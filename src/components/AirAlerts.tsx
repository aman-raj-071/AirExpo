import React, { useEffect, useRef, useState } from 'react';
import { checkSmsAlert, sendSmsTest, smsRequest, type SmsStatus } from '../services/smsApi';

export function AirAlerts({ aqi, threshold, setThreshold, location, browserAlertsEnabled, onBrowserAlertsChange }: { aqi: number | null; threshold: number; setThreshold: (n:number)=>void; location: {latitude:number;longitude:number;name:string}; browserAlertsEnabled:boolean; onBrowserAlertsChange:(enabled:boolean)=>void }) {
  const enabled=browserAlertsEnabled;
  const [status,setStatus]=useState('');
  const [sms,setSms]=useState<SmsStatus|null>(null);
  const [smsEnabled,setSmsEnabled]=useState(false);
  const [sliderThreshold,setSliderThreshold]=useState(threshold);
  const [isLoadingSms, setIsLoadingSms] = useState(true);
  const last=useRef(0);
  const isSliding=useRef(false);
  const sliderTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const latestThreshold=useRef(threshold);

  useEffect(()=>{ latestThreshold.current=threshold; },[threshold]);

  useEffect(()=>{
    if (!isSliding.current) setSliderThreshold(threshold);
  },[threshold]);
  
  useEffect(() => {
    let mounted = true;
    
    const check = async () => {
      try {
        const data = await smsRequest();
        if (mounted) {
          setSms(data);
          setSmsEnabled(data.enabled);
          setIsLoadingSms(false);
        }
      } catch (e) {
        if (mounted) {
          setSms({
            configured: false,
            enabled: false,
            threshold,
            message: e instanceof Error ? e.message : 'SMS is unavailable.'
          });
          setIsLoadingSms(false);
        }
      }
    };
    
    void check(); // Initial check
    const refreshSms = () => { void check(); };
    window.addEventListener('airexpo-profile-updated', refreshSms);
    const timer = setInterval(() => void check(), 5 * 60 * 1000); // Refresh configuration every 5 minutes.
    
    return () => {
      mounted = false;
      window.removeEventListener('airexpo-profile-updated', refreshSms);
      clearInterval(timer);
      if (sliderTimer.current) clearTimeout(sliderTimer.current);
    };
  }, []);
  
  useEffect(()=>{
    if (!enabled || aqi===null || aqi<threshold || !('Notification' in window) || Notification.permission!=='granted' || Date.now()-last.current<3600000) return;
    try {new Notification('AirExpo AQI alert',{body:`${location.name}: U.S. AQI ${aqi} exceeds your threshold ${threshold}. Recheck conditions before going outdoors.`,tag:'airexpo-aqi'});last.current=Date.now();}catch {setStatus('This browser cannot display notifications. Try a supported desktop browser.');}
  },[enabled,aqi,threshold,location.name]);
  useEffect(() => {
    if (!smsEnabled) return;
    let active = true;
    const check = () => void checkSmsAlert().then(data => { if (active) setStatus(data.message); }).catch(error => { if (active) setStatus(error.message); });
    check();
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [smsEnabled, sms?.threshold]);
  async function toggleNotifications(){
    if(enabled){onBrowserAlertsChange(false);setStatus('Browser alerts disabled.');return;}
    if(!('Notification' in window) || !window.isSecureContext){setStatus('Browser notifications require a supported browser and HTTPS (or localhost).');return;}
    const permission=await Notification.requestPermission();
    onBrowserAlertsChange(permission==='granted');
    setStatus(permission==='granted'?'Browser alerts enabled while this site is open.':'Notifications were not allowed. Enable them in browser site settings to retry.');
  }
  async function saveSms(enabledValue:boolean){
    try {
      const selectedThreshold=latestThreshold.current;
      const data=await smsRequest({enabled:enabledValue,threshold:selectedThreshold,lat:location.latitude,lon:location.longitude,label:location.name});
      setSms(data);
      setSmsEnabled(data.enabled);
      setStatus(enabledValue
        ? `SMS alerts enabled. You will receive a text when AQI exceeds ${selectedThreshold} at ${location.name}.`
        : 'SMS alerts disabled.');
    }
    catch(e){setStatus(e instanceof Error?e.message:'SMS update failed.');}
  }

  function updateSlider(value:number){
    isSliding.current=true;
    latestThreshold.current=value;
    setSliderThreshold(value);
    if (sliderTimer.current) clearTimeout(sliderTimer.current);
    sliderTimer.current=setTimeout(()=>{
      commitSlider();
    },400);
  }

  function commitSlider(){
    if (!isSliding.current) return;
    if (sliderTimer.current) clearTimeout(sliderTimer.current);
    sliderTimer.current=null;
    isSliding.current=false;
    setSliderThreshold(latestThreshold.current);
    setThreshold(latestThreshold.current);
    if (smsEnabled) void saveSms(true);
  }
  
  // Only show "Checking..." on first load, then show cached status
  const smsStatusMessage = isLoadingSms ? 'Checking SNS configuration…' : (sms?.message || 'SMS configuration unavailable.');
  
  return <div id="alerts-section" className="lg:col-span-5 bg-surface-container-lowest p-space-lg rounded-2xl border border-primary flex flex-col gap-4">
    <div><span className="font-label-caps uppercase">Air quality alerts</span><h3 className="font-headline-md text-headline-md">Stay informed about your air</h3><p className="text-sm mt-2">Alerts use current modeled AQI. Browser alerts check while the site is open; SMS monitoring availability is shown below.</p></div>
    <label className="bg-surface-container-low p-4">Alert threshold <strong className="float-right">{sliderThreshold} AQI</strong><input aria-label="AQI alert threshold" type="range" min="50" max="350" step="10" value={sliderThreshold} onPointerDown={()=>{isSliding.current=true;}} onChange={e=>updateSlider(Number(e.target.value))} onPointerUp={commitSlider} onBlur={commitSlider} onKeyUp={e=>{if (['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)) updateSlider(Number(e.currentTarget.value));}} className="block w-full mt-3" /></label>
    <div className="border border-primary p-4"><div className="flex justify-between gap-3"><strong>Browser notifications</strong><button onClick={()=>void toggleNotifications()} className="underline">{enabled?'Disable':'Enable'}</button></div><p className="text-xs mt-2">{enabled?'Enabled · at most one alert per hour':'Off · requires browser permission'}</p></div>
    <div className="border border-primary p-4"><div className="flex justify-between gap-3"><strong>SMS · AWS SNS topic</strong><button disabled={!sms?.configured} onClick={()=>void saveSms(!smsEnabled)} className="underline disabled:opacity-40">{smsEnabled?'Disable':'Enable'}</button></div><p className="text-xs mt-2">{smsStatusMessage}</p><p className="text-xs mt-2">SMS goes only to the mobile number saved and verified in your Profile. AQI checks run while this dashboard is open, with a one-hour alert cooldown. Sandbox destinations must also be verified in AWS. SMS charges may apply.</p><button disabled={!sms?.configured} className="underline mt-3 disabled:opacity-40" onClick={()=>void sendSmsTest().then(data=>setStatus(data.message)).catch(e=>setStatus(e.message))}>Send SNS test message</button></div>
    <p role="status" className="text-sm">{status}</p>
  </div>;
}
