# Model evaluation

Run `python ml/train.py --csv ml/data/aqi.csv --out ml/model.joblib`. The command prints MAE, RMSE, and R2 for every horizon using the final chronological 20% as test data. Metrics are generated from the downloaded dataset and must not be invented or copied into documentation.
