import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, ClipboardList, Sparkles, RefreshCw } from 'lucide-react';
import { cloudRequest } from '../services/cloudStorage';

type Report = { key: string; documentId: string; name: string; type: string; createdAt: string; size: number; status: string; confirmed: boolean; jobId?: string };
type Analysis = Report & { extractedText?: string; confirmedFacts?: string[]; jobId?: string; extractionTruncated?: boolean };
type AiSuggestion = {
  headline: string;
  summary?: string;
  doList: string[];
  dontList: string[];
  necessaryList: string[];
  warningSigns?: string[];
  dailyRoutine?: string[];
  disclaimer: string;
  documentId: string;
  documentName: string;
  analysedAt: string;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

function errorMessage(error: unknown) {
  const msg = error instanceof Error ? error.message : 'Could not complete this request.';
  return msg;
}

// ── AI Suggestion Cards ──────────────────────────────────────────────────────
function AiSuggestionPanel({
  suggestion,
  loading,
  onReanalyse,
}: {
  suggestion: AiSuggestion | null;
  loading: boolean;
  onReanalyse: () => void;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 flex items-center gap-4 animate-pulse">
        <Sparkles className="w-6 h-6 text-primary shrink-0" />
        <div>
          <p className="font-semibold text-on-surface">Analysing your report…</p>
          <p className="text-sm text-on-surface-variant mt-1">Gemini is reading the confirmed text. This takes a few seconds.</p>
        </div>
      </div>
    );
  }

  if (!suggestion) return null;

  const mainCards: Array<{
    key: keyof Pick<AiSuggestion, 'doList' | 'dontList' | 'necessaryList'>;
    title: string;
    icon: React.ReactNode;
    accent: string;
    bg: string;
    border: string;
    dot: string;
  }> = [
    {
      key: 'doList',
      title: '✅ What to do',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
      accent: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      dot: 'bg-emerald-500',
    },
    {
      key: 'dontList',
      title: '⛔ What not to do',
      icon: <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />,
      accent: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      dot: 'bg-rose-500',
    },
    {
      key: 'necessaryList',
      title: '📋 Necessary actions',
      icon: <ClipboardList className="w-5 h-5 text-amber-600 shrink-0" />,
      accent: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
    },
  ];

  return (
    <div className="space-y-5 mt-2">
      {/* Header + summary */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                AI Report Analysis · {suggestion.documentName}
              </p>
              <p className="font-bold text-on-surface text-lg leading-snug">{suggestion.headline}</p>
            </div>
          </div>
          <button
            onClick={onReanalyse}
            title="Re-analyse this report"
            className="shrink-0 p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
        {suggestion.summary && (
          <p className="text-sm text-on-surface leading-relaxed border-t border-primary/20 pt-3">
            {suggestion.summary}
          </p>
        )}
      </div>

      {/* Main three cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {mainCards.map(({ key, title, accent, bg, border, dot }) => (
          <div key={key} className={`rounded-2xl border ${border} ${bg} p-4 space-y-3`}>
            <h4 className={`font-bold text-sm ${accent}`}>{title}</h4>
            {suggestion[key].length === 0 ? (
              <p className="text-xs text-on-surface-variant italic">Nothing specific noted.</p>
            ) : (
              <ul className="space-y-2">
                {suggestion[key].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Warning signs + Daily routine side by side */}
      {((suggestion.warningSigns?.length ?? 0) > 0 || (suggestion.dailyRoutine?.length ?? 0) > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {(suggestion.warningSigns?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-4 space-y-3">
              <h4 className="font-bold text-sm text-red-700">🚨 Warning signs — seek help immediately</h4>
              <ul className="space-y-2">
                {suggestion.warningSigns!.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-red-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(suggestion.dailyRoutine?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
              <h4 className="font-bold text-sm text-blue-700">📅 Daily routine to adopt</h4>
              <ul className="space-y-2">
                {suggestion.dailyRoutine!.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-blue-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-on-surface-variant border border-outline-variant rounded-xl px-4 py-3 bg-surface-container-low">
        <strong>Important:</strong> {suggestion.disclaimer}
      </p>
      <p className="text-[10px] text-on-surface-variant">
        Analysed {new Date(suggestion.analysedAt).toLocaleString()} · Based only on text you reviewed and confirmed.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function MedicalReportsPanel() {
  const [reports, setReports] = useState<Report[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [facts, setFacts] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(true);
  const [available, setAvailable] = useState(false);
  const [notice, setNotice] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const result = await cloudRequest('/documents');
    setReports(result.data || []);
  }

  useEffect(() => {
    let active = true;
    setBusy(false);
    setAvailable(true);
    refresh().catch(() => {});
    return () => { active = false; };
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true); setNotice('');
    try { await action(); } catch (e) { setNotice(errorMessage(e)); } finally { setBusy(false); }
  }

  // Auto-trigger AI analysis for a confirmed document — retries once on 429
  async function triggerAiAnalysis(documentId: string) {
    setAiSuggestion(null);
    setAiLoading(true);
    setNotice('');
    setTimeout(() => suggestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    const attempt = async () => cloudRequest('/documents/analyse', { documentId, consent: true });
    try {
      let result;
      try {
        result = await attempt();
      } catch (first) {
        // If rate-limited, wait 12 seconds and retry once
        if (first instanceof Error && /429|quota|rate|unavailable/i.test(first.message)) {
          setNotice('Gemini is rate-limited — retrying in 12 seconds…');
          await new Promise(r => setTimeout(r, 12000));
          setNotice('');
          result = await attempt();
        } else {
          throw first;
        }
      }
      setAiSuggestion(result.data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI analysis failed.';
      setNotice(
        /429|quota|rate/i.test(msg)
          ? 'Gemini free-tier quota is exhausted. Wait a minute and click the ↻ refresh button to retry.'
          : /not configured|503/i.test(msg)
          ? 'AI analysis needs GEMINI_API_KEY and AI_PROVIDER=gemini set on the server.'
          : msg + ' — click ↻ to retry.'
      );
    } finally {
      setAiLoading(false);
    }
  }

  const chooseFile = (selected: File | null) => {
    setNotice('');
    if (selected && (selected.size > MAX_FILE_SIZE || !ACCEPTED_TYPES.includes(selected.type))) {
      setFile(null);
      if (input.current) input.current.value = '';
      setNotice('Choose a PDF, PNG or JPEG up to 2 MB.');
      return;
    }
    setFile(selected);
  };

  const upload = () => {
    if (!file) return;
    void run(async () => {
      if (!consent) throw new Error('Confirm document-processing consent first.');
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read the file.'));
        reader.readAsDataURL(file);
      });
      const uploaded = await cloudRequest('/documents', { name: file.name, type: file.type, content });
      let result = await cloudRequest('/documents/process', { key: uploaded.data.key, consent: true });
      for (let attempt = 0; result.data?.status === 'processing' && attempt < 15; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        result = await cloudRequest('/documents/process', { key: uploaded.data.key, jobId: result.data.jobId, consent: true });
      }
      if (result.data?.status === 'processing') throw new Error('Textract is still processing. Select the uploaded report again in a moment.');
      const detail = await cloudRequest('/documents/analysis?key=' + encodeURIComponent(uploaded.data.key));
      setAnalysis(detail.data);
      setFacts(detail.data.extractedText || '');
      setFile(null); setConsent(false);
      if (input.current) input.current.value = '';
      await refresh();
      setNotice('Text extraction is complete. Review the page text below and confirm or correct the details before the assistant can use it.');
    });
  };

  const inspect = (report: Report) => void run(async () => {
    const result = await cloudRequest('/documents/analysis?key=' + encodeURIComponent(report.key));
    setAnalysis(result.data);
    setFacts((result.data.confirmedFacts || []).join('\n') || result.data.extractedText || '');
    // Show cached AI analysis if available
    if (result.data.aiAnalysis) setAiSuggestion(result.data.aiAnalysis);
    else setAiSuggestion(null);
  });

  const resume = (report: Report) => void run(async () => {
    let result = await cloudRequest('/documents/process', { key: report.key, jobId: report.jobId, consent: true });
    for (let attempt = 0; result.data?.status === 'processing' && attempt < 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      result = await cloudRequest('/documents/process', { key: report.key, jobId: result.data.jobId || report.jobId, consent: true });
    }
    if (result.data?.status === 'processing') throw new Error('Textract is still processing. Try again shortly.');
    const detail = await cloudRequest('/documents/analysis?key=' + encodeURIComponent(report.key));
    setAnalysis(detail.data);
    setFacts(detail.data.extractedText || '');
    await refresh();
    setNotice('Text extraction is complete. Review and confirm the report details.');
  });

  const processPending = (report: Report) => void run(async () => {
    if (!consent) throw new Error('Confirm document-processing consent first.');
    let result = await cloudRequest('/documents/process', { key: report.key, consent: true });
    for (let attempt = 0; result.data?.status === 'processing' && attempt < 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      result = await cloudRequest('/documents/process', { key: report.key, jobId: result.data.jobId, consent: true });
    }
    if (result.data?.status === 'processing') throw new Error('Textract is still processing. Try again shortly.');
    const detail = await cloudRequest('/documents/analysis?key=' + encodeURIComponent(report.key));
    setAnalysis(detail.data);
    setFacts(detail.data.extractedText || '');
    setConsent(false);
    await refresh();
    setNotice('Text extraction is complete. Review and confirm the report details.');
  });

  const confirm = () => {
    if (!analysis) return;
    void run(async () => {
      const confirmedFacts = facts.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (!confirmedFacts.length) throw new Error('Enter or retain the report details you reviewed.');
      await cloudRequest('/documents/confirm', { documentId: analysis.documentId, facts });
      setAnalysis({ ...analysis, confirmed: true, confirmedFacts });
      await refresh();
      setNotice('Report confirmed. Running AI analysis…');
      // Auto-trigger AI analysis immediately after confirm
      void triggerAiAnalysis(analysis.documentId);
    });
  };

  const download = (report: Report) => void run(async () => {
    const result = await cloudRequest('/documents/content?key=' + encodeURIComponent(report.key));
    const bytes = Uint8Array.from(atob(result.data.content), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: result.data.type }));
    const a = document.createElement('a'); a.href = url;
    a.download = result.data.name.replace(/[\\/]/g, '_'); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const remove = (report: Report) => void run(async () => {
    await cloudRequest('/documents?documentId=' + encodeURIComponent(report.documentId), undefined, 'DELETE');
    if (analysis?.documentId === report.documentId) { setAnalysis(null); setAiSuggestion(null); }
    await refresh();
    setNotice('Report and extracted details were deleted from S3 and DynamoDB.');
  });

  return (
    <div className="space-y-6">
      {/* Upload + Saved reports */}
      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-7 items-start">
        <div className="space-y-4">
          <div>
            <h3 className="font-title-md text-title-md">Medical reports</h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Upload a PDF, including a scanned PDF, PNG or JPEG. Original files remain private in S3 and
              downloadable from Saved reports. After your consent, Amazon Textract extracts page-labeled text for
              review. Gemini does not receive the original file; only selected text that you review and confirm can
              be shared in the Health Assistant after a separate Gemini consent.
            </p>
          </div>
          <p className="text-xs text-on-surface-variant">
            Extracted text can contain errors; correct it before confirming. Review Google's API data terms and billing status before sharing real medical records.
          </p>
          {/* Styled file upload zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose medical report file"
            onClick={() => !busy && available && input.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
            onDragOver={e => { e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) chooseFile(f); }}
            className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors
              ${file ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary hover:bg-surface-container-low'}
              ${busy || !available ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          >
            <input
              ref={input}
              aria-hidden="true"
              tabIndex={-1}
              disabled={busy || !available}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={e => chooseFile(e.target.files?.[0] || null)}
              className="sr-only"
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary text-xl">📄</span>
                </div>
                <p className="font-semibold text-sm text-on-surface">{file.name}</p>
                <p className="text-xs text-on-surface-variant">{Math.max(1, Math.round(file.size / 1024))} KB · Click to change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
                  <span className="text-2xl">⬆️</span>
                </div>
                <p className="font-semibold text-sm text-on-surface">Click to choose a file</p>
                <p className="text-xs text-on-surface-variant">or drag and drop here</p>
                <p className="text-xs text-on-surface-variant mt-1">PDF, PNG or JPEG · up to 2 MB</p>
              </div>
            )}
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
            <span>I consent to Amazon Textract processing this document to extract text. The original stays in my private account. This does not send it to Gemini or provide a diagnosis.</span>
          </label>
          <button
            type="button"
            disabled={busy || !available || !file || !consent}
            onClick={upload}
            className="px-4 py-2.5 rounded-xl bg-primary text-on-primary disabled:opacity-50"
          >
            {busy ? 'Processing…' : 'Upload and extract text'}
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="font-title-md text-title-md">Saved reports</h3>
          {!busy && available && reports.length === 0 && (
            <p className="p-4 rounded-xl border border-dashed text-sm">No reports uploaded yet.</p>
          )}
          {reports.map(report => (
            <article key={report.documentId} className="rounded-xl border border-outline-variant p-3 text-sm">
              <div className="flex justify-between gap-2">
                <button onClick={() => inspect(report)} className="text-left underline font-medium">{report.name || 'Medical report'}</button>
                <span className={`text-xs px-2 py-0.5 rounded-full ${report.confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-container text-on-surface-variant'}`}>
                  {report.confirmed ? '✓ Reviewed' : report.status}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-1">{new Date(report.createdAt).toLocaleDateString()} · {Math.max(1, Math.round(report.size / 1024))} KB</p>
              <div className="mt-2 flex gap-4 text-xs flex-wrap">
                <button disabled={busy} onClick={() => download(report)} className="underline">Download</button>
                {report.confirmed && (
                  <button disabled={busy} onClick={async () => {
                    // Load the document analysis first (sets analysis state),
                    // then trigger AI — sequentially so documentId is always available.
                    await new Promise<void>(resolve => {
                      const req = cloudRequest('/documents/analysis?key=' + encodeURIComponent(report.key));
                      req.then(result => {
                        setAnalysis(result.data);
                        setFacts((result.data.confirmedFacts || []).join('\n') || result.data.extractedText || '');
                        if (result.data.aiAnalysis) setAiSuggestion(result.data.aiAnalysis);
                        else setAiSuggestion(null);
                        resolve();
                      }).catch(() => resolve());
                    });
                    void triggerAiAnalysis(report.documentId);
                  }} className="underline text-primary font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Analyse with AI
                  </button>
                )}
                {report.status === 'processing' && <button disabled={busy} onClick={() => resume(report)} className="underline">Resume extraction</button>}
                {['quarantined', 'failed'].includes(report.status) && <button disabled={busy || !consent} onClick={() => processPending(report)} className="underline disabled:opacity-50">Process with consent</button>}
                <button disabled={busy} onClick={() => remove(report)} className="underline text-error">Delete</button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Extracted text review */}
      {analysis && (
        <section className="rounded-2xl border border-primary/40 p-4 space-y-3">
          <div>
            <h3 className="font-title-md">Review extracted text</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Page labels and Textract confidence estimates are retained. Correct errors and remove anything you
              don't want used as confirmed context.
            </p>
            {analysis.extractionTruncated && (
              <p className="mt-2 text-sm text-error">The extracted text was shortened to fit secure storage. Review the original report for omitted content.</p>
            )}
          </div>
          <textarea
            aria-label="Review and correct extracted medical report text"
            value={facts}
            onChange={e => setFacts(e.target.value)}
            rows={10}
            className="w-full p-3 rounded-xl border border-outline-variant font-mono text-xs"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              disabled={busy}
              onClick={confirm}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary disabled:opacity-50"
            >
              {analysis.confirmed ? 'Save corrections and re-analyse' : 'Confirm and analyse with AI'}
            </button>
            {analysis.confirmed && (
              <p className="text-sm text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Confirmed. You can also choose this report in the Health Assistant.
              </p>
            )}
          </div>
        </section>
      )}

      {/* AI Suggestion Cards */}
      <div ref={suggestionRef}>
        <AiSuggestionPanel
          suggestion={aiSuggestion}
          loading={aiLoading}
          onReanalyse={() => {
            const id = analysis?.documentId || aiSuggestion?.documentId;
            if (id) void triggerAiAnalysis(id);
          }}
        />
      </div>

      {notice && <p role="status" className="text-sm">{notice}</p>}
    </div>
  );
}
