<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8e8c64d4-07e1-40d9-a25a-e9def1bfde55

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
# AirExpo

## Cognito sign-in and sign-up

The web client uses AWS Amplify v6 (`src/auth/amplify.ts`) with the Cognito user pool and public app client declared in `infra/template.yaml`. The existing header modal supports email/password sign-up, Cognito email-code confirmation and resend, sign-in, session restoration, and sign-out. It follows Amplify's `nextStep` response and reports Cognito delivery and validation errors. Amplify uses Cognito's SRP sign-in flow; credentials and tokens are handled in the browser by the Amplify Auth library. Do not add a client secret or AWS access keys to the frontend.

After deploying the existing SAM template, retrieve the stack's `UserPoolId` and `UserPoolClientId` outputs and place them in the project-root `.env.local`:

```dotenv
VITE_COGNITO_USER_POOL_ID=us-east-1_example
VITE_COGNITO_USER_POOL_CLIENT_ID=examplepublicclientid
```

Restart `pnpm dev` after changing these values. For local Cognito testing, use the existing AWS stack or a Cognito user pool configured for email sign-in and email auto-verification. The SAM template explicitly configures Cognito's default email sender and `CONFIRM_WITH_CODE` verification message; deploy the template update for those settings to apply to an AWS pool. The user pool's password policy requires at least eight characters, an uppercase letter, a lowercase letter, and a number. The app client must be public (no client secret) and allow `ALLOW_USER_SRP_AUTH` and refresh-token auth. Without both environment variables, the app shows the sign-in form but disables Cognito actions.

Example commands to inspect outputs after a deployment (this project does not deploy cloud resources automatically):

```sh
aws cloudformation describe-stacks --stack-name airguard-ai --query "Stacks[0].Outputs"
pnpm dev
```

The frontend configuration uses only the public user pool and app-client identifiers. Keep AWS credentials in the normal AWS credential provider chain for deployment operations; never put them in `VITE_` variables.

## Clean-Air Route Planner

Route alternatives are provided by OpenRouteService. Configure `OPENROUTESERVICE_API_KEY` in the server environment (see `.env.example`); the key is read only by the Express server and is never exposed to the browser. Walking and running use the provider's foot-walking profile; cycling uses cycling-regular. Place-name searches use the app's existing Open-Meteo geocoder, and latitude/longitude can also be entered directly.

Route air-quality samples come from Open-Meteo's modeled grid via the server proxy. AQI, PM2.5, and PM10 are estimates at sample points, not street-level measurements. Exposure ranking uses average sampled PM2.5 multiplied by provider-estimated route duration; it is only highlighted when at least two alternatives have usable comparable samples. A 10 km circle is a visual reference only and does not restrict route length. OpenStreetMap data and the routing provider may have incomplete geographic coverage.

## Browser and AWS SNS alerts

The historical AQI chart requests two past days and displays only hourly modeled values in the preceding 24 hours, using the selected location’s timezone. Forecast values remain separate in the data service.

Browser notifications require permission (HTTPS or localhost) and the page to remain open. Current telemetry refreshes every five minutes; alerts are limited to once per hour and simulated AQI is excluded.

SNS SMS sends directly to both sandbox-verified numbers configured in the server-only `SNS_SMS_RECIPIENTS`. Follow [infra/USER-SMS-SETUP.md](infra/USER-SMS-SETUP.md) to set the matching region, grant SMS publish permission, configure the recipients, and verify delivery from the dashboard. The test and each AQI alert are sent separately to both numbers.

Enable SMS from the dashboard to save the current location and threshold. The Express server evaluates modeled AQI every five minutes and publishes at most once per hour. Disabling SMS stops future evaluations; an already submitted message cannot be recalled.

Settings (including monitored coordinates) are stored in `.airexpo-alert-settings.json`, excluded from Git. Delivery errors appear in the SMS status. SNS acceptance does not guarantee handset delivery. AWS SMS charges apply. The explicit test button sends a real billable SMS; builds and configuration checks do not send messages.

SMS preference changes are restricted to local same-origin requests; this is a single-operator integration. The standalone Vite development command does not run the SMS monitor; use the Express-backed npm scripts. A production deployment needs a continuously running Express service or a scheduled worker.

