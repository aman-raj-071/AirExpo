import 'dotenv/config';
import express from 'express';
import { registerCodeExchange } from './codeExchange';
import { registerCloudStorage } from './cloudStorage';
import { registerSmsAlerts, startSmsMonitor, sendTestSms } from './smsAlerts';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import type { DiagnosticReport } from './src/types/environmental';
import { getRoutes, geocodeRoute } from './routeService';
import { predict } from './aqiInference';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({limit: "3mb"}));
app.get('/api/aqi/predict', async (req,res)=>{try{res.json(await predict(req.query));}catch(e:any){res.status(503).json({status:'unavailable',error:e.message||'AQI prediction unavailable.'});}});
app.use(['/api/exchange-code','/api/auth/me'], (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const callback=process.env.COGNITO_REDIRECT_URI||process.env.VITE_COGNITO_REDIRECT_URI;
  const allowed=callback ? new URL(callback).origin : '';
  if (req.get('origin') === allowed) { res.setHeader('Access-Control-Allow-Origin',allowed); res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS'); }
  if(req.method==='OPTIONS') {res.sendStatus(204);return;}next();
});
registerCodeExchange(app);
registerCloudStorage(app);
void startSmsMonitor();
registerSmsAlerts(app);
app.post('/api/alerts/sms/test', async (req, res) => {
  const origin = req.get('origin');
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const localOrigins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
  if (!localHosts.has(req.hostname) || (origin && !localOrigins.has(origin))) return res.status(403).json({ error: 'SNS test sends are available only from the local AirExpo dashboard.' });
  try { return res.json({ success: true, ...await sendTestSms() }); }
  catch (error: any) { return res.status(502).json({ success: false, error: error?.message || 'AWS SNS did not accept the test message.' }); }
});

// OpenRouteService proxy. Keep the routing token on the server.
app.post('/api/routes', async (req, res) => {
  try { return res.json(await getRoutes(req.body)); }
  catch (error: any) { return res.status(502).json({ success: false, error: error?.name === 'TimeoutError' ? 'Routing timed out. Try a shorter trip or retry.' : error?.message || 'Routing is temporarily unavailable.' }); }
});
app.get('/api/route-geocode', async (req, res) => {
  try { return res.json(await geocodeRoute(String(req.query.q || ''))); }
  catch (error: any) { return res.status(502).json({ success: false, error: error?.message || 'Place search is unavailable.' }); }
});
// Open-Meteo Air Quality grid samples used only as coarse route estimates.
app.get('/api/route-air-quality', async (req, res) => {
  const lat = Number(req.query.lat); const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ success: false, error: 'Valid latitude and longitude are required.' });
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,us_aqi&timezone=GMT&timeformat=unixtime`;
    const upstream = await fetch(url);
    if (!upstream.ok) throw new Error(`Open-Meteo returned ${upstream.status}`);
    const data: any = await upstream.json().catch(() => null);
    if (!data) return res.status(502).json({ success: false, error: 'Air-quality provider returned an empty or invalid response.' });
    return res.json({ success: true, source: 'Open-Meteo modeled grid', current: data.current || null });
  } catch (error: any) {
    console.warn('Route air-quality request failed:', error?.message || error);
    return res.status(502).json({ success: false, error: 'Air-quality estimate is temporarily unavailable.' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AQICN/WAQI station proxy. The token remains server-side and is never exposed
// to the browser. When no token is configured the UI keeps its Open-Meteo AQI.
app.get('/api/aqi/nearby', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const token = process.env.AQICN_API_TOKEN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ success: false, error: 'Valid latitude and longitude are required.' });
  }
  if (!token) {
    return res.json({ success: true, configured: false, stations: [] });
  }
  try {
    const delta = 0.55;
    const bounds = `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`;
    const upstream = await fetch(`https://api.waqi.info/map/bounds/?latlng=${bounds}&token=${encodeURIComponent(token)}`);
    if (!upstream.ok) throw new Error(`AQICN returned ${upstream.status}`);
    const payload: any = await upstream.json().catch(() => null);
    if (!payload) return res.status(502).json({ success: false, error: 'AQICN returned an empty or invalid response.' });
    if (payload.status !== 'ok' || !Array.isArray(payload.data)) throw new Error('AQICN response was not usable');
    const stations = payload.data.slice(0, 150).map((item: any) => ({
      id: String(item.uid ?? `${item.lat}-${item.lon}`),
      name: String(item.station?.name || 'AQICN monitoring station'),
      lat: Number(item.lat),
      lon: Number(item.lon),
      aqi: Number(item.aqi),
    })).filter((item: any) => Number.isFinite(item.lat) && Number.isFinite(item.lon) && Number.isFinite(item.aqi));
    return res.json({ success: true, configured: true, stations, attribution: 'World Air Quality Index Project' });
  } catch (error: any) {
    console.warn('AQICN nearby station request failed:', error?.message || error);
    return res.status(502).json({ success: false, error: 'AQICN station data is temporarily unavailable.' });
  }
});

