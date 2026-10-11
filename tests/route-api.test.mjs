import test from 'node:test';
import assert from 'node:assert/strict';
import { routeApi } from '../infra/lambda/routeApi.mjs';

const event = (path, method = 'GET', extra = {}) => ({ rawPath: path, requestContext: { http: { method } }, ...extra });

test('routing rejects malformed bodies and out-of-range coordinates', async () => {
  assert.equal((await routeApi(event('/api/routes', 'POST', { body: '{' }))).statusCode, 400);
  assert.equal((await routeApi(event('/api/routes', 'POST', { body: JSON.stringify({ origin: { lat: 91, lon: 0 }, destination: { lat: 0, lon: 0 }, mode: 'walk' }) }))).statusCode, 400);
  assert.equal((await routeApi(event('/api/route-air-quality'))).statusCode, 400);
});

test('routing dispatch leaves unrelated endpoints alone and rejects wrong methods', async () => {
  assert.equal(await routeApi(event('/settings')), null);
  assert.equal((await routeApi(event('/api/routes'))).statusCode, 405);
});

test('Lambda routes return provider routes and air-quality JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('openrouteservice')) return Response.json({ features: [{ geometry: { coordinates: [[77, 13], [77.1, 13.1]] }, properties: { summary: { distance: 1000, duration: 600 } } }] });
    return Response.json({ current: { us_aqi: 42, pm2_5: 10, time: 123 } });
  });
  const original = process.env.OPENROUTESERVICE_API_KEY;
  process.env.OPENROUTESERVICE_API_KEY = 'test-only';
  try {
    const result = await routeApi(event('/api/routes', 'POST', { body: JSON.stringify({ origin: { lat: 13, lon: 77 }, destination: { lat: 13.1, lon: 77.1 }, mode: 'walk' }) }));
    assert.equal(result.statusCode, 200);
    assert.equal(JSON.parse(result.body).routes[0].distanceKm, 1);
    const quality = await routeApi(event('/api/route-air-quality', 'GET', { queryStringParameters: { lat: '13', lon: '77' } }));
    assert.equal(JSON.parse(quality.body).current.us_aqi, 42);
  } finally {
    if (original === undefined) delete process.env.OPENROUTESERVICE_API_KEY; else process.env.OPENROUTESERVICE_API_KEY = original;
  }
});

test('Lambda geocoder returns selectable coordinates', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([{ display_name: 'Example hill', lat: '13.4', lon: '77.7' }]));
  const result = await routeApi(event('/api/route-geocode', 'GET', { queryStringParameters: { q: 'Example hill' } }));
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body).results, [{ name: 'Example hill', lat: 13.4, lon: 77.7 }]);
});
