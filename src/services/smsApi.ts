export type SmsStatus = { configured: boolean; enabled: boolean; threshold: number; message: string };

export async function smsRequest(body?: unknown): Promise<SmsStatus> {
  const response = await fetch('/api/alerts/sms', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'SMS is unavailable.');
  return data;
}

export async function sendSmsTest() {
  const response = await fetch('/api/alerts/sms/test', { method: 'POST' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'AWS SNS did not accept the test message.');
  return data as { success: boolean; message: string };
}
