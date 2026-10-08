import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2, MapPin, Radio, RefreshCw } from 'lucide-react';
import { fetchAqicnAirQuality } from '../services/aqicnApi';
import { AqicnAirQuality } from '../types/aqicn';
import { LocationInfo, MicroWeather } from '../types/environmental';
import { getAqiCategory } from '../services/openMeteoApi';

interface Props {
  location: LocationInfo;
  weather?: MicroWeather;
  personaName?: string;
}

const labels: Record<string, string> = {
  pm25: 'PM2.5', pm10: 'PM10', no2: 'NO₂', so2: 'SO₂', co: 'CO', o3: 'O₃',
};

export const AqicnLivePanel: React.FC<Props> = ({ location, weather, personaName = 'General' }) => {
  const [data, setData] = useState<AqicnAirQuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    fetchAqicnAirQuality(location, controller.signal)
      .then(setData)
      .catch((reason) => { if (reason.name !== 'AbortError') { setData(null); setError(reason.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [location.latitude, location.longitude, reloadKey]);

  const category = getAqiCategory(data?.aqi ?? 0);
  const pm25Forecast = useMemo(() => data?.forecast.filter((item) => item.pollutant === 'pm25' && item.averageIndex !== null) || [], [data]);
  const advisor = useMemo(() => {
    const aqi = data?.aqi;
    const hour = now.getHours();
    const period = hour < 6 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    const isDaylight = hour >= 7 && hour < 18;
    const wind = weather?.windSpeed ?? 0;

    if (aqi === null || aqi === undefined) {
      return {
        headline: `Waiting for live air data for this ${period}`,
        summary: 'Advice will update automatically as soon as the selected AQICN station responds.',
        actions: ['Keep this page open for the live station result.', 'Use normal symptom precautions meanwhile.', 'Refresh the station if data remains unavailable.'],
      };
    }
    if (aqi <= 50) {
      return {
        headline: `Good air for ${period} activity`,
        summary: `AQI ${aqi} is in the ${category.label.toLowerCase()} range. ${wind >= 8 ? 'Steady wind is helping disperse pollutants.' : 'Conditions are suitable for most people.'}`,
        actions: [`Outdoor exercise is suitable for the ${personaName.toLowerCase()} profile.`, isDaylight ? 'Use sun protection and check UV before a long session.' : 'Choose a well-lit route and keep normal visibility precautions.', 'Natural ventilation is reasonable while AQI remains below 50.'],
      };
    }
    if (aqi <= 100) {
      return {
        headline: `Use a measured pace this ${period}`,
        summary: `Live AQI is ${aqi}. Most people can continue normal activity, while sensitive lungs should watch for irritation.`,
        actions: ['Prefer light-to-moderate outdoor activity over intense cardio.', `For ${personaName.toLowerCase()} needs, shorten exposure if coughing or tightness begins.`, wind < 6 ? 'Low wind may allow pollution to build; recheck before opening windows.' : 'Air movement is helping; ventilate briefly if indoor air feels stale.'],
      };
    }
    if (aqi <= 200) {
      return {
        headline: `Reduce exposure during the ${period}`, 
        summary: `AQI ${aqi} is elevated. Prolonged or vigorous outdoor exertion can increase inhaled pollutant dose.`,
        actions: ['Move strenuous exercise indoors or shorten it substantially.', 'Keep windows closed during traffic peaks and run filtration if available.', `The ${personaName.toLowerCase()} profile should carry prescribed medication and stop if symptoms appear.`],
      };
    }
    return {
      headline: `Avoid outdoor exertion this ${period}`,
      summary: `AQI ${aqi} indicates unhealthy air. Limiting inhalation is the priority until the station reports improvement.`,
      actions: ['Postpone jogging, cycling, and other strenuous outdoor activity.', 'Close windows and use a well-fitted mask outdoors when travel is essential.', 'Sensitive users should follow their clinician-approved action plan if symptoms develop.'],
    };
  }, [category.label, data?.aqi, now, personaName, weather?.windSpeed]);

  return (
    <section className="w-full px-margin-mobile md:px-margin pb-space-xl" aria-live="polite">
      <div className="bg-surface-container-lowest border border-primary rounded-2xl shadow-[6px_6px_0_#10162f] overflow-hidden">
        <div className="p-5 md:p-7 border-b border-primary flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="font-label-caps uppercase text-primary flex items-center gap-2"><Radio className="w-4 h-4" /> Official AQICN live feed</span>
            <h2 className="font-headline-lg text-headline-lg mt-1">Verified station air quality</h2>
            <p className="font-label-md mt-1">Requested location: {location.name}{location.country ? `, ${location.country}` : ''}</p>
            <p className="text-sm text-on-surface-variant mt-1">Individual pollutants below are AQI indices, not µg/m³ or concentration measurements.</p>
          </div>
          <button onClick={() => setReloadKey((value) => value + 1)} disabled={loading} className="px-4 py-2 border border-primary rounded flex items-center gap-2 font-label-md disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh live data</button>
        </div>

        {loading && <div className="p-10 flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /><span>Loading current AQICN station data…</span></div>}
        {!loading && error && <div className="p-7 text-error flex items-start gap-3"><AlertCircle className="w-5 h-5 shrink-0" /><div><strong>Live data unavailable</strong><p className="text-sm mt-1">{error}</p></div></div>}
        {!loading && data && (
          <div className="p-5 md:p-7">
            <div className="grid lg:grid-cols-[0.7fr_1.3fr] gap-6">
              <div className="p-5 bg-primary text-white rounded-xl">
                <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-secondary" /> {data.station.name}</div>
                <div className="flex items-end gap-3 mt-5"><span className="text-6xl font-bold tabular-nums">{data.aqi ?? '—'}</span><span className="pb-2 font-label-caps">Overall AQI</span></div>
                <div className="mt-3 inline-flex px-3 py-1 rounded bg-white text-primary text-sm font-semibold" style={{ borderLeft: `7px solid ${category.color}` }}>{data.aqi === null ? 'Unavailable' : category.label}</div>
                <div className="mt-5 text-xs text-white/75">Observed: {data.observedAt ? new Date(data.observedAt).toLocaleString() : 'Timestamp unavailable'}</div>
                <div className="text-xs text-white/75 mt-1">Dominant pollutant: {data.dominantPollutant?.toUpperCase() || 'Unavailable'}</div>
                {data.station.url && <a href={data.station.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-secondary text-xs underline">Station details <ExternalLink className="w-3 h-3" /></a>}
              </div>
              <div>
                <h3 className="font-title-md">Individual pollutant AQI indices</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                  {Object.entries(data.pollutantIndices).map(([key, value]) => (
                    <div key={key} className="p-4 border border-primary rounded bg-surface-container-low">
                      <div className="font-label-caps text-on-surface-variant">{labels[key] || key}</div>
                      <div className="text-2xl font-bold mt-1 tabular-nums">{value ?? 'N/A'}</div>
                      <div className="text-[10px] font-label-caps mt-1">AQI index</div>
                    </div>
                  ))}
                </div>
                {pm25Forecast.length > 0 && <div className="mt-6"><h3 className="font-title-md">AQICN-provided PM2.5 forecast indices</h3><div className="mt-3 flex items-end gap-2 h-28 border-b border-primary">{pm25Forecast.map((item) => <div key={item.day} className="flex-1 flex flex-col items-center justify-end h-full"><span className="text-xs font-semibold">{item.averageIndex}</span><div className="w-full bg-tertiary mt-1" style={{ height: `${Math.max(8, Math.min(90, item.averageIndex || 0))}%` }} /><span className="text-[10px] mt-1">{item.day.slice(5)}</span></div>)}</div><p className="text-xs text-on-surface-variant mt-2">Shown only when returned by AQICN; no missing forecast values are synthesized.</p></div>}
              </div>
            </div>

            <div className="mt-7 pt-7 border-t border-primary/30 grid lg:grid-cols-[1.15fr_0.85fr] gap-6 items-stretch">
              <div className="rounded-xl bg-surface-container-low p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">thermostat</span>
                    <h3 className="font-title-md">Surface Atmospheric Mechanics</h3>
                  </div>
                  <span className="font-label-caps text-xs bg-surface-container px-2 py-1 rounded">Live weather · ground model</span>
                </div>
                {weather ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                    {[
                      ['☀️', 'Temp', `${Math.round(weather.temperature)}°C`, `Feels ~${Math.round(weather.temperature + 2)}°C`],
                      ['💧', 'Humidity', `${Math.round(weather.humidity)}%`, weather.humidity > 75 ? 'High moisture' : 'Comfort range'],
                      ['💨', 'Wind', `${Math.round(weather.windSpeed)} km/h`, weather.windSpeed < 6 ? 'Low dispersion' : 'Active dispersion'],
                      ['☁️', 'Cloud', `${Math.round(weather.cloudCover)}%`, weather.weatherDescription],
                      ['☀️', 'UV', `${weather.uvIndex}`, weather.uvIndex >= 6 ? 'Protection advised' : 'Lower exposure'],
                      ['🪟', 'Venting', (data.aqi ?? 999) > 100 ? 'Close' : 'Open', (data.aqi ?? 999) > 100 ? 'Keep filtered' : 'Brief ventilation is suitable'],
                    ].map(([icon, label, value, note]) => (
                      <div key={label} className="bg-surface-container-lowest border border-primary/20 rounded-lg p-3 min-h-28">
                        <div className="flex items-center justify-between gap-2 text-xs font-label-caps text-on-surface-variant"><span>{icon}</span><span>{label}</span></div>
                        <div className="text-2xl font-bold mt-2 tabular-nums">{value}</div>
                        <div className="text-xs text-on-surface-variant mt-1">{note}</div>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-4 text-sm text-on-surface-variant">Weather telemetry is loading…</p>}
              </div>

              <aside className="rounded-xl bg-primary text-white p-5 flex flex-col" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-label-caps uppercase text-secondary">AI exposure advisor</span>
                  <span className="text-xs text-white/70">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <h3 className="text-2xl font-bold mt-3">{advisor.headline}</h3>
                <p className="text-sm text-white/75 mt-2">{advisor.summary}</p>
                <div className="mt-5 space-y-3">
                  {advisor.actions.map((action, index) => (
                    <div key={action} className="flex gap-3 bg-white/10 rounded-lg p-3">
                      <span className="w-6 h-6 rounded-full bg-secondary text-primary flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</span>
                      <p className="text-sm">{action}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-white/60 mt-auto pt-4">Updates automatically when AQI, selected profile, weather, or local time changes. General guidance—not a medical diagnosis.</p>
              </aside>
            </div>
            <div className="mt-6 pt-4 border-t border-primary/30 text-xs text-on-surface-variant flex flex-wrap gap-x-4 gap-y-1">
              <strong>Data: World Air Quality Index Project</strong>
              {data.attribution.map((item, index) => item.url ? <a key={`${item.name}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="underline">{item.name}</a> : <span key={`${item.name}-${index}`}>{item.name}</span>)}
              <span>Live display only; not cached or redistributed.</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
