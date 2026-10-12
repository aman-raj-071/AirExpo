import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const sns = new SNSClient({ region: process.env.SNS_REGION || process.env.AWS_REGION });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const reply = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });

export async function smsHandler(event) {
  const path = event.rawPath;
  if (!['/api/cloud/sms', '/api/cloud/sms/test'].includes(path)) return null;
  const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userId) return reply(401, { error: 'Sign in before using SMS alerts.' });
  const method = event.requestContext?.http?.method;
  const topic = process.env.SNS_TOPIC_ARN;
  const configured = Boolean(topic && process.env.SETTINGS_TABLE);
  if (method === 'GET' && path === '/api/cloud/sms') return reply(200, {
    configured, enabled: false, threshold: 200, automaticAvailable: false,
    message: configured ? 'SNS topic connected. Test messages go to its subscribed destinations. Automatic hosted AQI monitoring is not deployed.' : 'Set SNS_TOPIC_ARN and grant the Lambda role sns:Publish on that topic.',
  });
  if (path === '/api/cloud/sms' && method === 'POST') return reply(503, { error: 'Automatic hosted SMS monitoring requires a scheduled backend worker. The test-message feature is available separately.' });
  if (path !== '/api/cloud/sms/test' || method !== 'POST') return reply(405, { error: 'Method not allowed.' });
  if (!configured) return reply(503, { error: 'SNS_TOPIC_ARN or account storage is not configured on Lambda.' });
  try {
    const now = Date.now();
    // Persist the cooldown across Lambda instances; concurrent clicks cannot fan out.
    await db.send(new UpdateCommand({ TableName: process.env.SETTINGS_TABLE, Key: { userId }, UpdateExpression: 'SET smsTestRequestedAt = :now', ConditionExpression: 'attribute_not_exists(smsTestRequestedAt) OR smsTestRequestedAt < :cutoff', ExpressionAttributeValues: { ':now': now, ':cutoff': now - 60000 } }));
    await sns.send(new PublishCommand({ TopicArn: topic, Message: 'AirExpo test: AWS SNS topic publishing is connected. This is a test notification.', MessageAttributes: { 'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' } } }));
    return reply(200, { success: true, message: 'AWS SNS accepted the test notification. Acceptance does not confirm delivery to the phone; check SNS SMS delivery logs if it does not arrive.' });
  } catch (error) {
    console.warn('SNS test failed', { name: error?.name });
    if (error?.name === 'ConditionalCheckFailedException') return reply(429, { error: 'Wait one minute before requesting another test SMS.' });
    if (['AuthorizationErrorException', 'AuthorizationError', 'AccessDeniedException'].includes(error?.name)) return reply(403, { error: 'AWS denied SNS publishing. Attach infra/sns-topic-publish-policy.json to the AirExpo Lambda execution role.' });
    return reply(502, { error: 'SNS did not accept the test. Check topic subscriptions, SMS sandbox verification, spending limits and destination registration.' });
  }
}
