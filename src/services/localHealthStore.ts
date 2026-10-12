import { HealthProfile, SymptomEntry } from '../types/health';

const PROFILE_KEY = 'airguard-demo-profile-v1';
const JOURNAL_KEY = 'airguard-demo-journal-v1';

export const DEFAULT_HEALTH_PROFILE: HealthProfile = {
  mode: 'everyday',
  ageRange: '18–39',
  knownTriggers: [],
  prescribedActionPlan: '',
  usualOutdoorMinutes: 30,
  mobileNumber: '',
  smsOptIn: false,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadHealthProfile(): HealthProfile {
  return readJson(PROFILE_KEY, DEFAULT_HEALTH_PROFILE);
}

export function hasLocalHealthProfile(): boolean {
  try { return window.localStorage.getItem(PROFILE_KEY) !== null; }
  catch { return false; }
}

export function loadSymptomEntries(): SymptomEntry[] {
  return readJson<SymptomEntry[]>(JOURNAL_KEY, []);
}

export function clearLocalHealthData(): void {
  window.localStorage.removeItem(PROFILE_KEY);
  window.localStorage.removeItem(JOURNAL_KEY);
}
