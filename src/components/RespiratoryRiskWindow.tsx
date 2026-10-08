import React from 'react';
import { SafeRespiratoryWindow } from '../types/environmental';
import { Activity, Wind, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface RespiratoryRiskWindowProps {
  windows: SafeRespiratoryWindow[];
  currentAqi: number;
}

export const RespiratoryRiskWindow: React.FC<RespiratoryRiskWindowProps> = ({
  windows,
  currentAqi,
}) => {
  return (
    <div className="bg-white border border-[#D5E1E8] rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#D5E1E8]">
        <div>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#4A5F6D] font-label">
            Pulmonary Pacing Protocol
          </span>
          <h2 className="text-xl font-bold font-display text-[#12232E] mt-0.5">
            Respiratory Risk Windows (24-Hour Horizon)
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#4A5F6D] font-label">
          <span className="inline-flex items-center gap-1 text-[#2E9E5B]">
            <CheckCircle2 className="w-3.5 h-3.5" /> Optimal Aerobic
          </span>
          <span className="text-[#D5E1E8]">·</span>
          <span className="inline-flex items-center gap-1 text-[#0B7A8A]">
            <Wind className="w-3.5 h-3.5" /> Clean Ventilation
          </span>
          <span className="text-[#D5E1E8]">·</span>
          <span className="inline-flex items-center gap-1 text-[#F08A24]">
            <AlertCircle className="w-3.5 h-3.5" /> Ozone Peak
          </span>
        </div>
      </div>

      {/* Segmented Time-Block Visualizer */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        {windows.map((win, idx) => {
          const isBest = win.isBestWindow;
          return (
            <div
              key={idx}
              className={`rounded-xl p-4 border transition-all ${
                isBest
                  ? 'bg-[#F2F7FA] border-[#0B7A8A]/30 ring-1 ring-[#0B7A8A]/20'
                  : 'bg-white border-[#D5E1E8]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: win.accentColor }}
                  />
                  <span className="text-sm font-bold font-display text-[#12232E]">
                    {win.category}
                  </span>
                </div>
                {isBest && (
                  <span className="text-[11px] font-semibold text-[#0B7A8A] font-label">
                    PRIME WINDOW
                  </span>
                )}
              </div>

              {/* Time Range */}
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-2xl font-bold font-display tracking-tight text-[#12232E] tabular-nums">
                  {win.startTime} – {win.endTime}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2 text-xs text-[#4A5F6D] font-label">
                <span>Avg Projected AQI: <strong className="text-[#12232E] tabular-nums">{win.averageAqi}</strong></span>
              </div>

              {/* Activity recommendation */}
              <p className="mt-3 text-xs text-[#12232E] font-body leading-relaxed">
                {win.recommendedActivity}
              </p>
            </div>
          );
        })}
      </div>

      {/* Actionable Clinical Directives */}
      <div className="mt-5 pt-4 border-t border-[#D5E1E8] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#4A5F6D]">
        <div className="flex items-start gap-2.5">
          <Activity className="w-4 h-4 text-[#0B7A8A] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[#12232E] font-label">Athletic VO₂ Scheduling</div>
            <p className="font-body mt-0.5">
              {currentAqi <= 50
                ? 'Unrestricted outdoor endurance volume and peak heart-rate exertion.'
                : 'Prioritize low-ventilation early morning hours before photochemistry accelerates.'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <Wind className="w-4 h-4 text-[#0B7A8A] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[#12232E] font-label">Indoor Air Exchange</div>
            <p className="font-body mt-0.5">
              Initiate cross-ventilation during 06:00–08:30 clean tropospheric downdraft.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#0B7A8A] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[#12232E] font-label">Filtration & Barrier</div>
            <p className="font-body mt-0.5">
              {currentAqi > 100
                ? 'Activate HEPA H13 filtration; N95 recommended for sustained street-level exposure.'
                : 'Ambient particulate levels within physiological mucosal clearance tolerance.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
