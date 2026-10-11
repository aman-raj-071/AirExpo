import express from 'express';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';

const DEFAULT_THRESHOLD = 200;
const ALERT_INTERVAL_MS = 5 * 60 * 1000;
const MAX_MESSAGE_AGE_MS = 60 * 60 * 1000;

type AlertSettings = { enabled: boolean; threshold: number; lat: number; lon: number; label: string };
let settings: AlertSettings = {
  enabled: false,
  threshold: DEFAULT_THRESHOLD,
  lat: 28.7041,
  lon: 77.1025,
  label: 'Rohini, Delhi',
};
let lastSentAt = 0;
let monitorBusy = false;

function getSettingsPath() {
  return process.env.SNS_ALERT_SETTINGS_FILE || '.airexpo-alert-settings.json';
}

async function loadSettings() {
  try {
    const { readFile } = await import('node:fs/promises');
    const value = JSON.parse(await readFile(getSettingsPath(), 'utf8'));
    if (typeof value.enabled === 'boolean' && Number.isFinite(value.threshold) && Number.isFinite(value.lat) && Number.isFinite(value.lon)) {
      settings = { ...settings, ...value };
    }
    if (Number.isFinite(value.lastSentAt)) lastSentAt = value.lastSentAt;
  } catch (error: any) {
    if (error?.code !== 'ENOENT') console.warn('Could not read SNS alert settings:', error?.message || error);
  }
}

let settingsLoaded: Promise<void> | undefined;
function ensureSettings() { settingsLoaded ??= loadSettings(); return settingsLoaded; }

async function saveSettings() {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(getSettingsPath(), JSON.stringify({ ...settings, lastSentAt }, null, 2), 'utf8');
}

function configured() {
  return Boolean((process.env.SNS_REGION || process.env.AWS_REGION) && recipients().length === 2);
}

function recipients() {
  return (process.env.SNS_SMS_RECIPIENTS || '').split(',').map((value) => value.trim()).filter((value) => /^\+[1-9]\d{7,14}$/.test(value));
}

function validate(input: any): AlertSettings {
  const threshold = Number(input?.threshold);
  const lat = Number(input?.lat);
  const lon = Number(input?.lon);
  const label = String(input?.label || 'Selected location').trim().slice(0, 120);
  if (!Number.isFinite(threshold) || threshold < 50 || threshold > 350) throw Error('AQI threshold must be between 50 and 350.');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) throw Error('Valid latitude and longitude are required.');
  return { enabled: Boolean(input?.enabled), threshold, lat, lon, label };
}

async function currentAqi() {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.search = new URLSearchParams({ latitude: String(settings.lat), longitude: String(settings.lon), current: 'us_aqi', timezone: 'GMT' }).toString();
  const response = await fetch(url);
  if (!response.ok) throw Error(`Open-Meteo returned HTTP ${response.status}.`);
  const data: any = await response.json();
  const aqi = Number(data?.current?.us_aqi);
  if (!Number.isFinite(aqi)) throw Error('The air-quality provider returned no current AQI.');
  return aqi;
}

async function publishToRecipients(message: string) {
  const targets = recipients();
  if (!targets.length) throw Error('Set SNS_SMS_RECIPIENTS on the server to the verified destination numbers.');
  const region = process.env.SNS_REGION || process.env.AWS_REGION!;
  const sns = new SNSClient({ region });
  const results = await Promise.allSettled(targets.map((PhoneNumber) => sns.send(new PublishCommand({
    PhoneNumber,
    Message: message,
    MessageAttributes: { 'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' } },
  }))));
  const accepted = results.filter((result) => result.status === 'fulfilled').length;
  if (accepted) {
    lastSentAt = Date.now();
    await saveSettings();
  }
  console.info('SNS direct SMS publish completed', { region, destinations: targets.length, accepted });
  if (accepted !== targets.length) {
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason;
    const detail = failure?.name === 'AuthorizationErrorException'
      ? `Grant the server identity sns:Publish in ${region} using infra/sns-alerts-publish-policy.json.`
      : `${failure?.name || 'Check SNS sandbox status, phone registration, and SMS spending limits.'}`;
    throw Error(`SNS accepted ${accepted} of ${targets.length} SMS messages. ${detail}`);
  }
  return { accepted, total: targets.length };
}

async function sendAlert(aqi: number) {
  const message = `AirExpo AQI alert for ${settings.label}: current modeled U.S. AQI is ${Math.round(aqi)}, above your threshold of ${settings.threshold}. Check local conditions before going outdoors. (${settings.lat.toFixed(3)}, ${settings.lon.toFixed(3)})`;
  return publishToRecipients(message);
}

function publicStatus() {
  return {
    configured: configured(),
    enabled: settings.enabled,
    threshold: settings.threshold,
    message: !configured() ? 'SNS is not configured. Set SNS_REGION and SNS_SMS_RECIPIENTS on the server.' : settings.enabled ? `Automatic alerts are enabled for ${recipients().length} verified numbers; checks run every five minutes with a one-hour cooldown.` : `Automatic alerts are off (${recipients().length} verified numbers configured).`,
  };
}

export function registerSmsAlerts(app: express.Express) {
  const handleSettings = async (req: express.Request, res: express.Response) => {
    await ensureSettings();
    if (!configured()) return res.status(503).json({ error: 'SNS is not configured. Set SNS_REGION and SNS_SMS_RECIPIENTS on the server.' });
    if (req.method === 'GET') return res.json(publicStatus());
    if (req.method !== 'POST') return res.sendStatus(405);
    const origin = req.get('origin');
    if (origin && origin !== `http://${req.hostname}:3000` && origin !== `http://localhost:3000` && origin !== `http://127.0.0.1:3000`) {
      return res.status(403).json({ error: 'SMS alert settings can only be changed from the local AirExpo server.' });
    }
    try {
      const next = validate(req.body);
      settings = next;
      await saveSettings();
      return res.json(publicStatus());
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Could not update alert settings.' });
    }
  };
  app.get('/api/alerts/sms', handleSettings);
  app.post('/api/alerts/sms', handleSettings);
}

export function startSmsMonitor() {
  const timer = setInterval(async () => {
    await ensureSettings();
    if (monitorBusy || !configured() || !settings.enabled || Date.now() - lastSentAt < MAX_MESSAGE_AGE_MS) return;
    monitorBusy = true;
    try {
      const aqi = await currentAqi();
      if (aqi >= settings.threshold) await sendAlert(aqi);
    } catch (error: any) {
      console.warn('SNS AQI alert check failed:', error?.name || 'Error', error?.message || 'unknown error');
    } finally {
      monitorBusy = false;
    }
  }, ALERT_INTERVAL_MS);
  timer.unref();
  return timer;
}

export async function sendTestSms() {
  await ensureSettings();
  if (!configured()) throw Error('Set SNS_REGION and SNS_SMS_RECIPIENTS on the server first.');
  const result = await publishToRecipients(`AirExpo test message: direct SNS SMS is connected at ${new Date().toISOString()}.`);
  return { ...result, message: `AWS SNS accepted the test message for ${result.accepted} of ${result.total} configured verified numbers.` };
}
