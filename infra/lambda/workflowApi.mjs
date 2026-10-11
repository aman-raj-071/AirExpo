import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

const client = new SFNClient({});

export async function handler(event = {}) {
  let input;
  try { input = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON.' }) }; }
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Valid latitude and longitude are required.' }) };
  }
  const execution = await client.send(new StartExecutionCommand({
    stateMachineArn: process.env.AQI_WORKFLOW_ARN,
    input: JSON.stringify({ latitude, longitude }),
  }));
  return {
    statusCode: 202,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify({ executionArn: execution.executionArn, startDate: execution.startDate }),
  };
}
