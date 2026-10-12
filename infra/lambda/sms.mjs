import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
const sns = new SNSClient({region:process.env.SNS_REGION || process.env.AWS_REGION});
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const reply=(statusCode,body)=>({statusCode,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
export async function smsHandler(event){
 const path=event.rawPath;
 if(!['/api/cloud/sms','/api/cloud/sms/test','/api/cloud/sms/notify'].includes(path))return null;
 const claims=event.requestContext?.authorizer?.jwt?.claims;
 const userId=claims?.sub,method=event.requestContext?.http?.method;
 if(!userId)return reply(401,{error:'Sign in before using SMS alerts.'});
 if(!process.env.SETTINGS_TABLE)return reply(503,{error:'Account storage is not configured.'});
 try{
  const found=await db.send(new GetCommand({TableName:process.env.SETTINGS_TABLE,Key:{userId},ConsistentRead:true}));
  const profile=found.Item?.healthProfile||{},settings=found.Item?.smsAlerts||{};
  const phone=profile.mobileNumber;
  const verified=typeof phone==='string'&&/^\+[1-9]\d{7,14}$/.test(phone)&&phone===claims.phone_number&&String(claims.phone_number_verified)==='true';
  const ready=verified&&profile.smsOptIn===true;
  if(path==='/api/cloud/sms'&&method==='GET')return reply(200,{configured:ready,enabled:ready&&settings.enabled===true,threshold:settings.threshold||200,automaticAvailable:true,message:!profile.smsOptIn?'Add your mobile number and SMS consent in Profile.':!verified?'Verify your saved mobile number in Profile before using SMS.':'Your verified mobile is connected. AQI checks run while this dashboard is open; at most one alert per hour.'});
  if(!ready)return reply(403,{error:'Save your mobile number, verify it in Profile, and enable SMS consent before sending notifications.'});
  if(path==='/api/cloud/sms'&&method==='POST'){
   let body;try{body=JSON.parse(event.body||'{}');}catch{return reply(400,{error:'Invalid JSON.'});}
   const {enabled,threshold,lat,lon}=body;
   const label=typeof body.label==='string'?body.label.replace(/[\r\n]/g,' ').trim().slice(0,120):'your selected location';
   if(typeof enabled!=='boolean'||!Number.isFinite(threshold)||threshold<50||threshold>350||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)return reply(400,{error:'Enter a valid threshold and location.'});
   await db.send(new UpdateCommand({TableName:process.env.SETTINGS_TABLE,Key:{userId},UpdateExpression:'SET smsAlerts = :settings',ExpressionAttributeValues:{':settings':{enabled,threshold,lat,lon,label}}}));
   return reply(200,{configured:true,enabled,threshold,automaticAvailable:true,message:enabled?'SMS enabled for your verified mobile while the dashboard is open.':'SMS disabled.'});
  }
  if(method!=='POST'||!['/api/cloud/sms/test','/api/cloud/sms/notify'].includes(path))return reply(405,{error:'Method not allowed.'});
  const test=path.endsWith('/test');
  if(!test&&!settings.enabled)return reply(200,{success:true,sent:false,message:'SMS alerts are disabled.'});
  if(!Number.isFinite(settings.lat)||!Number.isFinite(settings.lon))return reply(400,{error:'Enable SMS once in Air quality alerts to save your location and threshold, then retry.'});
  const response=await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${settings.lat}&longitude=${settings.lon}&current=us_aqi`,{signal:AbortSignal.timeout(8000)});
  if(!response.ok)return reply(502,{error:'AQI provider is unavailable. Retry shortly.'});
  const data=await response.json(),aqi=data.current?.us_aqi;
  if(!Number.isFinite(aqi))return reply(502,{error:'No current modeled AQI is available.'});
  if(!test&&aqi<settings.threshold)return reply(200,{success:true,sent:false,message:`Current AQI ${Math.round(aqi)} is below your SMS threshold ${settings.threshold}. No alert sent.`});
  const label=typeof settings.label==='string'?settings.label.replace(/[\r\n]/g,' ').slice(0,120):'your selected location';
  const message=`AirExpo ${test?'AQI test':'AQI alert'} for ${label}: current modeled U.S. AQI is ${Math.round(aqi)}. Your threshold is ${settings.threshold}. ${test?'This is a test update.':'Check local conditions before going outdoors.'}`;
  const field=test?'smsTestRequestedAt':'smsAlertRequestedAt',now=Date.now();
  await db.send(new UpdateCommand({TableName:process.env.SETTINGS_TABLE,Key:{userId},UpdateExpression:'SET #time = :now',ConditionExpression:'(attribute_not_exists(#time) OR #time < :cutoff) AND healthProfile.mobileNumber = :phone AND healthProfile.smsOptIn = :consent',ExpressionAttributeNames:{'#time':field},ExpressionAttributeValues:{':now':now,':cutoff':now-(test?60000:3600000),':phone':phone,':consent':true}}));
  try {
   await sns.send(new PublishCommand({PhoneNumber:phone,Message:message,MessageAttributes:{'AWS.SNS.SMS.SMSType':{DataType:'String',StringValue:'Transactional'}}}));
  } catch (publishError) {
   // Failed publishes must not suppress the user's next AQI alert for an hour.
   await db.send(new UpdateCommand({TableName:process.env.SETTINGS_TABLE,Key:{userId},UpdateExpression:'REMOVE #time',ConditionExpression:'#time = :now',ExpressionAttributeNames:{'#time':field},ExpressionAttributeValues:{':now':now}})).catch(()=>{});
   throw publishError;
  }
  return reply(200,{success:true,sent:true,message:'AWS SNS accepted the notification for your verified mobile. Carrier delivery is not guaranteed.'});
 }catch(error){
  console.warn('SNS request failed',{name:error?.name});
  if(error?.name==='ConditionalCheckFailedException')return reply(429,{error:'SMS cooldown is active, or your saved phone/consent changed. Wait and reload before retrying.'});
  if(['AuthorizationErrorException','AuthorizationError','AccessDeniedException'].includes(error?.name))return reply(403,{error:'AWS denied direct SMS publishing. The Lambda role needs infra/sns-alerts-publish-policy.json. Topic-only access cannot send to individual mobile numbers.'});
  return reply(502,{error:'SMS request failed. Check SNS sandbox verification, spending limits, Cognito SMS settings and country registration.'});
 }
}
