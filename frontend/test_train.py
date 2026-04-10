import requests

url = "http://localhost:8000/train_base_models"
data = {
  "date_col": "Date",
  "target_col": "Sales",
  "media_config": [{"name": "TV", "activity_col": "TV_Impressions", "spend_col": "TV_Spend"}],
  "control_cols": [],
  "ridge_alpha": 1.0,
  "ridge_alphas": [0.1, 0.5, 1, 2, 5, 10]
}

try:
    response = requests.post(url, json=data)
    print("Status Code:", response.status_code)
    if response.status_code != 200:
        print(response.text)
except Exception as e:
    print("Error:", e)
