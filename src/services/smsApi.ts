import { cloudRequest } from './cloudStorage';
export type SmsStatus = { configured: boolean; enabled: boolean; threshold: number; message: string; automaticAvailable?: boolean };
export async function smsRequest(body?: unknown): Promise<SmsStatus> {
  return cloudRequest('/sms', body);
}
export async function sendSmsTest(): Promise<{success: boolean; message: string}> {
  return cloudRequest('/sms/test', {});
}
export async function checkSmsAlert(): Promise<{success: boolean; sent: boolean; message: string}> {
  return cloudRequest('/sms/notify', {});
}
