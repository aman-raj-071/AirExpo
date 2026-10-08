import React from 'react';
import { DiagnosticReport } from '../types/environmental';
import { Stethoscope, Sparkles, HeartPulse, User, Dumbbell, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';

interface DiagnosticPanelProps {
  report: DiagnosticReport | null;
  isLoading: boolean;
  onRefresh: () => void;
  locationName: string;
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({
  report,
  isLoading,
  onRefresh,
  locationName,
}) => {
  if (isLoading && !report) {
    return (
      <div className="bg-white border border-[#D5E1E8] rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px]">
        <RefreshCw className="w-6 h-6 text-[#0B7A8A] animate-spin mb-3" />
        <p className="text-sm font-label text-[#12232E] font-medium">
          Synthesizing Atmospheric Diagnostic Matrix...
        </p>
        <p className="text-xs text-[#4A5F6D] font-body mt-1">
          Processing real-time satellite scans and localized chemical kinetics for {locationName}
        </p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="bg-white border border-[#D5E1E8] rounded-2xl p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D5E1E8]">
        <div>
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#0B7A8A]" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[#4A5F6D] font-label">
              Medical-Grade Atmospheric Synthesis
            </span>
          </div>
          <h2 className="text-xl font-bold font-display text-[#12232E] mt-0.5">
            Diagnostic Health Evaluation & Source Attribution
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-[#4A5F6D] font-label">
            <span>Sensor Confidence:</span>
            <strong className="text-[#0B7A8A] font-medium tabular-nums">{report.confidenceScore}%</strong>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 text-[#4A5F6D] hover:text-[#0B7A8A] hover:bg-[#F2F7FA] rounded-lg transition-colors border border-[#D5E1E8]"
            title="Re-run diagnostic analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0B7A8A]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Clinical Headline & Executive Summary */}
      <div className="p-4 bg-[#F2F7FA] border border-[#D5E1E8] rounded-xl">
        <div className="text-xs font-semibold text-[#0B7A8A] font-label uppercase tracking-wider">
          Diagnostic Assessment
        </div>
        <h3 className="text-lg font-bold font-display text-[#12232E] mt-1 leading-snug">
          {report.clinicalHeadline}
        </h3>
        <p className="text-sm text-[#12232E] font-body mt-2 leading-relaxed">
          {report.executiveSummary}
        </p>
      </div>

      {/* Particulate Source Attribution Breakdown */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold font-display text-[#12232E]">
            Aerosol & Gas Source Attribution
          </h4>
          <span className="text-xs text-[#4A5F6D] font-label">Kinetic & Satellite Estimator</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {report.sourceAttribution.map((item, idx) => (
            <div key={idx} className="p-3.5 bg-white border border-[#D5E1E8] rounded-xl">
              <div className="flex items-center justify-between text-xs font-label">
                <span className="font-semibold text-[#12232E] truncate pr-2">{item.factor}</span>
                <span className="font-bold text-[#0B7A8A] tabular-nums">{item.contributionPercent}%</span>
              </div>
              <div className="w-full bg-[#E8EFF3] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-[#0B7A8A] rounded-full"
                  style={{ width: `${item.contributionPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-[#4A5F6D] font-body mt-2 leading-normal">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Vulnerable Population Directives */}
      <div>
        <h4 className="text-sm font-bold font-display text-[#12232E] mb-3">
          Physiological Advisory Matrix
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-[#D5E1E8] rounded-xl bg-white">
            <div className="flex items-center gap-2 text-xs font-bold font-display text-[#12232E] pb-2 border-b border-[#D5E1E8]">
              <HeartPulse className="w-4 h-4 text-[#D93F3F]" />
              <span>Asthma & Pulmonary Sensitive</span>
            </div>
            <p className="mt-2.5 text-xs text-[#12232E] font-body leading-relaxed">
              {report.vulnerablePopulationAdvice.asthmaAndRespiratory}
            </p>
          </div>

          <div className="p-4 border border-[#D5E1E8] rounded-xl bg-white">
            <div className="flex items-center gap-2 text-xs font-bold font-display text-[#12232E] pb-2 border-b border-[#D5E1E8]">
              <User className="w-4 h-4 text-[#0B7A8A]" />
              <span>Pediatric & Senior Cohorts</span>
            </div>
            <p className="mt-2.5 text-xs text-[#12232E] font-body leading-relaxed">
              {report.vulnerablePopulationAdvice.pediatricAndElderly}
            </p>
          </div>

          <div className="p-4 border border-[#D5E1E8] rounded-xl bg-white">
            <div className="flex items-center gap-2 text-xs font-bold font-display text-[#12232E] pb-2 border-b border-[#D5E1E8]">
              <Dumbbell className="w-4 h-4 text-[#2E9E5B]" />
              <span>Endurance Athletes & VO₂ Max</span>
            </div>
            <p className="mt-2.5 text-xs text-[#12232E] font-body leading-relaxed">
              {report.vulnerablePopulationAdvice.enduranceAthletes}
            </p>
          </div>
        </div>
      </div>

      {/* Actionable Micro-Climate Protocols */}
      <div className="pt-4 border-t border-[#D5E1E8]">
        <h4 className="text-sm font-bold font-display text-[#12232E] mb-3">
          Actionable Exposure Mitigation Protocol
        </h4>
        <div className="space-y-2">
          {report.microClimateAction.map((action, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-[#12232E] font-body">
              <CheckCircle2 className="w-4 h-4 text-[#2E9E5B] shrink-0 mt-0.5" />
              <span>{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
