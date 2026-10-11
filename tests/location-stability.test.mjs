import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';

const { translateDocument } = await tsImport('../src/services/i18n.ts', import.meta.url);
const { fetchEnvironmentalData } = await tsImport('../src/services/openMeteoApi.ts', import.meta.url);
const { fetchAiDiagnostic } = await tsImport('../src/services/aiDiagnosticService.ts', import.meta.url);

test('translation preserves new React text and settles without repeated DOM writes', () => {
  let writes = 0;
  let value = 'Delhi';
  const node = {
    parentElement: { tagName: 'P' },
    get nodeValue() { return value; },
    set nodeValue(next) { writes++; value = next; },
  };
  const previousDocument = globalThis.document;
  const previousFilter = globalThis.NodeFilter;
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.document = {
    body: {}, documentElement: {},
    createTreeWalker() { let visited = false; return { nextNode() { if (visited) return null; visited = true; return node; } }; },
  };
  try {
    for (const language of ['EN', 'HI', 'KN']) {
      value = 'Delhi'; translateDocument(language);
      for (const latest of ['Mumbai', '125', 'Good afternoon', 'Updated 12:30']) {
        value = latest; // A React text-node update.
        translateDocument(language);
        assert.equal(value, latest);
      }
    }
    value = 'Now'; translateDocument('HI');
    assert.equal(value, 'अभी');
    const settledWrites = writes;
    for (let i = 0; i < 20; i++) translateDocument('HI');
    assert.equal(writes, settledWrites, 'observer passes must be idempotent');
    translateDocument('KN'); assert.equal(value, 'ಈಗ');
    translateDocument('EN'); assert.equal(value, 'Now');
    value = 'Routes'; translateDocument('HI'); assert.equal(value, 'मार्ग');
    translateDocument('EN'); assert.equal(value, 'Routes');
  } finally {
    globalThis.document = previousDocument;
    globalThis.NodeFilter = previousFilter;
  }
});

test('telemetry uses provider current.time and preserves selected coordinates', async () => {
  const originalFetch = globalThis.fetch;
  const location = { name: 'Mumbai', country: 'India', latitude: 19.076, longitude: 72.8777 };
  const controller = new AbortController();
  const time = 1791691200;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({
      latitude: 19, longitude: 73, timezone: 'Asia/Kolkata',
      current: { time, us_aqi: 75, temperature_2m: 28 }, hourly: { time: [] },
    }) };
  };
  try {
    const data = await fetchEnvironmentalData(location, controller.signal);
    assert.equal(data.location.latitude, location.latitude);
    assert.equal(data.location.longitude, location.longitude);
    assert.equal(data.currentAqi, 75);
    assert.equal(data.lastUpdated, new Date(time * 1000).toLocaleTimeString([], { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }));
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.options.signal === controller.signal));
  } finally { globalThis.fetch = originalFetch; }
});

test('cancelled telemetry rejects instead of returning old readings', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async (_url, { signal }) => { signal.throwIfAborted(); };
  try {
    await assert.rejects(fetchEnvironmentalData({ name: 'Delhi', latitude: 28.7, longitude: 77.1 }, controller.signal), { name: 'AbortError' });
  } finally { globalThis.fetch = originalFetch; }
});

test('AI cache separates identical city names and changing pollutant readings', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ success: true, data: { executiveSummary: `report-${++requests}` } }) });
  const station = {
    location: { name: 'Springfield', country: 'US', latitude: 39.8, longitude: -89.6 },
    currentAqi: 75, pollutants: { pm2_5: { value: 18 } }, weather: { temperature: 22 }, safeWindows: [],
  };
  try {
    const first = await fetchAiDiagnostic(station);
    assert.deepEqual(await fetchAiDiagnostic(station), first);
    assert.equal(requests, 1);
    const elsewhere = await fetchAiDiagnostic({ ...station, location: { ...station.location, latitude: 42.1, longitude: -72.6 } });
    assert.notDeepEqual(elsewhere, first);
    await fetchAiDiagnostic({ ...station, pollutants: { pm2_5: { value: 24 } } });
    assert.equal(requests, 3);
  } finally { globalThis.fetch = originalFetch; }
});

test('forecast windows use consecutive supplied hours and their actual average', async () => {
  const originalFetch = globalThis.fetch;
  const start = Math.ceil(Date.now() / 3600000) * 3600 + 3600;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({
    timezone: 'Asia/Kolkata', current: { us_aqi: 75, time: start },
    hourly: { time: [start, start + 3600, start + 7200, start + 10800], us_aqi: [80, 20, 30, 40] },
  }) });
  try {
    const data = await fetchEnvironmentalData({ name: 'Test', latitude: 20, longitude: 70 });
    assert.equal(data.safeWindows.length, 1);
    assert.equal(data.safeWindows[0].averageAqi, 30);
    assert.equal(data.safeWindows[0].startTime, data.hourlyTimeline[1].formattedTime);
  } finally { globalThis.fetch = originalFetch; }
});
