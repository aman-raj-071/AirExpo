import { HealthProfile, SymptomEntry } from '../types/health';

const PROFILE_KEY = 'airguard-demo-profile-v1';
const JOURNAL_KEY = 'airguard-demo-journal-v1';

export const DEFAULT_HEALTH_PROFILE: HealthProfile = {
  mode: 'everyday',
  ageRange: '18–39',
  knownTriggers: [],
  prescribedActionPlan: '',
  usualOutdoorMinutes: 30,
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

export function saveHealthProfile(profile: HealthProfile): void {
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadSymptomEntries(): SymptomEntry[] {
  return readJson<SymptomEntry[]>(JOURNAL_KEY, []);
}

export function saveSymptomEntries(entries: SymptomEntry[]): void {
  window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

export function clearLocalHealthData(): void {
  window.localStorage.removeItem(PROFILE_KEY);
  window.localStorage.removeItem(JOURNAL_KEY);
}
