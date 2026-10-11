import { exchangeCodeHandler } from './exchangeCode.mjs';
import { cloudHandler } from './cloud.mjs';
import { routeApi } from './routeApi.mjs';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({});
const reportBucket = process.env.REPORT_BUCKET;

const response = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

const userIdFrom = (event) => event.requestContext?.authorizer?.jwt?.claims?.sub;
const bodyFrom = (event) => {
  try { return JSON.parse(event.body || '{}'); } catch { return null; }
};

function recommendation({ aqi = 0, mode = 'everyday', minutes = 30, activity = 'walk' }) {
  const sensitivity = mode === 'asthma' ? 1.45 : mode === 'athlete' ? 1.15 : 1;
  const intensity = activity === 'run' ? 1.9 : activity === 'cycle' ? 1.55 : 1;
  const score = Number(aqi) * sensitivity * (Number(minutes) / 30) * intensity;
  if (score >= 260) return { level: 'high', message: 'Move the activity indoors or wait for a cleaner forecast window.' };
  if (score >= 120) return { level: 'elevated', message: 'Reduce duration or intensity and monitor symptoms.' };
  if (score >= 60) return { level: 'moderate', message: 'Prefer a shorter, easier session.' };
  return { level: 'lower', message: 'Conditions are comparatively favorable; continue monitoring.' };
}

export async function handler(event) {
  if (event.rawPath === '/api/exchange-code' || event.rawPath === '/api/auth/me') return exchangeCodeHandler(event);
  if (event.source === 'airguard.schedule') {
    // Notification delivery is deliberately separate: only opted-in users
    // should be processed after SNS/web-push consent is implemented.
    console.info('Scheduled alert evaluation completed', { action: event.action });
    return { processed: 0 };
  }

  const cloudResult = await cloudHandler(event);
  if (cloudResult) return cloudResult;
  const userId = userIdFrom(event);
  if (!userId) return response(401, { error: 'Authenticated user identity is required.' });
  const routeResult = await routeApi(event);
  if (routeResult) return routeResult;
  const method = event.requestContext?.http?.method;
  const path = event.rawPath || '';

  if (path === '/recommendations' && method === 'POST') {
    const input = bodyFrom(event);
    if (!input) return response(400, { error: 'Invalid request body.' });
    return response(200, { data: recommendation(input), disclaimer: 'Planning guidance only; not a diagnosis.' });
  }

  if (path === '/health-report' && method === 'POST') {
    const input = bodyFrom(event);
    if (!input?.content) return response(400, { error: 'Report content is required.' });
    const key = `${userId}/${new Date().toISOString()}.txt`;
    await s3.send(new PutObjectCommand({
      Bucket: reportBucket,
      Key: key,
      Body: String(input.content).slice(0, 250000),
      ContentType: 'text/plain; charset=utf-8',
      ServerSideEncryption: 'AES256',
    }));
    return response(201, { data: { key, expiresAfterDays: 30 } });
  }

  return response(404, { error: 'Route not found.' });
}