## DynamoDB and S3: user data storage

| Service | Stored data | Access and retention |
| --- | --- | --- |
| DynamoDB SettingsTable | Per-account language, alert threshold, browser alert preference, saved place labels and coordinates, and medical document metadata | Partitioned by verified Cognito user ID; encrypted and retained |
| DynamoDB ProfileTable | Health workspace mode, age range, triggers, activity duration, and clinician action-plan reminder | Private account record; encrypted and retained |
| DynamoDB SymptomTable | Saved journal entries, including symptoms, severity, suspected triggers, inhaler use, peak flow, notes, and the AQI/PM2.5 snapshot | Partitioned by verified Cognito user ID; encrypted and retained |
| S3 ReportBucket | Uploaded doctor-report files and generated AQI report JSON | Private and encrypted; only `reports/` objects expire after 30 days; `documents/` objects have no automatic expiry |
| Cognito | Account identity and authentication | Passwords/tokens remain in Cognito and are not copied into DynamoDB or S3 |

Settings sync automatically after they load for the signed-in account. Health profile and journal changes are written when the user saves or deletes them. Doctor-report bytes are stored in S3, with owner-scoped metadata in DynamoDB. Existing browser-only preferences, saved places, health profile, and journal entries are copied to cloud storage on the next successful load. Temporary search queries and unsaved form drafts are not persisted.

### Create storage for the existing Cognito login

The smallest deployment is `infra/storage.yaml`: one on-demand DynamoDB table and one private S3 bucket, without IAM role creation or a new Cognito pool. Resources are retained if the stack is deleted, to avoid accidental data loss.

```powershell
aws cloudformation deploy --template-file infra/storage.yaml --stack-name airexpo-storage --region YOUR_REGION
aws cloudformation describe-stacks --stack-name airexpo-storage --region YOUR_REGION --query "Stacks[0].Outputs"
```

Set `AWS_REGION`, `SETTINGS_TABLE`, `PROFILE_TABLE`, `SYMPTOM_TABLE` and `REPORT_BUCKET` from the stack outputs in `.env` or the server environment. Use the configured AWS profile or a deployment IAM role with access to those DynamoDB tables and S3 `reports/*` and `documents/*` prefixes. The Express server verifies Cognito ID tokens using the existing public pool/client identifiers; server overrides `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` are optional. Restart `npm run dev`. No AWS secret belongs in browser code.

For a deployed serverless API use `infra/template.yaml`, install dependencies in `infra/lambda`, build/deploy with SAM, then set `VITE_STORAGE_API_URL` to its ApiUrl. Pass ExistingUserPoolId/ExistingUserPoolClientId to preserve the current accounts, and WebOrigin for the deployed web origin. Leave VITE_STORAGE_API_URL empty for local Express. The SAM Lambda calls the same cloud handler and API Gateway verifies JWTs. The serverless Lambda does not run the local SNS monitor; SMS alerts currently run through the Express server.

Endpoints: GET/POST `/settings`, GET/POST `/profile`, GET/POST/DELETE `/symptoms`, and GET/POST `/documents` plus owner-scoped content downloads. AQI JSON reports use GET/POST `/reports`. Local prefix: `/api/cloud`; deployed API: its base URL. Client-provided user IDs are ignored. Missing configuration returns 503; missing/invalid identity returns 401. Backend errors report failure rather than claiming a save succeeded.

## Signed-in health workspace and doctor reports

The **Personal protection workspace** stores the health profile and symptom journal in ProfileTable and SymptomTable. The Profile modal contains account identity details only. Doctor reports are uploaded from the workspace’s **Reports** tab using `/documents`. Accepted formats: PDF, PNG and JPEG, up to 2 MB; the server checks file signature, declared type, and size. Files use private encrypted S3 keys under `documents/{Cognito-sub}/{uuid}`; the original filename and upload metadata are also stored in DynamoDB. Authenticated list/download endpoints enforce account ownership. Doctor documents do not have automatic expiration in the provided storage templates. They are kept for reference and are not automatically interpreted as diagnoses.

