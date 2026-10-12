// Installed as index.mjs when extending the existing Bedrock-only Lambda.
// The deployment bundle retains its original index.mjs as legacyBedrock.mjs.
import { handler as bedrockHandler } from './legacyBedrock.mjs';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { SimpleJwksCache } from 'aws-jwt-verify/jwk';
import { SimpleFetcher } from 'aws-jwt-verify/https';
import { FetchError, WaitPeriodNotYetEndedJwkError } from 'aws-jwt-verify/error';
import { routeApi } from './routeApi.mjs';
import { cloudHandler } from './cloud.mjs';

const origins = new Set(['https://main.d1u40zs0ugi10g.amplifyapp.com', 'http://localhost:3000', 'http://127.0.0.1:3000']);
const paths = new Set(['/api/routes', '/api/route-geocode', '/api/route-air-quality']);
const verifier = CognitoJwtVerifier.create({
  userPoolId: 'us-east-1_UOugaJlN8',
  clientId: '6rls971j2qq88nune9f74lukbc',
  tokenUse: 'id',
}, { jwksCache: new SimpleJwksCache({ fetcher: new SimpleFetcher({ defaultRequestOptions: { timeout: 12000, responseTimeout: 12000 } }) }) });

export async function handler(event) {
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
  const origin = headers.origin;
  const cors = origins.has(origin) ? {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'vary': 'Origin',
  } : {};
  const output = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors }, body: JSON.stringify(body) });
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path;
  const isCloud = typeof path === 'string' && path.startsWith('/api/cloud/');
  if (paths.has(path) || isCloud) {
    if (origin && !origins.has(origin)) return output(403, { success: false, error: 'Website origin is not allowed.' });
    if (method === 'OPTIONS') return { ...output(204, null), body: '' };
    const token = headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return output(401, { success: false, error: 'Sign in before using this service.' });
    let claims;
    try { claims = await verifier.verify(token); } catch (error) {
      if (error instanceof FetchError || error instanceof WaitPeriodNotYetEndedJwkError) return output(503, { success: false, error: 'Cognito signing keys are temporarily unavailable. Retry shortly.' });
      return output(401, { success: false, error: 'Your session expired or is invalid. Sign in again.' });
    }
    const request = { ...event, rawPath: path, body: event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body, requestContext: { ...event.requestContext, http: { ...event.requestContext?.http, method }, authorizer: { jwt: { claims: { sub: claims.sub } } } } };
    const result = isCloud ? await cloudHandler(request) : await routeApi(request);
    if (!result) return output(404, { error: 'Unknown API endpoint.' });
    return { ...result, headers: { ...result.headers, ...cors } };
  }
  return bedrockHandler(event);
}
