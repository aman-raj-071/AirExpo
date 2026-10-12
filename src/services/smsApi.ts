import { cloudRequest } from './cloudStorage';
export type SmsStatus = { configured: boolean; enabled: boolean; threshold: number; message: string; automaticAvailable?: boolean };
const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

async function localRequest(path: string, body?: unknown) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw Error('SMS backend is unavailable. Start the AirExpo server or configure the hosted API.');
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'SMS request failed.');
  return data;
}
export async function smsRequest(body?: unknown): Promise<SmsStatus> {
  return local ? localRequest('/api/alerts/sms', body) : cloudRequest('/sms', body);
}
export async function sendSmsTest(): Promise<{success: boolean; message: string}> {
  return local ? localRequest('/api/alerts/sms/test', {}) : cloudRequest('/sms/test', {});
}
