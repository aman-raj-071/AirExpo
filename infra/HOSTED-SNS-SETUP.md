# Hosted SNS test delivery

The hosted frontend must be rebuilt to use the authenticated `/api/cloud/sms`
and `/api/cloud/sms/test` endpoints. The existing topic is configured in Lambda.
The old `/api/alerts/sms` routes only run in the local Express server.

An AWS administrator must attach `sns-topic-publish-policy.json` as an inline
policy to role `AirExpo-role-62frx6gd`. The current CLI identity cannot change IAM:

```powershell
aws iam put-role-policy --role-name AirExpo-role-62frx6gd --policy-name AirExpoSnsTopicPublish --policy-document file://infra/sns-topic-publish-policy.json --region us-east-1
```

This grants publishing only to `AirExpoAqiAlerts`, not arbitrary phone numbers.
After rebuilding Amplify, sign in and click **Send SNS test message** once.
That action sends a generic test to all subscribers of the configured topic.
Tests are limited to one request per account per minute. No real SMS was sent
as part of this code change.

If SNS accepts the publish but the phone receives nothing, check the subscription,
same-region SMS sandbox destination verification, SMS spending limits, and
country-specific sender registration/routing. SNS acceptance is not proof of
carrier delivery. Sandbox account inspection is denied to the current CLI user.

Automatic hosted AQI monitoring is not deployed. The local Express monitor does
not run on Amplify Hosting or persist as a Lambda background timer. The hosted
UI explicitly disables automatic enablement rather than claiming alerts run.
