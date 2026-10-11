# Implementation Plan: AI Optimization Bugfix

## Overview

This plan addresses 12 bugs in the AI optimization features using the bug condition methodology. The approach follows: explore (write tests before fix), preserve (capture non-buggy behavior), implement (apply fixes with understanding), and validate (verify no regressions).

---

## Phase 1: Bug Condition Exploration Tests

- [ ] 1. Write bug condition exploration tests for Critical bugs
  - **Property 1: Bug Condition** - Memory Leaks and Runtime Crashes
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For deterministic bugs, scope properties to concrete failing cases to ensure reproducibility
  - Test 1a: Rate Limiter Memory Leak
    - Simulate 100 unique IPs making requests to `/api/diagnose`
    - Wait 2 minutes (beyond 60-second rate limit window)
    - Assert: `diagnoseRateLimits.size === 0` (should be empty after window expires)
    - **EXPECTED OUTCOME on UNFIXED**: Map retains all 100 IPs (demonstrates leak)
  - Test 1b: Cache Expiration Memory Leak
    - Add 150 cache entries with timestamps 15 minutes old (beyond 10-minute TTL)
    - Current size: 150 < 200 (below max eviction threshold)
    - Assert: `diagnoseCache.size === 0` (expired entries should be removed)
    - **EXPECTED OUTCOME on UNFIXED**: All 150 expired entries remain (demonstrates leak)
  - Test 1c: Runtime Error on Undefined Symptoms
    - Mock DynamoDB to return symptom entry with `symptoms: undefined`
    - Call POST `/assistant/chat` with `includeHealth: true`
    - Assert: Response succeeds with empty symptoms string
    - **EXPECTED OUTCOME on UNFIXED**: Lambda crashes with "Cannot read property 'join' of undefined"
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root causes
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: Critical-1, Critical-2, Critical-3_

- [ ] 2. Write bug condition exploration tests for High Priority bugs
  - **Property 1: Bug Condition** - Cache Collisions and Database Errors
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **GOAL**: Surface counterexamples demonstrating cache collisions and wrong table references
  - Test 2a: Cache Key Collision
    - Request diagnostic for "Springfield, IL" (coords: 39.78, -89.65) with AQI 45
    - Cache the response
    - Request diagnostic for "Springfield, MA" (coords: 42.10, -72.59) with AQI 45
    - Assert: Second request gets different data (not cached response from first)
    - **EXPECTED OUTCOME on UNFIXED**: Both get same cached data (demonstrates collision)
  - Test 2b: Wrong Database Table References
    - Set only `SETTINGS_TABLE` environment variable (no PROFILE_TABLE/SYMPTOM_TABLE)
    - Call `/profile` endpoint to load health profile
    - Assert: Operation succeeds
    - **EXPECTED OUTCOME on UNFIXED**: Error checking for PROFILE_TABLE or operation fails
  - Test 2c: Inefficient Quota Retry
    - Mock Groq API to return 429 status with "quota exceeded" error
    - Measure response time for POST `/assistant/chat`
    - Assert: Response returns in < 1 second
    - **EXPECTED OUTCOME on UNFIXED**: Takes ~7 seconds (1s + 2s + 4s retries)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All tests FAIL (confirms bugs exist)
  - Document counterexamples (collision keys, wasted retry time, etc.)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: High-4, High-5, High-6_

- [ ] 3. Write bug condition exploration tests for Medium Priority bugs
  - **Property 1: Bug Condition** - Inconsistencies and Missing Validation
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **GOAL**: Surface counterexamples for message limits, error messages, and validation gaps
  - Test 3a: Inconsistent Message Limit
    - Create conversation with exactly 20 messages in DynamoDB
    - Attempt to add 21st message via POST `/assistant/chat`
    - Assert: Error states "20-message limit reached"
    - **EXPECTED OUTCOME on UNFIXED**: Request succeeds (40-message check) but causes confusion
  - Test 3b: Misleading Error Message
    - Set `AI_PROVIDER=gemini` and `GEMINI_API_KEY` (no GROQ_API_KEY)
    - Trigger configuration check in `/assistant/chat`
    - Assert: Error message mentions both GROQ and Gemini options
    - **EXPECTED OUTCOME on UNFIXED**: Error says "Set GROQ_API_KEY" only
  - Test 3c: Missing Location Validation
    - Send POST `/api/diagnose` with location string of 500 characters
    - Assert: Returns 400 error "Location name is too long"
    - **EXPECTED OUTCOME on UNFIXED**: Accepts invalid location or causes downstream errors
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All tests FAIL (confirms bugs exist)
  - Document counterexamples
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: Medium-7, Medium-8, Medium-9_

