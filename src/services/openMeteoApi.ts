import {
  Coordinates,
  EnvironmentalStationData,
  HourlyDataPoint,
  LocationInfo,
  MicroWeather,
  PollutantDetail,
  SafeRespiratoryWindow,
} from '../types/environmental';

export const PRESET_LOCATIONS: LocationInfo[] = [
  {
    name: 'Zurich (Alps Telemetry)',
    country: 'Switzerland',
    admin1: 'Zurich',
    latitude: 47.3769,
    longitude: 8.5417,
    timezone: 'Europe/Zurich',
  },
  {
    name: 'Tokyo (Shinjuku Met)',
    country: 'Japan',
    admin1: 'Tokyo',
    latitude: 35.6895,
    longitude: 139.6917,
    timezone: 'Asia/Tokyo',
  },
  {
    name: 'Los Angeles (South Coast Basin)',
    country: 'United States',
    admin1: 'California',
    latitude: 34.0522,
    longitude: -118.2437,
    timezone: 'America/Los_Angeles',
  },
  {
    name: 'London (Hyde Park Observatory)',
    country: 'United Kingdom',
    admin1: 'Greater London',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
  },
  {
    name: 'New Delhi (Connaught Station)',
    country: 'India',
    admin1: 'Delhi',
    latitude: 28.6139,
    longitude: 77.2090,
    timezone: 'Asia/Kolkata',
  },
  {
    name: 'Singapore (Marina Coastal)',
    country: 'Singapore',
    admin1: 'Central Region',
    latitude: 1.3521,
    longitude: 103.8198,
    timezone: 'Asia/Singapore',
  },
  {
    name: 'Reykjavik (Boreal Clean Air)',
    country: 'Iceland',
    admin1: 'Capital Region',
    latitude: 64.1466,
    longitude: -21.9426,
    timezone: 'Atlantic/Reykjavik',
  },
  {
    name: 'Denver (Front Range Foothills)',
    country: 'United States',
    admin1: 'Colorado',
    latitude: 39.7392,
    longitude: -104.9903,
    timezone: 'America/Denver',
  },
];

export function getAqiCategory(aqi: number): {
  label: string;
  level: 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very_poor' | 'severe';
  color: string;
  bgTint: string;
  advisory: string;
} {
  if (aqi <= 50) {
    return {
      label: 'Good',
      level: 'good',
      color: '#2E9E5B',
      bgTint: 'rgba(46, 158, 91, 0.12)',
      advisory: 'Air quality is considered satisfactory; air pollution poses little or no respiratory risk.',
    };
  }
  if (aqi <= 100) {
    return {
      label: 'Moderate',
      level: 'satisfactory',
      color: '#8CC152',
      bgTint: 'rgba(140, 193, 82, 0.14)',
      advisory: 'Air quality is acceptable; unusually sensitive individuals may notice mild respiratory impact.',
    };
  }
  if (aqi <= 150) {
    return {
      label: 'Unhealthy for sensitive groups',
      level: 'moderate',
      color: '#F2C230',
      bgTint: 'rgba(242, 194, 48, 0.16)',
      advisory: 'Members of sensitive groups may experience health effects; general public is less likely to be affected.',
    };
  }
  if (aqi <= 200) {
    return {
      label: 'Unhealthy',
      level: 'poor',
      color: '#F08A24',
      bgTint: 'rgba(240, 138, 36, 0.16)',
      advisory: 'Everyone may begin to experience adverse effects; sensitive individuals may experience more serious effects.',
    };
  }
  if (aqi <= 300) {
    return {
      label: 'Very Unhealthy',
      level: 'very_poor',
      color: '#D93F3F',
      bgTint: 'rgba(217, 63, 63, 0.16)',
      advisory: 'Health alert: increased likelihood of adverse cardiac and respiratory effects across the entire population.',
    };
  }
  return {
    label: 'Hazardous',
    level: 'severe',
    color: '#8E1B3A',
    bgTint: 'rgba(142, 27, 58, 0.16)',
    advisory: 'Emergency health warning: serious biological risk for the entire community. Avoid all outdoor exertion.',
  };
}

export function getWeatherDescription(code: number): string {
  switch (code) {
    case 0:
      return 'Clear Troposphere';
    case 1:
      return 'Mainly Clear';
    case 2:
      return 'Partly Cloudy';
    case 3:
      return 'Overcast Stratocumulus';
    case 45:
    case 48:
      return 'Radiation Fog / Low Inversion';
    case 51:
    case 53:
    case 55:
      return 'Light Atmospheric Drizzle';
    case 61:
    case 63:
    case 65:
      return 'Precipitation Scavenging';
    case 71:
    case 73:
    case 75:
      return 'Crystalline Snowfall';
    case 80:
    case 81:
    case 82:
      return 'Turbulent Rain Showers';
    case 95:
    case 96:
    case 99:
      return 'Convective Thunderstorm';
    default:
      return 'Stable Sky Conditions';
  }
}

