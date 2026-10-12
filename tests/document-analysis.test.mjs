import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { cloudHandler } from '../infra/lambda/cloud.mjs';
const require = createRequire(new URL('../infra/lambda/cloud.mjs', import.meta.url));
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

test('confirmed report analysis uses Gemini and persists the result without a Groq key', async t => {
  const before = { ...process.env };
  Object.assign(process.env, { DOCUMENT_TABLE: 'test-documents', AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', GEMINI_MODEL: 'test-model' });
  delete process.env.GROQ_API_KEY;
  let saved;
  t.mock.method(DynamoDBDocumentClient.prototype, 'send', async command => {
    if (command.constructor.name === 'GetCommand') return { Item: { confirmed: true, confirmedFacts: ['Synthetic document for testing.'], name: 'Test' } };
    saved = command.input.ExpressionAttributeValues[':a'];
    return {};
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(String(url), /generativelanguage.googleapis.com/);
    assert.equal(JSON.parse(options.body).generationConfig.responseMimeType, 'application/json');
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ headline: 'Test summary', doList: [], dontList: [], necessaryList: [] }) }] } }] });
  });
  try {
    const result = await cloudHandler({ rawPath: '/api/cloud/documents/analyse', body: JSON.stringify({ documentId: 'test-document', consent: true }), requestContext: { http: { method: 'POST' }, authorizer: { jwt: { claims: { sub: 'test-user' } } } } });
    assert.equal(result.statusCode, 200);
    assert.equal(saved.headline, 'Test summary');
    assert.equal(JSON.parse(result.body).data.documentId, 'test-document');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
