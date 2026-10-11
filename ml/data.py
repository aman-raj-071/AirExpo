"""Download real hourly Open-Meteo air-quality/weather history."""
import argparse, pathlib, requests, pandas as pd
def fetch(lat,lon,start,end,out):
    url='https://air-quality-api.open-meteo.com/v1/air-quality'
    params={'latitude':lat,'longitude':lon,'start_date':start,'end_date':end,'hourly':'pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide,us_aqi','timezone':'GMT'}
    data=requests.get(url,params=params,timeout=60); data.raise_for_status(); payload=data.json()
    frame=pd.DataFrame(payload.get('hourly',{})); frame['time']=pd.to_datetime(frame['time'],utc=True); frame=frame.drop_duplicates('time').sort_values('time').dropna(subset=['us_aqi'])
    pathlib.Path(out).parent.mkdir(parents=True,exist_ok=True); frame.to_csv(out,index=False); return frame
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--lat',type=float,required=True);p.add_argument('--lon',type=float,required=True);p.add_argument('--start',required=True);p.add_argument('--end',required=True);p.add_argument('--out',default='ml/data/aqi.csv');a=p.parse_args(); print(fetch(a.lat,a.lon,a.start,a.end,a.out).tail().to_string(index=False))