// Search locations worldwide using Open-Meteo Geocoding
export async function searchLocations(query: string): Promise<LocationInfo[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query.trim()
      )}&count=8&language=en&format=json`
    );
    if (!res.ok) throw new Error('Geocoding service unavailable');
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((item: any) => ({
      name: item.name,
      country: item.country || '',
      admin1: item.admin1 || '',
      latitude: item.latitude,
      longitude: item.longitude,
      timezone: item.timezone,
      elevation: item.elevation,
    }));
  } catch (err) {
    console.warn('Geocoding search error:', err);
    return [];
  }
}

// Reverse geocoding fallback
export async function reverseGeocode(coords: Coordinates): Promise<LocationInfo> {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.lat}&longitude=${coords.lon}&localityLanguage=en`);
    if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`);
    const data = await res.json();
    const locality = data.city || data.locality || data.principalSubdivision || '';
    const country = data.countryName || '';
    if (locality || country) return {
      name: locality || country,
      country,
      admin1: data.principalSubdivision || '',
      latitude: coords.lat,
      longitude: coords.lon,
    };
  } catch (_e) {
    // fallback
  }

  return {
    name: `Station [${coords.lat.toFixed(3)}°, ${coords.lon.toFixed(3)}°]`,
    country: 'Coordinates',
    latitude: coords.lat,
    longitude: coords.lon,
  };
}

// Fetch comprehensive real-time atmospheric and air quality telemetry
export async function fetchEnvironmentalData(
  location: LocationInfo,
  signal?: AbortSignal
): Promise<EnvironmentalStationData> {
  const lat = location.latitude;
  const lon = location.longitude;

  const [aqResponse, weatherResponse] = await Promise.all([
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,european_aqi,uv_index&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&past_days=2&forecast_days=3&timeformat=unixtime&timezone=auto&cell_selection=nearest`, { signal }
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&past_days=2&forecast_days=3&timeformat=unixtime&timezone=auto&cell_selection=nearest`, { signal }
    ),
  ]);

  if (!aqResponse.ok || !weatherResponse.ok) {
    throw new Error('Atmospheric telemetry network fetch failed');
  }

  const aqData = await aqResponse.json();
  const weatherData = await weatherResponse.json();

  const currentAq = aqData.current || {};
  const currentWeather = weatherData.current || {};

  // Current AQI (US EPA scale)
  if (!Number.isFinite(currentAq.us_aqi)) {
    throw new Error('Air-quality provider did not return a current U.S. AQI for this location.');
  }
  const currentAqi = Math.round(currentAq.us_aqi);
  const aqiCat = getAqiCategory(currentAqi);

  // Pollutants breakdown against WHO 2021 Reference limits
  const pm25Val = Number.isFinite(currentAq.pm2_5) ? Number(currentAq.pm2_5.toFixed(1)) : null;
  const pm10Val = Number.isFinite(currentAq.pm10) ? Number(currentAq.pm10.toFixed(1)) : null;
  const no2Val = Number.isFinite(currentAq.nitrogen_dioxide) ? Number(currentAq.nitrogen_dioxide.toFixed(1)) : null;
  const o3Val = Number.isFinite(currentAq.ozone) ? Number(currentAq.ozone.toFixed(1)) : null;
  const coVal = Number.isFinite(currentAq.carbon_monoxide) ? Number((currentAq.carbon_monoxide / 1000).toFixed(2)) : null; // convert to mg/m³
  const so2Val = Number.isFinite(currentAq.sulphur_dioxide) ? Number(currentAq.sulphur_dioxide.toFixed(1)) : null;

  const pollutantStatus = (value: number | null, limits: [number, number, number]): PollutantDetail['status'] => {
    if (value === null) return 'unavailable';
    return value <= limits[0] ? 'safe' : value <= limits[1] ? 'moderate' : value <= limits[2] ? 'elevated' : 'hazardous';
  };
  const percentOfLimit = (value: number | null, limit: number) => value === null ? 0 : Math.round((value / limit) * 100);

  const pollutants: Record<string, PollutantDetail> = {
    pm2_5: {
      code: 'pm2_5',
      name: 'PM2.5',
      fullName: 'Fine Inhalable Particles (≤2.5 µm)',
      value: pm25Val,
      unit: 'µg/m³',
      whoSafeThreshold: 15.0, // WHO 24h guideline
      percentOfLimit: percentOfLimit(pm25Val, 15),
      status: pollutantStatus(pm25Val, [15, 35, 75]),
      description: 'Combustion aerosols and secondary sulfates penetrating deep alveolar tissues.',
    },
    pm10: {
      code: 'pm10',
      name: 'PM10',
      fullName: 'Respirable Particulate Matter (≤10 µm)',
      value: pm10Val,
      unit: 'µg/m³',
      whoSafeThreshold: 45.0, // WHO 24h guideline
      percentOfLimit: percentOfLimit(pm10Val, 45),
      status: pollutantStatus(pm10Val, [45, 100, 150]),
      description: 'Suspended road dust, mechanical abrasions, and pollen matrices.',
    },
    no2: {
      code: 'no2',
      name: 'NO₂',
      fullName: 'Nitrogen Dioxide',
      value: no2Val,
      unit: 'µg/m³',
      whoSafeThreshold: 25.0, // WHO 24h guideline
      percentOfLimit: percentOfLimit(no2Val, 25),
      status: pollutantStatus(no2Val, [25, 50, 100]),
      description: 'Primary vehicular internal combustion and thermal power generation emissions.',
    },
    o3: {
      code: 'o3',
      name: 'O₃',
      fullName: 'Ground-Level Ozone',
      value: o3Val,
      unit: 'µg/m³',
      whoSafeThreshold: 100.0, // WHO 8h guideline
      percentOfLimit: percentOfLimit(o3Val, 100),
      status: pollutantStatus(o3Val, [100, 140, 180]),
      description: 'Photochemical secondary reaction of NOx and VOCs under solar radiation.',
    },
    co: {
      code: 'co',
      name: 'CO',
      fullName: 'Carbon Monoxide',
      value: coVal,
      unit: 'mg/m³',
      whoSafeThreshold: 4.0, // WHO 24h guideline in mg/m³
      percentOfLimit: percentOfLimit(coVal, 4),
      status: pollutantStatus(coVal, [4, 9, 15]),
      description: 'Incomplete combustion of hydrocarbons and urban exhaust pockets.',
    },
    so2: {
      code: 'so2',
      name: 'SO₂',
      fullName: 'Sulfur Dioxide',
      value: so2Val,
      unit: 'µg/m³',
      whoSafeThreshold: 40.0, // WHO 24h guideline
      percentOfLimit: percentOfLimit(so2Val, 40),
      status: pollutantStatus(so2Val, [40, 80, 120]),
      description: 'Industrial heavy oil combustion, refining, and volcanic sulfur traces.',
    },
  };

  // Find dominant pollutant
  let dominantPollutant = 'PM2.5';
  let highestRatio = -1;
  Object.values(pollutants).forEach((p) => {
    if (p.percentOfLimit > highestRatio) {
      highestRatio = p.percentOfLimit;
      dominantPollutant = p.name;
    }
  });

  // Micro-meteorology
  const weather: MicroWeather = {
    temperature: Number.isFinite(currentWeather.temperature_2m) ? Math.round(currentWeather.temperature_2m) : null,
    humidity: Number.isFinite(currentWeather.relative_humidity_2m) ? Math.round(currentWeather.relative_humidity_2m) : null,
    windSpeed: Number.isFinite(currentWeather.wind_speed_10m) ? Math.round(currentWeather.wind_speed_10m) : null,
    windDirection: Number.isFinite(currentWeather.wind_direction_10m) ? Math.round(currentWeather.wind_direction_10m) : null,
    surfacePressure: Number.isFinite(currentWeather.surface_pressure) ? Math.round(currentWeather.surface_pressure) : null,
    cloudCover: Number.isFinite(currentWeather.cloud_cover) ? Math.round(currentWeather.cloud_cover) : null,
    weatherCode: Number.isFinite(currentWeather.weather_code) ? currentWeather.weather_code : null,
    weatherDescription: Number.isFinite(currentWeather.weather_code) ? getWeatherDescription(currentWeather.weather_code) : 'Weather unavailable',
    uvIndex: Number.isFinite(currentAq.uv_index) ? Math.round(currentAq.uv_index) : null,
  };

  // Build 72-Hour Longitudinal Timeline
  const hourlyTimeline: HourlyDataPoint[] = [];
  const hourlyAqTimes = aqData.hourly?.time || [];
  const hourlyAqi = aqData.hourly?.us_aqi || [];
  const hourlyPm25 = aqData.hourly?.pm2_5 || [];
  const hourlyPm10 = aqData.hourly?.pm10 || [];
  const hourlyNo2 = aqData.hourly?.nitrogen_dioxide || [];
  const hourlyO3 = aqData.hourly?.ozone || [];
  const hourlyTemp = weatherData.hourly?.temperature_2m || [];
  const hourlyHum = weatherData.hourly?.relative_humidity_2m || [];
  const hourlyWind = weatherData.hourly?.wind_speed_10m || [];
  const zone = aqData.timezone || 'UTC';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());

  for (let i = 0; i < hourlyAqTimes.length; i++) {
    const date = new Date(hourlyAqTimes[i] * 1000);
    const rawTime = date.toISOString();
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour:'2-digit', hourCycle:'h23' }).format(date));
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(Date.now()+86400000));
    const dayLabel = day === today ? 'Today' : day === tomorrow ? 'Tomorrow' : new Intl.DateTimeFormat('en-GB',{timeZone:zone,day:'2-digit',month:'short'}).format(date);
    const formattedTime = `${hour.toString().padStart(2, '0')}:00`;
    if (!Number.isFinite(hourlyAqi[i])) continue;

    const aqiPoint = Math.round(hourlyAqi[i] ?? currentAqi);
    const cat = getAqiCategory(aqiPoint);

    hourlyTimeline.push({
      time: rawTime,
      formattedTime,
      hour,
      dayLabel,
      aqi: aqiPoint,
      pm2_5: Number.isFinite(hourlyPm25[i]) ? Math.round(hourlyPm25[i] * 10) / 10 : null,
      pm10: Number.isFinite(hourlyPm10[i]) ? Math.round(hourlyPm10[i] * 10) / 10 : null,
      no2: Number.isFinite(hourlyNo2[i]) ? Math.round(hourlyNo2[i] * 10) / 10 : null,
      o3: Number.isFinite(hourlyO3[i]) ? Math.round(hourlyO3[i] * 10) / 10 : null,
      temperature: Number.isFinite(hourlyTemp[i]) ? Math.round(hourlyTemp[i]) : Number.isFinite(weather.temperature) ? weather.temperature : null,
      humidity: Number.isFinite(hourlyHum[i]) ? Math.round(hourlyHum[i]) : Number.isFinite(weather.humidity) ? weather.humidity : null,
      windSpeed: Number.isFinite(hourlyWind[i]) ? Math.round(hourlyWind[i]) : Number.isFinite(weather.windSpeed) ? weather.windSpeed : null,
      isSafeForCardio: aqiPoint <= 65,
      statusLabel: cat.label,
      color: cat.color,
    });
  }

  // Derive Respiratory Risk Windows (optimal outdoor activity vs ventilation slots)
  const safeWindows: SafeRespiratoryWindow[] = hourlyTimeline.length
    ? calculateSafeWindows(hourlyTimeline.filter(point => Date.parse(point.time) >= Date.now()).slice(0, 24), zone)
    : [];

  return {
    location: { ...location, timezone: weatherData.timezone ?? location.timezone },
    currentAqi,
    aqiCategory: aqiCat,
    dominantPollutant,
    pollutants,
    weather,
    safeWindows,
    hourlyHistory: hourlyTimeline.filter(point => { const age = Date.now() - Date.parse(point.time); return age >= 0 && age < 24 * 3600000; }),
    hourlyTimeline: hourlyTimeline.filter(point => Date.parse(point.time) >= Date.now()),
    lastUpdated: Number.isFinite(currentAq.time)
      ? new Date(currentAq.time * 1000).toLocaleTimeString([], { timeZone: zone, hour: '2-digit', minute: '2-digit' })
      : 'Time unavailable',
  };
}

// Compare only forecast hours actually supplied by the provider.
function calculateSafeWindows(points: HourlyDataPoint[], timeZone: string): SafeRespiratoryWindow[] {
  if (!points.length) return [];
  const size = Math.min(3, points.length);
  const candidates = points.map((_, index) => points.slice(index, index + size))
    .filter(window => window.length === size && window.every((point, index) =>
      index === 0 || Date.parse(point.time) - Date.parse(window[index - 1].time) === 3600000));
  if (!candidates.length) return [];
  const average = (window: HourlyDataPoint[]) => window.reduce((sum, point) => sum + point.aqi, 0) / window.length;
  const best = candidates.reduce((lowest, window) => average(window) < average(lowest) ? window : lowest);
  const averageAqi = Math.round(average(best));
  const format = (timestamp: number) => new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(timestamp));
  return [{
    startTime: best[0].formattedTime,
    endTime: format(Date.parse(best[best.length - 1].time) + 3600000),
    category: averageAqi > 100 ? 'Stay Indoors' : 'Mild Activity',
    recommendedActivity: 'Lowest average modeled AQI among available consecutive forecast windows; compare with your personal guidance.',
    averageAqi,
    accentColor: getAqiCategory(averageAqi).color,
    isBestWindow: true,
  }];
}
