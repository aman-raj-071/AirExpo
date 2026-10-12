import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {smsHandler} from '../infra/lambda/sms.mjs';
const require=createRequire(new URL('../infra/lambda/sms.mjs',import.meta.url));
const {SNSClient}=require('@aws-sdk/client-sns');
const {DynamoDBDocumentClient}=require('@aws-sdk/lib-dynamodb');
const event=(phone,verified='true',path='/api/cloud/sms/test')=>({rawPath:path,requestContext:{http:{method:'POST'},authorizer:{jwt:{claims:{sub:'synthetic-test-user',phone_number:phone,phone_number_verified:verified}}}}});
test('SNS rejects a phone that differs from verified identity or lacks consent',async t=>{
 const old=process.env.SETTINGS_TABLE;process.env.SETTINGS_TABLE='test-settings';
 t.mock.method(DynamoDBDocumentClient.prototype,'send',async()=>({Item:{healthProfile:{mobileNumber:'+12025550123',smsOptIn:true}}}));
 let calls=0;t.mock.method(SNSClient.prototype,'send',async()=>{calls++;});
 try{
  assert.equal((await smsHandler(event('+12025550124'))).statusCode,403);
  assert.equal((await smsHandler(event('+12025550123','false'))).statusCode,403);
  assert.equal(calls,0);
 }finally{if(old===undefined)delete process.env.SETTINGS_TABLE;else process.env.SETTINGS_TABLE=old;}
});
test('SNS targets only the saved verified personal mobile after atomic consent and cooldown checks',async t=>{
 const old=process.env.SETTINGS_TABLE;process.env.SETTINGS_TABLE='test-settings';let claimed=false;
 t.mock.method(DynamoDBDocumentClient.prototype,'send',async command=>{
  if(command.constructor.name==='GetCommand'){assert.equal(command.input.Key.userId,'synthetic-test-user');return {Item:{healthProfile:{mobileNumber:'+12025550123',smsOptIn:true},smsAlerts:{enabled:true,threshold:50,lat:13,lon:77,label:'Test city'}}};}
  assert.match(command.input.ConditionExpression,/healthProfile.smsOptIn/);claimed=true;return {};
 });
 t.mock.method(globalThis,'fetch',async()=>Response.json({current:{us_aqi:158}}));
 t.mock.method(SNSClient.prototype,'send',async command=>{assert.match(command.input.Message,/AQI is 158/);assert.match(command.input.Message,/Test city/);assert.ok(claimed);assert.equal(command.input.PhoneNumber,'+12025550123');assert.equal(command.input.TopicArn,undefined);return {MessageId:'synthetic'};});
 try{assert.equal((await smsHandler(event('+12025550123'))).statusCode,200);}finally{if(old===undefined)delete process.env.SETTINGS_TABLE;else process.env.SETTINGS_TABLE=old;}
});
test('SNS requires verified authentication',async()=>{assert.equal((await smsHandler({rawPath:'/api/cloud/sms',requestContext:{http:{method:'GET'}}})).statusCode,401);});
