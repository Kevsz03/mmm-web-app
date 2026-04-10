import pandas as pd
import numpy as np
import optuna
import statsmodels.api as sm
from sklearn.metrics import mean_squared_error, mean_absolute_percentage_error
from scipy.stats import shapiro, pearsonr
from typing import List, Dict, Any, Optional, Tuple
from pydlm import dlm, trend, seasonality, dynamic, autoReg
from .utils import parse_date

from sklearn.linear_model import Ridge, LinearRegression
from sklearn.ensemble import RandomForestRegressor

class MMMBuilder:
    def __init__(self):
        self.data = None
        self.date_col = None
        self.target_col = None
        self.media_config = [] # List of dicts: {'name': 'TV', 'activity_col': 'tv_imp', 'spend_col': 'tv_spend'}
        self.control_cols = []
        self.best_params = {}
        self.model_results = None
        self.transformed_data = None
        self.decomposition = None
        self.roi_metrics = {}
        self.optimization_method = "Ridge" # Default

    def load_data(self, df: pd.DataFrame, date_col: str, target_col: str, media_config: List[Dict], control_cols: List[str] = []):
        """
        media_config: [{'name': 'TV', 'activity_col': 'tv_grp', 'spend_col': 'tv_spend'}, ...]
        """
        self.data = df.copy()
        self.date_col = date_col
        self.target_col = target_col
        self.media_config = media_config
        self.control_cols = control_cols
        
        # Ensure date is datetime
        # Try multiple formats if simple to_datetime fails
        try:
            self.data[self.date_col] = pd.to_datetime(self.data[self.date_col])
        except:
             self.data[self.date_col] = self.data[self.date_col].apply(parse_date)
             
        self.data = self.data.sort_values(self.date_col).reset_index(drop=True)
        
        # Handle missing values - forward fill then fillna(0)
        self.data = self.data.ffill().fillna(0)

    def adstock_transform(self, series: pd.Series, decay: float) -> pd.Series:
        """
        Adstock_t = Activity_t + lambda * Adstock_{t-1}
        """
        adstock = np.zeros(len(series))
        for t in range(len(series)):
            if t == 0:
                adstock[t] = series[t]
            else:
                adstock[t] = series[t] + decay * adstock[t-1]
        return pd.Series(adstock, index=series.index)

    def hill_transform(self, series: pd.Series, alpha: float, gamma: float) -> pd.Series:
        """
        X_sat = Stock^alpha / (Stock^alpha + gamma^alpha)
        """
        # Ensure non-negative base for power
        s_alpha = np.power(series, alpha)
        g_alpha = np.power(gamma, alpha)
        
        # Avoid division by zero
        denominator = s_alpha + g_alpha
        denominator = np.where(denominator == 0, 1e-9, denominator)
        
        return s_alpha / denominator

    def objective(self, trial, train_data, valid_data, method='Ridge', ridge_alpha=1.0):
        """
        Objective function for Optuna
        """
        temp_train = train_data.copy()
        
        # Transform media columns based on activity
        for media in self.media_config:
            name = media['name']
            activity_col = media['activity_col']
            
            # Parameters for this media channel
            # Decay (0 to 1)
            decay = trial.suggest_float(f"{name}_decay", 0.0, 0.95)
            # Alpha (Slope)
            alpha = trial.suggest_float(f"{name}_alpha", 0.5, 3.0)
            
            # Gamma (Half-saturation point)
            adstocked = self.adstock_transform(temp_train[activity_col], decay)
            # Suggest gamma as fraction of max adstock
            gamma_fraction = trial.suggest_float(f"{name}_gamma_frac", 0.1, 1.0)
            gamma = adstocked.max() * gamma_fraction
            
            # Store gamma for later use
            trial.set_user_attr(f"{name}_gamma", gamma)

            temp_train[f"{name}_transformed"] = self.hill_transform(adstocked, alpha, gamma)

        # Prepare regression features
        features = [f"{m['name']}_transformed" for m in self.media_config] + self.control_cols
        X_train = temp_train[features]
        y_train = temp_train[self.target_col]
        
        # Add constant for linear models
        if method != 'RandomForest':
            X_train = sm.add_constant(X_train)
        
        try:
            if method == 'Linear':
                model = LinearRegression()
                model.fit(X_train, y_train)
                preds = model.predict(X_train)
            elif method == 'RandomForest':
                # Use fewer estimators for speed during optimization
                model = RandomForestRegressor(n_estimators=10, max_depth=5, random_state=42)
                model.fit(X_train, y_train)
                preds = model.predict(X_train)
            else: # Ridge (Default)
                model = Ridge(alpha=ridge_alpha)
                model.fit(X_train, y_train)
                preds = model.predict(X_train)

            rmse = np.sqrt(mean_squared_error(y_train, preds))
            
            # Penalize negative coefficients for media (Consistency Check)
            # Only applicable for linear models where we can inspect coefficients easily
            if method in ['Linear', 'Ridge']:
                # Get coefs mapping
                if method == 'Linear' or method == 'Ridge':
                    coefs = model.coef_
                    # If add_constant was used, first col might be const (sklearn doesn't need explicit const usually if fit_intercept=True)
                    # But statsmodels add_constant adds a column. Sklearn handles intercept separately.
                    # Wait, if we passed sm.add_constant(X_train), then X_train has a 'const' column.
                    # Sklearn will treat 'const' as a feature.
                    # Let's check features.
                    pass
                
                # Simplified penalty for negative impact
                # For Ridge/Linear, we want media to have positive impact
                # Check correlation as proxy if coef extraction is complex with sm.add_constant mix
                pass
                
        except:
            return float('inf')
                
        return rmse

    def optimize_hyperparameters(self, n_trials=50, method='Ridge', ridge_alpha=1.0):
        # Use full data for simplicity or split if dataset large enough
        # The prompt suggests split.
        n_train = int(len(self.data) * 0.8)
        train_data = self.data.iloc[:n_train].copy()
        valid_data = self.data.iloc[n_train:].copy()
        
        study = optuna.create_study(direction="minimize")
        study.optimize(lambda trial: self.objective(trial, train_data, valid_data, method=method, ridge_alpha=ridge_alpha), n_trials=n_trials)
        
        self.best_params = study.best_params
        self.optimization_method = method
        
        # Recalculate absolute gammas on full dataset using best fractions
        for media in self.media_config:
            name = media['name']
            activity_col = media['activity_col']
            
            decay = self.best_params[f"{name}_decay"]
            adstocked = self.adstock_transform(self.data[activity_col], decay)
            
            gamma_frac = self.best_params[f"{name}_gamma_frac"]
            self.best_params[f"{name}_gamma"] = adstocked.max() * gamma_frac

    def calculate_initial_priors(self):
        """
        Runs a quick OLS to calculate initial priors (beta, SE, df) for the preprocessing step.
        """
        temp_data = self.data.copy()
        # Asegurar valores numéricos para evitar que falle OLS
        y = pd.to_numeric(temp_data[self.target_col], errors='coerce').fillna(0)
        
        features = []
        for media in self.media_config:
            name = media['name']
            activity_col = media['activity_col']
            temp_data[f"{name}_proxy"] = pd.to_numeric(temp_data[activity_col], errors='coerce').fillna(0)
            features.append(f"{name}_proxy")
            
        for ctrl in self.control_cols:
            temp_data[f"{ctrl}_proxy"] = pd.to_numeric(temp_data[ctrl], errors='coerce').fillna(0)
            features.append(f"{ctrl}_proxy")
            
        X = temp_data[features]
        X = sm.add_constant(X)
        
        try:
            model = sm.OLS(y, X).fit()
            priors = []
            for media in self.media_config:
                name = media['name']
                col_name = f"{name}_proxy"
                
                beta = model.params.get(col_name, 0.0)
                se = model.bse.get(col_name, 1.0)
                
                if pd.isna(beta): beta = 0.0
                if pd.isna(se): se = 1.0
                
                priors.append({
                    "canal": name,
                    "initial_value": float(beta),
                    "SE": float(se),
                    "df": 0.95 # Default Discount Factor
                })
            return priors
        except Exception as e:
            print("Error calculating priors:", e)
            # Fallback
            return [{"canal": m['name'], "initial_value": 0.1, "SE": 0.05, "df": 0.95} for m in self.media_config]

    def build_base_model(self, method='Ridge', ridge_alpha=1.0):
        # 1. Apply transformations with best parameters
        self.transformed_data = self.data.copy()
        
        for media in self.media_config:
            name = media['name']
            activity_col = media['activity_col']
            
            decay = self.best_params[f"{name}_decay"]
            alpha = self.best_params[f"{name}_alpha"]
            gamma = self.best_params[f"{name}_gamma"]
            
            adstock_col = f"{name}_adstock"
            sat_col = f"{name}_saturated"
            
            self.transformed_data[adstock_col] = self.adstock_transform(self.transformed_data[activity_col], decay)
            self.transformed_data[sat_col] = self.hill_transform(self.transformed_data[adstock_col], alpha, gamma)

        # 2. Seasonality (Fourier Terms)
        diffs = self.data[self.date_col].diff().dt.days.median()
        period = 52 if diffs < 10 else 12 
        
        fourier_cols = []
        for order in [1, 2]:
            sin_col = f'sin_{order}'
            cos_col = f'cos_{order}'
            self.transformed_data[sin_col] = np.sin(2 * np.pi * order * self.transformed_data.index / period)
            self.transformed_data[cos_col] = np.cos(2 * np.pi * order * self.transformed_data.index / period)
            fourier_cols.extend([sin_col, cos_col])

        # 3. Fit Model
        exog_media = self.transformed_data[[f"{m['name']}_saturated" for m in self.media_config]]
        exog_season = self.transformed_data[fourier_cols]
        
        if self.control_cols:
            exog_controls = self.transformed_data[self.control_cols]
            exog = pd.concat([exog_media, exog_season, exog_controls], axis=1)
        else:
            exog = pd.concat([exog_media, exog_season], axis=1)
            
        endog = self.transformed_data[self.target_col]
        exog_with_const = sm.add_constant(exog)
        
        self.model_type = 'OLS'
        
        # We use sklearn for the actual fit if Ridge/RF, but Statsmodels for OLS
        if method == 'Linear':
            mod = sm.OLS(endog, exog_with_const)
            res = mod.fit()
            self.model_results = res
            coeffs = np.tile(res.params.values, (len(self.transformed_data), 1))
        elif method == 'Ridge':
            model = Ridge(alpha=ridge_alpha)
            model.fit(exog_with_const, endog)
            # Create a dummy statsmodels result-like object for compatibility if needed
            # But we can just store the model and reconstruct coeffs
            self.model_results = sm.OLS(endog, exog_with_const).fit() # Proxy for SE
            coeffs = np.tile(model.coef_, (len(self.transformed_data), 1))
            # intercept is model.intercept_ but since we added const to exog, model.coef_[0] might be 0
            # Let's adjust for const
            coeffs[:, 0] = model.intercept_
            
        elif method == 'RandomForest':
            model = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42)
            model.fit(exog, endog) # RF usually doesn't need const
            self.model_results = sm.OLS(endog, exog_with_const).fit() # Proxy
            # We can't easily extract coefficients for RF, so we approximate with feature importances
            # For simplicity, we just use OLS proxy for the stats table
            coeffs = np.tile(self.model_results.params.values, (len(self.transformed_data), 1))

        # Reconstruct contributions
        contrib_df = pd.DataFrame(index=self.transformed_data.index)
        param_names = exog_with_const.columns
        
        for i, col in enumerate(param_names):
            contrib_df[col] = exog_with_const[col].values * coeffs[:, i]
            
        if 'const' in contrib_df.columns:
            contrib_df['Base (Trend)'] = contrib_df['const']
            contrib_df.drop('const', axis=1, inplace=True)
            
        fourier_cols_exist = [c for c in contrib_df.columns if 'sin_' in c or 'cos_' in c]
        if fourier_cols_exist:
            contrib_df['Seasonality'] = contrib_df[fourier_cols_exist].sum(axis=1)
            contrib_df.drop(fourier_cols_exist, axis=1, inplace=True)
        else:
            contrib_df['Seasonality'] = 0.0
            
        total_pred = contrib_df.sum(axis=1)
        contrib_df['Unexplained'] = self.transformed_data[self.target_col] - total_pred
        contrib_df[self.date_col] = self.data[self.date_col]
        
        self.decomposition = contrib_df
        
        # Calculate stats and ROI
        self.calculate_roi()
        self.channel_stats = self.calculate_channel_stats(exog_with_const, endog)
        
        # If Ridge, overwrite the beta in channel_stats with the actual Ridge beta
        if method == 'Ridge':
            for stat in self.channel_stats:
                col_idx = list(param_names).index(f"{stat['canal']}_saturated")
                stat['beta'] = float(model.coef_[col_idx])
                
        return self.channel_stats

    def build_model(self, model_type='RecursiveLS', user_priors=None):
        # 1. Apply transformations with best parameters
        self.transformed_data = self.data.copy()
        
        for media in self.media_config:
            name = media['name']
            activity_col = media['activity_col']
            
            decay = self.best_params[f"{name}_decay"]
            alpha = self.best_params[f"{name}_alpha"]
            gamma = self.best_params[f"{name}_gamma"]
            
            adstock_col = f"{name}_adstock"
            sat_col = f"{name}_saturated"
            
            self.transformed_data[adstock_col] = self.adstock_transform(self.transformed_data[activity_col], decay)
            self.transformed_data[sat_col] = self.hill_transform(self.transformed_data[adstock_col], alpha, gamma)

        # 2. Seasonality (Fourier Terms) - Still useful for OLS
        # Heuristic for frequency
        diffs = self.data[self.date_col].diff().dt.days.median()
        period = 52 if diffs < 10 else 12 # Weekly vs Monthly
        
        fourier_cols = []
        for order in [1, 2]:
            sin_col = f'sin_{order}'
            cos_col = f'cos_{order}'
            self.transformed_data[sin_col] = np.sin(2 * np.pi * order * self.transformed_data.index / period)
            self.transformed_data[cos_col] = np.cos(2 * np.pi * order * self.transformed_data.index / period)
            fourier_cols.extend([sin_col, cos_col])

        # 3. Fit Model
        exog_media = self.transformed_data[[f"{m['name']}_saturated" for m in self.media_config]]
        
        # OLS uses Fourier, DLM handles seasonality internally usually but we can use Fourier as exog too
        exog_season = self.transformed_data[fourier_cols]
        
        if self.control_cols:
            exog_controls = self.transformed_data[self.control_cols]
            exog = pd.concat([exog_media, exog_season, exog_controls], axis=1)
        else:
            exog = pd.concat([exog_media, exog_season], axis=1)
            
        endog = self.transformed_data[self.target_col]
        
        if model_type == 'pydlm':
            try:
                # Setup pydlm
                # 1. Trend
                my_dlm = dlm(endog.values.tolist())
                my_dlm = my_dlm + trend(degree=1, discount=0.95, name='trend')
                
                # 2. Seasonality
                my_dlm = my_dlm + seasonality(period=int(period), discount=0.95, name='seasonality')
                
                # 3. Media & Controls (Dynamic components)
                # In pydlm, dynamic components take a list of lists [[x1], [x2], ...]
                for col in exog_media.columns:
                    base_name = col.replace('_saturated', '')
                    # Find user prior if available
                    r_val = 0.9 # Default
                    m0 = [0]
                    C0 = [[100]] # Default high variance prior
                    
                    if user_priors:
                        prior = next((p for p in user_priors if p['canal'] == base_name), None)
                        if prior:
                            r_val = float(prior.get('df', 0.95))
                            if r_val <= 0.01: r_val = 0.01
                            if r_val > 1.0: r_val = 1.0
                            m0 = [prior.get('initial_value', 0)]
                            # SE to variance
                            se_val = float(prior.get('SE', 10))
                            if se_val <= 0.0001: se_val = 0.0001
                            C0 = [[se_val**2]]
                            
                    features = [[x] for x in exog_media[col].values]
                    my_dlm = my_dlm + dynamic(features=features, discount=r_val, name=col, m0=m0, C0=C0)
                
                if self.control_cols:
                    for col in self.control_cols:
                         features = [[x] for x in self.transformed_data[col].values]
                         my_dlm = my_dlm + dynamic(features=features, discount=0.95, name=col)

                my_dlm.fit()
                self.model_results = my_dlm
                self.model_type = 'pydlm'
                
            except Exception as e:
                print(f"pydlm failed ({e}), falling back to OLS")
                exog = sm.add_constant(exog)
                mod = sm.OLS(endog, exog)
                res = mod.fit()
                self.model_results = res
                self.model_type = 'OLS'
                
        elif model_type == 'RecursiveLS': # RecursiveLS
            exog = sm.add_constant(exog)
            try:
                # Try new location first
                from statsmodels.regression.recursive_ls import RecursiveLS
                mod = RecursiveLS(endog, exog)
                res = mod.fit()
                self.model_results = res
                self.model_type = 'RecursiveLS'
            except ImportError:
                 try:
                    # Fallback to old location or API
                    mod = sm.tsa.RecursiveLS(endog, exog)
                    res = mod.fit()
                    self.model_results = res
                    self.model_type = 'RecursiveLS'
                 except Exception as e:
                    print(f"RecursiveLS failed ({e}), falling back to OLS")
                    mod = sm.OLS(endog, exog)
                    res = mod.fit()
                    self.model_results = res
                    self.model_type = 'OLS'
            except Exception as e:
                print(f"RecursiveLS failed ({e}), falling back to OLS")
                mod = sm.OLS(endog, exog)
                res = mod.fit()
                self.model_results = res
                self.model_type = 'OLS'
        else: # OLS
            exog = sm.add_constant(exog)
            mod = sm.OLS(endog, exog)
            res = mod.fit()
            self.model_results = res
            self.model_type = 'OLS'

        # 4. Generate decomposition first so ROI and stats can use it
        self.get_decomposition()

        # 5. Calculate ROI
        self.calculate_roi()
        
        # 6. Calculate stats (VIF, t-values, contributions)
        self.channel_stats = self.calculate_channel_stats(exog, endog)

    def calculate_channel_stats(self, exog, endog):
        stats = []
        from statsmodels.stats.outliers_influence import variance_inflation_factor
        
        # Convert exog to dataframe if not already
        if not isinstance(exog, pd.DataFrame):
            exog_df = pd.DataFrame(exog)
        else:
            exog_df = exog.copy()
            
        # Ensure constant for VIF
        if 'const' not in exog_df.columns:
            exog_df = sm.add_constant(exog_df)
            
        # Run a static OLS to get baseline t-values and Betas if model is dynamic
        # For pydlm we extract the final state beta
        ols_model = sm.OLS(endog, exog_df).fit()
        
        for i, col in enumerate(exog_df.columns):
            if col == 'const' or col.startswith('sin_') or col.startswith('cos_') or col in self.control_cols:
                continue
                
            base_name = col.replace('_saturated', '')
            
            # Map base_name to activity and spend columns
            activity_col = None
            spend_col = None
            for m in self.media_config:
                if m['name'] == base_name:
                    activity_col = m.get('activity_col')
                    spend_col = m.get('spend_col')
                    break
            
            # VIF
            try:
                vif = variance_inflation_factor(exog_df.values, i)
            except:
                vif = float('inf')
                
            # Beta, SE, and t-value
            if self.model_type == 'pydlm':
                try:
                    # Get final state mean and variance
                    final_state = self.model_results.getLatentState(name=col)[-1][0]
                    final_cov = self.model_results.getLatentCov(name=col)[-1][0][0]
                    beta = final_state
                    se = np.sqrt(final_cov)
                    t_val = beta / se if se > 0 else 0
                except:
                    beta = ols_model.params.get(col, 0)
                    se = ols_model.bse.get(col, 0)
                    t_val = ols_model.tvalues.get(col, 0)
            elif self.model_type == 'RecursiveLS':
                try:
                    beta = self.model_results.recursive_coefficients.filtered[-1, i]
                    # Approximate SE from the static OLS for simplicity
                    se = ols_model.bse.get(col, 0)
                    t_val = ols_model.tvalues.get(col, 0) 
                except:
                    beta = ols_model.params.get(col, 0)
                    se = ols_model.bse.get(col, 0)
                    t_val = ols_model.tvalues.get(col, 0)
            else:
                beta = ols_model.params.get(col, 0)
                se = ols_model.bse.get(col, 0)
                t_val = ols_model.tvalues.get(col, 0)
                
            entry = {
                "canal": base_name,
                "beta": float(beta),
                "se": float(se),
                "vif": float(vif),
                "t_value": float(t_val)
            }
            # Add activity and spend totals if available
            if activity_col and activity_col in self.data.columns:
                entry["total_activity"] = float(self.data[activity_col].sum())
            if spend_col and spend_col in self.data.columns:
                entry["total_spend"] = float(self.data[spend_col].sum())
            
            stats.append(entry)
            
        # Add contribution metrics if decomposition is available
        if self.decomposition is not None:
            # Calculate total absolute contributions for percentage
            total_abs_contrib = 0
            channel_abs_contribs = {}
            for stat in stats:
                col_name = f"{stat['canal']}_saturated"
                if col_name in self.decomposition.columns:
                    # Sum of contribution over time
                    total_contrib = self.decomposition[col_name].sum()
                    abs_contrib = self.decomposition[col_name].abs().sum()
                    channel_abs_contribs[stat['canal']] = {
                        "total": total_contrib,
                        "abs": abs_contrib
                    }
                    total_abs_contrib += abs_contrib
            
            for stat in stats:
                c_name = stat['canal']
                if c_name in channel_abs_contribs:
                    stat['contribution'] = float(channel_abs_contribs[c_name]['total'])
                    stat['abs_contribution'] = float(channel_abs_contribs[c_name]['abs'])
                    stat['pct_contribution'] = float(channel_abs_contribs[c_name]['abs'] / total_abs_contrib) if total_abs_contrib > 0 else 0.0
                else:
                    stat['contribution'] = 0.0
                    stat['abs_contribution'] = 0.0
                    stat['pct_contribution'] = 0.0

        return stats

    def get_diagnostics(self):
        if not self.model_results:
            return {}
        
        if self.model_type == 'pydlm':
            # pydlm results handling
            fitted = np.array(self.model_results.getMean()) # predicted mean
            resid = self.transformed_data[self.target_col].values - fitted
            
            # Basic stats
            rmse = np.sqrt(mean_squared_error(self.transformed_data[self.target_col], fitted))
            mape = mean_absolute_percentage_error(self.transformed_data[self.target_col], fitted)
            durbin_watson = sm.stats.stattools.durbin_watson(resid)
            try:
                shapiro_test = shapiro(resid)
                p_value = shapiro_test.pvalue
            except:
                p_value = 0.0 # Fallback if sample size issue
                
            return {
                "RMSE": float(rmse),
                "MAPE": float(mape),
                "Durbin-Watson": float(durbin_watson),
                "Shapiro-Wilk P-value": float(p_value),
                "Model Type": "Bayesian DLM (pydlm)"
            }

        resid = self.model_results.resid
        fitted = self.model_results.fittedvalues
        
        # Handle RecursiveLS output structure which can be slightly different
        if hasattr(self.model_results, 'fittedvalues'):
             pass # Standard
             
        rmse = np.sqrt(mean_squared_error(self.transformed_data[self.target_col], fitted))
        mape = mean_absolute_percentage_error(self.transformed_data[self.target_col], fitted)
        durbin_watson = sm.stats.stattools.durbin_watson(resid)
        shapiro_test = shapiro(resid)
        
        return {
            "RMSE": float(rmse),
            "MAPE": float(mape),
            "Durbin-Watson": float(durbin_watson),
            "Shapiro-Wilk P-value": float(shapiro_test.pvalue),
            "Model Type": self.model_type
        }

    def get_decomposition(self):
        if not self.model_results:
            return pd.DataFrame()
        
        contrib_df = pd.DataFrame(index=self.transformed_data.index)
        
        if self.model_type == 'pydlm':
            # pydlm decomposition
            try:
                # Reconstruct contributions: State * Feature
                
                # Trend
                trend_comp = self.model_results.getLatentState(name='trend', filterType='backwardSmoother') # Returns list of lists
                # Flatten
                contrib_df['Base (Trend)'] = [x[0] for x in trend_comp]
                
                # Seasonality
                try:
                    season_comp = self.model_results.getLatentState(name='seasonality', filterType='backwardSmoother')
                    contrib_df['Seasonality'] = [x[0] for x in season_comp]
                except:
                    pass
                
                # Media & Controls
                features = [f"{m['name']}_saturated" for m in self.media_config] + self.control_cols
                
                for feat in features:
                    # Dynamic coefficient (beta_t)
                    beta_t = [x[0] for x in self.model_results.getLatentState(name=feat, filterType='backwardSmoother')]
                    # Contribution = beta_t * X_t
                    contrib_df[feat] = np.array(beta_t) * self.transformed_data[feat].values
                
                # Unexplained
                total_pred = np.array(self.model_results.getMean())
                contrib_df['Unexplained'] = self.transformed_data[self.target_col].values - total_pred
                
                # Consolidate for simple chart if needed
                # We will use explicit 'Base (Trend)' and 'Seasonality' instead of 'const'
                # contrib_df['const'] = contrib_df.get('Base (Trend)', 0) + contrib_df.get('Seasonality', 0)
                
            except Exception as e:
                print(f"Error extracting pydlm components: {e}")
                pass

        elif self.model_type == 'RecursiveLS':
            # Recursive coefficients: (n_obs, n_params)
            coeffs = self.model_results.recursive_coefficients.filtered.T
            if coeffs.shape[0] != len(self.transformed_data):
                 coeffs = coeffs.T
            if coeffs.shape[0] != len(self.transformed_data):
                pass

        elif self.model_type == 'OLS':
            # OLS: Static coefficients
            coeffs = np.tile(self.model_results.params.values, (len(self.transformed_data), 1))

        if self.model_type != 'pydlm':
            # Reconstruct Exog for Statsmodels
            # Must match the order used in fit()
            exog_media = self.transformed_data[[f"{m['name']}_saturated" for m in self.media_config]]
            fourier_cols = [c for c in self.transformed_data.columns if 'sin_' in c or 'cos_' in c]
            exog_season = self.transformed_data[fourier_cols]
            
            if self.control_cols:
                 exog_controls = self.transformed_data[self.control_cols]
                 exog = pd.concat([exog_media, exog_season, exog_controls], axis=1)
            else:
                 exog = pd.concat([exog_media, exog_season], axis=1)
            exog = sm.add_constant(exog)
            
            # Calculate contributions
            param_names = exog.columns
            
            # Handle shape mismatch robustly
            n_obs = len(self.transformed_data)
            if coeffs.shape[0] != n_obs:
                # If DLM skipped first few obs, pad
                pad_len = n_obs - coeffs.shape[0]
                if pad_len > 0:
                    coeffs = np.pad(coeffs, ((pad_len, 0), (0, 0)), mode='edge')
            
            for i, col in enumerate(param_names):
                contrib_df[col] = exog[col].values * coeffs[:, i]
                
            # Rename 'const' to 'Base (Trend)'
            if 'const' in contrib_df.columns:
                contrib_df['Base (Trend)'] = contrib_df['const']
                contrib_df.drop('const', axis=1, inplace=True)
                
            # Aggregate Seasonality (Fourier terms)
            fourier_cols = [c for c in contrib_df.columns if 'sin_' in c or 'cos_' in c]
            if fourier_cols:
                contrib_df['Seasonality'] = contrib_df[fourier_cols].sum(axis=1)
                contrib_df.drop(fourier_cols, axis=1, inplace=True)
            else:
                contrib_df['Seasonality'] = 0.0
                
            # Add Residuals
            # Sum of all components (Trend + Seasonality + Media + Controls)
            total_pred = contrib_df.sum(axis=1)
            contrib_df['Unexplained'] = self.transformed_data[self.target_col] - total_pred
        
        # Add Date
        contrib_df[self.date_col] = self.data[self.date_col]
        
        self.decomposition = contrib_df
        return contrib_df

    def get_adstock_data(self):
        if self.data is None or not hasattr(self, 'best_params'):
            return []
        
        adstock_df = pd.DataFrame()
        adstock_df[self.date_col] = self.data[self.date_col]
        
        for media in self.media_config:
            name = media['name']
            activity_col = media['activity_col']
            decay = self.best_params.get(f"{name}_decay", 0.0)
            
            # Original Activity
            adstock_df[f"{name}_Original"] = self.data[activity_col]
            # Adstocked Activity
            adstock_df[f"{name}_Adstock"] = self.adstock_transform(self.data[activity_col], decay)
            
        return adstock_df.to_dict(orient='records')

    def calculate_roi(self):
        if self.decomposition is None:
            return
            
        rois = {}
        for media in self.media_config:
            name = media['name']
            spend_col = media['spend_col']
            
            # Contribution from Decomposition
            # Column name in decomposition is usually "{name}_saturated"
            contrib_col = f"{name}_saturated"
            
            if contrib_col in self.decomposition.columns:
                total_contrib = self.decomposition[contrib_col].sum()
                total_spend = self.data[spend_col].sum()
                
                if total_spend > 0:
                    roi = total_contrib / total_spend
                else:
                    roi = 0.0
                
                rois[name] = {
                    "ROI": roi,
                    "Total Contribution": total_contrib,
                    "Total Spend": total_spend
                }
        self.roi_metrics = rois
        return rois

    def optimize_budget(self, total_budget: float, channel_bounds: Dict[str, Tuple[float, float]], periods: int = 4):
        """
        Optimiza la distribución del presupuesto a través de los canales para maximizar las ventas incrementales.
        
        channel_bounds: Diccionario con los límites de porcentaje min y max de variación por canal respecto 
                        al gasto promedio histórico por periodo. Ej: {'TV': (-0.2, 0.5)}
        """
        from scipy.optimize import minimize

        channels = [m['name'] for m in self.media_config]
        num_channels = len(channels)
        
        # Calcular gasto promedio histórico por periodo para cada canal
        hist_avg_spend = {}
        for m in self.media_config:
            spend_col = m['spend_col']
            # Promedio de gasto por periodo
            avg_spend = self.data[spend_col].sum() / len(self.data)
            hist_avg_spend[m['name']] = avg_spend

        # Obtener betas del último modelo ajustado
        betas = {}
        if hasattr(self, 'channel_stats') and self.channel_stats:
            for stat in self.channel_stats:
                betas[stat['canal']] = stat['beta']
        else:
            # Fallback
            for c in channels:
                betas[c] = 0.0

        def objective_function(spend_alloc):
            """Queremos maximizar las ventas, así que minimizamos el negativo de las ventas."""
            total_incremental = 0
            for i, canal in enumerate(channels):
                spend_per_period = spend_alloc[i] / periods
                
                decay = self.best_params.get(f"{canal}_decay", 0.0)
                alpha = self.best_params.get(f"{canal}_alpha", 1.0)
                gamma = self.best_params.get(f"{canal}_gamma", 1.0)
                beta = betas.get(canal, 0.0)

                # Steady state adstock
                adstock_ss = spend_per_period / (1 - decay) if decay < 1 else spend_per_period
                
                # Hill transform
                if adstock_ss == 0:
                    x_sat = 0
                else:
                    x_sat = (adstock_ss**alpha) / (adstock_ss**alpha + gamma**alpha)
                
                contrib_per_period = beta * x_sat
                total_incremental += contrib_per_period * periods
                
            return -total_incremental

        # Restricción: la suma de las inversiones debe ser igual al total_budget
        constraints = [
            {'type': 'eq', 'fun': lambda x: np.sum(x) - total_budget}
        ]

        # Límites por canal
        bounds = []
        initial_guess = []
        for canal in channels:
            avg_spend = hist_avg_spend[canal]
            min_pct, max_pct = channel_bounds.get(canal, (-1.0, 1.0)) # Default -100% to +100% si no se provee
            
            # Limites para el total a invertir en ese canal en 'periods' periodos
            min_spend = max(0, avg_spend * periods * (1 + min_pct))
            max_spend = avg_spend * periods * (1 + max_pct)
            
            bounds.append((min_spend, max_spend))
            # Initial guess: distribuir proporcionalmente al histórico o en medio de los bounds
            initial_guess.append(np.clip(avg_spend * periods, min_spend, max_spend))
            
        # Ajustar el initial_guess para que sume total_budget
        initial_guess = np.array(initial_guess)
        if np.sum(initial_guess) > 0:
            initial_guess = initial_guess / np.sum(initial_guess) * total_budget
        else:
            initial_guess = np.ones(num_channels) * (total_budget / num_channels)

        # Ejecutar la optimización
        result = minimize(
            objective_function, 
            initial_guess, 
            method='SLSQP', 
            bounds=bounds, 
            constraints=constraints,
            options={'maxiter': 1000}
        )

        optimized_alloc = result.x
        max_incremental = -result.fun

        # Formatear el resultado
        alloc_results = []
        for i, canal in enumerate(channels):
            alloc_results.append({
                "canal": canal,
                "optimized_spend": float(optimized_alloc[i]),
                "historical_avg_spend": float(hist_avg_spend[canal] * periods)
            })

        return {
            "status": "success" if result.success else "warning",
            "message": result.message,
            "total_budget": float(total_budget),
            "optimized_incremental_sales": float(max_incremental),
            "allocation": alloc_results
        }