type AqicnIndex = { v?: number | string };

function numericIndex(value: AqicnIndex | undefined): number | null {
  const parsed = Number(value?.v);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAqicnFeed(data: any) {
  const daily = data.forecast?.daily || {};
  const forecast = Object.entries(daily).flatMap(([pollutant, values]) =>
    Array.isArray(values)
      ? values.map((entry: any) => ({
          pollutant,
          day: String(entry.day),
          averageIndex: Number.isFinite(Number(entry.avg)) ? Number(entry.avg) : null,
          minimumIndex: Number.isFinite(Number(entry.min)) ? Number(entry.min) : null,
          maximumIndex: Number.isFinite(Number(entry.max)) ? Number(entry.max) : null,
        }))
      : []
  );

  return {
    aqi: Number.isFinite(Number(data.aqi)) ? Number(data.aqi) : null,
    dominantPollutant: data.dominentpol || null,
    pollutantIndices: {
      pm25: numericIndex(data.iaqi?.pm25),
      pm10: numericIndex(data.iaqi?.pm10),
      no2: numericIndex(data.iaqi?.no2),
      so2: numericIndex(data.iaqi?.so2),
      co: numericIndex(data.iaqi?.co),
      o3: numericIndex(data.iaqi?.o3),
    },
    station: {
      name: data.city?.name || 'Unknown AQICN station',
      coordinates: Array.isArray(data.city?.geo) && data.city.geo.length === 2
        ? { lat: Number(data.city.geo[0]), lon: Number(data.city.geo[1]) }
        : null,
      url: data.city?.url || null,
    },
    observedAt: data.time?.iso || data.time?.s || null,
    timezone: data.time?.tz || null,
    attribution: Array.isArray(data.attributions)
      ? data.attributions.map((item: any) => ({ name: String(item.name || ''), url: item.url || null }))
      : [],
    forecast,
  };
}

// Normalized AQICN feed. Individual pollutant values are AQI sub-indices—not
// concentrations—and are deliberately labelled that way in the response/UI.
app.get('/api/air-quality', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const token = process.env.AQICN_API_TOKEN;
  if (!token) return res.status(503).json({ success: false, error: 'AQICN_API_TOKEN is not configured.' });

  const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);
  if (!city && !hasCoordinates) {
    return res.status(400).json({ success: false, error: 'Provide a city or valid latitude and longitude.' });
  }

  // AQICN's city feed is more reliable for a user-selected geocoded city.
  // Coordinates remain supported for map probes and current-position lookups.
  const feed = city ? encodeURIComponent(city) : `geo:${lat};${lon}`;
  try {
    const upstream = await fetch(`https://api.waqi.info/feed/${feed}/?token=${encodeURIComponent(token)}`);
    if (!upstream.ok) throw new Error(`AQICN returned HTTP ${upstream.status}`);
    const payload: any = await upstream.json().catch(() => null);
    if (!payload) return res.status(502).json({ success: false, error: 'AQICN returned an empty or invalid response.' });
    if (payload.status !== 'ok' || !payload.data || typeof payload.data !== 'object') {
      const message = typeof payload.data === 'string' ? payload.data : 'AQICN returned no matching station.';
      return res.status(404).json({ success: false, error: message });
    }
    return res.json({
      success: true,
      source: 'World Air Quality Index Project',
      usage: 'Live display only; response must not be cached or redistributed.',
      data: normalizeAqicnFeed(payload.data),
    });
  } catch (error: any) {
    console.warn('AQICN feed request failed:', error?.message || error);
    return res.status(502).json({ success: false, error: 'Unable to retrieve live AQICN data.' });
  }
});

function buildObservedIndicators(aqi: unknown, pollutants: any, weather: any) {
  const value = (input: unknown, unit = '') => typeof input === 'number' && Number.isFinite(input) ? `${input}${unit}` : null;
  const values: Array<[string, string | null]> = [
    ['U.S. AQI', value(aqi)],
    ['PM2.5', value(pollutants?.pm2_5, ' µg/m³')],
    ['PM10', value(pollutants?.pm10, ' µg/m³')],
    ['NO₂', value(pollutants?.no2, ' µg/m³')],
    ['O₃', value(pollutants?.o3, ' µg/m³')],
    ['Temperature', value(weather?.temperature, ' °C')],
    ['Relative humidity', value(weather?.humidity, '%')],
  ];
  return values.filter((item): item is [string, string] => item[1] !== null).map(([label, indicator]) => ({ label, value: indicator }));
}

// Cache for diagnose responses (LRU, 200 entries, 10-min TTL)
interface CacheEntry { data: DiagnosticReport; timestamp: number; }
const diagnoseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX_SIZE = 200;

// Rate limiter for diagnose endpoint (6 calls/60s per IP)
const diagnoseRateLimits = new Map<string, number[]>();
const DIAGNOSE_RATE_LIMIT = 6;
const DIAGNOSE_RATE_WINDOW_MS = 60 * 1000;


