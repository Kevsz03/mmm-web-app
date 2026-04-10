from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pandas as pd
import io
import json
from .mmm_engine import MMMBuilder
import numpy as np
import os

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global store (not production safe, but good for demo)
mmm_model = MMMBuilder()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def to_native(obj):
    try:
        if isinstance(obj, dict):
            return {k: to_native(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [to_native(v) for v in obj]
        if isinstance(obj, np.generic):
            return obj.item()
        # pandas Timestamp or datetime-like
        if hasattr(obj, "isoformat"):
            try:
                return obj.isoformat()
            except:
                return str(obj)
        return obj
    except Exception:
        return str(obj)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    fname = file.filename.strip().lower()
    if not fname.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Formato de archivo inválido. Usa .csv, .xlsx o .xls")
    
    contents = await file.read()
    try:
        if fname.endswith('.csv'):
            try:
                df = pd.read_csv(io.BytesIO(contents))
            except Exception:
                try:
                    df = pd.read_csv(io.StringIO(contents.decode('utf-8')), engine='python')
                except Exception:
                    df = pd.read_csv(io.StringIO(contents.decode('latin-1')), engine='python')
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Archivo no legible: {str(e)}")
    
    # Save to temp file to reload later if needed
    file_path = os.path.join(UPLOAD_DIR, "current_data.csv")
    df.to_csv(file_path, index=False)
    
    # Initialize model with data just to inspect columns
    mmm_model.data = df
    
    return {"columns": df.columns.tolist(), "filename": file.filename, "rows": len(df)}

@app.get("/columns")
async def get_columns():
    if mmm_model.data is None:
         # Try loading from disk
         file_path = os.path.join(UPLOAD_DIR, "current_data.csv")
         if os.path.exists(file_path):
             mmm_model.data = pd.read_csv(file_path)
         else:
             raise HTTPException(status_code=400, detail="No data uploaded")
    return {"columns": mmm_model.data.columns.tolist()}

@app.get("/data/preview")
async def get_data_preview(limit: int = 50):
    if mmm_model.data is None:
        file_path = os.path.join(UPLOAD_DIR, "current_data.csv")
        if os.path.exists(file_path):
             # Ensure dates are parsed
             try:
                mmm_model.data = pd.read_csv(file_path, parse_dates=True)
             except:
                try:
                    mmm_model.data = pd.read_csv(file_path)
                except:
                    return {"columns": [], "data": []}
        else:
             return {"columns": [], "data": []}
    
    # Fill NaN for JSON serialization
    df_preview = mmm_model.data.head(limit).fillna("")
    
    # Convert dates to string for JSON
    for col in df_preview.columns:
        if pd.api.types.is_datetime64_any_dtype(df_preview[col]):
            df_preview[col] = df_preview[col].dt.strftime('%Y-%m-%d')
            
    return {
        "columns": df_preview.columns.tolist(),
        "data": df_preview.to_dict(orient="records"),
        "total_rows": len(mmm_model.data)
    }


@app.post("/priors")
async def get_priors(config: dict):
    if mmm_model.data is None:
        file_path = os.path.join(UPLOAD_DIR, "current_data.csv")
        if os.path.exists(file_path):
            mmm_model.data = pd.read_csv(file_path)
        else:
            raise HTTPException(status_code=400, detail="No data uploaded")
            
    mmm_model.load_data(
        mmm_model.data,
        date_col=config['date_col'],
        target_col=config['target_col'],
        media_config=config['media_config'],
        control_cols=config.get('control_cols', [])
    )
    
    priors = mmm_model.calculate_initial_priors()
    return {"priors": priors}

@app.post("/train_base_models")
async def train_base_models(config: dict):
    if mmm_model.data is None:
        file_path = os.path.join(UPLOAD_DIR, "current_data.csv")
        if os.path.exists(file_path):
            mmm_model.data = pd.read_csv(file_path)
        else:
            raise HTTPException(status_code=400, detail="No data uploaded")

    try:
        mmm_model.load_data(
            mmm_model.data,
            date_col=config['date_col'],
            target_col=config['target_col'],
            media_config=config['media_config'],
            control_cols=config.get('control_cols', [])
        )
        
        ridge_alpha = config.get('ridge_alpha', 1.0)
        ridge_alphas = config.get('ridge_alphas', None)
        
        global base_model_variations
        base_model_variations = {}
        
        methods = ['Linear', 'Ridge', 'RandomForest']
        
        for method in methods:
            print(f"Training base model: {method}...")
            if method == 'Ridge' and ridge_alphas and isinstance(ridge_alphas, list) and len(ridge_alphas) > 0:
                solutions = {}
                default_alpha = float(ridge_alphas[0])
                for a in ridge_alphas:
                    a_val = float(a)
                    mmm_model.optimize_hyperparameters(n_trials=20, method=method, ridge_alpha=a_val)
                    stats = mmm_model.build_base_model(method=method, ridge_alpha=a_val)
                    solutions[a_val] = {
                        "stats": stats,
                        "best_params": mmm_model.best_params.copy(),
                        "method": method,
                        "ridge_alpha": a_val
                    }
                # Provide a default top-level view using first alpha for backward compatibility
                base_model_variations[method] = {
                    "stats": solutions[default_alpha]["stats"],
                    "best_params": solutions[default_alpha]["best_params"],
                    "method": method,
                    "ridge_alpha": default_alpha,
                    "solutions": solutions
                }
            else:
                mmm_model.optimize_hyperparameters(n_trials=20, method=method, ridge_alpha=ridge_alpha)
                stats = mmm_model.build_base_model(method=method, ridge_alpha=ridge_alpha)
                base_model_variations[method] = {
                    "stats": stats,
                    "best_params": mmm_model.best_params.copy(),
                    "method": method,
                    "ridge_alpha": ridge_alpha if method == 'Ridge' else None
                }
        
        return {"status": "success", "models": base_model_variations}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train_dlm")
async def train_dlm(config: dict):
    if mmm_model.data is None:
        file_path = os.path.join(UPLOAD_DIR, "current_data.csv")
        if os.path.exists(file_path):
            mmm_model.data = pd.read_csv(file_path)
        else:
            raise HTTPException(status_code=400, detail="No data uploaded")

    model_type = config.get('model_type', 'pydlm')

    try:
        mmm_model.load_data(
            mmm_model.data,
            date_col=config['date_col'],
            target_col=config['target_col'],
            media_config=config['media_config'],
            control_cols=config.get('control_cols', [])
        )
        
        user_priors = config.get('priors', None)
        best_params = config.get('best_params', None)
        
        # If best_params provided from the base model, apply them
        if best_params:
            mmm_model.best_params = best_params
        else:
            # Fallback to Ridge if not provided
            mmm_model.optimize_hyperparameters(n_trials=10, method='Ridge')

        print(f"Training final DLM model...")
        
        # Build final DLM model using the optimized params
        mmm_model.build_model(model_type=model_type, user_priors=user_priors)
        
        # Store results
        diagnostics = mmm_model.get_diagnostics()
        decomposition = mmm_model.get_decomposition()
        roi = mmm_model.roi_metrics
        channel_stats = mmm_model.channel_stats
        
        # Format decomposition
        decomposition_dict = decomposition.reset_index().to_dict(orient='records')
        # Handle dates
        for row in decomposition_dict:
            val = row.get(mmm_model.date_col)
            if isinstance(val, (pd.Timestamp, pd.DatetimeIndex)):
                row[mmm_model.date_col] = val.isoformat()
            elif hasattr(val, 'isoformat'):
                row[mmm_model.date_col] = val.isoformat()
        
        # Saturation curves
        saturation_curves = {}
        for media in mmm_model.media_config:
            name = media['name']
            alpha = mmm_model.best_params[f"{name}_alpha"]
            gamma = mmm_model.best_params[f"{name}_gamma"]
            
            decay = mmm_model.best_params[f"{name}_decay"]
            adstock = mmm_model.adstock_transform(mmm_model.data[media['activity_col']], decay)
            
            x_vals = np.linspace(0, adstock.max() * 1.2, 100)
            y_vals = (x_vals**alpha) / (x_vals**alpha + gamma**alpha)
            
            saturation_curves[name] = [{"x": float(x), "y": float(y)} for x, y in zip(x_vals, y_vals)]

        # Adstock data and best params sanitization
        adstock_data = mmm_model.get_adstock_data()
        for row in adstock_data:
            val = row.get(mmm_model.date_col)
            if hasattr(val, 'isoformat'):
                row[mmm_model.date_col] = val.isoformat()
        best_params_native = {k: float(v) if isinstance(v, (int, float, np.generic)) else v for k, v in mmm_model.best_params.items()}

        global dlm_results
        dlm_results = {
            "diagnostics": to_native(diagnostics),
            "decomposition": to_native(decomposition_dict),
            "roi": to_native(roi),
            "channel_stats": to_native(channel_stats),
            "best_params": to_native(best_params_native),
            "saturation_curves": to_native(saturation_curves),
            "optimization_method": "DLM",
            "adstock_data": to_native(adstock_data)
        }
        
        return {"status": "success", "message": "DLM trained successfully"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/results")
async def get_results():
    global dlm_results
    if not dlm_results:
        raise HTTPException(status_code=400, detail="Model not trained yet")
    return dlm_results

@app.post("/predict")
async def predict_scenario(payload: dict):
    global model_variations
    method = payload.get('method', 'Ridge')
    scenario = payload.get('scenario', {})
    periods = int(payload.get('periods', 4))

    if not model_variations or method not in model_variations:
        raise HTTPException(status_code=400, detail="Model not trained yet")

    var_data = model_variations[method]
    best_params = var_data['best_params']
    channel_stats = var_data.get('channel_stats', [])
    decomposition = var_data['decomposition']

    # 1. Calculate Base Sales (Average of last 4 periods from historical decomposition)
    last_n = min(4, len(decomposition))
    if last_n == 0:
        recent_base = 0
    else:
        recent_base = sum([row.get('Base (Trend)', 0) + row.get('Seasonality', 0) for row in decomposition[-last_n:]]) / last_n
    
    total_base_sales = recent_base * periods

    # 2. Calculate Incremental Sales per channel using Steady-State formulas
    predictions = []
    total_incremental = 0
    total_spend = 0

    for stat in channel_stats:
        canal = stat['canal']
        beta = stat['beta']
        spend_per_period = float(scenario.get(canal, 0.0))
        
        decay = best_params.get(f"{canal}_decay", 0.0)
        alpha = best_params.get(f"{canal}_alpha", 1.0)
        gamma = best_params.get(f"{canal}_gamma", 1.0)

        # Steady state adstock: Ass = Spend / (1 - decay)
        adstock_ss = spend_per_period / (1 - decay) if decay < 1 else spend_per_period
        
        # Hill transform
        if adstock_ss == 0:
            x_sat = 0
        else:
            x_sat = (adstock_ss**alpha) / (adstock_ss**alpha + gamma**alpha)
        
        contrib_per_period = beta * x_sat
        total_contrib = contrib_per_period * periods
        total_channel_spend = spend_per_period * periods

        predictions.append({
            "canal": canal,
            "spend": total_channel_spend,
            "contribution": total_contrib,
            "roi": total_contrib / total_channel_spend if total_channel_spend > 0 else 0
        })
        total_incremental += total_contrib
        total_spend += total_channel_spend

    return {
        "base_sales": total_base_sales,
        "incremental_sales": total_incremental,
        "total_sales": total_base_sales + total_incremental,
        "total_spend": total_spend,
        "overall_roi": total_incremental / total_spend if total_spend > 0 else 0,
        "channel_predictions": predictions
    }

@app.post("/optimize_budget")
async def optimize_budget(payload: dict):
    if not mmm_model or not hasattr(mmm_model, 'best_params') or not mmm_model.best_params:
        raise HTTPException(status_code=400, detail="Model not trained yet")
        
    try:
        total_budget = float(payload.get('total_budget', 10000))
        periods = int(payload.get('periods', 4))
        bounds_payload = payload.get('bounds', {}) # e.g. {"TV": [-0.2, 0.5]}
        
        channel_bounds = {}
        for canal, bounds in bounds_payload.items():
            if isinstance(bounds, list) and len(bounds) == 2:
                channel_bounds[canal] = (float(bounds[0]), float(bounds[1]))
                
        result = mmm_model.optimize_budget(
            total_budget=total_budget,
            channel_bounds=channel_bounds,
            periods=periods
        )
        
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Initialize global variables
base_model_variations = {}
dlm_results = {}

@app.get("/export")
async def export_results():
    if mmm_model.decomposition is None:
        raise HTTPException(status_code=400, detail="Model not trained yet")
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        mmm_model.decomposition.to_excel(writer, sheet_name='Decomposition')
        pd.DataFrame([mmm_model.best_params]).to_excel(writer, sheet_name='Parameters')
        pd.DataFrame(mmm_model.roi_metrics).T.to_excel(writer, sheet_name='ROI')
        pd.DataFrame([mmm_model.get_diagnostics()]).to_excel(writer, sheet_name='Diagnostics')
        
    output.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="mmm_results.xlsx"'
    }
    return FileResponse(path=output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename="mmm_results.xlsx")

import numpy as np # Ensure np is available for saturation curves
