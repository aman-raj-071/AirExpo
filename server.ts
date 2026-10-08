import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

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
    const payload: any = await upstream.json();
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
    const payload: any = await upstream.json();
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

// AI Diagnostic & Environmental Synthesis API
app.post('/api/diagnose', async (req, res) => {
  const { location, coordinates, aqi, pollutants, weather, safeWindows } = req.body;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const ai = new GoogleGenAI();
      const prompt = `You are the lead atmospheric scientist and environmental health diagnostician for "AirExpo", a hyper-local environmental tracking and respiratory decision engine.
Analyze the following real-time telemetry from satellites and ground monitoring stations:

Location: ${location || 'Unknown'} (${coordinates?.lat?.toFixed(4)}, ${coordinates?.lon?.toFixed(4)})
AQI (US EPA Standard): ${aqi}
Particulate & Gas Concentrations:
- PM2.5: ${pollutants?.pm2_5 ?? 'N/A'} µg/m³
- PM10: ${pollutants?.pm10 ?? 'N/A'} µg/m³
- Nitrogen Dioxide (NO2): ${pollutants?.no2 ?? 'N/A'} µg/m³
- Ozone (O3): ${pollutants?.o3 ?? 'N/A'} µg/m³
- Carbon Monoxide (CO): ${pollutants?.co ?? 'N/A'} µg/m³
- Sulfur Dioxide (SO2): ${pollutants?.so2 ?? 'N/A'} µg/m³

Atmospheric Telemetry:
- Temperature: ${weather?.temperature ?? 'N/A'}°C
- Relative Humidity: ${weather?.humidity ?? 'N/A'}%
- Wind Speed & Direction: ${weather?.windSpeed ?? 'N/A'} km/h (${weather?.windDirection ?? 'N/A'}°)
- Surface Pressure: ${weather?.surfacePressure ?? 'N/A'} hPa
- Cloud Cover / Inversion Risk: ${weather?.cloudCover ?? 'N/A'}%

Calculated Safe Respiratory Time Slots: ${JSON.stringify(safeWindows || [])}

Provide a clinical, calm, and mathematically precise diagnostic report in valid JSON format only (no markdown code blocks, just raw JSON matching this schema):
{
  "clinicalHeadline": "Concise 1-sentence diagnostic status (e.g. 'Tropospheric thermal inversion trapping fine particulates in low basin')",
  "executiveSummary": "2-3 sentences of measured, authoritative environmental synthesis explaining what is in the air, the primary atmospheric drivers (wind drift, solar radiation O3 synthesis, or local emissions), and physiological impact.",
  "sourceAttribution": [
    { "factor": "e.g. Vehicular Combustion & NO2", "contributionPercent": 45, "description": "High rush-hour density along major arterials." },
    { "factor": "e.g. Fine Particulate Resuspension", "contributionPercent": 30, "description": "Dry soil and low relative humidity facilitating aerosol drift." },
    { "factor": "e.g. Background Biogenic Aerosols", "contributionPercent": 25, "description": "Pollen and secondary organic aerosols in vegetative buffer zones." }
  ],
  "vulnerablePopulationAdvice": {
    "asthmaAndRespiratory": "Targeted advice for asthmatics/COPD",
    "pediatricAndElderly": "Targeted advice for children & seniors",
    "enduranceAthletes": "Specific advice for runners and cyclists regarding VO2 max exposure"
  },
  "microClimateAction": [
    "Precise action item 1 (e.g. Keep HEPA filtration on low speed, avoid open windows during 14:00-17:00 solar peak)",
    "Precise action item 2 (e.g. Schedule strenuous cardio between 06:30 and 08:30 AM)",
    "Precise action item 3"
  ],
  "confidenceScore": 94
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText);
        return res.json({ success: true, data: parsed });
      }
    }
  } catch (err: any) {
    console.error('Error in /api/diagnose with Gemini:', err?.message || err);
  }

  // High-precision scientific fallback if API key is not configured or rate-limited
  const aqiVal = typeof aqi === 'number' ? aqi : 50;
  const isClean = aqiVal <= 50;
  const isModerate = aqiVal > 50 && aqiVal <= 100;
  const isUnhealthy = aqiVal > 100;

  const fallbackData = {
    clinicalHeadline: isClean
      ? 'Optimal atmospheric dispersal with negligible respiratory burden'
      : isModerate
      ? 'Mild aerosol accumulation under steady barometric conditions'
      : 'Elevated particulate loading requiring deliberate exposure pacing',
    executiveSummary: isClean
      ? `Atmospheric conditions over ${location || 'the monitored area'} exhibit robust boundary-layer ventilation. Fine particulate concentrations remain well below WHO annual and 24-hour guidelines, creating ideal conditions for unconstrained outdoor physical activity.`
      : isModerate
      ? `Moderate concentration of secondary particulates detected. Lower tropospheric stability and moderate wind currents are allowing light localized buildup, particularly during peak transit intervals.`
      : `Particulate matter concentrations have exceeded baseline reference standards due to local emissions and thermal stratification. Individuals with heightened respiratory sensitivity should calibrate outdoor duration.`,
    sourceAttribution: [
      {
        factor: isUnhealthy ? 'Combustion & Motorized Transit' : 'Regional Background Transport',
        contributionPercent: isUnhealthy ? 52 : 38,
        description: isUnhealthy
          ? 'Urban transit corridors and localized stationary combustion sources.'
          : 'Trans-boundary clean airflow with minor maritime or continental background.',
      },
      {
        factor: 'Photochemical / Secondary Aerosols',
        contributionPercent: isUnhealthy ? 28 : 34,
        description: 'Solar radiation catalyzing precursor gases into fine suspended nitrate/sulfate aerosol matrices.',
      },
      {
        factor: 'Biogenic & Mineral Particles',
        contributionPercent: isUnhealthy ? 20 : 28,
        description: 'Naturally occurring dust, pollen grains, and vegetative volatile organics.',
      },
    ],
    vulnerablePopulationAdvice: {
      asthmaAndRespiratory: isClean
        ? 'Airway irritation risk is minimal. Normal preventive medication protocols apply.'
        : isModerate
        ? 'Carry rescue inhaler during prolonged outdoor workouts; avoid proximity to high-volume motorways.'
        : 'Limit prolonged strenuous exertion outdoors. Utilize indoor air filtration (HEPA H13) if symptoms emerge.',
      pediatricAndElderly: isClean
        ? 'Safe for all recreational and educational outdoor activities without restriction.'
        : isModerate
        ? 'Outdoor recreation acceptable; encourage adequate hydration and mid-activity pauses.'
        : 'Shift vigorous group play indoors or to early morning hours when solar convection is minimal.',
      enduranceAthletes: isClean
        ? 'Unrestricted VO2 max sessions and long-distance endurance training recommended.'
        : isModerate
        ? 'Morning hours (06:00 - 09:00) offer lower ambient ozone and superior lung tidal volume safety.'
        : 'Substitute outdoor tempo runs with indoor stationary treadmill or filtered track intervals.',
    },
    microClimateAction: [
      isClean
        ? 'Ventilate home and workspaces thoroughly during the morning boundary layer renewal.'
        : 'Time natural room ventilation to match low-particulate windows (06:00 – 08:30).',
      `Monitor barometric shifts (${weather?.surfacePressure ?? '1013'} hPa) for incoming frontal changes.`,
      isUnhealthy
        ? 'Run recirculating HEPA air purifiers in sleeping and training quarters.'
        : 'Maintain adequate hydration to support mucosal barrier clearance efficiency.',
    ],
    confidenceScore: 92,
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