---

## Phase 2: Preservation Property Tests

- [ ] 4. Write preservation property tests for diagnostic features (BEFORE implementing fix)
  - **Property 2: Preservation** - Valid Diagnostic Requests and Cache Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Valid unique locations with different AQIs return correct diagnostics
    - Cache hits for non-expired entries return cached data
    - Rate limiting correctly blocks 7th request within 60 seconds
  - Write property-based tests capturing observed behavior:
    - Property: For all unique locations with valid coordinates and AQI within 0-500, diagnostic returns success response with structure {success, advice, risk_level, cached_used, aqi}
    - Property: For all non-expired cache entries (age < 10 minutes), cache hit returns identical response without API call
    - Property: For all IPs making ≤ 6 requests within 60 seconds, rate limiter allows requests through
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: Preservation-1, Preservation-2_

- [ ] 5. Write preservation property tests for database and API features (BEFORE implementing fix)
  - **Property 2: Preservation** - Database Operations and API Success Cases
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for valid operations:
    - Health profile CRUD operations succeed with valid data
    - Symptom tracking operations succeed with well-formed symptom arrays
    - Document uploads and retrievals work correctly
    - Successful Groq/Gemini API calls return formatted responses
  - Write property-based tests capturing observed behavior:
    - Property: For all valid health profiles (with required fields), save and load operations preserve data exactly
    - Property: For all well-formed symptom entries (symptoms as string array), operations succeed
    - Property: For all successful API calls (200 status), responses contain expected fields and token counts
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: Preservation-3_

- [ ] 6. Write preservation property tests for error handling (BEFORE implementing fix)
  - **Property 2: Preservation** - Error Cases and Non-AI Features
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for error cases:
    - Network errors return appropriate error responses
    - 5xx API errors are handled gracefully
    - Invalid inputs return 400 errors
    - Maps, routes, storage features work independently
  - Write property-based tests capturing observed behavior:
    - Property: For all network errors, response includes {success: false, error: message}
    - Property: For all invalid diagnostic inputs (missing location, invalid AQI), returns 400
    - Property: For all non-AI features (maps, routes, storage), functionality is completely unaffected
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: Preservation-1, Preservation-2, Preservation-3_

---

## Phase 3: Implementation

- [ ] 7. Fix Critical bugs - Memory leaks and runtime errors

  - [ ] 7.1 Fix Rate Limiter Memory Leak (Bug 1)
    - File: `server.ts`, function `checkRateLimit` (line 222)
    - Add immediate cleanup: Delete IP entry from Map when no recent requests remain
    - Add periodic cleanup: setInterval every 5 minutes to remove all IPs with no recent requests
    - _Bug_Condition: isBugCondition_RateLimiter(state) where diagnoseRateLimits.size > 0 AND noEntriesRemovedFromMap AND timeElapsed > DIAGNOSE_RATE_WINDOW_MS_
    - _Expected_Behavior: diagnoseRateLimits Map bounded to only IPs with recent requests (<60s), automatic cleanup removes expired entries_
    - _Preservation: Rate limiting still enforces 6 requests per 60 seconds per IP, valid requests under limit continue to work_
    - _Requirements: Critical-1_

  - [ ] 7.2 Fix Cache Expiration Memory Leak (Bug 2)
    - File: `server.ts`, `/api/diagnose` endpoint (around line 256)
    - Add active cleanup: Delete expired entry when checking cache before returning cached data
    - Add periodic cleanup: setInterval every 2 minutes to remove all expired entries regardless of cache size
    - _Bug_Condition: isBugCondition_CacheExpiration(state) where expired entries exist AND cache size <= CACHE_MAX_SIZE_
    - _Expected_Behavior: diagnoseCache bounded by TTL (10 minutes), expired entries removed even when cache not full_
    - _Preservation: Non-expired cache hits continue to return cached data, cache behavior for valid entries unchanged_
    - _Requirements: Critical-2_

  - [ ] 7.3 Fix Runtime Error on Undefined Symptoms (Bug 3)
    - File: `infra/lambda/cloud.mjs`, symptoms mapping in `/assistant/chat`
    - Add safety check: `Array.isArray(s.symptoms) ? s.symptoms.join('; ') : ''`
    - Handle undefined, null, and non-array values gracefully
    - _Bug_Condition: isBugCondition_SymptomsArray(symptomEntry) where symptoms IS undefined OR NOT an array_
    - _Expected_Behavior: Lambda handles malformed data gracefully, returns empty string for invalid symptoms_
    - _Preservation: Well-formed symptom entries continue to work exactly as before_
    - _Requirements: Critical-3_

  - [ ] 7.4 Verify Critical bug exploration tests now pass
    - **Property 1: Expected Behavior** - Memory Bounded and No Crashes
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - Run memory leak tests (1a, 1b) and runtime error test (1c)
    - **EXPECTED OUTCOME**: All tests PASS (confirms bugs are fixed)
    - Assert: Rate limiter map size = 0 after cleanup
    - Assert: Cache map removes expired entries
    - Assert: Lambda doesn't crash on undefined symptoms
    - _Requirements: Critical-1, Critical-2, Critical-3_

