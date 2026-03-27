import pandas as pd
from datetime import datetime

def parse_date(date_str):
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y%m%d', '%d-%m-%Y'):
        try:
            return datetime.strptime(str(date_str), fmt)
        except ValueError:
            pass
    return pd.to_datetime(date_str) # Fallback to pandas
