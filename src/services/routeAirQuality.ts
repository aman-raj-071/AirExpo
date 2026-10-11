import type { PlannedRoute } from '../components/GoogleJoggingMap';

export async function sampleRouteAirQuality(routes: PlannedRoute[]): Promise<PlannedRoute[]> {
  const checkedAt = new Date().toISOString();
  const samples = new Map<string, Promise<any>>();
  return Promise.all(routes.map(async (route) => {
    const count = Math.min(7, route.coordinates.length);
    const points = Array.from({ length: count }, (_, index) => route.coordinates[Math.round(index * (route.coordinates.length - 1) / Math.max(1, count - 1))]);
    const results = await Promise.all(points.map((point) => {
      const key = `${point.lat.toFixed(4)},${point.lon.toFixed(4)}`;
      if (!samples.has(key)) samples.set(key, (async () => {
        try {
          const res = await fetch(`/api/route-air-quality?lat=${point.lat}&lon=${point.lon}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
          const data = await res.json();
          return res.ok && data.success ? data.current : null;
        } catch { return null; }
      })());
      return samples.get(key)!;
    }));
    const fresh = results.filter((item) => item && Number.isFinite(item.us_aqi) && item.us_aqi >= 0 && typeof item.time === 'number' && Date.now() - item.time * 1000 <= 3 * 3600000 && item.time * 1000 <= Date.now() + 600000);
    const avg = (key: string) => {
      const values = fresh.map((item) => item[key]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      return values.length ? values.reduce((a,b) => a+b,0) / values.length : null;
    };
    const pm25 = avg('pm2_5');
    return { ...route, aqi: avg('us_aqi'), maxAqi: fresh.length ? Math.max(...fresh.map((item) => item.us_aqi)) : null, sampleCount: count, validSamples: fresh.length, pm2_5: pm25, pm10: avg('pm10'), exposure: pm25 === null ? null : pm25 * route.durationMin, observedAt: fresh[0] ? new Date(fresh[0].time * 1000).toISOString() : null, checkedAt };
  }));
}

export function isGoodRoute(route: PlannedRoute) {
  return route.sampleCount! > 0 && route.validSamples === route.sampleCount && route.maxAqi != null && route.maxAqi <= 50;
}

export function recommendRoute(routes: PlannedRoute[]) {
  const complete = routes.filter((route) => route.sampleCount! > 0 && route.validSamples === route.sampleCount && route.maxAqi != null);
  const good = complete.filter(isGoodRoute);
  const eligible = good.length ? good : complete;
  return [...eligible].sort((a,b) => (a.maxAqi! - b.maxAqi!) || ((a.aqi ?? Infinity) - (b.aqi ?? Infinity)) || ((a.exposure ?? Infinity) - (b.exposure ?? Infinity)) || a.durationMin - b.durationMin)[0] ?? null;
}