- [ ] 8. Fix High Priority bugs - Cache collisions, database references, retry logic

  - [ ] 8.1 Fix Cache Key Collision (Bug 4)
    - File: `server.ts`, function `getCacheKey` (line 217)
    - Add coordinates parameter: `getCacheKey(location: string, aqi: number | null, coordinates?: {lat: number, lon: number})`
    - Include coordinates in key: `${location}${coordPart}:${aqiBucket}` where coordPart = `:${lat.toFixed(2)},${lon.toFixed(2)}`
    - Update call site in `/api/diagnose` to pass coordinates
    - _Bug_Condition: isBugCondition_CacheCollision(location1, location2, aqi) where location1 != location2 AND sameCity AND same AQI_
    - _Expected_Behavior: Cache keys unique per geographic location, coordinates included in key generation_
    - _Preservation: Cache hits for same actual location continue to work, unique locations get unique keys_
    - _Requirements: High-4_

  - [ ] 8.2 Fix Wrong Database Table References (Bug 5)
    - File: `infra/lambda/cloud.mjs`, multiple locations
    - Replace all `PROFILE_TABLE` references with `SETTINGS_TABLE`
    - Replace all `SYMPTOM_TABLE` references with `SETTINGS_TABLE`
    - Update environment variable existence checks
    - _Bug_Condition: isBugCondition_WrongTable(operation) where operation references PROFILE_TABLE or SYMPTOM_TABLE_
    - _Expected_Behavior: All database operations use SETTINGS_TABLE, correct table referenced in all environments_
    - _Preservation: Database operations with valid data continue to work, CRUD operations unchanged_
    - _Requirements: High-5_

  - [ ] 8.3 Fix Inefficient Retry on Quota (Bug 6)
    - File: `infra/lambda/cloud.mjs`, Groq and Gemini retry loops in `/assistant/chat`
    - Add quota detection before retry: Check if status=429 AND error contains 'quota' or 'rate_limit_exceeded'
    - Skip retry for quota errors: Return 429 immediately with appropriate message
    - Keep retry logic for transient 429s (rate limiting with retry-after header)
    - _Bug_Condition: isBugCondition_QuotaRetry(apiCall) where status=429 AND quota exhausted_
    - _Expected_Behavior: Quota exhaustion returns immediately without retry, saves ~7 seconds response time_
    - _Preservation: Transient 429s with retry-after still retry appropriately, network errors still retry_
    - _Requirements: High-6_

  - [ ] 8.4 Verify High Priority bug exploration tests now pass
    - **Property 1: Expected Behavior** - Unique Keys, Correct Tables, Fast Quota Response
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run cache collision test (2a), database table test (2b), quota retry test (2c)
    - **EXPECTED OUTCOME**: All tests PASS (confirms bugs are fixed)
    - Assert: Springfield IL and MA get different cache keys
    - Assert: Database operations work with SETTINGS_TABLE only
    - Assert: Quota 429 returns in < 1 second
    - _Requirements: High-4, High-5, High-6_

