# Gemini reliability and server credentials

The assistant and document analysis share a server-only Gemini client. It bounds
requests to 24 seconds with at most three attempts, retries temporary failures,
honors Retry-After on quota errors, and can switch to a configured backup key.
Invalid credentials, permission errors, malformed requests and missing models
return distinct configuration errors rather than endlessly retrying.

Keep `AI_PROVIDER=gemini`, `GEMINI_MODEL`, and the existing `GEMINI_API_KEY` in
Lambda environment variables. Optional `GEMINI_API_KEYS` is a JSON array of backup
key strings. At most four unique keys including the primary are used. Never put
keys in `VITE_*` variables, browser code, Git, screenshots or chat messages.

Google applies limits per project, not per key. Multiple keys from the same
project share quota. Backup credentials do not increase that quota. Use only
authorized projects with appropriate billing, data terms and available quotas;
request a quota increase for sustained traffic instead of treating key rotation
as a way to bypass limits. All configured projects receive the same consented
request content when used for fallback.

The cooldown is per warm Lambda instance; it is not a shared global rate limiter.
All exhausted keys yield HTTP 429. A daily quota may require waiting for its reset
or increasing quota. The UI must not promise that a one-minute wait fixes it.

Deploy `infra/lambda/gemini.mjs` alongside `cloud.mjs`. A real end-to-end signed-in
assistant request is still needed after deployment. A successful synthetic model
probe confirms credentials and model availability only at the time of that probe.

References:
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/troubleshooting
