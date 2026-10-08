import React, { useState } from 'react';
import { HourlyDataPoint } from '../types/environmental';
import { Clock, ShieldCheck, AlertTriangle, Wind, Thermometer, Droplets } from 'lucide-react';

interface TimelineScrubberProps {
  timeline: HourlyDataPoint[];
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({ timeline }) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  if (!timeline || timeline.length === 0) return null;

  const activePoint = timeline[Math.min(selectedIndex, timeline.length - 1)];

  // Construct gradient CSS along the timeline
  const gradientStops = timeline.slice(0, 48).map((point, index) => {
    const percent = Math.round((index / (Math.min(timeline.length, 48) - 1)) * 100);
    return `${point.color} ${percent}%`;
  });
  const trackGradient = `linear-gradient(to right, ${gradientStops.join(', ')})`;

  return (
    <div className="bg-white border border-[#D5E1E8] rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#D5E1E8]">
        <div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#4A5F6D] font-label">
            Longitudinal Telemetry
          </span>
          <h2 className="text-xl font-bold font-display text-[#12232E] mt-0.5">
            72-Hour Atmospheric Timeline & Scrubber
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#4A5F6D] font-label">
          <Clock className="w-3.5 h-3.5 text-[#0B7A8A]" />
          <span>Interactive Time Travel</span>
        </div>
      </div>

      {/* Selected Time Inspection Card */}
      <div className="mt-5 p-4 bg-[#F2F7FA] border border-[#D5E1E8] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#4A5F6D] font-label">
            <span className="font-semibold text-[#12232E]">{activePoint.dayLabel}</span>
            <span>·</span>
            <span className="text-sm font-bold font-display text-[#12232E] tabular-nums">
              {activePoint.formattedTime}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 font-medium" style={{ color: activePoint.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activePoint.color }} />
              {activePoint.statusLabel}
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-4xl font-bold font-display text-[#12232E] tabular-nums">
              {activePoint.aqi}
            </span>
            <span className="text-xs text-[#4A5F6D] font-label">Projected EPA AQI</span>
          </div>
        </div>

        {/* Micro-Pollutant Snapshot for this hour */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white p-2.5 rounded-lg border border-[#D5E1E8]">
            <div className="text-[11px] text-[#4A5F6D] font-label">PM2.5</div>
            <div className="text-base font-bold font-display text-[#12232E] tabular-nums mt-0.5">
              {activePoint.pm2_5} <span className="text-[10px] text-[#4A5F6D] font-normal">µg/m³</span>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#D5E1E8]">
            <div className="text-[11px] text-[#4A5F6D] font-label">Ozone (O₃)</div>
            <div className="text-base font-bold font-display text-[#12232E] tabular-nums mt-0.5">
              {activePoint.o3} <span className="text-[10px] text-[#4A5F6D] font-normal">µg/m³</span>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#D5E1E8]">
            <div className="text-[11px] text-[#4A5F6D] font-label flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-[#0B7A8A]" /> Temp
            </div>
            <div className="text-base font-bold font-display text-[#12232E] tabular-nums mt-0.5">
              {activePoint.temperature}°C
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-[#D5E1E8]">
            <div className="text-[11px] text-[#4A5F6D] font-label flex items-center gap-1">
              <Wind className="w-3 h-3 text-[#0B7A8A]" /> Wind
            </div>
            <div className="text-base font-bold font-display text-[#12232E] tabular-nums mt-0.5">
              {activePoint.windSpeed} <span className="text-[10px] text-[#4A5F6D] font-normal">km/h</span>
            </div>
          </div>
        </div>

        {/* Clearance badge */}
        <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center">
          <div className="flex items-center gap-1.5 text-xs font-label">
            {activePoint.isSafeForCardio ? (
              <span className="text-[#2E9E5B] font-medium flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> Outdoor Cardio Cleared
              </span>
            ) : (
              <span className="text-[#F08A24] font-medium flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Exercise Precaution
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#4A5F6D] font-body mt-0.5">
            Humidity: {activePoint.humidity}%
          </span>
        </div>
      </div>

      {/* Custom Slider Scrubber */}
      <div className="mt-8 space-y-3">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={timeline.length - 1}
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(parseInt(e.target.value, 10))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer transition-all focus:outline-none"
            style={{
              background: trackGradient,
              accentColor: '#0B7A8A',
            }}
          />
        </div>

        {/* Timeline Axis Labels */}
        <div className="flex justify-between text-[11px] font-label text-[#4A5F6D] pt-1">
          <span>{timeline[0]?.dayLabel} {timeline[0]?.formattedTime}</span>
          <span>+24 Hours</span>
          <span>+48 Hours</span>
          <span>+72 Hours</span>
        </div>
      </div>

      {/* Discrete 24-Hour Horizon Bar Chart Preview */}
      <div className="mt-6 pt-5 border-t border-[#D5E1E8]">
        <div className="flex items-center justify-between text-xs text-[#4A5F6D] font-label mb-3">
          <span className="font-medium text-[#12232E]">Diurnal Particulate Cycle (Next 24 Hours)</span>
          <span>Click any column to lock timeline</span>
        </div>

        <div className="grid grid-cols-12 sm:grid-cols-24 gap-1 items-end h-20 pt-2">
          {timeline.slice(0, 24).map((pt, idx) => {
            const isSelected = idx === selectedIndex;
            const barHeight = Math.min(Math.max((pt.aqi / 200) * 100, 15), 100);

            return (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className="group relative flex flex-col items-center h-full justify-end cursor-pointer"
                title={`${pt.formattedTime}: AQI ${pt.aqi} (${pt.statusLabel})`}
              >
                <div
                  className={`w-full rounded-xs transition-all ${
                    isSelected ? 'ring-2 ring-[#0B7A8A] opacity-100 scale-y-105' : 'opacity-80 group-hover:opacity-100'
                  }`}
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: pt.color,
                  }}
                />
                <span className="text-[9px] font-label text-[#4A5F6D] mt-1 tabular-nums hidden sm:block">
                  {idx % 4 === 0 ? pt.hour : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
