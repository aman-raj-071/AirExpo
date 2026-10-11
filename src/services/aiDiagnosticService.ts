import { DiagnosticReport, EnvironmentalStationData } from '../types/environmental';

const cache = new Map<string, { report: DiagnosticReport; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function fetchAiDiagnostic(
  station: EnvironmentalStationData,
  signal?: AbortSignal
): Promise<DiagnosticReport> {
  const cacheKey = JSON.stringify([station.location, station.currentAqi, station.pollutants, station.weather, station.safeWindows]);
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.report;
  }

  try {
    const response = await fetch('/api/diagnose', {
      signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: `${station.location.name}, ${station.location.country}`,
        coordinates: {
          lat: station.location.latitude,
          lon: station.location.longitude,
        },
        aqi: station.currentAqi,
        pollutants: {
          pm2_5: station.pollutants.pm2_5?.value,
          pm10: station.pollutants.pm10?.value,
          no2: station.pollutants.no2?.value,
          o3: station.pollutants.o3?.value,
          co: station.pollutants.co?.value,
          so2: station.pollutants.so2?.value,
        },
        weather: {
          temperature: station.weather.temperature,
          humidity: station.weather.humidity,
          windSpeed: station.weather.windSpeed,
          windDirection: station.weather.windDirection,
          surfacePressure: station.weather.surfacePressure,
          cloudCover: station.weather.cloudCover,
        },
        safeWindows: station.safeWindows,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success && json.data) {
        cache.set(cacheKey, { report: json.data, timestamp: Date.now() });
        return json.data;
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('AI Diagnostic endpoint unreachable, utilizing calibrated telemetry fallback:', err);
  }

  // A transparent fallback reports only readings received from the data service.
  const value = (n: number | null | undefined, unit = '') => n == null || !Number.isFinite(n) ? null : `${n}${unit}`;
  const observedIndicators = [
    ['U.S. AQI', value(station.currentAqi)],
    ['PM2.5', value(station.pollutants.pm2_5?.value, ' µg/m³')],
    ['PM10', value(station.pollutants.pm10?.value, ' µg/m³')],
    ['NO₂', value(station.pollutants.no2?.value, ' µg/m³')],
    ['O₃', value(station.pollutants.o3?.value, ' µg/m³')],
    ['Temperature', value(station.weather.temperature, ' °C')],
    ['Relative humidity', value(station.weather.humidity, '%')],
  ].filter((item): item is [string, string] => item[1] !== null).map(([label, indicator]) => ({ label, value: indicator }));
  const fallbackReport: DiagnosticReport = {
    environmentalHeadline: `Current U.S. AQI: ${station.currentAqi}`,
    executiveSummary: `Environmental readings for ${station.location.name}. The values below are the readings returned by the selected data provider; no pollution source or individual health effect can be inferred from them alone.`,
    observedIndicators,
    contextNotes: ['These readings describe outdoor environmental conditions at the selected location.', 'AQI and pollutant values do not establish an individual diagnosis or predict how a specific person will respond.'],
    limitations: ['Provider readings may be modeled grid estimates or station observations and may not match street-level exposure.', 'This explanation does not give medical advice or treatment recommendations.'],
  };

  cache.set(cacheKey, { report: fallbackReport, timestamp: Date.now() });
  return fallbackReport;
}
