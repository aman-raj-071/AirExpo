import json,sys,pathlib,joblib,requests,pandas as pd
def main():
 r=json.load(sys.stdin); lat,lon=float(r['latitude']),float(r['longitude']); horizons=r.get('horizons',[1,6,12,24]); model_path=pathlib.Path('ml/model.joblib')
 if not model_path.exists(): raise RuntimeError('Train ml/model.joblib before local inference.')
 payload=requests.get('https://air-quality-api.open-meteo.com/v1/air-quality',params={'latitude':lat,'longitude':lon,'hourly':'pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide,us_aqi','forecast_days':2,'timezone':'GMT'},timeout=30).json(); h=pd.DataFrame(payload['hourly']); h['time']=pd.to_datetime(h.time,utc=True); row=h.dropna(subset=['us_aqi']).iloc[-1].copy(); row['hour']=row.time.hour;row['dow']=row.time.dayofweek
 for lag in [1,3,6,12,24]:row[f'aqi_lag_{lag}']=row.us_aqi;row['aqi_roll_6']=row.us_aqi; forecasts=[]
 for hours in horizons:
  m=joblib.load(model_path)['models'][str(hours)]; x=pd.DataFrame([{k:row.get(k,0) for k in m['features']}]); value=max(0,min(500,float(m['model'].predict(x)[0]))); forecasts.append({'horizonHours':hours,'timestamp':(pd.Timestamp.now(tz='UTC')+pd.Timedelta(hours=hours)).isoformat(),'predictedAQI':round(value,1),'category':'Good' if value<=50 else 'Moderate' if value<=100 else 'Unhealthy for Sensitive Groups' if value<=150 else 'Unhealthy' if value<=200 else 'Very Unhealthy' if value<=300 else 'Hazardous'})
 print(json.dumps({'status':'success','source':'local','modelVersion':'local-joblib-v1','aqiStandard':'US_EPA','generatedAt':pd.Timestamp.now(tz='UTC').isoformat(),'location':{'latitude':lat,'longitude':lon},'forecasts':forecasts}))
if __name__=='__main__':main()
