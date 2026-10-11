export interface Coordinates {
  lat: number;
  lon: number;
}

export interface LocationInfo {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  elevation?: number;
}

export interface PollutantDetail {
  code: 'pm2_5' | 'pm10' | 'no2' | 'o3' | 'co' | 'so2';
  name: string;
  fullName: string;
  value: number | null;
  unit: string;
  whoSafeThreshold: number; // WHO 24h or 8h guideline
  status: 'safe' | 'moderate' | 'elevated' | 'hazardous' | 'unavailable';
  percentOfLimit: number;
  description: string;
}

export interface MicroWeather {
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  surfacePressure: number | null;
  cloudCover: number | null;
  weatherCode: number | null;
  weatherDescription: string;
  uvIndex: number | null;
}

export interface HourlyDataPoint {
  time: string; // ISO string
  formattedTime: string;
  hour: number;
  dayLabel: string;
  aqi: number;
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  isSafeForCardio: boolean;
  statusLabel: string;
  color: string;
}

export interface SafeRespiratoryWindow {
  startTime: string;
  endTime: string;
  category: 'Optimal Cardio' | 'Mild Activity' | 'Ventilation Window' | 'Stay Indoors';
  recommendedActivity: string;
  averageAqi: number;
  accentColor: string;
  isBestWindow?: boolean;
}

export interface ObservedIndicator {
  label: string;
  value: string;
}

export interface DiagnosticReport {
  environmentalHeadline: string;
  executiveSummary: string;
  observedIndicators: ObservedIndicator[];
  contextNotes: string[];
  limitations: string[];
}

export interface SatelliteLayerConfig {
  id: string;
  name: string;
  sensor: string;
  resolution: string;
  description: string;
  tileUrl: string;
  attribution: string;
  maxZoom: number;
  category: 'visible' | 'atmospheric' | 'thermal';
}

export interface EnvironmentalStationData {
  location: LocationInfo;
  currentAqi: number;
  aqiCategory: {
    label: string;
    level: 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very_poor' | 'severe';
    color: string;
    bgTint: string;
    advisory: string;
  };
  dominantPollutant: string;
  pollutants: Record<string, PollutantDetail>;
  weather: MicroWeather;
  safeWindows: SafeRespiratoryWindow[];
  hourlyTimeline: HourlyDataPoint[];
  hourlyHistory?: HourlyDataPoint[];
  lastUpdated: string;
}
