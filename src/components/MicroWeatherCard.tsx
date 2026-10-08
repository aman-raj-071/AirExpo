import React from 'react';
import { MicroWeather, LocationInfo } from '../types/environmental';
import {
  Thermometer,
  Droplets,
  Wind,
  Gauge,
  Sun,
  Cloud,
  Compass,
  Satellite,
} from 'lucide-react';

interface MicroWeatherCardProps {
  weather: MicroWeather;
  location: LocationInfo;
  lastUpdated: string;
}

export const MicroWeatherCard: React.FC<MicroWeatherCardProps> = ({
  weather,
  location,
  lastUpdated,
}) => {
  return (
    <div className="bg-white border border-[#D5E1E8] rounded-2xl p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[#D5E1E8]">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#4A5F6D] font-label">
              Atmospheric Physics
            </span>
            <h2 className="text-xl font-bold font-display text-[#12232E] mt-0.5">
              Micro-Climate Telemetry
            </h2>
          </div>
          <div className="text-xs text-[#4A5F6D] font-label">
            <span className="tabular-nums font-medium text-[#12232E]">{weather.weatherDescription}</span>
          </div>
        </div>

        {/* Primary metric banner */}
        <div className="mt-4 flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold font-display text-[#12232E] tabular-nums">
              {weather.temperature}°C
            </span>
            <span className="text-xs text-[#4A5F6D] font-body">Ambient Air Temp</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#4A5F6D] font-label">
            <Satellite className="w-3.5 h-3.5 text-[#0B7A8A]" />
            <span>Refreshed: {lastUpdated}</span>
          </div>
        </div>

        {/* 4-Item Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
          {/* Surface Pressure */}
          <div className="p-3 bg-[#F2F7FA] border border-[#D5E1E8] rounded-xl flex items-start gap-2.5">
            <Gauge className="w-4 h-4 text-[#0B7A8A] shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-[#4A5F6D] font-label">Barometric Pressure</div>
              <div className="text-base font-bold font-display text-[#12232E] tabular-nums mt-0.5">
                {weather.surfacePressure} <span className="text-xs font-normal text-[#4A5F6D]">hPa</span>
              </div>
              <div className="text-[10px] text-[#4A5F6D] font-body mt-0.5">
                {weather.surfacePressure >= 1013 ? 'High tropospheric ridge' : 'Low convective depression'}
              </div>
            </div>
          </div>

          {/* Wind Vector */}
          <div className="p-3 bg-[#F2F7FA] border border-[#D5E1E8] rounded-xl flex items-start gap-2.5">
            <Wind className="w-4 h-4 text-[#0B7A8A] shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-[#4A5F6D] font-label">Wind Dispersion</div>
              <div className="text-base font-bold font-display text-[#12232E] tabular-nums mt-0.5">
                {weather.windSpeed} <span className="text-xs font-normal text-[#4A5F6D]">km/h</span>
              </div>
              <div className="text-[10px] text-[#4A5F6D] font-body mt-0.5 flex items-center gap-1">
                <Compass className="w-3 h-3 text-[#0B7A8A]" style={{ transform: `rotate(${weather.windDirection}deg)` }} />
                <span>Vector: {weather.windDirection}°</span>
              </div>
            </div>
          </div>

          {/* Humidity */}
          <div className="p-3 bg-[#F2F7FA] border border-[#D5E1E8] rounded-xl flex items-start gap-2.5">
            <Droplets className="w-4 h-4 text-[#0B7A8A] shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-[#4A5F6D] font-label">Relative Humidity</div>
              <div className="text-base font-bold font-display text-[#12232E] tabular-nums mt-0.5">
                {weather.humidity}%
              </div>
              <div className="text-[10px] text-[#4A5F6D] font-body mt-0.5">
                {weather.humidity > 65 ? 'Enhanced aerosol hygroscopicity' : 'Dry dispersion conditions'}
              </div>
            </div>
          </div>

          {/* Cloud Cover & UV */}
          <div className="p-3 bg-[#F2F7FA] border border-[#D5E1E8] rounded-xl flex items-start gap-2.5">
            <Sun className="w-4 h-4 text-[#0B7A8A] shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-[#4A5F6D] font-label">Cloud & UV Index</div>
              <div className="text-base font-bold font-display text-[#12232E] tabular-nums mt-0.5">
                UV {weather.uvIndex} <span className="text-xs font-normal text-[#4A5F6D]">· {weather.cloudCover}%</span>
              </div>
              <div className="text-[10px] text-[#4A5F6D] font-body mt-0.5">
                {weather.cloudCover < 30 ? 'High solar flux (O₃ potential)' : 'Filtered irradiance'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sensor Elevation & Geo Reference */}
      <div className="mt-4 pt-3 border-t border-[#D5E1E8] flex items-center justify-between text-xs text-[#4A5F6D] font-label">
        <span>Coordinates: {location.latitude.toFixed(3)}°, {location.longitude.toFixed(3)}°</span>
        <span>Elevation: {location.elevation ? `${location.elevation}m MSL` : 'Calibrated'}</span>
      </div>
    </div>
  );
};
