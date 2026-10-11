# Bugfix Requirements Document

## Introduction

This document addresses 12 bugs discovered across three severity levels in the AirExpo AI optimization code. The bugs affect two main components: the Express server's `/api/diagnose` endpoint (`server.ts`) and the AWS Lambda health assistant chat endpoint (`infra/lambda/cloud.mjs`). These bugs were introduced during recent optimizations that added LRU caching, rate limiting, retry logic, and token optimization.

**Production Impact:**
- **Critical**: Memory leaks will crash the production server within days of operation
- **High**: Users receive incorrect data due to cache key collisions and database query failures
- **Medium/Low**: Poor user experience through inefficient retries, inconsistent limits, and unclear error messages

**Affected Components:**
- `server.ts`: diagnose endpoint with rate limiting and caching logic
- `infra/lambda/cloud.mjs`: assistant chat endpoint with health data queries and retry logic

## Bug Analysis

### Current Behavior (Defect)

#### Critical Severity - Memory Leaks and Crashes

1.1 WHEN the Express server receives diagnose requests from unique IP addresses THEN the `diagnoseRateLimits` Map in server.ts grows unbounded without ever removing old entries, consuming memory indefinitely until the server crashes

1.2 WHEN the Express server's `diagnoseCache` Map accumulates cached responses THEN expired entries are never removed, causing the cache to fill with stale data that wastes memory and reduces cache effectiveness

1.3 WHEN the Lambda chat endpoint (cloud.mjs line 91) processes health profile data with undefined, null, or non-array symptoms field THEN the code executes `s.symptoms.join()` causing a runtime TypeError crash

#### High Priority - Data Corruption and Query Failures

1.4 WHEN the `getCacheKey()` function generates cache keys for different cities with the same name (e.g., "Springfield, IL" vs "Springfield, MA") THEN it produces identical keys because coordinates are not included, causing users to receive air quality data for the wrong location

1.5 WHEN the Lambda chat endpoint queries health profile and symptom data using `process.env.PROFILE_TABLE` and `process.env.SYMPTOM_TABLE` THEN the queries fail because the actual AWS infrastructure uses `SETTINGS_TABLE` for both profile and symptom storage, returning no data

1.6 WHEN the Lambda chat endpoint's Groq or Gemini API calls receive 429 rate limit responses indicating quota exhaustion THEN the retry logic executes 3 attempts with exponential backoff even though quota exhaustion will not recover within seconds, wasting 7+ seconds of user wait time

#### Medium Priority - Inconsistencies and Poor Error Handling

1.7 WHEN the Lambda chat endpoint validates conversation message count THEN it checks if `prior.length >= 40` to enforce a 40-message limit but the storage logic only keeps the last 20 messages with `.slice(-20)`, creating an inconsistency where the limit is never actually reached

1.8 WHEN the Lambda chat endpoint returns an error about missing AI configuration THEN the message says "Set GROQ_API_KEY on the server" even though Gemini with `GEMINI_API_KEY` is also a valid configuration, misleading users about available options

1.9 WHEN users submit assistant chat messages THEN the code accepts any location string without validating length, allowing arbitrarily long strings that could cause downstream API failures or database size issues

#### Low Priority - Maintenance and Reliability Issues

1.10 WHEN the Lambda chat endpoint uses the Gemini model THEN it defaults to `gemini-1.5-flash` but the AWS template specifies `gemini-3.8-flash` as the intended default model, creating a version mismatch

1.11 WHEN the Express server's rate limiter and cache Maps (`diagnoseRateLimits`, `diagnoseCache`) run for extended periods THEN old entries are never periodically cleaned even during idle time, preventing automatic memory recovery

1.12 WHEN multiple concurrent diagnose requests arrive for the same cache key before the first completes THEN all requests generate separate AI calls instead of deduplicating requests, wasting API quota and increasing costs

### Expected Behavior (Correct)

#### Critical Severity - Memory Leaks and Crashes

2.1 WHEN the Express server processes diagnose requests THEN the `diagnoseRateLimits` Map SHALL automatically remove IP entries older than the rate window (60 seconds) during cleanup operations, maintaining bounded memory usage

2.2 WHEN the Express server's `diagnoseCache` Map stores responses THEN it SHALL remove expired entries (older than 10 minutes) when accessing the cache or when max size is reached, keeping memory usage stable

2.3 WHEN the Lambda chat endpoint processes health profile data THEN it SHALL safely handle undefined, null, or non-array symptoms fields with defensive code that validates the data structure before calling array methods