Local development needs `SETTINGS_TABLE`, `PROFILE_TABLE`, `SYMPTOM_TABLE`, and `REPORT_BUCKET`, plus DynamoDB access to those tables and S3 access to both object prefixes. For real cloud saves, deploy the updated storage/backend templates and restart the server or deploy the updated Lambda. The UI shows cloud errors instead of claiming a save succeeded.

## Landing-page managed login

Sign-in/sign-up is launched from the landing page via `/signin`. The dashboard no longer contains an email demo sign-in or authentication modal and requires a verified Amplify/Cognito session. Its Profile button opens health details and doctor reports; Sign out returns to the landing page.

Set VITE_COGNITO_DOMAIN to the public managed-login domain (without `/login` or query parameters). The existing pool/client must match that domain. Add `http://localhost:3000/auth/callback` to Cognito app-client allowed callback URLs and `http://localhost:3000/` to allowed sign-out URLs. Enable authorization-code grant with openid, email, profile scopes for the public client. For production, set VITE_COGNITO_REDIRECT_URI to the deployed `/auth/callback` URL and allow that exact URL in Cognito. Rebuild/restart after changing environment variables.

Amplify starts authorization-code login with PKCE and processes the callback; the app does not simply trust URL parameters or an email address. Successful login enters `/dashboard` and opens the account profile. Health profile saving requires the storage tables and backend environment described above.

### Current Cognito managed-login connection

Domain: `us-east-1uougajln8.auth.us-east-1.amazoncognito.com`
Client: `6rls971j2qq88nune9f74lukbc`
Scopes: `openid email phone`, authorization-code grant with PKCE.

The supplied login link allows the production redirect `https://d84l1y8p4kdic.cloudfront.net`. Local verification returned `redirect_mismatch`. In Cognito → User pool → App client → Login pages, add `http://localhost:3000/auth/callback` to Allowed callback URLs and `http://localhost:3000/` to Allowed sign-out URLs; keep production URLs as well. Do not switch local login to a production callback: PKCE/session state is tied to the local origin.

The configured CLI principal cannot call cognito-idp:DescribeUserPoolClient, so the app could not inspect or update this setting. An AWS administrator must apply it. The localhost app already points to the provided domain/client with the local callback.

## Backend authorization-code exchange (current implementation)

The React `index.html` remains the app entry point. On the production origin, Sign in creates a random state and PKCE verifier and redirects to Cognito. Cognito returns to `https://d84l1y8p4kdic.cloudfront.net?code=...&state=...`. React validates state and sends code + verifier to POST `/api/exchange-code`; the Node backend exchanges against Cognito `/oauth2/token`, verifies ID and access token signatures/issuer/client/token-use, and returns tokens plus verified user details. Tokens are kept in tab-scoped sessionStorage, not the URL. Callback parameters are removed from browser history immediately. GET `/api/auth/me` validates a restored session. Expired sessions require sign-in again; refresh tokens are not returned to the browser. This replaces the previous Amplify client-side hosted token exchange.

The verified pool is `us-east-1_UOugaJlN8` (lowercase l after J). The uppercase-I spelling supplied later returned 404 from public discovery; the corrected pool returns 200.

Backend configuration: COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_DOMAIN, COGNITO_REDIRECT_URI (local Express falls back to the VITE_COGNITO_* settings). The frontend uses VITE_AUTH_API_URL, empty for same-origin `/api/*`, or the deployed API base URL. The backend must be reachable over HTTPS, with CORS allowing exactly the CloudFront origin. Do not point this setting to the static S3 bucket.

`infra/template.yaml` includes unauthenticated exchange/session-check routes (their handler validates code/token), while data routes still require authentication. ExistingUserPoolId/ExistingUserPoolClientId must be supplied to keep the current account pool. Deploy through an AWS principal permitted to create the SAM resources and IAM execution role. The current principal is denied CloudFront ListDistributions and CloudFormation CreateChangeSet, so live deployment has not been performed.

Frontend deployment helper: `infra/deploy-frontend.ps1 -Bucket BUCKET -DistributionId ID -AuthApiUrl https://API_HOST -Profile PROFILE`. It builds and uploads the entire `dist` folder, not only index.html, then invalidates entry routes. Configure a CloudFront SPA rewrite for browser routes such as /signin and /dashboard (return index.html with status 200). Do not rewrite API errors to index.html. If using a same-origin API, configure a separate `/api/*` behavior to the backend and disable caching of auth responses.

