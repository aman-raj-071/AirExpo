# AirExpo AQI forecasting

The existing Express server exposes `GET /api/aqi/predict?latitude=28.7&longitude=77.1`. `AQI_INFERENCE_PROVIDER=local` runs the Python joblib model; `AQI_INFERENCE_PROVIDER=sagemaker` invokes the configured SageMaker endpoint. The React app never calls SageMaker directly.

Historical data comes from Open-Meteo hourly pollutant observations. Features include lagged AQI values, six-hour rolling AQI, hour of day, day of week, PM2.5, PM10, ozone, nitrogen dioxide, carbon monoxide, and sulphur dioxide. Models forecast 1, 6, 12, and 24 hours using chronological splits and US EPA AQI.
