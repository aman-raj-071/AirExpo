type Point = { lat: number; lon: number };
export const validPoint = (point: any): point is Point => point && typeof point.lat === 'number' && typeof point.lon === 'number' && Number.isFinite(point.lat) && Number.isFinite(point.lon) && Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180;

function decodeShape(shape: string): Point[] {
  let index = 0, lat = 0, lon = 0;
  const coordinates: Point[] = [];
  const read = () => {
    let result = 0, shift = 0, byte: number;
    do {
      if (index >= shape.length || shift > 30) throw new Error('Invalid route geometry.');
      byte = shape.charCodeAt(index++) - 63;
      result |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < shape.length) { lat += read(); lon += read(); coordinates.push({ lat: lat / 1e6, lon: lon / 1e6 }); }
  return coordinates;
}

export async function getRoutes(input: any) {
  const { origin, destination, mode } = input || {};
  if (!validPoint(origin) || !validPoint(destination) || !['walk', 'run', 'cycle'].includes(mode)) throw new Error('Enter valid origin and destination coordinates and a travel mode.');
  if (Math.abs(origin.lat - destination.lat) + Math.abs(origin.lon - destination.lon) < .00001) throw new Error('Choose a destination different from the origin.');
  const token = process.env.OPENROUTESERVICE_API_KEY?.trim();
  let routes: Array<{ id: string; coordinates: Point[]; distanceKm: number; durationMin: number }>;
  let source: string;
  if (token) {
    const profile = mode === 'cycle' ? 'cycling-regular' : 'foot-walking';
    const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
      method: 'POST', signal: AbortSignal.timeout(20000), headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [[origin.lon, origin.lat], [destination.lon, destination.lat]], alternative_routes: { target_count: 3, weight_factor: 1.6, share_factor: .6 }, instructions: false }),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Routing provider could not find this trip.');
    source = 'OpenRouteService';
    routes = (data.features || []).slice(0, 3).map((feature: any, index: number) => ({ id: `route-${index + 1}`, coordinates: feature.geometry.coordinates.map(([lon, lat]: number[]) => ({lat, lon})), distanceKm: feature.properties.summary.distance / 1000, durationMin: feature.properties.summary.duration / 60 }));
  } else {
    const costing = mode === 'cycle' ? 'bicycle' : 'pedestrian';
    const res = await fetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'AirExpo-local-development' },
      body: JSON.stringify({ locations: [origin, destination], costing, costing_options: mode === 'run' ? { pedestrian: { walking_speed: 9 } } : {}, alternates: 2, units: 'kilometers' }),
    });
    const data: any = await res.json();
    if (!res.ok || !data.trip) throw new Error(data.error || 'No route found. Try nearby streets or a different travel mode.');
    source = 'Valhalla / OpenStreetMap (public development service)';
    routes = [data.trip, ...(data.alternates || []).map((item: any) => item.trip)].filter(Boolean).slice(0, 3).map((trip: any, index: number) => ({ id: `route-${index + 1}`, coordinates: trip.legs.flatMap((leg: any) => decodeShape(leg.shape)), distanceKm: trip.summary.length, durationMin: trip.summary.time / 60 }));
  }
  routes = routes.filter((route) => route.coordinates.length > 1 && Number.isFinite(route.distanceKm) && Number.isFinite(route.durationMin));
  if (!routes.length) throw new Error('No usable route found. Try a destination on a nearby road.');
  return { success: true, routes, source };
}

const geocodeCache = new Map<string, { results: any[]; expires: number }>();
let geocodeQueue: Promise<unknown> = Promise.resolve();
let nextGeocodeAt = 0;
export async function geocodeRoute(query: string) {
  if (!query || query.trim().length < 2 || query.length > 200) throw new Error('Enter a place name or address.');
  const key = query.trim().toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached && cached.expires > Date.now()) return { success: true, results: cached.results };
  const task = geocodeQueue.catch(() => {}).then(async () => {
  const wait = nextGeocodeAt - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  nextGeocodeAt = Date.now() + 1100;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: query.trim(), format: 'jsonv2', limit: '5' }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'AirExpo-local-development', 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error('Place search is unavailable. Enter latitude, longitude or pick on the map.');
  const data: any = await res.json();
  const results = data.map((item: any) => ({ name: item.display_name, lat: Number(item.lat), lon: Number(item.lon) })).filter(validPoint);
  if (geocodeCache.size >= 200) geocodeCache.delete(geocodeCache.keys().next().value!);
  geocodeCache.set(key, { results, expires: Date.now() + 3600000 });
  return { success: true, results };
  });
  geocodeQueue = task;
  return task;
}
