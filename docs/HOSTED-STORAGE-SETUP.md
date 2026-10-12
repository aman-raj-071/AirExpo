# Complete hosted storage setup

Runtime update (2026-10-12): the existing AirExpo Lambda was still configured
with a 3-second timeout and 128 MB memory. CloudWatch confirmed repeated timeouts
and memory usage near that limit. It now uses a 30-second timeout and 512 MB memory.
The AirExpoPrivateStorage inline policy is now present on its execution role.

The AirExpo Lambda in us-east-1 now contains authenticated cloud storage endpoints
and CORS for https://main.d1u40zs0ugi10g.amplifyapp.com. Storage resource names and
the existing Gemini configuration have been added to its environment. Credentials
must remain server-side; never add them to VITE variables.

An AWS administrator must attach the prepared inline policy to the existing runtime
role. The current classline-cli-user cannot perform iam:PutRolePolicy.

Run from the repository root with an administrator-authorized AWS identity:

```powershell
aws iam put-role-policy --role-name AirExpo-role-62frx6gd --policy-name AirExpoPrivateStorage --policy-document file://infra/airexpo-private-storage-policy.json --region us-east-1
```

The policy permits CRUD on four named AirExpo DynamoDB tables, access to the
private AirExpo reports bucket, and three Textract extraction actions. Textract's
processing actions use Resource "*"; no general Textract administrative access is granted.

In Amplify app d1u40zs0ugi10g, set the frontend environment variable:

```text
VITE_STORAGE_API_URL=https://xsvjrx04tl.execute-api.us-east-1.amazonaws.com/api/cloud
```

Rebuild the main branch. The current CLI identity cannot read/update Amplify settings.
The source also defaults to this endpoint on hosted websites when the variable is absent.

Then sign in and verify profile save/reload, first journal save/reload, and report
upload/extraction with a non-sensitive test document. Confirm assistant responses
only after storage permissions are applied. A 204 preflight or unauthenticated 401
proves CORS/auth routing, not database write access or successful AI generation.
