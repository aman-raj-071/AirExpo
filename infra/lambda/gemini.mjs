// Server-only credentials. Never log request bodies, keys, or provider error text.
const coolingUntil = new Map();
export function geminiKeys(env = process.env) {
  let extra = [];
  try { extra = JSON.parse(env.GEMINI_API_KEYS || '[]'); } catch { throw new GeminiError(503, 'Gemini backup-key configuration is invalid.'); }
  if (!Array.isArray(extra) || extra.some(key => typeof key !== 'string')) throw new GeminiError(503, 'Gemini backup-key configuration is invalid.');
  return [...new Set([env.GEMINI_API_KEY, ...extra].filter(key => typeof key === 'string' && key.trim()).map(key => key.trim()))].slice(0, 4);
}
export class GeminiError extends Error {
  constructor(statusCode, message) { super(message); this.statusCode = statusCode; }
}
export async function generateGemini(body, { env = process.env, fetchImpl = fetch, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), budgetMs = 24000 } = {}) {
  const keys = geminiKeys(env), model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!keys.length) throw new GeminiError(503, 'Gemini is not configured on the server.');
  const available = keys.filter(key => (coolingUntil.get(key) || 0) <= now());
  if (!available.length) throw new GeminiError(429, 'Gemini rate limit reached. Wait before retrying; daily quota may require a quota increase.');
  const deadline = now() + budgetMs;
  let lastError = new GeminiError(503, 'Gemini is temporarily unavailable. Retry shortly.');
  for (let attempt = 0; attempt < 3 && now() < deadline; attempt++) {
    const key = available[attempt % available.length];
    if ((coolingUntil.get(key) || 0) > now()) continue;
    let response;
    try {
      response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(1, Math.min(12000, deadline - now()))),
      });
    } catch {
      lastError = new GeminiError(504, 'Gemini connection timed out or failed. Retry shortly.');
    }
    if (response?.ok) return { generated: await response.json(), model, attempts: attempt + 1 };
    if (response && !response.ok) {
      // Status-only diagnostics: provider bodies may contain private input or credentials.
      console.warn('[gemini] request rejected', { status: response.status, attempt: attempt + 1 });
      if ([400, 401, 403, 404].includes(response.status)) {
        const message = response.status === 404 ? 'The configured Gemini model is unavailable. Check GEMINI_MODEL on the server.' :
          response.status === 400 ? 'Gemini rejected the request. Check the server request configuration.' :
          'Gemini API key or access is invalid. Check server credentials and API permissions.';
        throw new GeminiError(503, message);
      }
      if (response.status === 429) {
        const raw = response.headers.get('retry-after');
        const seconds = Number(raw) || (raw ? (Date.parse(raw) - now()) / 1000 : 60);
        coolingUntil.set(key, now() + Math.max(1000, (Number.isFinite(seconds) ? seconds : 60) * 1000));
        lastError = new GeminiError(429, 'Gemini rate limit or quota reached. Retry later or increase the project quota.');
      } else if (response.status === 408 || response.status >= 500) {
        lastError = new GeminiError(503, 'Gemini is temporarily unavailable. Retry shortly.');
      } else throw new GeminiError(502, 'Gemini could not complete the request. Check server configuration.');
    }
    const nextKey = available[(attempt + 1) % available.length];
    const delay = Math.max(500 * 2 ** attempt, (coolingUntil.get(nextKey) || 0) - now());
    if (attempt < 2 && delay < deadline - now()) await sleep(delay);
    else break;
  }
  throw lastError;
}
