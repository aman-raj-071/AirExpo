import json
import pathlib
import joblib
import pandas as pd
import requests

def model_fn(model_dir):
    return joblib.load(pathlib.Path(model_dir) / "model.joblib")

def input_fn(request_body, content_type):
    if content_type != "application/json":
        raise ValueError("application/json is required")
    value = json.loads(request_body)
    lat, lon = float(value["latitude"]), float(value["longitude"])
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError("Invalid coordinates")
    return {"latitude": lat, "longitude": lon, "horizons": value.get("horizons", [1, 6, 12, 24])}

def predict_fn(value, artifact):
    response = requests.get(
        "https://air-quality-api.open-meteo.com/v1/air-quality",
        params={"latitude": value["latitude"], "longitude": value["longitude"], "hourly": "pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide,us_aqi", "forecast_days": 2, "timezone": "GMT"},
        timeout=30,
    )
    response.raise_for_status()
    frame = pd.DataFrame(response.json()["hourly"])
    frame["time"] = pd.to_datetime(frame["time"], utc=True)
    row = frame.dropna(subset=["us_aqi"]).iloc[-1].copy()
    row["hour"], row["dow"] = row["time"].hour, row["time"].dayofweek
    for lag in [1, 3, 6, 12, 24]: row[f"aqi_lag_{lag}"] = row["us_aqi"]
    row["aqi_roll_6"] = row["us_aqi"]
    forecasts = []
    for hours in value["horizons"]:
        entry = artifact["models"][str(int(hours))]
        features = pd.DataFrame([{key: row.get(key, 0) for key in entry["features"]}])
        predicted = max(0, min(500, float(entry["model"].predict(features)[0])))
        category = "Good" if predicted <= 50 else "Moderate" if predicted <= 100 else "Unhealthy for Sensitive Groups" if predicted <= 150 else "Unhealthy" if predicted <= 200 else "Very Unhealthy" if predicted <= 300 else "Hazardous"
        forecasts.append({"horizonHours": int(hours), "predictedAQI": round(predicted, 1), "category": category})
    return {"status": "success", "source": "sagemaker", "modelVersion": "aqi-joblib-v1", "aqiStandard": "US_EPA", "generatedAt": pd.Timestamp.now(tz="UTC").isoformat(), "location": {"latitude": value["latitude"], "longitude": value["longitude"]}, "forecasts": forecasts}

def output_fn(prediction, accept):
    return json.dumps(prediction), "application/json"
