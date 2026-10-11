import React from 'react';
import { DiagnosticReport } from '../types/environmental';
import { Info, RefreshCw, Wind } from 'lucide-react';

interface DiagnosticPanelProps {
  report: DiagnosticReport | null;
  isLoading: boolean;
  onRefresh: () => void;
  locationName: string;
}

export const DiagnosticPanel: React.FC<DiagnosticPanelProps> = ({ report, isLoading, onRefresh, locationName }) => {
  if (isLoading && !report) {
    return <div className="bg-white border border-[#D5E1E8] rounded-2xl p-8 flex flex-col items-center justify-center min-h-[300px]">
      <RefreshCw className="w-6 h-6 text-[#0B7A8A] animate-spin mb-3" />
      <p className="text-sm font-label text-[#12232E] font-medium">Explaining current air-quality conditions…</p>
      <p className="text-xs text-[#4A5F6D] font-body mt-1">Summarizing available environmental readings for {locationName}</p>
    </div>;
  }
  if (!report) return null;

  return <div className="bg-white border border-[#D5E1E8] rounded-2xl p-6 flex flex-col gap-5">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D5E1E8]">
      <div><div className="flex items-center gap-2"><Wind className="w-4 h-4 text-[#0B7A8A]" /><span className="text-[11px] font-semibold tracking-wider uppercase text-[#4A5F6D] font-label">Environmental explanation</span></div>
        <h2 className="text-xl font-bold font-display text-[#12232E] mt-0.5">Current air-quality context</h2></div>
      <button onClick={onRefresh} disabled={isLoading} className="p-1.5 text-[#4A5F6D] hover:text-[#0B7A8A] hover:bg-[#F2F7FA] rounded-lg transition-colors border border-[#D5E1E8]" title="Refresh environmental explanation"><RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#0B7A8A]' : ''}`} /></button>
    </div>

    <div className="p-4 bg-[#F2F7FA] border border-[#D5E1E8] rounded-xl">
      <div className="text-xs font-semibold text-[#0B7A8A] font-label uppercase tracking-wider">Modeled environmental summary</div>
      <h3 className="text-lg font-bold font-display text-[#12232E] mt-1 leading-snug">{report.environmentalHeadline}</h3>
      <p className="text-sm text-[#12232E] font-body mt-2 leading-relaxed">{report.executiveSummary}</p>
    </div>

    <div><h4 className="text-sm font-bold font-display text-[#12232E] mb-3">Readings used</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{report.observedIndicators.map((item, idx) => <div key={`${item.label}-${idx}`} className="p-3.5 bg-white border border-[#D5E1E8] rounded-xl"><div className="text-xs font-semibold text-[#4A5F6D]">{item.label}</div><div className="text-lg font-bold text-[#12232E] mt-1">{item.value}</div></div>)}</div>
    </div>

    <div className="grid md:grid-cols-2 gap-4">
      <div className="p-4 border border-[#D5E1E8] rounded-xl bg-white"><h4 className="flex items-center gap-2 text-sm font-bold text-[#12232E]"><Info className="w-4 h-4 text-[#0B7A8A]" />Context</h4><ul className="mt-2 space-y-2">{report.contextNotes.map((note, idx) => <li key={idx} className="text-xs text-[#12232E] leading-relaxed">{note}</li>)}</ul></div>
      <div className="p-4 border border-[#D5E1E8] rounded-xl bg-white"><h4 className="text-sm font-bold text-[#12232E]">Limitations</h4><ul className="mt-2 space-y-2">{report.limitations.map((note, idx) => <li key={idx} className="text-xs text-[#4A5F6D] leading-relaxed">{note}</li>)}</ul></div>
    </div>
    <p className="text-[11px] text-[#4A5F6D] border-t border-[#D5E1E8] pt-3">Environmental information only. It is not medical advice, a diagnosis, or a treatment recommendation.</p>
  </div>;
};
