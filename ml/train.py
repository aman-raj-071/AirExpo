"""Train chronological multi-horizon AQI regressors; no fabricated values."""
import argparse, pathlib, joblib, pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error,mean_squared_error,r2_score
def train(csv,out):
 d=pd.read_csv(csv,parse_dates=['time']).sort_values('time'); d['hour']=d.time.dt.hour;d['dow']=d.time.dt.dayofweek
 for lag in [1,3,6,12,24]:d[f'aqi_lag_{lag}']=d.us_aqi.shift(lag)
 d['aqi_roll_6']=d.us_aqi.shift(1).rolling(6).mean();d=d.dropna().reset_index(drop=True)
 features=[c for c in d.columns if c not in ['time','us_aqi']]; models={};metrics={}; split=int(len(d)*.8)
 for h in [1,6,12,24]:
  target=d.us_aqi.shift(-h); valid=target.notna(); X=d.loc[valid,features];y=target[valid]; cut=min(split,len(X)-1); model=HistGradientBoostingRegressor(max_iter=250,random_state=42).fit(X.iloc[:cut],y.iloc[:cut]); pred=model.predict(X.iloc[cut:]);metrics[str(h)]={'mae':float(mean_absolute_error(y.iloc[cut:],pred)),'rmse':float(mean_squared_error(y.iloc[cut:],pred)**.5),'r2':float(r2_score(y.iloc[cut:],pred))};models[str(h)]={'model':model,'features':features}
 pathlib.Path(out).parent.mkdir(parents=True,exist_ok=True);joblib.dump({'models':models,'metrics':metrics,'standard':'US_EPA'},out);print(metrics)
if __name__=='__main__':p=argparse.ArgumentParser();p.add_argument('--csv',default='ml/data/aqi.csv');p.add_argument('--out',default='ml/model.joblib');a=p.parse_args();train(a.csv,a.out)
