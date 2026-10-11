# AirExpo Health Assistant

## What it does

- Uploads private PDF, PNG, and JPEG clinician documents (up to 2 MB) to S3.
- Keeps uploads in a pending, unprocessed state until the user consents to Amazon Textract processing.
- Extracts line text with page labels and OCR confidence, then lets the user correct and confirm the text.
- Grounds chat retrieval only in selected, user-confirmed report details. Retrieval ranks matching lines, preserves page labels, and displays the exact passages used as evidence under each answer.
- Optionally includes the signed-in user's health profile and recent symptom journal. The user must opt in separately.
- Retrieves AQI, PM2.5, PM10, temperature, humidity, and hourly forecast from Open-Meteo on the server using the dashboard location coordinates.
- Stores the health profile and most recent 100 journal entries in the existing `SETTINGS_TABLE` item for the signed-in user. Each profile or journal save is also mirrored to the private S3 bucket; deleted journal entries are removed from both stores. Older entries remain in S3 after the DynamoDB recent-entry window rolls forward.
- Saves conversations and reminders in user-partitioned DynamoDB tables. Conversations expire after 30 days and can be deleted sooner.
- Mirrors the health profile and symptom journal records to encrypted objects in the private S3 bucket as well as DynamoDB. Deleting a journal entry removes both copies.
- Saves report files in private, encrypted S3. The user can delete a file and its extracted DynamoDB record.

The assistant explains report wording and environmental readings only. It must not provide medical advice, diagnose, prescribe, alter medication, or give personalized treatment instructions. It treats symptom/pollution co-occurrence as correlation, not proof of cause. Emergency wording is handled in the browser before any model or environmental request and directs the user to local emergency services and their clinician's action plan.

The original report remains in private S3 and is downloadable from **Saved reports**. Amazon Textract extracts page-labeled text only after the separate upload-processing consent. The user reviews and confirms that text. When the user selects a report and accepts Gemini consent, only retrieved confirmed text passages and page references are sent to Gemini; the original PDF/image is not sent. The answer UI shows the selected evidence passages so the user can compare the explanation with the source.

## Gemini data use and medical-record privacy