- [ ] 9. Fix Medium Priority bugs - Consistency and validation

  - [ ] 9.1 Fix Inconsistent Message Limit (Bug 7)
    - File: `infra/lambda/cloud.mjs`, message limit check in `/assistant/chat`
    - Change message limit check from 40 to 20: `if(prior.length>=20)`
    - Update error message: "This conversation reached its 20-message limit"
    - Align check with storage slice (already at 20)
    - _Bug_Condition: isBugCondition_MessageLimit(conversation) where check=40 but storage=20_
    - _Expected_Behavior: Consistent 20-message limit across check, storage, and error message_
    - _Preservation: Conversations under 20 messages continue to work identically_
    - _Requirements: Medium-7_

  - [ ] 9.2 Fix Misleading Error Message (Bug 8)
    - File: `infra/lambda/cloud.mjs`, API key check in `/assistant/chat`
    - Update error check: `if(!process.env.GROQ_API_KEY&&(process.env.AI_PROVIDER!=='gemini'||!process.env.GEMINI_API_KEY))`
    - Update error message: "Set GROQ_API_KEY or configure Gemini with GEMINI_API_KEY and AI_PROVIDER=gemini"
    - _Bug_Condition: isBugCondition_MisleadingError(error) where AI_PROVIDER=gemini but error mentions only GROQ_
    - _Expected_Behavior: Error message mentions both provider options (GROQ and Gemini)_
    - _Preservation: Existing error handling logic continues to work, just improved messaging_
    - _Requirements: Medium-8_

  - [ ] 9.3 Fix Missing Location Validation (Bug 9)
    - File: `server.ts`, `/api/diagnose` endpoint validation (around line 242)
    - Add location length validation before processing
    - Return 400 error if location string length > 300 characters
    - Error message: "Location name is too long"
    - _Bug_Condition: isBugCondition_LocationLength(location) where location.length > 300_
    - _Expected_Behavior: Location strings validated for reasonable length, prevents cache key issues_
    - _Preservation: Valid location strings (< 300 chars) continue to work unchanged_
    - _Requirements: Medium-9_

  - [ ] 9.4 Verify Medium Priority bug exploration tests now pass
    - **Property 1: Expected Behavior** - Consistent Limits, Clear Errors, Valid Inputs
    - **IMPORTANT**: Re-run the SAME tests from task 3 - do NOT write new tests
    - Run message limit test (3a), error message test (3b), validation test (3c)
    - **EXPECTED OUTCOME**: All tests PASS (confirms bugs are fixed)
    - Assert: 21st message blocked with "20-message limit" error
    - Assert: Error mentions both GROQ and Gemini
    - Assert: 500-char location rejected with 400 error
    - _Requirements: Medium-7, Medium-8, Medium-9_

- [ ] 10. Verify all preservation tests still pass
  - **Property 2: Preservation** - No Regressions in Non-Buggy Behavior
  - **IMPORTANT**: Re-run the SAME tests from tasks 4, 5, 6 - do NOT write new tests
  - Run all preservation property tests from Phase 2
  - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
  - Assert: Valid diagnostic requests work identically
  - Assert: Cache hits for non-expired entries work identically
  - Assert: Rate limiting for valid usage works identically
  - Assert: Database operations with valid data work identically
  - Assert: API success cases work identically
  - Assert: Error handling for genuine errors works identically
  - Assert: Non-AI features completely unaffected
  - _Requirements: Preservation-1, Preservation-2, Preservation-3_

---

## Phase 4: Validation and Testing

- [ ] 11. Run integration test suite
  - 24-hour load test: Simulate production traffic, monitor memory usage
    - Assert: Memory stable, no unbounded growth
    - Assert: diagnoseRateLimits map stays under 1000 entries
    - Assert: diagnoseCache map stays under 200 entries
  - Cache collision test: Test 100 cities with common names (Springfield, Salem, Portland, etc.)
    - Assert: Each geographic location gets unique cache entries
  - Database operations test: Test all health endpoints with only SETTINGS_TABLE configured
    - Assert: All CRUD operations succeed
  - API quota test: Simulate quota exhaustion scenarios
    - Assert: Quick failure without retries
    - Assert: Appropriate error messages returned
  - End-to-end assistant test: Full conversation flow with health data
    - Assert: Malformed symptom data doesn't crash Lambda
    - Assert: Error messages mention all configured providers
  - _Requirements: Critical-1, Critical-2, Critical-3, High-4, High-5, High-6, Medium-7, Medium-8, Medium-9_

- [ ] 12. Checkpoint - Ensure all tests pass
  - Verify all exploration tests pass (bugs fixed)
  - Verify all preservation tests pass (no regressions)
  - Verify integration tests pass (production-ready)
  - Review test coverage: 8+ unit tests, 6 integration scenarios
  - Ask the user if questions arise

---

## Notes

**Bug Condition Methodology:**
- C(X): Bug Condition - identifies inputs triggering bugs
- P(result): Property - desired behavior for buggy inputs
- ¬C(X): Non-buggy inputs that should be preserved
- F: Original (unfixed) function
- F': Fixed function

**Testing Philosophy:**
- **Explore first**: Write tests BEFORE fix to understand bugs
- **Preserve carefully**: Capture non-buggy behavior to prevent regressions
- **Implement surgically**: Minimal changes to fix identified issues
- **Validate thoroughly**: Confirm fixes work and nothing breaks

**Low Priority Bugs (Not in Main Plan):**
- Bug 10: Model name (gemini-1.5-flash vs gemini-3.8-flash) - requires verification
- Bug 11: No periodic cleanup during idle - covered by periodic cleanup in tasks 7.1, 7.2
- Bug 12: No request deduplication - future enhancement, not critical
