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
  value: number;
  unit: string;
  whoSafeThreshold: number; // WHO 24h or 8h guideline
  status: 'safe' | 'moderate' | 'elevated' | 'hazardous';
  percentOfLimit: number;
  description: string;
}

export interface MicroWeather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  surfacePressure: number;
  cloudCover: number;
  weatherCode: number;
  weatherDescription: string;
  uvIndex: number;
}

export interface HourlyDataPoint {
  time: string; // ISO string
  formattedTime: string;
  hour: number;
  dayLabel: string;
  aqi: number;
  pm2_5: number;
  pm10: number;
  no2: number;
  o3: number;
  temperature: number;
  humidity: number;
  windSpeed: number;
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

export interface SourceAttribution {
  factor: string;
  contributionPercent: number;
  description: string;
}

export interface VulnerableAdvice {
  asthmaAndRespiratory: string;
  pediatricAndElderly: string;
  enduranceAthletes: string;
}

export interface DiagnosticReport {
  clinicalHeadline: string;
  executiveSummary: string;
  sourceAttribution: SourceAttribution[];
  vulnerablePopulationAdvice: VulnerableAdvice;
  microClimateAction: string[];
  confidenceScore: number;
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
  lastUpdated: string;
}
