export async function handler(event = {}) {
  const action = event.action || 'fetch-aqi';
  const latitude = Number(event.latitude ?? 28.7041);
  const longitude = Number(event.longitude ?? 77.1025);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Valid coordinates are required.');
  if (action === 'fetch-aqi') {
    const url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude='+latitude+'&longitude='+longitude+'&current=us_aqi,pm2_5,pm10&timezone=GMT&timeformat=unixtime';
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('AQI provider returned '+response.status);
    const payload = await response.json();
    return { ...event, latitude, longitude, current: payload.current || null, source: 'Open-Meteo modeled grid' };
  }
  if (action === 'recommendation') {
    const aqi = Number(event.current?.us_aqi ?? event.aqi ?? 0);
    const level = aqi >= 201 ? 'avoid' : aqi >= 151 ? 'high' : aqi >= 101 ? 'moderate' : 'lower';
    return { ...event, aqi, level, message: level === 'avoid' ? 'Move activity indoors.' : level === 'high' ? 'Reduce duration and intensity.' : level === 'moderate' ? 'Prefer a shorter session.' : 'Conditions are comparatively favorable.' };
  }
  throw new Error('Unknown AQI workflow action: '+action);
}
