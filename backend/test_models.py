
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

print("Testing RecursiveLS...")
mmm_rls = MMMBuilder()
mmm_rls.load_data(df, 'date', 'sales', media_config)
mmm_rls.optimize_hyperparameters(n_trials=5)
mmm_rls.build_model(model_type='RecursiveLS')
diag_rls = mmm_rls.get_diagnostics()
print("RecursiveLS Diagnostics:", diag_rls)

print("\nTesting pydlm...")
mmm_pydlm = MMMBuilder()
mmm_pydlm.load_data(df, 'date', 'sales', media_config)
# Reuse best params from RLS to save time/mock optimization
mmm_pydlm.best_params = mmm_rls.best_params
mmm_pydlm.build_model(model_type='pydlm')
diag_pydlm = mmm_pydlm.get_diagnostics()
print("pydlm Diagnostics:", diag_pydlm)

decomp_pydlm = mmm_pydlm.get_decomposition()
print("pydlm Decomposition head:\n", decomp_pydlm.head())
