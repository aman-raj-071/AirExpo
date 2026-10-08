import React from 'react';

interface BioMetricGaugeProps {
  aqi: number;
  categoryLabel: string;
  categoryColor: string;
  categoryBg: string;
  dominantPollutant: string;
  advisory: string;
}

export const BioMetricGauge: React.FC<BioMetricGaugeProps> = ({
  aqi,
  categoryLabel,
  categoryColor,
  dominantPollutant,
  advisory,
}) => {
  // Semi-circle gauge calculations
  // Arc spans 180 degrees (from 180 deg to 360 deg)
  const radius = 88;
  const strokeWidth = 10;
  const cx = 110;
  const cy = 105;
  const circumference = Math.PI * radius; // Half-circle circumference

  // Clamp AQI between 0 and 500 for gauge scale
  const normalizedAqi = Math.min(Math.max(aqi, 0), 500);
  const progressRatio = normalizedAqi / 500;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className="bg-white border border-[#D5E1E8] rounded-2xl p-6 relative flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#4A5F6D] font-label">
            Biosphere Index
          </span>
          <h2 className="text-xl font-bold font-display text-[#12232E] mt-0.5">
            Real-Time AQI
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#4A5F6D] font-label">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor }} />
          <span className="font-medium text-[#12232E]">{categoryLabel}</span>
        </div>
      </div>

      {/* SVG Arc Gauge */}
      <div className="relative flex flex-col items-center justify-center my-3">
        <svg width="220" height="125" viewBox="0 0 220 125" className="overflow-visible">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2E9E5B" />
              <stop offset="20%" stopColor="#8CC152" />
              <stop offset="40%" stopColor="#F2C230" />
              <stop offset="60%" stopColor="#F08A24" />
              <stop offset="80%" stopColor="#D93F3F" />
              <stop offset="100%" stopColor="#8E1B3A" />
            </linearGradient>
          </defs>

          {/* Background Track */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="#E8EFF3"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Active Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={categoryColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />

          {/* Tick markers */}
          {[0, 100, 200, 300, 400, 500].map((val, idx) => {
            const angle = Math.PI - (val / 500) * Math.PI;
            const x1 = cx + (radius - 12) * Math.cos(angle);
            const y1 = cy - (radius - 12) * Math.sin(angle);
            const x2 = cx + (radius - 7) * Math.cos(angle);
            const y2 = cy - (radius - 7) * Math.sin(angle);
            return (
              <line
                key={idx}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#bec8cb"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>

        {/* Tabular Metric Readout */}
        <div className="absolute top-[52px] flex flex-col items-center">
          <span
            className="text-5xl font-bold font-display tracking-tight tabular-nums text-[#12232E]"
            style={{ fontFeatureSettings: '"tnum" 1' }}
          >
            {aqi}
          </span>
          <span className="text-[12px] font-medium text-[#4A5F6D] font-label -mt-0.5">
            US EPA STANDARD
          </span>
        </div>
      </div>

      {/* Dominant Driver & Clinical Context */}
      <div className="pt-2 border-t border-[#D5E1E8] flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-[#4A5F6D] font-label">
          <span>Dominant Driver: <strong className="text-[#12232E] font-medium">{dominantPollutant}</strong></span>
          <span>Scale: 0 – 500</span>
        </div>
        <p className="text-xs text-[#4A5F6D] font-body line-clamp-2 leading-relaxed">
          {advisory}
        </p>
      </div>
    </div>
  );
};
