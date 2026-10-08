# AirGuard AI implementation plan

This plan breaks the shared-chat requirements into independently testable slices.

## Phase 1 — Product safety and user model

- [x] Define Everyday, Asthma, and Athlete profiles.
- [x] Make health fields optional and clearly mark the product as decision support.
- [x] Add urgent respiratory-symptom guidance.
- [x] Keep demo health information on the device until authenticated cloud storage is configured.

## Phase 2 — Hackathon MVP

- [x] Live AQI, pollutant, weather, and forecast dashboard.
- [x] Personalized activity guidance for the three user modes.
- [x] Symptom, trigger, inhaler-use, and optional peak-flow journal.
- [x] Outdoor activity time planner using the AQI forecast.
- [x] “What if?” exposure simulator for activity type and duration.
- [x] Downloadable doctor-ready summary from user-entered journal data.
- [x] AI environmental explanation with a deterministic fallback.

## Phase 3 — Production data layer

- [ ] Replace device-only profile and journal persistence with authenticated APIs.
- [ ] Encrypt health records and enforce per-user ownership.
- [ ] Add edit/delete/export controls for all personal data.
- [ ] Add schema validation, audit-friendly timestamps, and retention rules.

## Phase 4 — AWS services

- [ ] Amplify Hosting: deploy the React application.
- [ ] Cognito: signup, login, JWTs, and protected user identity.
- [ ] API Gateway: expose authenticated HTTP endpoints.
- [ ] Lambda: AQI proxy, recommendations, profiles, symptoms, and reports.
- [ ] DynamoDB: user profiles and symptom journal records.
- [ ] S3: private generated health reports.
- [ ] EventBridge: scheduled AQI checks and alert evaluation.
- [ ] Optional Bedrock/Strands: explanations only; safety rules remain deterministic.

## Phase 5 — Post-MVP capability

- [ ] Real routing provider and geographically detailed pollution sampling.
- [ ] Web-push/SMS notification delivery with explicit user consent.
- [ ] Clinician sharing workflow with explicit, revocable consent.
- [ ] Wearable integrations and validated exposure models.
- [ ] Accessibility, unit, integration, and end-to-end tests.

## Important boundaries

- AirGuard AI does not diagnose asthma, predict attacks, or alter medication.
- Severe breathlessness, inability to speak normally, blue/grey lips, confusion,
  or symptoms that do not respond to a prescribed rescue plan require urgent
  medical assistance.
- Route exposure is labelled as an estimate until street-level pollutant data is
  integrated.
- Synthetic profiles should be used in hackathon demonstrations.
