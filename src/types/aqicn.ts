export interface AqicnPollutantIndices {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  o3: number | null;
}

export interface AqicnForecastIndex {
  pollutant: string;
  day: string;
  averageIndex: number | null;
  minimumIndex: number | null;
  maximumIndex: number | null;
}

export interface AqicnAirQuality {
  aqi: number | null;
  dominantPollutant: string | null;
  pollutantIndices: AqicnPollutantIndices;
  station: {
    name: string;
    coordinates: { lat: number; lon: number } | null;
    url: string | null;
  };
  observedAt: string | null;
  timezone: string | null;
  attribution: Array<{ name: string; url: string | null }>;
  forecast: AqicnForecastIndex[];
}

export interface AqicnResponse {
  success: boolean;
  source?: string;
  data?: AqicnAirQuality;
  error?: string;
}
