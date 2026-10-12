import { getRoutes, geocodeRoute, validPoint } from './routeService.mjs';
import { normalizeRoutePath } from './routePaths.mjs';

const reply = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });

export async function routeApi(event) {
  const path = normalizeRoutePath(event.rawPath);
  const method = event.requestContext?.http?.method;
  if (!['/api/routes', '/api/route-geocode', '/api/route-air-quality'].includes(path)) return null;
  try {
    if (path === '/api/routes' && method === 'POST') {
      let input;
      try { input = JSON.parse(event.body || '{}'); } catch { return reply(400, { success: false, error: 'Invalid request body.' }); }
      if (!validPoint(input?.origin) || !validPoint(input?.destination) || !['walk', 'run', 'cycle'].includes(input?.mode)) return reply(400, { success: false, error: 'Valid origin, destination and travel mode are required.' });
      return reply(200, await getRoutes(input));
    }
    if (path === '/api/route-geocode' && method === 'GET') {
      const q = event.queryStringParameters?.q || '';
      if (q.trim().length < 2 || q.length > 200) return reply(400, { success: false, error: 'Enter a place name or address.' });
      return reply(200, await geocodeRoute(q));
    }
    if (path === '/api/route-air-quality' && method === 'GET') {
      const params = event.queryStringParameters || {};
      const lat = params.lat?.trim() ? Number(params.lat) : NaN;
      const lon = params.lon?.trim() ? Number(params.lon) : NaN;
      if (!validPoint({ lat, lon })) return reply(400, { success: false, error: 'Valid latitude and longitude are required.' });
      const upstream = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,us_aqi&timezone=GMT&timeformat=unixtime`, { signal: AbortSignal.timeout(10000) });
      if (!upstream.ok) throw new Error('Air-quality provider is temporarily unavailable.');
      const data = await upstream.json();
      return reply(200, { success: true, source: 'Open-Meteo modeled grid', current: data.current || null });
    }
    return reply(405, { success: false, error: 'Method not allowed.' });
  } catch (error) {
    return reply(502, { success: false, error: error?.message || 'Routing is temporarily unavailable.' });
  }
}
