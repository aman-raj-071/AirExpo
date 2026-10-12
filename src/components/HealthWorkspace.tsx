import React, { useMemo, useState } from 'react';
import { confirmUserAttribute, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { requestPhoneVerification } from '../services/phoneVerification.mjs';
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
} from 'lucide-react';
import { EnvironmentalStationData } from '../types/environmental';
import { MedicalReportsPanel } from './MedicalReportsPanel';
import { HealthAssistant } from './HealthAssistant';
import { HealthProfile, SymptomEntry, SymptomSeverity, UserMode } from '../types/health';
import { DEFAULT_HEALTH_PROFILE, clearLocalHealthData, hasLocalHealthProfile, loadHealthProfile, loadSymptomEntries } from '../services/localHealthStore';
import { cloudRequest, getCloudStorageStatus } from '../services/cloudStorage';

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
  const [profile, setProfile] = useState<HealthProfile>(DEFAULT_HEALTH_PROFILE);
  const [entries, setEntries] = useState<SymptomEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'profile' | 'journal' | 'simulator' | 'reports' | 'assistant'>('profile');
  const [notice, setNotice] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  React.useEffect(() => {
    const refreshMobile = () => {
      void cloudRequest('/profile').then(result => {
        setProfile(current => ({ ...current, mobileNumber: result.data?.mobileNumber || '', smsOptIn: result.data?.smsOptIn === true }));
      }).catch(() => {});
      void fetchUserAttributes().then(a => setVerifiedPhone(a.phone_number_verified === 'true' ? a.phone_number || '' : '')).catch(() => {});
    };
    window.addEventListener('airexpo-profile-updated', refreshMobile);
    return () => window.removeEventListener('airexpo-profile-updated', refreshMobile);
  }, []);
  React.useEffect(() => { void fetchUserAttributes().then(a => { if (a.phone_number_verified === 'true') setVerifiedPhone(a.phone_number || ''); }).catch(() => {}); }, []);
  const verifyMobile = async (confirm = false) => {
    setPhoneBusy(true);
    try {
      if (confirm) {
        await confirmUserAttribute({ userAttributeKey: 'phone_number', confirmationCode: phoneCode });
        await fetchAuthSession({ forceRefresh: true });
        const attributes = await fetchUserAttributes();
        if (attributes.phone_number_verified !== 'true' || attributes.phone_number !== profile.mobileNumber?.trim()) throw Error('Mobile number verification did not match. Request a new code.');
        setVerifiedPhone(attributes.phone_number || ''); setPhoneCodeSent(false); setPhoneCode('');
        setNotice('Mobile verified. Save your profile and enable SMS in Air quality alerts.');
      } else {
        if (!/^\+[1-9]\d{7,14}$/.test(profile.mobileNumber?.trim() || '')) throw Error('Enter a mobile number with country code, such as +919876543210.');
        const result = await requestPhoneVerification(profile.mobileNumber!.trim());
        setPhoneCodeSent(!result.alreadyVerified);
        if (result.alreadyVerified) { await fetchAuthSession({ forceRefresh: true }); setVerifiedPhone(profile.mobileNumber!.trim()); }
        setNotice(result.alreadyVerified ? 'Mobile already verified. Save your profile to finish.' : 'Cognito accepted the OTP request. If it does not arrive, check AWS SMS sandbox destination verification, spending limits and sender registration.');
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Mobile verification failed. Check Cognito SMS configuration.'); }
    finally { setPhoneBusy(false); }
  };
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<SymptomSeverity>('mild');
  const [suspectedTriggers, setSuspectedTriggers] = useState('');
  const [inhalerUsed, setInhalerUsed] = useState(false);
  const [peakFlow, setPeakFlow] = useState('');
  const [notes, setNotes] = useState('');
  const [activityMinutes, setActivityMinutes] = useState(profile.usualOutdoorMinutes);
  const [activityType, setActivityType] = useState<'walk' | 'cycle' | 'run'>('walk');

  React.useEffect(() => {
    let active = true;
    const previousLocalProfile = loadHealthProfile();
    const previousLocalEntries = loadSymptomEntries();
    const hadLocalProfile = hasLocalHealthProfile();
    Promise.all([cloudRequest('/profile'), cloudRequest('/symptoms')])
      .then(async ([profileResult, symptomResult]) => {
        if (!active) return;
        setCloudReady(true);
        const savedProfile = profileResult.data ? { ...DEFAULT_HEALTH_PROFILE, ...profileResult.data } : hadLocalProfile ? previousLocalProfile : DEFAULT_HEALTH_PROFILE;
        let savedEntries: SymptomEntry[] = Array.isArray(symptomResult.data) ? symptomResult.data : [];
        try {
          if (!profileResult.data && hadLocalProfile) await cloudRequest('/profile', previousLocalProfile);
          const knownTimestamps = new Set(savedEntries.map((entry) => entry.recordedAt));
          for (const entry of previousLocalEntries) {
            if (!knownTimestamps.has(entry.recordedAt)) {
              await cloudRequest('/symptoms', entry);
              savedEntries = [entry, ...savedEntries];
              knownTimestamps.add(entry.recordedAt);
            }
          }
          if (hadLocalProfile || previousLocalEntries.length) clearLocalHealthData();
        } catch {
          const migratedTimestamps = new Set(savedEntries.map((entry) => entry.recordedAt));
          savedEntries = [...savedEntries, ...previousLocalEntries.filter((entry) => !migratedTimestamps.has(entry.recordedAt))];
          setNotice('Some earlier health entries could not be copied to the cloud yet. The browser copy is still available; retry after storage is restored.');
        }
        if (!active) return;
        setProfile(savedProfile);
        setActivityMinutes(savedProfile.usualOutdoorMinutes);
        onModeChange?.(savedProfile.mode);
        setEntries(savedEntries);
      })
      .catch(async (error) => {
        if (!active) return;
        if (hadLocalProfile) { setProfile(previousLocalProfile); setActivityMinutes(previousLocalProfile.usualOutdoorMinutes); }
        setEntries(previousLocalEntries);
        const status = await getCloudStorageStatus().catch(() => null);
        if (status && (!status.identityConfigured || !status.profileConfigured || !status.journalConfigured)) {
          setNotice('Finish the AWS setup before using health storage: configure Cognito, SETTINGS_TABLE, and REPORT_BUCKET in the server environment, then restart the app. Health profile and journal records are mirrored to private S3 and DynamoDB. See docs/HEALTH-ASSISTANT.md.');
        } else {
          setNotice(error instanceof Error ? `Could not load cloud health data: ${error.message}` : 'Could not load your cloud health data.');
        }
      })
      .finally(() => { if (active) setCloudLoading(false); });
    return () => { active = false; };
  }, []);

  const currentAqi = stationData?.currentAqi ?? null;
  const pm25 = stationData?.pollutants.pm2_5?.value ?? null;
  const intensity = activityType === 'walk' ? 1 : activityType === 'cycle' ? 1.55 : 1.9;
  const simulation = useMemo(
    () => currentAqi === null
      ? { label: 'Waiting for air-quality data', color: '#82919A', advice: 'The simulator will update when current AQI data is available.' }
      : exposureLabel(currentAqi, profile.mode, activityMinutes, intensity),
    [currentAqi, profile.mode, activityMinutes, intensity]
  );
  const inhaledDose = pm25 === null ? null : Math.round(pm25 * (activityType === 'walk' ? 15 : activityType === 'cycle' ? 30 : 45) * activityMinutes / 1000);

  const updateProfile = async (next: HealthProfile) => {
    if (!cloudReady) { setNotice('Connect to cloud storage before saving health details.'); return; }
    setSaving(true);
    setNotice('');
    try {
      const result = await cloudRequest('/profile', next);
      const saved = result.data as HealthProfile | undefined;
      // Only show a success notice when the API confirms the exact form values.
      // This also catches stale/incorrect backend responses instead of silently
      // telling the user that unsaved health details were stored.
      if (!saved || saved.mode !== next.mode || saved.ageRange !== next.ageRange ||
          saved.prescribedActionPlan !== next.prescribedActionPlan ||
          Number(saved.usualOutdoorMinutes) !== Number(next.usualOutdoorMinutes) ||
          JSON.stringify(saved.knownTriggers) !== JSON.stringify(next.knownTriggers) ||
          (saved.mobileNumber || '') !== (next.mobileNumber?.trim() || '') || Boolean(saved.smsOptIn) !== Boolean(next.smsOptIn)) {
        throw new Error('The server did not confirm the latest profile details. Please retry and check your cloud connection.');
      }
      const confirmedProfile = { ...DEFAULT_HEALTH_PROFILE, ...saved };
      setProfile(confirmedProfile);
      setActivityMinutes(confirmedProfile.usualOutdoorMinutes);
      onModeChange?.(confirmedProfile.mode);
      setNotice('Health profile saved to private DynamoDB and mirrored to encrypted S3.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save your health profile.');
    } finally { setSaving(false); }
  };

  const editProfile = (changes: Partial<HealthProfile>) => {
    setNotice('');
    setProfile((current) => ({ ...current, ...changes }));
  };

  const addJournalEntry = async () => {
    if (!cloudReady) { setNotice('Connect to cloud storage before saving journal entries.'); return; }
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
        aqi: currentAqi ?? -1,
        pm25: pm25 ?? -1,
      },
    };
    const previousEntry = editingId ? entries.find((item) => item.id === editingId) : undefined;
    const savedEntry = previousEntry ? { ...entry, id: editingId!, recordedAt: previousEntry.recordedAt } : entry;
    setSaving(true);
    setNotice('');
    try {
      await cloudRequest('/symptoms', savedEntry);
      const next = editingId ? entries.map((item) => item.id === editingId ? savedEntry : item) : [savedEntry, ...entries];
      setEntries(next);
      setEditingId(null);
      setSelectedSymptoms([]);
      setSuspectedTriggers('');
      setInhalerUsed(false);
      setPeakFlow('');
      setNotes('');
      setNotice(editingId ? 'Journal entry saved to DynamoDB and mirrored to encrypted S3.' : 'Journal entry saved to DynamoDB and encrypted S3 with the current air-quality snapshot.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save this journal entry.');
    } finally { setSaving(false); }
  };

  const startEditing = (entry: SymptomEntry) => {
    setEditingId(entry.id);
    setSelectedSymptoms(entry.symptoms);
    setSeverity(entry.severity);
    setSuspectedTriggers(entry.suspectedTriggers);
    setInhalerUsed(entry.inhalerUsed);
    setPeakFlow(entry.peakFlow == null ? '' : String(entry.peakFlow));
    setNotes(entry.notes);
    setActivePanel('journal');
  };

  const deleteEntry = async (entry: SymptomEntry) => {
    if (!cloudReady) { setNotice('Connect to cloud storage before deleting journal entries.'); return; }
    setSaving(true);
    setNotice('');
    try {
      await cloudRequest('/symptoms?recordedAt=' + encodeURIComponent(entry.recordedAt), undefined, 'DELETE');
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      if (editingId === entry.id) setEditingId(null);
      setNotice('Journal entry deleted from DynamoDB and its private S3 backup.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete this journal entry.');
    } finally { setSaving(false); }
  };

  const exposedEntries = entries.filter((entry) => entry.environmentalSnapshot.aqi >= 0);
  const elevatedEntries = exposedEntries.filter((entry) => entry.environmentalSnapshot.aqi >= 101);
  const symptomEntries = entries.filter((entry) => entry.symptoms.length > 0 || entry.severity !== 'mild');
  const triggerSummary = exposedEntries.length < 2
    ? 'Record at least two entries with current AQI data to see a pollution pattern.'
    : `${Math.round((elevatedEntries.filter((entry) => entry.symptoms.length > 0).length / Math.max(1, elevatedEntries.length)) * 100)}% of entries recorded at AQI 101+ included symptoms. This is an observation, not proof that pollution caused them.`;

  return (
    <section id="health-workspace-section" className="w-full px-margin-mobile md:px-margin pb-space-xl">
      <div className="rounded-3xl bg-surface-container-lowest border border-surface-container shadow-sm overflow-hidden">
        <div className="p-5 md:p-7 border-b border-surface-container flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="font-label-caps text-label-caps uppercase text-primary flex items-center gap-2"><HeartPulse className="w-4 h-4" /> Personal protection workspace</div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">Personal health tools, journal and reports</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-2 max-w-3xl">Health profiles and the latest 100 journal entries are saved in DynamoDB and mirrored to encrypted S3. Uploaded clinician documents are stored in private S3. Environmental values are modeled estimates.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['profile', 'journal', 'simulator', 'reports', 'assistant'] as const).map((panel) => (
              <button key={panel} onClick={() => setActivePanel(panel)} className={`px-4 py-2 rounded-xl capitalize font-label-md ${activePanel === panel ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant'}`}>
                {panel}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 md:p-7">
          {cloudLoading && <p role="status" className="mb-4 text-sm">Loading your health profile and journal from DynamoDB…</p>}
          {notice && cloudReady && <div role="status" className="mb-4 p-3 rounded-xl bg-secondary-container/35 text-on-secondary-container flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

          {activePanel === 'profile' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-3">
                {MODES.map((mode) => (
                  <button key={mode.id} disabled={cloudLoading || saving} onClick={() => editProfile({ mode: mode.id })} className={`text-left p-4 rounded-2xl border disabled:opacity-60 ${profile.mode === mode.id ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-surface-container'}`}>
                    <div className="font-title-md text-title-md text-on-surface">{mode.title}</div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant mt-1">{mode.description}</div>
                  </button>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <label className="font-label-md text-on-surface">Age range
                  <select disabled={cloudLoading || saving} value={profile.ageRange} onChange={(e) => editProfile({ ageRange: e.target.value })} className="mt-2 w-full p-3 rounded-xl border border-outline-variant bg-white">
                    {['Under 13', '13–17', '18–39', '40–64', '65+'].map((age) => <option key={age}>{age}</option>)}
                  </select>
                </label>
                <label className="font-label-md text-on-surface">Usual outdoor duration
                  <input disabled={cloudLoading || saving} type="number" min="5" max="300" value={profile.usualOutdoorMinutes} onChange={(e) => editProfile({ usualOutdoorMinutes: Number(e.target.value) })} className="mt-2 w-full p-3 rounded-xl border border-outline-variant disabled:opacity-60" />
                </label>
              </div>
              <div className="space-y-3 rounded-xl border border-outline-variant p-4">
                <label className="block font-label-md">Mobile number for SMS (optional)
                  <input type="tel" autoComplete="tel" maxLength={16} value={profile.mobileNumber || ''} onChange={e => { editProfile({ mobileNumber: e.target.value }); setPhoneCodeSent(false); }} disabled={saving || phoneBusy} placeholder="+919876543210" className="mt-2 w-full p-3 rounded-xl border border-outline-variant" />
                </label>
                <p className="text-sm">Use your country code. Notifications go only to your saved, verified number. AWS SMS charges may apply.</p>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={Boolean(profile.smsOptIn)} onChange={e => editProfile({ smsOptIn: e.target.checked })} disabled={saving} />I own this number and agree to receive AirExpo SMS notifications through AWS. I can opt out by unchecking this box and saving.</label>
                <button type="button" disabled={phoneBusy || !profile.mobileNumber} onClick={() => void verifyMobile()} className="underline disabled:opacity-50">{verifiedPhone === profile.mobileNumber?.trim() && verifiedPhone ? 'Mobile verified · resend code' : phoneBusy ? 'Requesting…' : 'Send verification code'}</button>
                {phoneCodeSent && <div className="flex flex-wrap gap-3"><input aria-label="Mobile verification code" inputMode="numeric" autoComplete="one-time-code" value={phoneCode} onChange={e => setPhoneCode(e.target.value)} className="p-3 rounded-xl border border-outline-variant" /><button type="button" disabled={phoneBusy || !phoneCode} onClick={() => void verifyMobile(true)} className="underline">Verify mobile</button></div>}
              </div>
              <div>
                <div className="font-label-md text-on-surface mb-2">Known triggers (optional)</div>
                <div className="flex flex-wrap gap-2">{TRIGGERS.map((trigger) => <button key={trigger} disabled={cloudLoading || saving} onClick={() => editProfile({ knownTriggers: profile.knownTriggers.includes(trigger) ? profile.knownTriggers.filter((item) => item !== trigger) : [...profile.knownTriggers, trigger] })} className={`px-3 py-2 rounded-xl border text-sm disabled:opacity-60 ${profile.knownTriggers.includes(trigger) ? 'bg-primary text-white border-primary' : 'border-outline-variant'}`}>{trigger}</button>)}</div>
              </div>
              <label className="block font-label-md text-on-surface">Doctor-provided action-plan reminder (optional)
                <textarea disabled={cloudLoading || saving} value={profile.prescribedActionPlan} onChange={(e) => editProfile({ prescribedActionPlan: e.target.value })} rows={3} className="mt-2 w-full p-3 rounded-xl border border-outline-variant disabled:opacity-60" placeholder="Record instructions exactly as provided by your clinician. AirExpo will not modify them." />
              </label>
              <div className="flex flex-wrap gap-3">
                <button disabled={cloudLoading || saving || !cloudReady} onClick={() => void updateProfile(profile)} className="px-4 py-2.5 rounded-xl bg-primary text-on-primary flex items-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save profile'}</button>
              </div>
            </div>
          )}

          {activePanel === 'journal' && (
            <div className="grid lg:grid-cols-[1fr_0.9fr] gap-7">
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container text-sm"><strong>Daily symptom check-in</strong><p className="mt-1 text-on-surface-variant">Record what you noticed and compare it with the AQI snapshot captured at the time. AirExpo does not diagnose or change treatment.</p></div>
                <div><div className="font-label-md mb-2">Symptoms</div><div className="flex flex-wrap gap-2">{SYMPTOMS.map((symptom) => <button key={symptom} onClick={() => setSelectedSymptoms(selectedSymptoms.includes(symptom) ? selectedSymptoms.filter((item) => item !== symptom) : [...selectedSymptoms, symptom])} className={`px-3 py-2 rounded-xl border text-sm ${selectedSymptoms.includes(symptom) ? 'bg-tertiary text-white border-tertiary' : 'border-outline-variant'}`}>{symptom}</button>)}</div></div>
                <label className="block font-label-md">Severity<select value={severity} onChange={(e) => setSeverity(e.target.value as SymptomSeverity)} className="mt-2 w-full p-3 rounded-xl border border-outline-variant bg-white"><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></label>
                <label className="block font-label-md">Suspected triggers<input value={suspectedTriggers} onChange={(e) => setSuspectedTriggers(e.target.value)} className="mt-2 w-full p-3 rounded-xl border border-outline-variant" placeholder="Traffic, pollen, exercise…" /></label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 font-label-md"><input type="checkbox" checked={inhalerUsed} onChange={(e) => setInhalerUsed(e.target.checked)} /> Prescribed inhaler used</label>
                  <label className="font-label-md">Peak flow (optional)<input type="number" min="0" value={peakFlow} onChange={(e) => setPeakFlow(e.target.value)} className="mt-2 w-full p-3 rounded-xl border border-outline-variant" /></label>
                </div>
                <label className="block font-label-md">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 w-full p-3 rounded-xl border border-outline-variant" /></label>
                <div className="flex flex-wrap gap-2"><button disabled={cloudLoading || saving || !cloudReady} onClick={() => void addJournalEntry()} className="px-4 py-2.5 rounded-xl bg-primary text-on-primary flex items-center gap-2 disabled:opacity-50"><NotebookPen className="w-4 h-4" /> {saving ? 'Saving…' : editingId ? 'Update journal entry' : 'Save journal entry'}</button>{editingId && <button onClick={() => { setEditingId(null); setSelectedSymptoms([]); setSuspectedTriggers(''); setInhalerUsed(false); setPeakFlow(''); setNotes(''); }} className="px-4 py-2.5 rounded-xl border border-outline-variant">Cancel edit</button>}</div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-3"><h3 className="font-title-md text-title-md">Recent entries</h3><button disabled={!entries.length} onClick={() => downloadSummary(profile, entries)} className="px-3 py-2 rounded-xl border border-primary text-primary disabled:opacity-40 flex items-center gap-2 text-sm"><Download className="w-4 h-4" /> Download summary</button></div>
                <div className="p-4 mb-3 rounded-2xl border border-primary bg-secondary-container/20"><strong>Pollution pattern</strong><p className="text-sm mt-1">{triggerSummary}</p><p className="text-xs text-on-surface-variant mt-2">Compared records: {exposedEntries.length} · symptom records: {symptomEntries.length}</p></div>
                <div className="space-y-3 max-h-[430px] overflow-auto">{entries.length === 0 ? <div className="p-5 rounded-2xl bg-surface-container-low text-on-surface-variant">No observations recorded yet.</div> : entries.map((entry) => <article key={entry.id} className="p-4 rounded-2xl border border-surface-container"><div className="flex justify-between gap-3"><strong className="capitalize">{entry.severity}</strong><span className="text-xs text-on-surface-variant">{new Date(entry.recordedAt).toLocaleString()}</span></div><p className="text-sm mt-2">{entry.symptoms.join(', ') || 'No symptoms selected'}</p><p className="text-xs text-on-surface-variant mt-2">AQI {entry.environmentalSnapshot.aqi} · PM2.5 {entry.environmentalSnapshot.pm25} µg/m³ · {entry.environmentalSnapshot.location}</p><div className="flex gap-3 mt-3 text-xs"><button onClick={() => startEditing(entry)} className="underline">Edit</button><button disabled={saving} onClick={() => void deleteEntry(entry)} className="underline text-error disabled:opacity-50">Delete</button></div></article>)}</div>
              </div>
            </div>
          )}

          {activePanel === 'simulator' && (
            <div className="grid lg:grid-cols-[1fr_0.9fr] gap-7 items-start">
              <div className="space-y-6">
              <div><div className="font-label-md mb-2">Activity</div><div className="flex gap-2">{(['walk', 'cycle', 'run'] as const).map((activity) => <button key={activity} onClick={() => setActivityType(activity)} className={`capitalize px-4 py-2 rounded-xl ${activityType === activity ? 'bg-primary text-white' : 'bg-surface-container-low'}`}>{activity}</button>)}</div><p className="text-xs text-on-surface-variant mt-2">Profile: {profile.mode} · Activity intensity is a simple comparison factor.</p></div>
                <label className="block font-label-md">Outdoor duration: <strong>{activityMinutes} minutes</strong><input type="range" min="5" max="180" step="5" value={activityMinutes} onChange={(e) => setActivityMinutes(Number(e.target.value))} className="w-full mt-3 accent-primary" /></label>
                <div className="grid grid-cols-2 gap-3"><div className="p-4 rounded-2xl bg-surface-container-low"><div className="text-xs text-on-surface-variant">Modeled U.S. AQI</div><div className="text-3xl font-bold">{currentAqi ?? '—'}</div></div><div className="p-4 rounded-2xl bg-surface-container-low"><div className="text-xs text-on-surface-variant">Illustrative inhaled PM2.5 estimate</div><div className="text-3xl font-bold">{inhaledDose ?? '—'}<span className="text-sm font-normal">{inhaledDose === null ? '' : ' µg'}</span></div></div></div>
              </div>
              <div className="p-6 rounded-3xl border-2" style={{ borderColor: simulation.color, backgroundColor: `${simulation.color}10` }}><Sparkles className="w-6 h-6" style={{ color: simulation.color }} /><div className="font-headline-md text-headline-md mt-3" style={{ color: simulation.color }}>{simulation.label}</div><p className="mt-3 text-on-surface">{simulation.advice}</p><p className="mt-4 text-xs text-on-surface-variant">AQI × duration × activity intensity is a simple comparison heuristic. The inhaled PM2.5 estimate uses assumed breathing rates; it is not a measured dose or clinical risk assessment.</p></div>
            </div>
          )}

          {activePanel === 'reports' && <MedicalReportsPanel />}
          {activePanel === 'assistant' && <HealthAssistant stationData={stationData} />}

          <div className="mt-7 grid md:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-tertiary-container/10 border border-tertiary/20 flex gap-3"><ShieldAlert className="w-5 h-5 text-tertiary shrink-0" /><p className="text-sm"><strong>Urgent symptoms:</strong> seek immediate medical help for severe breathlessness, inability to speak normally, blue/grey lips, confusion, or symptoms not responding to your prescribed rescue plan.</p></div>
            <div className="p-4 rounded-2xl bg-surface-container-low flex gap-3"><AlertTriangle className="w-5 h-5 text-primary shrink-0" /><p className="text-sm"><strong>Safety boundary:</strong> AirExpo does not diagnose illness, change medication, or replace your clinician or local emergency guidance.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
};