The Gemini API project’s billing status determines Google's terms. Under Google's [current terms](https://ai.google.dev/gemini-api/terms), unpaid quota may be used to improve Google products and human reviewers may process submitted prompts and responses; Google says not to submit sensitive, confidential, or personal information to unpaid services. With a paid Gemini API project, prompts and responses are not used to improve Google products, but Google may retain logs for a limited period for abuse monitoring. Paid Gemini API is not a zero-data-retention guarantee. If a use case requires guaranteed zero retention or enterprise data-processing terms, Google directs users to [Vertex AI](https://ai.google.dev/gemini-api/docs/zdr). Verify the API key's project and active billing status before using real medical records. This product is informational and is not for clinical practice or medical advice.

## AWS resources

`infra/template.yaml` provisions Cognito, API Gateway, Lambda, DynamoDB, S3, and the existing workflow resources. It now includes three additional DynamoDB tables:

- `DocumentTable`: user ID partition key, document ID sort key; stores extraction state, page text, and user-confirmed corrections.
- `ConversationTable`: user ID partition key, conversation ID sort key; stores up to 40 messages and uses DynamoDB TTL for 30-day retention.
- `ReminderTable`: user ID partition key, reminder ID sort key; stores appointment, action-plan review, and explicitly confirmed medication reminders.

S3 uses public access blocks and server-side encryption. The Lambda execution role has per-table DynamoDB permissions, S3 access, and Textract permissions. `infra/storage.yaml` provisions the storage resources separately if needed.

## Environment variables

Configure these on the local server (for example, in `.env`) or the Lambda server environment. Never use a `VITE_` prefix for secrets.

| Variable | Purpose |
| --- | --- |
| `AWS_REGION` | Region for DynamoDB, S3, and Textract clients |
| `SETTINGS_TABLE` | Existing account settings table |
| `PROFILE_TABLE` | Optional separate profile table for deployments retaining the older split-table design; current `/profile` route uses `SETTINGS_TABLE` |
| `SYMPTOM_TABLE` | Optional separate symptom table for deployments retaining the older split-table design; current `/symptoms` route uses `SETTINGS_TABLE` |
| `DOCUMENT_TABLE` | New medical-document table output |
| `CONVERSATION_TABLE` | New conversation table output |
| `REMINDER_TABLE` | New reminder table output |
| `REPORT_BUCKET` | Private bucket for uploaded documents, AQI reports, and encrypted health-record backups |
| `AI_PROVIDER` | Must be `gemini` to enable the disclosed provider |
| `GEMINI_MODEL` | Model name; defaults to the model used by the existing server integration |
| `GEMINI_API_KEY` | Server-only key; required for assistant responses |

The chat consent text tells the user that the message, recent chat turns, and selected context go to Google Gemini. No provider fallback occurs. Without Gemini configuration, the assistant returns an unavailable state. AQI/weather retrieval uses the existing Open-Meteo source and fails closed with an unavailable-data message.

For local development, the IAM identity selected by the AWS SDK in `server.ts` must be allowed to call `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, and `Query` on the configured DynamoDB tables. It needs `GetObject`, `PutObject`, and `DeleteObject` on the private bucket objects. Report extraction also needs `textract:DetectDocumentText`, `textract:StartDocumentTextDetection`, and `textract:GetDocumentTextDetection`. Scope these permissions to the AirExpo tables and bucket. The deployed Lambda role receives its resource permissions from the SAM template; do not place AWS access keys in browser-visible `VITE_` settings.

## API endpoints

These routes are served under `/api/cloud` locally and as authenticated API Gateway routes when deployed. Cognito ID tokens are required.

| Method and path | Purpose |
| --- | --- |
| `POST /documents` | Validate file signature, size and MIME type, then upload to private S3 in pending state |
| `GET /documents` | List the signed-in user's document metadata |
| `POST /documents/process` | Require consent, then run/poll Textract |
| `GET /documents/analysis?key=...` | Read the owner's extraction and review state |
| `POST /documents/confirm` | Save user-reviewed details for later grounding |
| `GET /documents/content?key=...` | Download the owner's original report |
| `DELETE /documents?documentId=...` | Delete the owner's S3 file and DynamoDB record |
| `POST /assistant/chat` | Ground a multi-turn response in selected confirmed reports, optional health context, and server-retrieved environment data |
| `GET /assistant/conversations` | List the signed-in user's conversation summaries |
| `GET /assistant/conversations/item?id=...` | Read one owned conversation |
| `DELETE /assistant/conversations/item?id=...` | Delete one owned conversation |
| `GET /reminders` | List the signed-in user's reminders |
| `POST /reminders` | Add a future reminder; medication reminders require clinician confirmation |
| `DELETE /reminders?id=...` | Delete one owned reminder |

## Local setup and demo

1. Deploy/update `infra/template.yaml` with SAM so the new tables and Lambda policies exist.
2. Set the table names and bucket name from stack outputs, Cognito settings, `AI_PROVIDER=gemini`, and a server-side `GEMINI_API_KEY`.
3. Run `pnpm install` only if dependencies are not already installed, then `pnpm dev`.
4. Sign in with a synthetic hackathon account and open **Dashboard → Personal protection workspace → Reports**.
5. Use a fictional asthma plan or report. Accept the Textract disclosure, upload it, review/correct page text, then confirm it.
6. Open **Assistant**, select the confirmed report, accept the Gemini data-sharing disclosure, and ask for a summary or a detail with page references.
7. Ask an outdoor activity question with a duration; the assistant retrieves current modeled AQI and forecast data for the dashboard location.
8. Opt in to health context and ask about symptom observations; confirm responses distinguish correlation from causation.
9. Try a severe-breathing warning phrase. The browser immediately shows emergency guidance without waiting for a network call.
10. Add an appointment/action-plan reminder, test the medication reminder confirmation control, then delete the chat, reminder, and report.

## Deployment

From `infra/`, run the existing SAM workflow described in [infra/README.md](../infra/README.md). Configure `GEMINI_API_KEY` only in the server-side Lambda environment, then update the function after deployment. Do not put model keys in Vite variables. Publish the frontend using the existing frontend deployment helper after setting its public Cognito/API URL values.

## Verification and limitations

- `vite build`: passed after implementation.
- `node --check infra/lambda/cloud.mjs`: passed.
- `tsc --noEmit`: reports existing repository-wide typing errors around Express/AWS SDK types, plus issues caused by the current local dependency tree; no live AWS workflow was exercised.
- The Lambda upload-to-Textract, Cognito authorization, Gemini invocation, DynamoDB writes, and S3 deletion require deployment and valid AWS/provider configuration; they have not been verified against the user's AWS account here.
- The pending upload state is application quarantine; no antivirus scanner is provisioned. Files remain private and unprocessed until user consent, but users should use fictional files for the hackathon demo.
- Textract extracts text and page labels, not validated clinical facts. Users review/correct text. The assistant is not a medical device and cannot replace clinical advice.
- Reminders are stored and shown as due in the workspace; this implementation does not send push, email, or SMS notifications.
- Conversation requests are limited per warm Lambda instance and API Gateway route throttling is configured. Distributed per-user rate limiting would need a dedicated service/atomic database counter.
