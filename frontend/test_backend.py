import requests

url_upload = "http://localhost:8000/upload"
url_train = "http://localhost:8000/train_base_models"

with open('test_data.csv', 'rb') as f:
    files = {'file': f}
    r = requests.post(url_upload, files=files)
    print("Upload:", r.json())

data = {
  "date_col": "Date",
  "target_col": "Sales",
  "media_config": [{"name": "TV", "activity_col": "TV_Impressions", "spend_col": "TV_Spend"}],
  "control_cols": [],
  "ridge_alpha": 1.0,
  "ridge_alphas": [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
}

r2 = requests.post(url_train, json=data)
if r2.status_code != 200:
    print("Train Error:", r2.text)
else:
    print("Train Success")
    res = r2.json()
    ridge = res['models']['Ridge']
    print("Ridge Keys:", ridge.keys())
    print("Solutions Keys:", ridge.get('solutions', {}).keys())