function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = diagnoseRateLimits.get(ip) || [];
  const recentRequests = requests.filter(t => now - t < DIAGNOSE_RATE_WINDOW_MS);
  
  if (recentRequests.length >= DIAGNOSE_RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  diagnoseRateLimits.set(ip, recentRequests);
  return true;
}

// AI environmental explanation API. Do not use it for clinical advice.
app.post('/api/diagnose', async (req, res) => {
  const startTime = Date.now();
  const { location, coordinates, aqi, pollutants, weather } = req.body;
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    console.log(`[diagnose] Rate limit exceeded for IP ${clientIp}`);
    const fallbackData: DiagnosticReport = {
      environmentalHeadline: `Current U.S. AQI: ${aqi ?? 'unavailable'}`,
      executiveSummary: `Environmental readings for ${String(location || 'the selected location').slice(0, 160)}. Please wait before requesting another analysis.`,
      observedIndicators: buildObservedIndicators(aqi, pollutants, weather),
      contextNotes: ['These readings describe outdoor environmental conditions at the selected location.'],
      limitations: ['Rate limit reached. Please wait before requesting another analysis.'],
    };
    return res.json({ success: true, data: fallbackData, isFallback: true, rateLimited: true });
  }

  // Check cache
  const cacheKey = JSON.stringify([location, coordinates, aqi, pollutants, weather]);
  const cached = diagnoseCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    console.log(`[diagnose] Cache hit for ${cacheKey} (age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
    return res.json({ success: true, data: cached.data, fromCache: true });
  }

  // Generate new response
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const readings = { location: String(location || 'Unknown').slice(0, 160), coordinates, aqi, pollutants, weather };
      const prompt = `Explain the supplied environmental readings for AirExpo in plain, neutral language. This is environmental information only. Do not provide medical advice, diagnosis, source attribution, causal claims, individual risk estimates, activity clearance, or medication/treatment instructions. Do not infer values or facts that are not in the input. Use concise, cautious language and valid JSON only with this schema: {"environmentalHeadline":"short summary of the measured/modelled conditions","executiveSummary":"two short sentences explaining only supplied readings","contextNotes":["general explanation of the readings"],"limitations":["what cannot be concluded from these readings"]}. Keep each list to at most three items. Input readings: ${JSON.stringify(readings)}`;

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 400,
        },
      });

      const responseText = response.text;
      const latency = Date.now() - startTime;
      
      if (responseText) {
        const parsed = JSON.parse(responseText);
        const cleanList = (value: unknown, fallback: string) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 3) : [fallback];
        const aiReport: DiagnosticReport = {
          environmentalHeadline: typeof parsed.environmentalHeadline === 'string' ? parsed.environmentalHeadline.slice(0, 180) : `Current U.S. AQI: ${aqi ?? 'unavailable'}`,
          executiveSummary: typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary.slice(0, 700) : 'Environmental readings are available; the assistant could not produce a summary.',
          observedIndicators: buildObservedIndicators(aqi, pollutants, weather),
          contextNotes: cleanList(parsed.contextNotes, 'These readings describe environmental conditions, not an individual health assessment.'),
          limitations: cleanList(parsed.limitations, 'This explanation is not medical advice or a diagnosis.'),
        };

        // Cache the result
        diagnoseCache.set(cacheKey, { data: aiReport, timestamp: now });
        if (diagnoseCache.size > CACHE_MAX_SIZE) {
          const firstKey = diagnoseCache.keys().next().value;
          if (firstKey) {
            diagnoseCache.delete(firstKey);
          }
        }

        console.log(`[diagnose] Success - model: ${process.env.GEMINI_MODEL || 'gemini-1.5-flash'}, latency: ${latency}ms, cached: ${cacheKey}`);
        return res.json({ success: true, data: aiReport });
      }
    }
  } catch (err: any) {
    const latency = Date.now() - startTime;
    console.error(`[diagnose] Error after ${latency}ms:`, err?.message || err);
    
    // Check for rate limit errors
    if (err?.message?.includes('429') || err?.message?.includes('quota') || err?.message?.includes('rate limit')) {
      console.warn(`[diagnose] Rate limit/quota error detected - returning fallback`);
    }
  }

  // Fallback response
  const fallbackData: DiagnosticReport = {
    environmentalHeadline: `Current U.S. AQI: ${aqi ?? 'unavailable'}`,
    executiveSummary: `Environmental readings for ${String(location || 'the selected location').slice(0, 160)}. The values below are the readings returned by the selected data provider; no pollution source or individual health effect can be inferred from them alone.`,
    observedIndicators: buildObservedIndicators(aqi, pollutants, weather),
    contextNotes: ['These readings describe outdoor environmental conditions at the selected location.'],
    limitations: ['Provider readings may be modeled grid estimates or station observations and may not match street-level exposure.', 'This explanation does not provide medical advice, diagnosis, or treatment recommendations.'],
  };

  return res.json({ success: true, data: fallbackData, isFallback: true });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AirExpo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
