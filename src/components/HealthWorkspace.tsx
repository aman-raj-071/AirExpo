import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  HeartPulse,
  NotebookPen,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { EnvironmentalStationData } from '../types/environmental';
import { HealthProfile, SymptomEntry, SymptomSeverity, UserMode } from '../types/health';
import {
  DEFAULT_HEALTH_PROFILE,
  clearLocalHealthData,
  loadHealthProfile,
  loadSymptomEntries,
  saveHealthProfile,
  saveSymptomEntries,
} from '../services/localHealthStore';

interface HealthWorkspaceProps {
  stationData: EnvironmentalStationData | null;
  onModeChange?: (mode: UserMode) => void;
}

const MODES: Array<{ id: UserMode; title: string; description: string }> = [
  { id: 'everyday', title: 'Everyday', description: 'Commuting and routine outdoor planning' },
  { id: 'asthma', title: 'Asthma care', description: 'Extra respiratory precautions and journaling' },
  { id: 'athlete', title: 'Athlete', description: 'Training windows and inhaled-dose estimates' },
];

const SYMPTOMS = ['Cough', 'Wheezing', 'Breathlessness', 'Chest tightness', 'Night waking'];
const TRIGGERS = ['Traffic', 'Dust', 'Pollen', 'Smoke', 'Cold air', 'Exercise'];

function exposureLabel(aqi: number, mode: UserMode, minutes: number, intensity: number) {
  const sensitivity = mode === 'asthma' ? 1.45 : mode === 'athlete' ? 1.15 : 1;
  const score = aqi * sensitivity * (minutes / 30) * intensity;
  if (score >= 260) return { label: 'High concern', color: '#ba1a1a', advice: 'Move the activity indoors or wait for a cleaner forecast window.' };
  if (score >= 120) return { label: 'Elevated concern', color: '#F08A24', advice: 'Reduce duration or intensity and watch for symptoms.' };
  if (score >= 60) return { label: 'Moderate concern', color: '#F2C230', advice: 'A shorter, easier session is the lower-exposure choice.' };
  return { label: 'Lower concern', color: '#2E9E5B', advice: 'Conditions are comparatively favorable; continue monitoring changes.' };
}

