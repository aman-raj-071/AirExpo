import React from 'react';
import { PollutantDetail } from '../types/environmental';

interface PollutantGridProps {
  pollutants: Record<string, PollutantDetail>;
}

export const PollutantGrid: React.FC<PollutantGridProps> = ({ pollutants }) => {
  const items = Object.values(pollutants);

  const getStatusColor = (status: PollutantDetail['status']) => {
    switch (status) {
      case 'safe':
        return '#2E9E5B';
      case 'moderate':
        return '#8CC152';
      case 'elevated':
        return '#F08A24';
      case 'hazardous':
        return '#D93F3F';
      default:
        return '#4A5F6D';
    }
  };

  const getStatusLabel = (status: PollutantDetail['status']) => {
    switch (status) {
      case 'safe':
        return 'Within WHO Guideline';
      case 'moderate':
        return 'Approaching Guideline';
      case 'elevated':
        return 'Exceeds Guideline';
      case 'hazardous':
        return 'Critical Exposure';
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const color = getStatusColor(item.status);
        const percent = Math.min(item.percentOfLimit, 250);

        return (
          <div
            key={item.code}
            className="bg-white border border-[#D5E1E8] rounded-2xl p-5 flex flex-col justify-between hover:border-[#0B7A8A]/40 transition-colors"
          >
            <div>
              {/* Chemical Symbol & Label */}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold font-display text-[#12232E]">
                    {item.name}
                  </span>
                  <span className="text-xs text-[#4A5F6D] font-body truncate max-w-[150px]">
                    {item.fullName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium font-label">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span style={{ color }}>{item.status.toUpperCase()}</span>
                </div>
              </div>

              {/* Numerical Concentration */}
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold font-display tracking-tight text-[#12232E] tabular-nums">
                  {item.value}
                </span>
                <span className="text-xs text-[#4A5F6D] font-label font-medium">
                  {item.unit}
                </span>
              </div>

              {/* Progress bar relative to WHO Threshold */}
              <div className="mt-3 space-y-1.5">
                <div className="w-full bg-[#E8EFF3] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(percent, 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#4A5F6D] font-label">
                  <span>WHO Standard: {item.whoSafeThreshold} {item.unit}</span>
                  <span className="tabular-nums font-medium text-[#12232E]">
                    {item.percentOfLimit}% of limit
                  </span>
                </div>
              </div>
            </div>

            {/* Contextual attribution */}
            <div className="mt-4 pt-3 border-t border-[#D5E1E8] text-[12px] text-[#4A5F6D] font-body leading-relaxed">
              {item.description}
            </div>
          </div>
        );
      })}
    </div>
  );
};
