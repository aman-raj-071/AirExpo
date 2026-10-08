import { AqicnAirQuality, AqicnResponse } from '../types/aqicn';
import { LocationInfo } from '../types/environmental';

export async function fetchAqicnAirQuality(location: LocationInfo, signal?: AbortSignal): Promise<AqicnAirQuality> {
  const params = new URLSearchParams({
    city: location.name.split(',')[0].trim(),
    lat: String(location.latitude),
    lon: String(location.longitude),
  });
  const response = await fetch(`/api/air-quality?${params}`, { signal, cache: 'no-store' });
  const payload = await response.json() as AqicnResponse;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || 'Live AQICN data is unavailable for this location.');
  }
  return payload.data;
}