function downloadSummary(profile: HealthProfile, entries: SymptomEntry[]) {
  const lines = [
    'AIREXPO — DOCTOR-READY DISCUSSION SUMMARY',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    'This document contains user-recorded observations and is not a diagnosis.',
    '',
    `Mode: ${profile.mode}`,
    `Age range: ${profile.ageRange || 'Not provided'}`,
    `Known triggers: ${profile.knownTriggers.join(', ') || 'None recorded'}`,
    `Usual outdoor activity: ${profile.usualOutdoorMinutes} minutes`,
    `Prescribed action plan note: ${profile.prescribedActionPlan || 'Not recorded'}`,
    '',
    `SYMPTOM JOURNAL (${entries.length} entries)`,
    ...entries.flatMap((entry) => [
      '',
      `${new Date(entry.recordedAt).toLocaleString()} — ${entry.severity.toUpperCase()}`,
      `Symptoms: ${entry.symptoms.join(', ') || 'None selected'}`,
      `Suspected triggers: ${entry.suspectedTriggers || 'Not recorded'}`,
      `Prescribed inhaler used: ${entry.inhalerUsed ? 'Yes' : 'No'}`,
      `Peak flow: ${entry.peakFlow ?? 'Not recorded'}`,
      `Environment: ${entry.environmentalSnapshot.location}; AQI ${entry.environmentalSnapshot.aqi}; PM2.5 ${entry.environmentalSnapshot.pm25} µg/m³`,
      `Notes: ${entry.notes || 'None'}`,
    ]),
    '',
    'Seek urgent medical help for severe breathlessness, inability to speak normally, blue/grey lips, confusion, or symptoms not responding to the prescribed rescue plan.',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `airguard-health-summary-${new Date().toISOString().slice(0, 10)}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const HealthWorkspace: React.FC<HealthWorkspaceProps> = ({ stationData, onModeChange }) => {
  const [profile, setProfile] = useState<HealthProfile>(() => loadHealthProfile());
  const [entries, setEntries] = useState<SymptomEntry[]>(() => loadSymptomEntries());
  const [activePanel, setActivePanel] = useState<'profile' | 'journal' | 'simulator'>('profile');
  const [notice, setNotice] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<SymptomSeverity>('mild');
  const [suspectedTriggers, setSuspectedTriggers] = useState('');
  const [inhalerUsed, setInhalerUsed] = useState(false);
  const [peakFlow, setPeakFlow] = useState('');
  const [notes, setNotes] = useState('');
  const [activityMinutes, setActivityMinutes] = useState(profile.usualOutdoorMinutes);
  const [activityType, setActivityType] = useState<'walk' | 'cycle' | 'run'>('walk');
  const [medicalFiles, setMedicalFiles] = useState<File[]>([]);

  const currentAqi = stationData?.currentAqi ?? 100;
  const pm25 = stationData?.pollutants.pm2_5?.value ?? 25;
  const intensity = activityType === 'walk' ? 1 : activityType === 'cycle' ? 1.55 : 1.9;
  const simulation = useMemo(
    () => exposureLabel(currentAqi, profile.mode, activityMinutes, intensity),
    [currentAqi, profile.mode, activityMinutes, intensity]
  );
  const inhaledDose = Math.round(pm25 * (activityType === 'walk' ? 15 : activityType === 'cycle' ? 30 : 45) * activityMinutes / 1000);

  const updateProfile = (next: HealthProfile) => {
    setProfile(next);
    saveHealthProfile(next);
    onModeChange?.(next.mode);
    setNotice('Profile saved on this device.');
  };

  const addJournalEntry = () => {
    const entry: SymptomEntry = {
      id: crypto.randomUUID?.() ?? Date.now().toString(),
      recordedAt: new Date().toISOString(),
      symptoms: selectedSymptoms,
      severity,
      suspectedTriggers,
      inhalerUsed,
      peakFlow: peakFlow ? Number(peakFlow) : undefined,
      notes,
      environmentalSnapshot: {
        location: stationData?.location.name ?? 'Unknown location',
        aqi: currentAqi,
        pm25,
      },
    };
    const next = [entry, ...entries];
    setEntries(next);
    saveSymptomEntries(next);
    setSelectedSymptoms([]);
    setSuspectedTriggers('');
    setInhalerUsed(false);
    setPeakFlow('');
    setNotes('');
    setNotice('Journal entry saved with the current environmental snapshot.');
  };

  return (
    <section id="health-workspace-section" className="w-full px-margin-mobile md:px-margin pb-space-xl">
      <div className="rounded-3xl bg-surface-container-lowest border border-surface-container shadow-sm overflow-hidden">
        <div className="p-5 md:p-7 border-b border-surface-container flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="font-label-caps text-label-caps uppercase text-primary flex items-center gap-2"><HeartPulse className="w-4 h-4" /> Personal protection workspace</div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">Profile, journal and “what if?” simulator</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 max-w-3xl">Optional, user-entered information turns general AQI readings into practical planning guidance. This prototype stores entries only in this browser.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['profile', 'journal', 'simulator'] as const).map((panel) => (
              <button key={panel} onClick={() => setActivePanel(panel)} className={`px-4 py-2 rounded-xl capitalize font-label-md ${activePanel === panel ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}>
                {panel}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 md:p-7">
          {notice && <div className="mb-4 p-3 rounded-xl bg-secondary-container/35 text-on-secondary-container flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

          {activePanel === 'profile' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-3">
                {MODES.map((mode) => (
                  <button key={mode.id} onClick={() => updateProfile({ ...profile, mode: mode.id })} className={`text-left p-4 rounded-2xl border ${profile.mode === mode.id ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-surface-container'}`}>
                    <div className="font-title-md text-title-md text-on-surface">{mode.title}</div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant mt-1">{mode.description}</div>
                  </button>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <label className="font-label-md text-on-surface">Age range
                  <select value={profile.ageRange} onChange={(e) => setProfile({ ...profile, ageRange: e.target.value })} className="mt-2 w-full p-3 rounded-xl border border-outline-variant bg-white">
                    {['Under 13', '13–17', '18–39', '40–64', '65+'].map((age) => <option key={age}>{age}</option>)}
                  </select>
                </label>
                <label className="font-label-md text-on-surface">Usual outdoor duration
                  <input type="number" min="5" max="300" value={profile.usualOutdoorMinutes} onChange={(e) => setProfile({ ...profile, usualOutdoorMinutes: Number(e.target.value) })} className="mt-2 w-full p-3 rounded-xl border border-outline-variant" />
                </label>
              </div>
              <div>
                <div className="font-label-md text-on-surface mb-2">Known triggers (optional)</div>
                <div className="flex flex-wrap gap-2">{TRIGGERS.map((trigger) => <button key={trigger} onClick={() => setProfile({ ...profile, knownTriggers: profile.knownTriggers.includes(trigger) ? profile.knownTriggers.filter((item) => item !== trigger) : [...profile.knownTriggers, trigger] })} className={`px-3 py-2 rounded-xl border text-sm ${profile.knownTriggers.includes(trigger) ? 'bg-primary text-white border-primary' : 'border-outline-variant'}`}>{trigger}</button>)}</div>
              </div>
              <label className="block font-label-md text-on-surface">Doctor-provided action-plan reminder (optional)
                <textarea value={profile.prescribedActionPlan} onChange={(e) => setProfile({ ...profile, prescribedActionPlan: e.target.value })} rows={3} className="mt-2 w-full p-3 rounded-xl border border-outline-variant" placeholder="Record instructions exactly as provided by your clinician. AirExpo will not modify them." />
              </label>
              {profile.mode === 'asthma' && (
                <div className="p-5 rounded-2xl border-2 border-dashed border-primary bg-surface-container-low">
                  <div className="flex items-start gap-3">
                    <Upload className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-title-md">Medical history and prescription upload</h3>
                      <p className="text-sm text-on-surface-variant mt-1">Upload PDF, JPG, or PNG documents only after signing in. In this local demo, files stay in the current browser session and are not transmitted.</p>
                      <input
                        className="mt-4 block w-full text-sm file:mr-4 file:px-4 file:py-2 file:border file:border-primary file:bg-secondary file:text-on-secondary file:font-semibold"
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        multiple
                        onChange={(event) => setMedicalFiles(Array.from(event.target.files || []))}
                      />
                      {medicalFiles.length > 0 && (
                        <ul className="mt-3 space-y-2 text-sm">
                          {medicalFiles.map((file) => <li key={`${file.name}-${file.lastModified}`} className="flex justify-between bg-white border border-primary/20 p-2"><span>{file.name}</span><span>{Math.ceil(file.size / 1024)} KB</span></li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button onClick={() => updateProfile(profile)} className="px-4 py-2.5 rounded-xl bg-primary text-on-primary flex items-center gap-2"><Save className="w-4 h-4" /> Save profile</button>
                <button onClick={() => { clearLocalHealthData(); setProfile(DEFAULT_HEALTH_PROFILE); setEntries([]); setNotice('Local demo health data cleared.'); }} className="px-4 py-2.5 rounded-xl border border-error/30 text-error flex items-center gap-2"><Trash2 className="w-4 h-4" /> Clear local health data</button>
              </div>
            </div>
          )}

          {activePanel === 'journal' && (
            <div className="grid lg:grid-cols-[1fr_0.9fr] gap-7">
              <div className="space-y-5">
                <div><div className="font-label-md mb-2">Symptoms</div><div className="flex flex-wrap gap-2">{SYMPTOMS.map((symptom) => <button key={symptom} onClick={() => setSelectedSymptoms(selectedSymptoms.includes(symptom) ? selectedSymptoms.filter((item) => item !== symptom) : [...selectedSymptoms, symptom])} className={`px-3 py-2 rounded-xl border text-sm ${selectedSymptoms.includes(symptom) ? 'bg-tertiary text-white border-tertiary' : 'border-outline-variant'}`}>{symptom}</button>)}</div></div>
                <label className="block font-label-md">Severity<select value={severity} onChange={(e) => setSeverity(e.target.value as SymptomSeverity)} className="mt-2 w-full p-3 rounded-xl border border-outline-variant bg-white"><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></label>
                <label className="block font-label-md">Suspected triggers<input value={suspectedTriggers} onChange={(e) => setSuspectedTriggers(e.target.value)} className="mt-2 w-full p-3 rounded-xl border border-outline-variant" placeholder="Traffic, pollen, exercise…" /></label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 font-label-md"><input type="checkbox" checked={inhalerUsed} onChange={(e) => setInhalerUsed(e.target.checked)} /> Prescribed inhaler used</label>
                  <label className="font-label-md">Peak flow (optional)<input type="number" min="0" value={peakFlow} onChange={(e) => setPeakFlow(e.target.value)} className="mt-2 w-full p-3 rounded-xl border border-outline-variant" /></label>
                </div>
                <label className="block font-label-md">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 w-full p-3 rounded-xl border border-outline-variant" /></label>
                <button onClick={addJournalEntry} className="px-4 py-2.5 rounded-xl bg-primary text-on-primary flex items-center gap-2"><NotebookPen className="w-4 h-4" /> Save journal entry</button>
              </div>
              <div>
                <div className="flex justify-between items-center mb-3"><h3 className="font-title-md text-title-md">Recent entries</h3><button disabled={!entries.length} onClick={() => downloadSummary(profile, entries)} className="px-3 py-2 rounded-xl border border-primary text-primary disabled:opacity-40 flex items-center gap-2 text-sm"><Download className="w-4 h-4" /> Download summary</button></div>
                <div className="space-y-3 max-h-[430px] overflow-auto">{entries.length === 0 ? <div className="p-5 rounded-2xl bg-surface-container-low text-on-surface-variant">No observations recorded yet.</div> : entries.map((entry) => <article key={entry.id} className="p-4 rounded-2xl border border-surface-container"><div className="flex justify-between gap-3"><strong className="capitalize">{entry.severity}</strong><span className="text-xs text-on-surface-variant">{new Date(entry.recordedAt).toLocaleString()}</span></div><p className="text-sm mt-2">{entry.symptoms.join(', ') || 'No symptoms selected'}</p><p className="text-xs text-on-surface-variant mt-2">AQI {entry.environmentalSnapshot.aqi} · PM2.5 {entry.environmentalSnapshot.pm25} µg/m³ · {entry.environmentalSnapshot.location}</p></article>)}</div>
              </div>
            </div>
          )}

          {activePanel === 'simulator' && (
            <div className="grid lg:grid-cols-[1fr_0.9fr] gap-7 items-start">
              <div className="space-y-6">
                <div><div className="font-label-md mb-2">Activity</div><div className="flex gap-2">{(['walk', 'cycle', 'run'] as const).map((activity) => <button key={activity} onClick={() => setActivityType(activity)} className={`capitalize px-4 py-2 rounded-xl ${activityType === activity ? 'bg-primary text-white' : 'bg-surface-container-low'}`}>{activity}</button>)}</div></div>
                <label className="block font-label-md">Outdoor duration: <strong>{activityMinutes} minutes</strong><input type="range" min="5" max="180" step="5" value={activityMinutes} onChange={(e) => setActivityMinutes(Number(e.target.value))} className="w-full mt-3 accent-primary" /></label>
                <div className="grid grid-cols-2 gap-3"><div className="p-4 rounded-2xl bg-surface-container-low"><div className="text-xs text-on-surface-variant">Live AQI</div><div className="text-3xl font-bold">{currentAqi}</div></div><div className="p-4 rounded-2xl bg-surface-container-low"><div className="text-xs text-on-surface-variant">Estimated inhaled PM2.5</div><div className="text-3xl font-bold">{inhaledDose}<span className="text-sm font-normal"> µg</span></div></div></div>
              </div>
              <div className="p-6 rounded-3xl border-2" style={{ borderColor: simulation.color, backgroundColor: `${simulation.color}10` }}><Sparkles className="w-6 h-6" style={{ color: simulation.color }} /><div className="font-headline-md text-headline-md mt-3" style={{ color: simulation.color }}>{simulation.label}</div><p className="mt-3 text-on-surface">{simulation.advice}</p><p className="mt-4 text-xs text-on-surface-variant">Interactive planning estimate—not a clinical risk calculator or prediction of an asthma attack.</p></div>
            </div>
          )}

          <div className="mt-7 grid md:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-tertiary-container/10 border border-tertiary/20 flex gap-3"><ShieldAlert className="w-5 h-5 text-tertiary shrink-0" /><p className="text-sm"><strong>Urgent symptoms:</strong> seek immediate medical help for severe breathlessness, inability to speak normally, blue/grey lips, confusion, or symptoms not responding to your prescribed rescue plan.</p></div>
            <div className="p-4 rounded-2xl bg-surface-container-low flex gap-3"><AlertTriangle className="w-5 h-5 text-primary shrink-0" /><p className="text-sm"><strong>Safety boundary:</strong> AirExpo does not diagnose illness, change medication, or replace your clinician or local emergency guidance.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
};
