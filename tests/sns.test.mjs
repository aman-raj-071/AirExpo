import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {smsHandler} from '../infra/lambda/sms.mjs';
const require=createRequire(new URL('../infra/lambda/sms.mjs',import.meta.url));
const {SNSClient}=require('@aws-sdk/client-sns');
const {DynamoDBDocumentClient}=require('@aws-sdk/lib-dynamodb');
const event=(path,method='GET',signedIn=true)=>({rawPath:path,requestContext:{http:{method},authorizer:{jwt:{claims:signedIn?{sub:'synthetic-test-user'}:{}}}}});
test('SNS requires authentication and reports unavailable automatic monitoring',async()=>{
 assert.equal((await smsHandler(event('/api/cloud/sms','GET',false))).statusCode,401);
 const result=await smsHandler(event('/api/cloud/sms'));
 assert.equal(JSON.parse(result.body).automaticAvailable,false);
});
test('SNS test publishes a generic message only after a durable cooldown claim',async t=>{
 const oldTopic=process.env.SNS_TOPIC_ARN,oldTable=process.env.SETTINGS_TABLE;
 process.env.SNS_TOPIC_ARN='test-topic';process.env.SETTINGS_TABLE='test-settings';
 let claimed=false;
 t.mock.method(DynamoDBDocumentClient.prototype,'send',async command=>{assert.ok(command.input.ConditionExpression);claimed=true;return {};});
 t.mock.method(SNSClient.prototype,'send',async command=>{assert.ok(claimed);assert.equal(command.input.TopicArn,'test-topic');assert.equal(command.input.PhoneNumber,undefined);return {MessageId:'synthetic'};});
 try{assert.equal((await smsHandler(event('/api/cloud/sms/test','POST'))).statusCode,200);}finally{
  if(oldTopic===undefined)delete process.env.SNS_TOPIC_ARN;else process.env.SNS_TOPIC_ARN=oldTopic;
  if(oldTable===undefined)delete process.env.SETTINGS_TABLE;else process.env.SETTINGS_TABLE=oldTable;
 }
});
