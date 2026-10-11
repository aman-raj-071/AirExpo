# SNS SMS alerts to verified destinations

AirExpo sends each test and AQI alert directly to every number in the server-only `SNS_SMS_RECIPIENTS` list. It does not rely on topic subscriptions. Numbers are never sent to the browser.

## Configure AWS and AirExpo

1. In the SNS console, select the same Region where the verified sandbox destinations are listed. The supplied screenshot shows **US East (N. Virginia), `us-east-1`** and two verified destinations.
2. Attach `sns-alerts-publish-policy.json` to the IAM identity used by the server. Direct SMS publishing requires `sns:Publish` with `Resource: "*"`; the policy limits it to `us-east-1`.
3. Set these server environment variables. Use the exact E.164 numbers that show **Verified** in the SNS SMS sandbox:

   ```dotenv
   AWS_REGION=us-east-1
   SNS_REGION=us-east-1
   SNS_SMS_RECIPIENTS=+919906770091,+919931897671
   ```

   Supply AWS credentials using an IAM role or `AWS_PROFILE`. Do not add these numbers or AWS credentials to `VITE_` variables or commit `.env`.

## Send and verify

Run `pnpm dev` (or `npm run dev`), sign in to the local dashboard, open **Air quality alerts**, and click **Send SNS test message**. The server makes a separate SNS publish call for each configured number and reports how many SNS accepted. Confirm receipt on both phones.

Then set the AQI threshold and click **Enable**. The Express server checks the selected location's modeled current AQI every five minutes and texts both numbers when it meets the threshold, with a one-hour cooldown. Settings are stored in `.airexpo-alert-settings.json`, excluded from Git. Keep Express running. The serverless Lambda does not run this monitor.

The screenshot shows the AWS account is in the SMS sandbox. AWS permits sandbox sends only to verified destinations in that same Region; each recipient country’s sender registration and routing requirements still apply. SNS acceptance is not proof of carrier delivery, and SMS charges may apply.
