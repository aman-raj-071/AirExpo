import React, { useEffect, useMemo, useState } from 'react';
import { CloudSun, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { EnvironmentalStationData, LocationInfo } from '../types/environmental';

interface Props {
  location: LocationInfo;
  data: EnvironmentalStationData | null;
  loading: boolean;
  personaName?: string;
  onRefresh: () => void;
}

export const OpenMeteoLivePanel: React.FC<Props> = ({
  location,
  data,
  loading,
  personaName = 'General',
  onRefresh,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [selectedBand, setSelectedBand] = useState<string | null>(null);
  const [selectedWeather, setSelectedWeather] = useState<string | null>(null);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const advisor = useMemo(() => {
    const aqi = data?.currentAqi;
    const hour = now.getHours();
    const period = hour < 6 ? 'late night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    if (aqi === undefined) return { title: 'Waiting for live conditions', body: 'Advice will update when Open‑Meteo responds.', actions: ['Keep this page open.', 'Refresh if loading continues.', 'Use your usual health precautions.'] };
    if (aqi <= 50) return { title: `Good air for ${period} activity`, body: `U.S. AQI ${aqi} is low for the selected coordinates.`, actions: ['Normal outdoor activity is suitable.', 'Ventilate while the reading remains low.', 'Check UV before prolonged daylight activity.'] };
    if (aqi <= 100) return { title: `Use a measured pace this ${period}`, body: `U.S. AQI ${aqi} is moderate; unusually sensitive people may notice symptoms.`, actions: ['Prefer moderate rather than intense outdoor exercise.', `For the ${personaName.toLowerCase()} profile, shorten activity if irritation begins.`, (data?.weather.windSpeed ?? 0) < 6 ? 'Low wind may allow pollutants to accumulate.' : 'Wind is supporting pollutant dispersion.'] };
    if (aqi <= 150) return { title: `Sensitive users should reduce exposure`, body: `U.S. AQI ${aqi} is unhealthy for sensitive groups.`, actions: ['Shorten strenuous outdoor sessions.', 'Keep rescue medication available if prescribed.', 'Recheck the next hourly forecast before going out.'] };
    return { title: `Avoid strenuous outdoor activity this ${period}`, body: `U.S. AQI ${aqi} is unhealthy; reducing inhaled dose is the priority.`, actions: ['Move exercise indoors.', 'Keep windows closed and use filtration if available.', 'Follow clinician-approved guidance if symptoms develop.'] };
  }, [data, now, personaName]);

  const forecast = data?.hourlyTimeline.slice(0, 24) ?? [];
  const pollutants = data ? Object.values(data.pollutants) : [];
  const pm25 = data?.pollutants.pm2_5;
  const pm10 = data?.pollutants.pm10;

  return (
    <section className="w-full px-margin-mobile md:px-margin pb-space-xl" aria-live="polite">
      <div className="space-y-6">
        <header className="hidden">
          <div>
            <span className="font-label-caps uppercase text-primary flex items-center gap-2"><CloudSun className="w-4 h-4" /> Open‑Meteo live model feed</span>
            <h2 className="font-headline-lg text-headline-lg mt-1">Coordinate-specific air quality & weather</h2>
            <p className="font-label-md mt-1">{location.name}, {location.country} · {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°</p>
            <p className="text-sm text-on-surface-variant mt-1">Overall and pollutant indices use the U.S. AQI scale. Concentrations retain the units supplied by Open‑Meteo.</p>
          </div>
          <button onClick={onRefresh} disabled={loading} className="px-4 py-2 border border-primary rounded flex items-center gap-2 font-label-md disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Open‑Meteo</button>
        </header>

        {loading && !data && <div className="p-10 flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /> Fetching current air and weather data…</div>}
        {data && (
          <div>
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#fff5f7] via-[#f8c8d3] to-[#e9557c] px-6 py-7 md:px-10 md:py-9 text-[#262636] shadow-sm">
              <div className="absolute inset-x-0 bottom-0 h-28 opacity-10 bg-[linear-gradient(90deg,transparent_4%,#7f3652_5%,transparent_12%,#7f3652_13%,#7f3652_17%,transparent_18%,#7f3652_25%,transparent_26%,#7f3652_34%,transparent_35%,#7f3652_47%,transparent_48%,#7f3652_64%,transparent_65%,#7f3652_80%,transparent_81%)]" />
              <div className="relative grid lg:grid-cols-[minmax(0,1.15fr)_150px_minmax(300px,0.95fr)] gap-7 items-center">
                <div>
                  <div className="grid sm:grid-cols-[1fr_0.9fr] gap-5 items-start">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold"><span className="h-3.5 w-3.5 rounded-full bg-[#ea5638]" /> Live AQI</div>
                      <div className="flex items-end gap-2 mt-1"><span className="text-[72px] md:text-[86px] leading-none font-bold text-[#eb4d73] tabular-nums">{data.currentAqi}</span><span className="pb-2 text-sm text-[#865b68]">AQI (US)</span></div>
                    </div>
                    <div className="text-center sm:text-left pt-3">
                      <p className="text-sm font-semibold mb-2">Air Quality is</p>
                      <div className="inline-flex px-7 py-3 rounded-lg bg-white/25 text-2xl md:text-3xl font-bold text-[#eb4d73]">{data.aqiCategory.label}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5 mt-7 max-w-xl">
                    <p className="text-lg text-[#5d6670]"><strong>PM2.5 :</strong> <span className="text-[#202638] font-semibold">{pm25?.value ?? '—'}</span> <span className="text-xs font-semibold">{pm25?.unit}</span></p>
                    <p className="text-lg text-[#5d6670]"><strong>PM10 :</strong> <span className="text-[#202638] font-semibold">{pm10?.value ?? '—'}</span> <span className="text-xs font-semibold">{pm10?.unit}</span></p>
                  </div>

                  <div className="mt-7 max-w-[450px]">
                    <div className="grid grid-cols-6 text-xs sm:text-sm text-center mb-1">{['Good','Moderate','Poor','Unhealthy','Severe','Hazardous'].map((band) => <button type="button" key={band} onClick={() => setSelectedBand(band)} className="rounded px-1 py-1 hover:bg-white/35 focus:outline-none focus:ring-2 focus:ring-white/70 transition">{band}</button>)}</div>
                    <div className="relative flex h-1.5 overflow-visible rounded-full">
                      {['#39bd42','#d4ca32','#ef9d43','#ec505f','#d53054','#ad1631'].map((color) => <span key={color} className="flex-1" style={{ backgroundColor: color }} />)}
                      <span className="absolute -top-1.5 h-4 w-4 rounded-full border-4 border-white shadow" style={{ left: `calc(${Math.min(100, data.currentAqi / 3)}% - 8px)`, backgroundColor: data.aqiCategory.color }} />
                    </div>
                    <div className="grid grid-cols-7 text-xs sm:text-sm text-[#66515a] mt-2"><span>0</span><span>50</span><span>100</span><span>150</span><span>200</span><span>300</span><span className="text-right">301+</span></div>
                    {selectedBand && <button type="button" onClick={() => setSelectedBand(null)} className="mt-2 text-xs bg-white/45 rounded-full px-3 py-1 hover:bg-white/65">{selectedBand} range selected · click to close</button>}
                  </div>
                </div>

                <button type="button" onClick={() => setAvatarSpeaking((value) => !value)} className="relative flex self-center lg:self-end lg:-mb-9 h-[190px] lg:h-[230px] items-end justify-center rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/80 group" aria-label="Show avatar air-quality advice">
                  {avatarSpeaking && <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-48 rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold shadow-lg z-10">{advisor.title}. {advisor.actions[0]}</span>}
                  <img src="/assets/masked-air-avatar.png" alt="Masked AirExpo health avatar" className="h-[205px] lg:h-[245px] w-auto object-contain drop-shadow-xl transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-105" />
                </button>

                <div className="flex items-center justify-center lg:justify-end">
                  <div className="relative w-full rounded-[1.4rem] border border-white/70 bg-white/25 backdrop-blur-sm overflow-hidden shadow-sm">
                    <button onClick={onRefresh} disabled={loading} title="Refresh Open‑Meteo" className="absolute right-4 top-4 w-10 h-10 rounded-full bg-white/70 flex items-center justify-center disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
                    <div className="px-7 py-7 flex items-center gap-6 border-b border-white/60">
                      <span className="text-5xl">{now.getHours() >= 18 || now.getHours() < 6 ? '🌙' : '☀️'}</span>
                      <span className="text-4xl font-semibold tabular-nums">{data.weather.temperature}<small className="text-lg ml-1">°C</small></span>
                      <span className="text-lg">{data.weather.weatherDescription.replace('Troposphere','').trim()}</span>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-[#c6909e] px-4 py-4">
                      <button type="button" onClick={() => setSelectedWeather('Humidity reflects moisture in the air.')} className="px-3 text-left hover:bg-white/20 rounded transition"><p className="text-sm">💧 Humidity</p><strong className="text-sm">{data.weather.humidity} %</strong></button>
                      <button type="button" onClick={() => setSelectedWeather('Wind controls how quickly pollutants disperse.')} className="px-3 text-left hover:bg-white/20 rounded transition"><p className="text-sm">🌬 Wind Speed</p><strong className="text-sm">{data.weather.windSpeed} km/h</strong></button>
                      <button type="button" onClick={() => setSelectedWeather('UV exposure changes throughout the day.')} className="px-3 text-left hover:bg-white/20 rounded transition"><p className="text-sm">☀ UV Index</p><strong className="text-sm">{data.weather.uvIndex}</strong></button>
                    </div>
                    {selectedWeather && <button type="button" onClick={() => setSelectedWeather(null)} className="w-full border-t border-white/50 bg-white/20 px-5 py-2 text-left text-xs hover:bg-white/35">{selectedWeather} · click to close</button>}
                  </div>
                </div>
              </div>
              <div className="relative mt-5 text-xs text-[#6b4652]">{location.name}, {location.country} · Open‑Meteo/CAMS · Updated {data.lastUpdated}</div>
            </div>

            <div className="mt-6 bg-surface-container-lowest border border-primary rounded-2xl p-5 md:p-7 shadow-sm">
              <h3 className="font-title-md">Current pollutant concentrations</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">{pollutants.map((pollutant) => <div key={pollutant.code} className="p-4 border border-primary rounded bg-surface-container-low"><div className="font-label-caps text-on-surface-variant">{pollutant.name}</div><div className="text-2xl font-bold mt-1 tabular-nums">{pollutant.value}</div><div className="text-[10px] font-label-caps mt-1">{pollutant.unit}</div></div>)}</div>
              {forecast.length > 0 && <div className="mt-6"><h3 className="font-title-md">Open‑Meteo hourly U.S. AQI forecast</h3><div className="mt-3 flex items-end gap-1.5 h-28 border-b border-primary">{forecast.map((item) => <div key={item.time} className="flex-1 flex flex-col items-center justify-end h-full min-w-3" title={`${item.formattedTime}: AQI ${item.aqi}`}><div className="w-full bg-tertiary" style={{ height: `${Math.max(6, Math.min(100, item.aqi / 2))}%` }} /></div>)}</div><div className="flex justify-between text-[10px] mt-1"><span>{forecast[0]?.formattedTime}</span><span>Next 24 hours</span><span>{forecast.at(-1)?.formattedTime}</span></div></div>}
            </div>

            <div className="mt-7">
              <div className="hidden">
                <h3 className="font-title-md flex items-center gap-2"><CloudSun className="w-5 h-5 text-primary" /> Current Open‑Meteo weather</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  {[
                    ['Temperature', `${data.weather.temperature}°C`, data.weather.weatherDescription],
                    ['Humidity', `${data.weather.humidity}%`, 'Relative humidity at 2 m'],
                    ['Wind', `${data.weather.windSpeed} km/h`, `${data.weather.windDirection}° direction`],
                    ['Pressure', `${data.weather.surfacePressure} hPa`, 'Surface pressure'],
                    ['Cloud cover', `${data.weather.cloudCover}%`, 'Total cloud cover'],
                    ['UV index', `${data.weather.uvIndex}`, data.weather.uvIndex >= 6 ? 'Protection advised' : 'Lower exposure'],
                  ].map(([label, value, note]) => <div key={label} className="bg-surface-container-lowest border border-primary/20 rounded-lg p-3"><div className="text-xs font-label-caps text-on-surface-variant">{label}</div><div className="text-2xl font-bold mt-2 tabular-nums">{value}</div><div className="text-xs text-on-surface-variant mt-1">{note}</div></div>)}
                </div>
              </div>
              <aside className="rounded-2xl bg-primary text-white p-5 md:p-7 flex flex-col shadow-sm">
                <div className="flex items-center justify-between gap-3"><span className="font-label-caps uppercase text-secondary flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI exposure advisor</span><span className="text-xs text-white/70">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                <h3 className="text-2xl font-bold mt-3">{advisor.title}</h3><p className="text-sm text-white/75 mt-2">{advisor.body}</p>
                <div className="mt-5 space-y-3">{advisor.actions.map((action, index) => <div key={action} className="flex gap-3 bg-white/10 rounded-lg p-3"><span className="w-6 h-6 rounded-full bg-secondary text-primary flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</span><p className="text-sm">{action}</p></div>)}</div>
                <p className="text-[11px] text-white/60 mt-auto pt-4">Updates with location, AQI, weather, profile and time. General guidance—not a medical diagnosis.</p>
              </aside>
            </div>

            <footer className="mt-6 pt-4 border-t border-primary/30 text-xs text-on-surface-variant flex flex-wrap gap-x-4 gap-y-1">
              <strong>Weather data: Open‑Meteo</strong><span>Air-quality model data: Copernicus Atmosphere Monitoring Service (CAMS)</span><span>Global air-quality grid resolution is approximately 45 km.</span>
            </footer>
          </div>
        )}
      </div>
    </section>
  );
};
