
import pandas as pd
import numpy as np
from app.mmm_engine import MMMBuilder

# Create dummy data
dates = pd.date_range(start='2023-01-01', periods=50, freq='W')
df = pd.DataFrame({
    'date': dates,
    'sales': np.random.rand(50) * 1000 + 5000,
    'tv_spend': np.random.rand(50) * 1000,
    'tv_imp': np.random.rand(50) * 10000,
    'radio_spend': np.random.rand(50) * 500,
    'radio_imp': np.random.rand(50) * 5000
})

media_config = [
    {'name': 'TV', 'activity_col': 'tv_imp', 'spend_col': 'tv_spend'},
    {'name': 'Radio', 'activity_col': 'radio_imp', 'spend_col': 'radio_spend'}
]

print("Testing Variations Optimization...")
mmm = MMMBuilder()
mmm.load_data(df, 'date', 'sales', media_config)

for method in ['Linear', 'Ridge', 'RandomForest']:
    print(f"\nOptimization with {method}:")
    mmm.optimize_hyperparameters(n_trials=5, method=method)
    print(f"Best params ({method}):", mmm.best_params)
    mmm.build_model(model_type='RecursiveLS')
    diag = mmm.get_diagnostics()
    print(f"Diagnostics ({method}):", diag)
