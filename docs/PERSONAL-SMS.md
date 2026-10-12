# Personal mobile notifications

Each signed-in account can save an optional E.164 mobile number (for example
`+919876543210`) and SMS consent in Profile. Numbers are stored in the account's
private DynamoDB profile and encrypted S3 backup. They are not added to a shared
SNS topic or sent to Gemini.

The user clicks Send verification code, enters the Cognito SMS code, and saves
their profile. Cognito's verified phone claim must match the saved mobile number.
The backend accepts only validated JWT claims, never a destination from an SMS
request. Changing the mobile or removing consent stops delivery to the old number.

Air quality alerts can then be enabled for that account. While the dashboard is
open it requests an AQI check every five minutes. The backend independently fetches
AQI for the saved alert location and publishes only if the threshold is exceeded.
Conditional DynamoDB writes enforce one alert per account per hour and one test
request per minute across Lambda instances. No automatic messages run while the
dashboard is closed; that requires a scheduled worker.

## AWS administrator setup

1. In Cognito pool `us-east-1_UOugaJlN8`, allow the app client to read/write
   `phone_number` and read `phone_number_verified`. Configure Cognito SMS delivery
   and its SNS publishing role. Enable verification when the phone number changes.
2. Attach `infra/sns-alerts-publish-policy.json` to Lambda role
   `AirExpo-role-62frx6gd`. The previous topic-only policy is insufficient for direct
   PhoneNumber publishing. SNS direct publishing requires Resource `*`; this policy
   restricts publishing to us-east-1. The application restricts destinations to the
   signed-in user's saved, consented, Cognito-verified number.
3. While in the SNS SMS sandbox, verify destinations in us-east-1 too. Cognito
   ownership verification and SNS sandbox destination verification are different.
   Request SMS production access to support arbitrary new users, and satisfy SMS
   spending-limit and destination-country sender-registration requirements.
4. Deploy the frontend and backend together. Sign in again if old tokens lack
   phone claims. Use Send SNS test message only when ready to send a real SMS.

The current CLI identity cannot inspect Cognito pool settings or modify IAM policies.
No real mobile numbers or verification messages were used in automated tests.
