import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGemini, geminiKeys } from '../infra/lambda/gemini.mjs';

test('server keys are deduplicated and malformed configuration is rejected', () => {
  assert.deepEqual(geminiKeys({GEMINI_API_KEY:'primary',GEMINI_API_KEYS:'["primary","backup"]'}),['primary','backup']);
  assert.throws(()=>geminiKeys({GEMINI_API_KEYS:'not-json'}),/configuration/);
});
test('quota failure switches credentials and cools down the exhausted key', async () => {
  const env={GEMINI_API_KEY:'quota-primary',GEMINI_API_KEYS:'["quota-backup"]',GEMINI_MODEL:'test-model'};
  const used=[];
  const fetchImpl=async (url,options)=>{
    used.push(options.headers['x-goog-api-key']);
    return used.length===1?new Response('',{status:429,headers:{'retry-after':'60'}}):Response.json({candidates:[]});
  };
  const result=await generateGemini({contents:[]},{env,fetchImpl,sleep:async()=>{}});
  assert.equal(result.attempts,2);
  await generateGemini({contents:[]},{env,fetchImpl,sleep:async()=>{}});
  assert.deepEqual(used,['quota-primary','quota-backup','quota-backup']);
});
test('configuration errors do not rotate keys or disclose provider response text', async () => {
  for(const status of [400,401,403,404]){
    let calls=0;
    await assert.rejects(generateGemini({}, {env:{GEMINI_API_KEY:'bad-key',GEMINI_API_KEYS:'["unused"]'},fetchImpl:async()=>{calls++;return new Response('secret provider text',{status});}}),error=>error.statusCode===503&&!error.message.includes('secret'));
    assert.equal(calls,1);
  }
});
test('transient outage retries but never exceeds three attempts',async()=>{
  let calls=0;
  await assert.rejects(generateGemini({}, {env:{GEMINI_API_KEY:'outage-key'},fetchImpl:async()=>{calls++;return new Response('',{status:503});},sleep:async()=>{}}),error=>error.statusCode===503);
  assert.equal(calls,3);
});
test('one exhausted key respects Retry-After instead of hammering the API',async()=>{
  let calls=0;
  await assert.rejects(generateGemini({}, {env:{GEMINI_API_KEY:'single-quota'},fetchImpl:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'3600'}});},sleep:async()=>assert.fail('must not wait beyond budget')}),error=>error.statusCode===429);
  assert.equal(calls,1);
});
