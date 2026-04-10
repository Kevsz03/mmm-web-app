import pandas as pd
import numpy as np

dates = pd.date_range('2023-01-01', periods=50, freq='W')
df = pd.DataFrame({
    'Date': dates,
    'Sales': np.random.randint(1000, 5000, size=50),
    'TV_Impressions': np.random.randint(100, 500, size=50),
    'TV_Spend': np.random.randint(500, 2000, size=50),
})
df.to_csv('test_data.csv', index=False)