A leaf logo source is available at `public/assets/airexpo-leaf-logo.svg`. Upload it in the managed-login branding editor, or export it to PNG for classic Hosted UI branding. Applying branding requires Cognito configuration permissions. Sign up and Forgot password remain Cognito-managed actions on its login page; passwords are never entered into this app's callback handler.

End-to-end verification requires a real user to authenticate on Cognito, on the deployed frontend origin. An arbitrary hand-built ?code link without the matching state/verifier is deliberately rejected. When running localhost with a production callback, the app moves to the production /signin page first so PKCE state is created on the callback origin; the production bundle must be updated before this flow works.

### Deployment status (10 October 2026)
Provided website bucket: `airexpo-website` (us-east-1, currently empty). Provided API: `https://xsvjrx04tl.execute-api.us-east-1.amazonaws.com`; POST `/api/exchange-code` currently returns HTTP 500 with a Bedrock invocation error, so the Cognito handler is not deployed at this endpoint. API Gateway inspection is denied to the current AWS principal. The supplied callback domain currently displays Cognito default redirect content rather than AirExpo. Confirm the actual AirExpo CloudFront distribution and use its URL as `-CallbackUrl` in the frontend deployment helper; register the exact same URL in Cognito and configure it on the backend. Do not deploy against the default redirect domain. Example: `./infra/deploy-frontend.ps1 -Bucket airexpo-website -DistributionId YOUR_DISTRIBUTION_ID -AuthApiUrl https://xsvjrx04tl.execute-api.us-east-1.amazonaws.com -CallbackUrl https://YOUR_AIREXPO_DOMAIN`. Backend deployment and Cognito branding require AWS permissions that the current principal lacks.

### Custom sign-in and Cedar
The frontend defaults to AirExpo's existing public Cognito pool `us-east-1_UOugaJlN8` and app client `6rls971j2qq88nune9f74lukbc` when neither Cognito build variable is set. Amplify Hosting can therefore build a working account form without a local `.env` file. To use a different pool, set both `VITE_COGNITO_USER_POOL_ID` and `VITE_COGNITO_USER_POOL_CLIENT_ID` in the hosting build environment and rebuild. A partial override disables account actions to avoid mixing identifiers from different pools. These identifiers are public configuration, not AWS credentials.

AirExpo now uses custom `/signin` forms with Cognito email/password (SRP), sign-up, email verification, password reset and common MFA/new-password challenges. No hosted UI, callback URL or code-exchange API is used by these forms. Enable `ALLOW_USER_SRP_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH` on public app client `6rls971j2qq88nune9f74lukbc`; it must have no client secret. Enable self-service sign-up and email verification in pool `us-east-1_UOugaJlN8`. Dashboard access requires a restored Cognito session; profile and sign-out controls are available after sign-in.
Cedar runs locally on the server using the official WASM engine (`infra/lambda/authorization.mjs`), not Amazon Verified Permissions. The cloud handler permits read/write only when the verified user is the owner. Download ownership comes from the server-generated S3 key; body owner IDs are ignored. Denials and policy errors fail closed. AWS storage still requires deployment and resource configuration. Install Lambda dependencies when packaging, including the Cedar WASM binary.

### Doctor-report S3 storage
Local server uses private bucket `airexpo-doctor-reports-298521811635` in us-east-1 via `REPORT_BUCKET`. Block Public Access is enabled, ACLs disabled, SSE-S3 encryption configured, and a bucket policy denies non-HTTPS access. The current server AWS profile has S3 permissions; deployed servers need ListBucket plus GetObject/PutObject on documents/* using an IAM execution role. No browser AWS credentials or public report URLs are used. Cognito ID tokens are verified, then Cedar checks ownership. PDF/PNG/JPEG uploads are limited to 2 MB and stored at documents/<Cognito sub>/<random UUID>, with the original filename in metadata. The runtime bucket has no automatic expiration rule; do not assume the separate CloudFormation template’s 30-day rule applies to this bucket.

