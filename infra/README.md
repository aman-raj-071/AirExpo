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

### Connect hosted storage and Health Assistant

The route planner also uses the SAM API: `/api/route-geocode`, `/api/routes`,
and `/api/route-air-quality`. Deploy the updated Lambda and set
`VITE_ROUTE_API_URL` to the stack's `ApiUrl` in Amplify Hosting, or leave it
empty to reuse `VITE_STORAGE_API_URL`. These endpoints require the same Cognito
session as storage. Set `OPENROUTESERVICE_API_KEY` on the Lambda for production
routing; the shared implementation uses a public development service when this
key is absent. Keep the key server-side. Rebuild the frontend after setting the
API URL; configuring only the frontend does not deploy these Lambda routes.

The existing API `https://xsvjrx04tl.execute-api.us-east-1.amazonaws.com` has
also been extended with `infra/route-bridge.mjs` as its Lambda entry point,
preserving the original Bedrock handler as `legacyBedrock.mjs`. Production
frontend builds default to this URL when neither route nor storage API URL is
configured. Local development keeps using the Express server. The bridge
validates Cognito ID tokens and allows CORS from the current Amplify origin
and localhost:3000. It serves routing only; do not assume this API also serves
cloud storage. The original Lambda ZIP is backed up under the ignored local
`.deployment/route-connect/original.zip` directory.

Amplify's static frontend build does not start `server.ts`. Without a separately
deployed backend or a same-origin API proxy, `/api/cloud/*` requests go to the
static website and storage/chat cannot work.

1. Deploy `infra/template.yaml` with `ExistingUserPoolId=us-east-1_UOugaJlN8`
   and `ExistingUserPoolClientId=6rls971j2qq88nune9f74lukbc` to match the
   frontend's default login. Set `WebOrigin` to the exact Amplify website origin
   (for example, `https://main.YOUR_APP_ID.amplifyapp.com`, without a trailing
   slash) so API Gateway allows browser requests.
2. Copy the stack's `ApiUrl` output into the Amplify Hosting build environment
   as `VITE_STORAGE_API_URL`. Use the API base URL, including any stage path,
   without adding `/api/cloud` for this SAM backend. Do not reuse an unrelated
   API Gateway endpoint: it must serve this project's `/settings`, `/documents`,
   and `/assistant/conversations` routes.
3. Configure the model API key on the backend Lambda, along with the provider
   and model. The template supplies the DynamoDB table and S3 bucket settings.
   Model keys and AWS credentials must remain server-side.
4. Rebuild and redeploy the frontend after changing the build environment.
   In browser developer tools, confirm `/assistant/conversations` is requested
   from the API host and returns JSON. A 401 indicates a session/authorizer
   mismatch; a CORS failure requires correcting `WebOrigin`; a 503 JSON response
   identifies missing backend configuration. HTML indicates a static-site
   response rather than the cloud API.

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
