# AirGuard AWS deployment

The SAM template provisions six backend services directly:

1. Cognito
2. API Gateway
3. Lambda
4. DynamoDB
5. S3
6. EventBridge

The Health Assistant also uses dedicated encrypted DynamoDB tables for reviewed
medical-document metadata and chat conversations. Configure `DOCUMENT_TABLE` and
`CONVERSATION_TABLE` from the stack outputs in the local server environment.

Amplify Hosting is the seventh service and is connected to the repository after
the frontend is pushed. It is not created automatically because repository
access requires the project owner's account authorization.

## Deploy the backend

Prerequisites: an AWS account, configured AWS CLI, SAM CLI, and a region selected
by the project owner.

```sh
cd infra/lambda
npm install
cd ..
sam build
sam deploy --guided
```

Copy the stack outputs into the frontend environment configuration. Do not put
AWS secrets in Vite environment variables; browser-visible variables are public.

For the local Express server, set `DOCUMENT_TABLE`, `CONVERSATION_TABLE`, and
`REPORT_BUCKET` along with the existing Cognito and health table settings. The
assistant uses the existing Gemini provider only when `AI_PROVIDER=gemini` and
`GEMINI_API_KEY` are set on the server. Store the API key as a server secret; do
not add a `VITE_` prefix or commit it. For the deployed Lambda, add the key to
Lambda's server-side secret configuration and map it to `GEMINI_API_KEY` in the
function environment, then redeploy/update the function. The UI discloses Gemini
and requires consent before sending messages or selected health context.

## Connect Amplify Hosting

In the Amplify console, choose **New app → Host web app**, connect the repository,
and use the repository root as the application root. Build command: `npm run
build`; output directory: `dist`.

## Security notes

- The API uses Cognito JWT authorization by default.
- `POST /api/aqi/workflow` is the authenticated API Gateway endpoint for starting the AQI Step Functions workflow. Send `{ "latitude": 28.7041, "longitude": 77.1025 }`; it returns HTTP 202 with an execution ARN.
- DynamoDB records use the JWT subject as their partition key.
- The report bucket blocks all public access and encrypts stored objects.
- Reports expire after 30 days.
- Assistant conversations are scoped by Cognito subject, encrypted in DynamoDB,
  user-deletable, and automatically expire after 30 days.
- Medical uploads remain private in S3 and are not processed by Textract until
  the user consents. The user reviews and confirms extracted text before chat
  retrieval can use it. Users can delete the report and its extracted record.
- The assistant uses server-side Open-Meteo AQI/weather retrieval and the
  server-configured Gemini model. If the model is not configured, chat returns
  an unavailable message instead of silently switching providers.
- The scheduled function does not send notifications until an explicit opt-in
  and a delivery service are added.
- Use synthetic health records for the hackathon demo.

See [Health Assistant setup, endpoints, demo and limitations](../docs/HEALTH-ASSISTANT.md)
for document processing and chat details.
