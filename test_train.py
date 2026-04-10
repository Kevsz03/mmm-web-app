import requests

url = "http://localhost:8000/train_base_models"
data = {
  "date_col": "Date",
  "target_col": "Sales",
  "media_config": [{"name": "TV", "activity_col": "TV_Impressions", "spend_col": "TV_Spend"}],
  "control_cols": [],
  "ridge_alpha": 1.0,
  "ridge_alphas": [0.0, 0.1, 0.2]
}

response = requests.post(url, json=data)
print(response.json())
