export type UserMode = 'everyday' | 'asthma' | 'athlete';

export interface HealthProfile {
  mode: UserMode;
  ageRange: string;
  knownTriggers: string[];
  prescribedActionPlan: string;
  usualOutdoorMinutes: number;
}

export type SymptomSeverity = 'mild' | 'moderate' | 'severe';

export interface SymptomEntry {
  id: string;
  recordedAt: string;
  symptoms: string[];
  severity: SymptomSeverity;
  suspectedTriggers: string;
  inhalerUsed: boolean;
  peakFlow?: number;
  notes: string;
  environmentalSnapshot: {
    location: string;
    aqi: number;
    pm25: number;
  };
}
