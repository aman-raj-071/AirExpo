import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const profileTable = process.env.PROFILE_TABLE;
const symptomTable = process.env.SYMPTOM_TABLE;
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

function validateProfile(value) {
  return value && ['everyday', 'asthma', 'athlete'].includes(value.mode)
    && Number.isFinite(Number(value.usualOutdoorMinutes));
}

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
  if (event.source === 'airguard.schedule') {
    // Notification delivery is deliberately separate: only opted-in users
    // should be processed after SNS/web-push consent is implemented.
    console.info('Scheduled alert evaluation completed', { action: event.action });
    return { processed: 0 };
  }

  const userId = userIdFrom(event);
  if (!userId) return response(401, { error: 'Authenticated user identity is required.' });
  const method = event.requestContext?.http?.method;
  const path = event.rawPath || '';

  if (path === '/profile' && method === 'GET') {
    const result = await db.send(new GetCommand({ TableName: profileTable, Key: { userId } }));
    return response(200, { data: result.Item || null });
  }

  if (path === '/profile' && method === 'POST') {
    const input = bodyFrom(event);
    if (!validateProfile(input)) return response(400, { error: 'Invalid profile.' });
    const item = { ...input, userId, updatedAt: new Date().toISOString() };
    await db.send(new PutCommand({ TableName: profileTable, Item: item }));
    return response(200, { data: item });
  }

  if (path === '/symptoms' && method === 'GET') {
    const result = await db.send(new QueryCommand({
      TableName: symptomTable,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
      ScanIndexForward: false,
      Limit: 100,
    }));
    return response(200, { data: result.Items || [] });
  }

  if (path === '/symptoms' && method === 'POST') {
    const input = bodyFrom(event);
    if (!input || !['mild', 'moderate', 'severe'].includes(input.severity)) return response(400, { error: 'Invalid symptom entry.' });
    const item = { ...input, userId, recordedAt: input.recordedAt || new Date().toISOString() };
    await db.send(new PutCommand({ TableName: symptomTable, Item: item }));
    return response(201, { data: item });
  }

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

