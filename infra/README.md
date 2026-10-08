# AirGuard AWS deployment

The SAM template provisions six backend services directly:

1. Cognito
2. API Gateway
3. Lambda
4. DynamoDB
5. S3
6. EventBridge

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

## Connect Amplify Hosting

In the Amplify console, choose **New app → Host web app**, connect the repository,
and use the repository root as the application root. Build command: `npm run
build`; output directory: `dist`.

## Security notes

- The API uses Cognito JWT authorization by default.
- DynamoDB records use the JWT subject as their partition key.
- The report bucket blocks all public access and encrypts stored objects.
- Reports expire after 30 days.
- The scheduled function does not send notifications until an explicit opt-in
  and a delivery service are added.
- Use synthetic health records for the hackathon demo.
