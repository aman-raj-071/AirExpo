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
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}&count=1&format=json`
    );
    const data = await res.json();
    if (data.results && data.results[0]) {
      const item = data.results[0];
      return {
        name: item.name,
        country: item.country || '',
        admin1: item.admin1 || '',
        latitude: coords.lat,
        longitude: coords.lon,
        timezone: item.timezone,
      };
    }
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
  location: LocationInfo
): Promise<EnvironmentalStationData> {
  const lat = location.latitude;
  const lon = location.longitude;

  const [aqResponse, weatherResponse] = await Promise.all([
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,european_aqi,uv_index&hourly=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi&forecast_days=3&timezone=auto&cell_selection=nearest`
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&forecast_days=3&timezone=auto&cell_selection=nearest`
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
  const currentAqi = Math.round(currentAq.us_aqi ?? 38);
  const aqiCat = getAqiCategory(currentAqi);

  // Pollutants breakdown against WHO 2021 Reference limits
  const pm25Val = Number((currentAq.pm2_5 ?? 11.2).toFixed(1));
  const pm10Val = Number((currentAq.pm10 ?? 22.4).toFixed(1));
  const no2Val = Number((currentAq.nitrogen_dioxide ?? 18.5).toFixed(1));
  const o3Val = Number((currentAq.ozone ?? 64.0).toFixed(1));
  const coVal = Number(((currentAq.carbon_monoxide ?? 280) / 1000).toFixed(2)); // convert to mg/m³
  const so2Val = Number((currentAq.sulphur_dioxide ?? 4.2).toFixed(1));

  const pollutants: Record<string, PollutantDetail> = {
    pm2_5: {
      code: 'pm2_5',
      name: 'PM2.5',
      fullName: 'Fine Inhalable Particles (≤2.5 µm)',
      value: pm25Val,
      unit: 'µg/m³',
      whoSafeThreshold: 15.0, // WHO 24h guideline
      percentOfLimit: Math.round((pm25Val / 15.0) * 100),
      status: pm25Val <= 15 ? 'safe' : pm25Val <= 35 ? 'moderate' : pm25Val <= 75 ? 'elevated' : 'hazardous',
      description: 'Combustion aerosols and secondary sulfates penetrating deep alveolar tissues.',
    },
    pm10: {
      code: 'pm10',
      name: 'PM10',
      fullName: 'Respirable Particulate Matter (≤10 µm)',
      value: pm10Val,
      unit: 'µg/m³',
      whoSafeThreshold: 45.0, // WHO 24h guideline
      percentOfLimit: Math.round((pm10Val / 45.0) * 100),
      status: pm10Val <= 45 ? 'safe' : pm10Val <= 100 ? 'moderate' : pm10Val <= 150 ? 'elevated' : 'hazardous',
      description: 'Suspended road dust, mechanical abrasions, and pollen matrices.',
    },
    no2: {
      code: 'no2',
      name: 'NO₂',
      fullName: 'Nitrogen Dioxide',
      value: no2Val,
      unit: 'µg/m³',
      whoSafeThreshold: 25.0, // WHO 24h guideline
      percentOfLimit: Math.round((no2Val / 25.0) * 100),
      status: no2Val <= 25 ? 'safe' : no2Val <= 50 ? 'moderate' : no2Val <= 100 ? 'elevated' : 'hazardous',
      description: 'Primary vehicular internal combustion and thermal power generation emissions.',
    },
    o3: {
      code: 'o3',
      name: 'O₃',
      fullName: 'Ground-Level Ozone',
      value: o3Val,
      unit: 'µg/m³',
      whoSafeThreshold: 100.0, // WHO 8h guideline
      percentOfLimit: Math.round((o3Val / 100.0) * 100),
      status: o3Val <= 100 ? 'safe' : o3Val <= 140 ? 'moderate' : o3Val <= 180 ? 'elevated' : 'hazardous',
      description: 'Photochemical secondary reaction of NOx and VOCs under solar radiation.',
    },
    co: {
      code: 'co',
      name: 'CO',
      fullName: 'Carbon Monoxide',
      value: coVal,
      unit: 'mg/m³',
      whoSafeThreshold: 4.0, // WHO 24h guideline in mg/m³
      percentOfLimit: Math.round((coVal / 4.0) * 100),
      status: coVal <= 4.0 ? 'safe' : coVal <= 9.0 ? 'moderate' : coVal <= 15.0 ? 'elevated' : 'hazardous',
      description: 'Incomplete combustion of hydrocarbons and urban exhaust pockets.',
    },
    so2: {
      code: 'so2',
      name: 'SO₂',
      fullName: 'Sulfur Dioxide',
      value: so2Val,
      unit: 'µg/m³',
      whoSafeThreshold: 40.0, // WHO 24h guideline
      percentOfLimit: Math.round((so2Val / 40.0) * 100),
      status: so2Val <= 40 ? 'safe' : so2Val <= 80 ? 'moderate' : so2Val <= 120 ? 'elevated' : 'hazardous',
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
    temperature: Math.round(currentWeather.temperature_2m ?? 19.5),
    humidity: Math.round(currentWeather.relative_humidity_2m ?? 58),
    windSpeed: Math.round(currentWeather.wind_speed_10m ?? 12),
    windDirection: Math.round(currentWeather.wind_direction_10m ?? 240),
    surfacePressure: Math.round(currentWeather.surface_pressure ?? 1014),
    cloudCover: Math.round(currentWeather.cloud_cover ?? 32),
    weatherCode: currentWeather.weather_code ?? 1,
    weatherDescription: getWeatherDescription(currentWeather.weather_code ?? 1),
    uvIndex: Math.round(currentAq.uv_index ?? 3),
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

  for (let i = 0; i < Math.min(hourlyAqTimes.length, 72); i++) {
    const rawTime = hourlyAqTimes[i];
    const date = new Date(rawTime);
    const hour = date.getHours();
    const dayLabel = i < 24 ? 'Today' : i < 48 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' });
    const formattedTime = `${hour.toString().padStart(2, '0')}:00`;

    const aqiPoint = Math.round(hourlyAqi[i] ?? currentAqi);
    const cat = getAqiCategory(aqiPoint);

    hourlyTimeline.push({
      time: rawTime,
      formattedTime,
      hour,
      dayLabel,
      aqi: aqiPoint,
      pm2_5: Math.round((hourlyPm25[i] ?? 12) * 10) / 10,
      pm10: Math.round((hourlyPm10[i] ?? 24) * 10) / 10,
      no2: Math.round((hourlyNo2[i] ?? 18) * 10) / 10,
      o3: Math.round((hourlyO3[i] ?? 50) * 10) / 10,
      temperature: Math.round(hourlyTemp[i] ?? weather.temperature),
      humidity: Math.round(hourlyHum[i] ?? weather.humidity),
      windSpeed: Math.round(hourlyWind[i] ?? weather.windSpeed),
      isSafeForCardio: aqiPoint <= 65,
      statusLabel: cat.label,
      color: cat.color,
    });
  }

  // Derive Respiratory Risk Windows (optimal outdoor activity vs ventilation slots)
  const safeWindows: SafeRespiratoryWindow[] = calculateSafeWindows(hourlyTimeline.slice(0, 24));

  return {
    location,
    currentAqi,
    aqiCategory: aqiCat,
    dominantPollutant,
    pollutants,
    weather,
    safeWindows,
    hourlyTimeline,
    lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

// Computes continuous time-block windows for optimal respiratory safety
function calculateSafeWindows(first24Hours: HourlyDataPoint[]): SafeRespiratoryWindow[] {
  if (!first24Hours || first24Hours.length === 0) {
    return [
      {
        startTime: '06:00',
        endTime: '08:30',
        category: 'Optimal Cardio',
        recommendedActivity: 'Aerobic running, cycling & endurance conditioning',
        averageAqi: 32,
        accentColor: '#2E9E5B',
        isBestWindow: true,
      },
      {
        startTime: '09:00',
        endTime: '11:00',
        category: 'Ventilation Window',
        recommendedActivity: 'Natural household & workspace passive ventilation',
        averageAqi: 48,
        accentColor: '#8CC152',
      },
      {
        startTime: '13:00',
        endTime: '17:00',
        category: 'Stay Indoors',
        recommendedActivity: 'Solar ozone peak; avoid strenuous outdoor exertion',
        averageAqi: 88,
        accentColor: '#F2C230',
      },
    ];
  }

  const windows: SafeRespiratoryWindow[] = [];

  // Find lowest AQI consecutive slots in the next 24 hours
  let minAqiSlot = first24Hours[0];
  first24Hours.forEach((p) => {
    if (p.aqi < minAqiSlot.aqi) minAqiSlot = p;
  });

  const bestHour = minAqiSlot.hour;
  const startBest = Math.max(5, bestHour - 1);
  const endBest = Math.min(22, startBest + 3);

  windows.push({
    startTime: `${startBest.toString().padStart(2, '0')}:00`,
    endTime: `${endBest.toString().padStart(2, '0')}:00`,
    category: minAqiSlot.aqi <= 50 ? 'Optimal Cardio' : 'Mild Activity',
    recommendedActivity:
      minAqiSlot.aqi <= 50
        ? 'Targeted aerobic running, cycling & peak pulmonary exertion'
        : 'Controlled outdoor tempo workouts with steady respiratory pacing',
    averageAqi: minAqiSlot.aqi,
    accentColor: minAqiSlot.aqi <= 50 ? '#2E9E5B' : '#8CC152',
    isBestWindow: true,
  });

  // Ventilation window (typically morning or late evening)
  const morningVentHour = 8;
  windows.push({
    startTime: `${morningVentHour.toString().padStart(2, '0')}:00`,
    endTime: `${(morningVentHour + 2).toString().padStart(2, '0')}:30`,
    category: 'Ventilation Window',
    recommendedActivity: 'Cross-breeze airflow exchange before peak commuter traffic resurgence',
    averageAqi: Math.round(minAqiSlot.aqi * 1.15),
    accentColor: '#0B7A8A',
  });

  // Afternoon peak caution slot (usually 13:00 - 17:00 due to ozone and heat)
  const afternoonPoints = first24Hours.filter((p) => p.hour >= 13 && p.hour <= 17);
  const avgAfternoonAqi = afternoonPoints.length
    ? Math.round(afternoonPoints.reduce((acc, cur) => acc + cur.aqi, 0) / afternoonPoints.length)
    : minAqiSlot.aqi + 35;

  windows.push({
    startTime: '13:30',
    endTime: '17:00',
    category: avgAfternoonAqi > 75 ? 'Stay Indoors' : 'Mild Activity',
    recommendedActivity:
      avgAfternoonAqi > 75
        ? 'Photochemical ozone buildup and direct thermal radiation peak'
        : 'Moderate ambient stability; light pedestrian transit acceptable',
    averageAqi: avgAfternoonAqi,
    accentColor: avgAfternoonAqi > 100 ? '#F08A24' : avgAfternoonAqi > 50 ? '#F2C230' : '#8CC152',
  });

  return windows;
}