#### High Priority - Data Corruption and Query Failures

2.4 WHEN the `getCacheKey()` function generates cache keys THEN it SHALL include the coordinates (latitude and longitude) in the key to ensure that different physical locations with similar names produce unique cache entries

2.5 WHEN the Lambda chat endpoint queries health profile and symptom data THEN it SHALL use `process.env.SETTINGS_TABLE` for both queries to match the actual AWS infrastructure where profiles and symptoms are stored in the settings table as nested maps

2.6 WHEN the Lambda chat endpoint's API calls receive 429 rate limit responses THEN the retry logic SHALL distinguish between rate limiting (recoverable with short wait) and quota exhaustion (not recoverable), only retrying rate limits and failing fast for quota exhaustion

#### Medium Priority - Inconsistencies and Poor Error Handling

2.7 WHEN the Lambda chat endpoint validates conversation message count and stores messages THEN both the validation check and storage logic SHALL use the same limit (20 messages), ensuring consistent enforcement

2.8 WHEN the Lambda chat endpoint returns an error about missing AI configuration THEN the message SHALL mention both valid options ("Set GROQ_API_KEY or configure Gemini with GEMINI_API_KEY"), providing accurate guidance

2.9 WHEN users submit assistant chat messages with location data THEN the code SHALL validate that the location string does not exceed 200 characters before processing or storing it

#### Low Priority - Maintenance and Reliability Issues

2.10 WHEN the Lambda chat endpoint selects a default Gemini model THEN it SHALL use `gemini-3.8-flash` to match the AWS template configuration, or read from `process.env.GEMINI_MODEL` if set

2.11 WHEN the Express server's rate limiter and cache Maps run during periods of low activity THEN a periodic cleanup function SHALL run every 5 minutes to remove expired entries, preventing unbounded growth during sparse usage

2.12 WHEN multiple concurrent diagnose requests arrive for the same cache key THEN the server SHALL deduplicate in-flight requests by tracking pending AI calls and having subsequent requests wait for the first result

### Unchanged Behavior (Regression Prevention)

#### Core Functionality Preservation

3.1 WHEN the Express server receives diagnose requests within rate limits with valid location and AQI data THEN the system SHALL CONTINUE TO generate and return AI-powered environmental explanations with the same response schema

3.2 WHEN the Express server's cache contains valid, non-expired entries for a requested location and AQI bucket THEN the system SHALL CONTINUE TO return cached responses with `fromCache: true` flag without making new AI API calls

3.3 WHEN the Lambda chat endpoint receives valid chat messages with conversation context THEN the system SHALL CONTINUE TO generate assistant responses using Groq or Gemini models with the same prompt structure and token limits

3.4 WHEN the Lambda chat endpoint processes emergency keyword patterns (severe breathing, blue lips, confusion) THEN the system SHALL CONTINUE TO return immediate safety instructions without calling AI models

3.5 WHEN users submit health profile data or symptom journal entries through the Lambda endpoint THEN the system SHALL CONTINUE TO validate inputs using the same schema rules and store data in DynamoDB with S3 mirroring

3.6 WHEN the Express server's rate limiter blocks requests exceeding 6 calls per 60 seconds per IP THEN the system SHALL CONTINUE TO return fallback diagnostic data with `rateLimited: true` flag instead of error responses

3.7 WHEN the Lambda chat endpoint builds conversation history for AI context THEN the system SHALL CONTINUE TO include only the last 2 messages from history to minimize token usage

3.8 WHEN the Lambda chat endpoint queries environmental data for coordinates THEN the system SHALL CONTINUE TO use the 5-minute cached Open-Meteo API responses with cache keys based on coordinates rounded to 3 decimal places

3.9 WHEN users query their stored health documents, reminders, or conversation history THEN the system SHALL CONTINUE TO enforce access controls through `canAccessPrivateData` authorization checks

3.10 WHEN the Express server's diagnose endpoint receives requests during Gemini API errors or missing API keys THEN the system SHALL CONTINUE TO return structured fallback responses with observed indicators instead of error messages

3.11 WHEN the Lambda chat endpoint validates user identity through JWT claims THEN the system SHALL CONTINUE TO extract `userId` from `event.requestContext?.authorizer?.jwt?.claims?.sub` and reject unauthenticated requests with 401 status

3.12 WHEN the Lambda chat endpoint enforces per-user rate limiting of 12 messages per 60 seconds THEN the system SHALL CONTINUE TO track requests in the `assistantRequests` Map and return 429 errors when exceeded
