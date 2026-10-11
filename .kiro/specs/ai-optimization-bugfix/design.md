# AI Optimization Bugfix Design

## Overview

This design addresses 12 bugs discovered in the recently implemented AI optimization features across the AirExpo application. The bugs range from critical memory leaks that cause unbounded growth in production to data corruption issues that affect cache correctness. The fix strategy focuses on surgical, targeted changes to prevent memory leaks, ensure data integrity, improve error handling, and optimize API usage patterns.

The bugs are categorized by severity:
- **Critical (3)**: Memory leaks and runtime crashes that block production deployment
- **High Priority (3)**: Data corruption and incorrect database references that affect functionality
- **Medium Priority (3)**: Inefficiencies and misleading error messages that degrade user experience
- **Low Priority (3)**: Suboptimal behavior that should be addressed for production quality

The fix approach emphasizes minimal changes to preserve existing functionality while addressing each identified issue systematically.

## Glossary

- **Bug_Condition (C)**: The conditions that trigger each of the 12 identified bugs
- **Property (P)**: The desired correct behavior for each bug scenario
- **Preservation**: All existing non-buggy behavior including successful API calls, correct cache hits, valid rate limiting, and proper error handling
- **diagnoseRateLimits**: Map in `server.ts` that tracks API rate limits per IP address
- **diagnoseCache**: Map in `server.ts` that stores diagnostic report responses with TTL
- **getCacheKey**: Function in `server.ts` (line 217) that generates cache keys from location and AQI
- **checkRateLimit**: Function in `server.ts` (line 222) that enforces per-IP rate limits
- **cloudHandler**: Lambda function in `infra/lambda/cloud.mjs` that handles health data and assistant chat
- **PROFILE_TABLE/SYMPTOM_TABLE**: Incorrect environment variable references (should be SETTINGS_TABLE)
- **Retry Logic**: Pattern in cloud.mjs that retries API calls on failure (currently retries on quota exhaustion)

## Bug Details

### Bug Condition

The bugs manifest across multiple scenarios in the AI optimization code. Below are the formal specifications for each bug category.

**Critical Bugs:**

**Bug 1 - Memory Leak: Rate Limiter**
```
FUNCTION isBugCondition_RateLimiter(state)
  INPUT: state of type ServerState
  OUTPUT: boolean
  
  RETURN state.diagnoseRateLimits.size > 0
         AND noEntriesRemovedFromMap(state.diagnoseRateLimits)
         AND timeElapsed > DIAGNOSE_RATE_WINDOW_MS
END FUNCTION
```
The `diagnoseRateLimits` Map never removes IP addresses once added. Each IP that makes a request is stored permanently, causing unbounded memory growth in long-running production servers.

**Bug 2 - Memory Leak: Cache**
```
FUNCTION isBugCondition_CacheExpiration(state)
  INPUT: state of type ServerState
  OUTPUT: boolean
  
  RETURN EXISTS entry IN state.diagnoseCache WHERE
         (now - entry.timestamp) > CACHE_TTL_MS
         AND entry still exists in Map
         AND state.diagnoseCache.size <= CACHE_MAX_SIZE
END FUNCTION
```
Expired cache entries are only removed when the cache exceeds 200 entries. If the cache has 199 entries and they all expire, they remain in memory indefinitely.

**Bug 3 - Runtime Error: Undefined Symptoms**
```
FUNCTION isBugCondition_SymptomsArray(symptomEntry)
  INPUT: symptomEntry from database
  OUTPUT: boolean
  
  RETURN symptomEntry.symptoms IS undefined
         OR symptomEntry.symptoms IS NOT an array
END FUNCTION
```
In `cloud.mjs`, the code calls `s.symptoms.join('; ')` without validating that `symptoms` exists and is an array. This crashes the Lambda when malformed data exists in the database.

**High Priority Bugs:**

**Bug 4 - Cache Key Collision**
```
FUNCTION isBugCondition_CacheCollision(location1, location2, aqi)
  INPUT: location1, location2 of type string, aqi of type number
  OUTPUT: boolean
  
  RETURN location1 != location2
         AND sameCity(location1, location2)  // e.g., "Springfield, IL" vs "Springfield, MA"
         AND getCacheKey(location1, aqi) == getCacheKey(location2, aqi)
END FUNCTION
```
Cache keys are generated from `${location}:${aqiBucket}` without including coordinates, causing different cities with the same name to share cache entries.

**Bug 5 - Wrong Database Tables**
```
FUNCTION isBugCondition_WrongTable(operation)
  INPUT: operation of type DatabaseOperation
  OUTPUT: boolean
  
  RETURN (operation.table == 'PROFILE_TABLE' OR operation.table == 'SYMPTOM_TABLE')
         AND operation.endpoint IN ['/profile', '/symptoms']
END FUNCTION
```
Code references `PROFILE_TABLE` and `SYMPTOM_TABLE` environment variables which don't exist. The correct table is `SETTINGS_TABLE`.

**Bug 6 - Inefficient Retry on Quota**
```
FUNCTION isBugCondition_QuotaRetry(apiCall)
  INPUT: apiCall of type APIRequest
  OUTPUT: boolean
  
  RETURN apiCall.statusCode == 429
         AND apiCall.errorMessage CONTAINS ('quota' OR 'rate limit')
         AND retryAttempted(apiCall) == true
END FUNCTION
```
The code retries 3 times on quota exhaustion (429 errors), wasting ~7 seconds when quotas won't recover immediately.

**Medium Priority Bugs:**

**Bug 7 - Inconsistent Message Limit**
```
FUNCTION isBugCondition_MessageLimit(conversation)
  INPUT: conversation of type Conversation
  OUTPUT: boolean
  
  RETURN conversation.messages.length == 40  // Checked limit
         AND conversationHistoryUsed.length == 8  // Previous used limit
         AND conversationStored.length == 20  // Storage limit
END FUNCTION
```
The code checks for 40 messages max but only stores 20 and previously used 8 in context. Now uses 2 in context but the limits are inconsistent.

**Bug 8 - Misleading Error Message**
```
FUNCTION isBugCondition_MisleadingError(error)
  INPUT: error of type ErrorResponse
  OUTPUT: boolean
  
  RETURN error.message CONTAINS 'Set GROQ_API_KEY'
         AND process.env.AI_PROVIDER == 'gemini'
         AND process.env.GEMINI_API_KEY IS configured
END FUNCTION
```
Error message says "Set GROQ_API_KEY" even when Gemini is a valid alternative provider.

**Bug 9 - Missing Validation**
```
FUNCTION isBugCondition_LocationLength(location)
  INPUT: location of type string
  OUTPUT: boolean
  
  RETURN location.length > 300
         AND noValidationPerformed(location)
END FUNCTION
```
No validation on location string length before using it in cache keys or API calls.

**Low Priority Bugs:**

**Bug 10 - Wrong Model Name**
```
FUNCTION isBugCondition_ModelName(config)
  INPUT: config of type ServerConfig
  OUTPUT: boolean
  
  RETURN config.defaultModel == 'gemini-1.5-flash'
         AND originalModel == 'gemini-3.8-flash'
END FUNCTION
```
Model name changed from `gemini-3.8-flash` to `gemini-1.5-flash` (possibly incorrect).

**Bug 11 - No Cleanup**
```
FUNCTION isBugCondition_NoCleanup(state)
  INPUT: state of type ServerState
  OUTPUT: boolean
  
  RETURN state.serverIdleTime > 1_HOUR
         AND state.diagnoseRateLimits.size > 0
         AND state.environmentCache.size > 0
         AND noPeriodicCleanupConfigured()
END FUNCTION
```
Maps never auto-clean during server idle periods, retaining stale data unnecessarily.

**Bug 12 - No Deduplication**
```
FUNCTION isBugCondition_Deduplication(requests)
  INPUT: requests of type Array<APIRequest>
  OUTPUT: boolean
  
  RETURN COUNT(requests WHERE sameLocation AND sameTimestamp) > 1
         AND allRequestsCallAPI == true
END FUNCTION
```
Simultaneous identical requests all call the external API instead of deduplicating.

### Examples

**Critical Examples:**

1. **Rate Limiter Memory Leak**: Server runs for 24 hours with 1000 unique IPs making requests → `diagnoseRateLimits` Map contains 1000 entries forever, even though rate limit windows are only 60 seconds
2. **Cache Expiration Leak**: Cache has 150 entries, all expire after 10 minutes → All 150 entries remain in memory indefinitely because size < 200
3. **Runtime Error**: Database contains symptom entry with `symptoms: undefined` → Lambda crashes with "Cannot read property 'join' of undefined"

**High Priority Examples:**

4. **Cache Collision**: User in Springfield, IL gets diagnostic for AQI 45 → User in Springfield, MA with AQI 45 gets Illinois data from cache
5. **Wrong Table Reference**: `/profile` endpoint tries to query `PROFILE_TABLE` → DynamoDB error: "Requested resource not found"
6. **Quota Retry Waste**: Groq API returns 429 quota exhausted → Code retries 3 times with exponential backoff, wasting 7+ seconds before returning error

**Medium Priority Examples:**

7. **Inconsistent Limit**: Conversation has 40 messages (hits limit) → Only 20 messages stored, but check happens at 40
8. **Misleading Error**: Server configured with `AI_PROVIDER=gemini` and `GEMINI_API_KEY` set → Error says "Set GROQ_API_KEY" even though Gemini is configured
9. **Missing Validation**: Attacker sends 50KB location string → Server crashes or stores invalid cache key

**Low Priority Examples:**

10. **Model Name**: Server uses `gemini-1.5-flash` but documentation mentions `gemini-3.8-flash` → Confusion about which model is actually used
11. **No Cleanup**: Server idle overnight with no requests → Maps retain all data from previous day unnecessarily
12. **No Dedup**: 5 users click diagnose for same location simultaneously → 5 identical API calls made instead of 1

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Successful diagnostic requests with valid inputs must continue to work exactly as before
- Cache hits for non-expired, correctly keyed entries must continue to return cached data
- Rate limiting must continue to protect the API from abuse (6 requests per 60 seconds per IP)
- Valid database operations with correct data must continue to succeed
- Error handling for genuine API failures (network errors, 5xx responses) must continue to work
- All existing API endpoints must continue to function with the same interfaces
- Conversation history, health profiles, symptom tracking, and document processing must continue to work

**Scope:**
All inputs that do NOT trigger any of the 12 identified bug conditions should be completely unaffected by this fix. This includes:
- Normal diagnostic requests with valid locations and reasonable request rates
- Cache operations on unique city/AQI combinations
- Database operations when the correct table names are used
- API calls that succeed on first attempt
- Conversations within message limits with valid data
- All non-AI optimization features (maps, routes, storage, etc.)

## Hypothesized Root Cause

Based on the bug descriptions and code analysis, the root causes are:

**Critical Bugs:**

1. **Rate Limiter Memory Leak**: The `checkRateLimit` function adds timestamps to the Map but only filters the array for recent requests. Old timestamps are removed from the array but the Map entry persists. The function never removes IP entries when they become inactive.

2. **Cache Expiration Leak**: Cache eviction only happens when `diagnoseCache.size > CACHE_MAX_SIZE`. The code checks TTL on cache reads but doesn't actively remove expired entries. If the cache never exceeds 200 entries, expired entries accumulate indefinitely.

3. **Runtime Error**: In `cloud.mjs`, the symptoms mapping code assumes `s.symptoms` is always an array:
   ```javascript
   symptoms:(symptomsResult.Items||[]).map(s=>({..., symptoms:s.symptoms.join('; '), ...}))
   ```
   But database entries might have undefined or malformed `symptoms` fields.

**High Priority Bugs:**

4. **Cache Key Collision**: The `getCacheKey` function only uses location string and AQI bucket:
   ```typescript
   function getCacheKey(location: string, aqi: number | null): string {
     const aqiBucket = aqi != null ? Math.round(aqi / 5) * 5 : 'null';
     return `${location}:${aqiBucket}`;
   }
   ```
   Cities with identical names produce identical keys regardless of geographic coordinates.

5. **Wrong Database Tables**: During code refactoring, environment variable references weren't updated. Code references `PROFILE_TABLE` and `SYMPTOM_TABLE` but the actual environment variable is `SETTINGS_TABLE` which stores both profiles and symptoms in document maps.

6. **Inefficient Retry**: The retry loop doesn't distinguish between transient failures (network errors) and permanent failures (quota exhaustion). It retries 3 times for all errors, including 429 status codes that won't recover without waiting much longer.

**Medium Priority Bugs:**

7. **Inconsistent Limit**: The message limit check was updated to 40 but the storage slice was set to 20, and context usage was reduced from 8 to 2. These values should be aligned for consistency.

8. **Misleading Error**: The error message hardcodes "GROQ_API_KEY" without checking if Gemini is configured as an alternative provider.

9. **Missing Validation**: Location string validation was overlooked during implementation. Other string inputs have length validation, but location doesn't.

**Low Priority Bugs:**

10. **Model Name**: Either the model name was changed intentionally (1.5-flash is newer) or accidentally (typo/misunderstanding). Need to verify which model name is correct.

11. **No Cleanup**: Periodic cleanup wasn't implemented because it's not critical for short-lived servers, but production servers run indefinitely and accumulate stale data.

12. **No Dedup**: Request deduplication adds complexity and wasn't prioritized in initial implementation. Simultaneous identical requests are rare in normal usage.

## Correctness Properties

Property 1: Bug Condition - Memory Leaks Eliminated

_For any_ server runtime state where rate limiter or cache maps contain expired entries, the fixed code SHALL automatically remove those entries, ensuring bounded memory usage regardless of request patterns or server uptime.

**Validates: Requirements Critical-1, Critical-2**

Property 2: Bug Condition - Runtime Errors Prevented

_For any_ database entry where the symptoms field is undefined, null, or not an array, the fixed code SHALL handle it gracefully without crashing, either by using a safe default or skipping the malformed entry.

**Validates: Requirements Critical-3**

Property 3: Bug Condition - Cache Collisions Eliminated

_For any_ two distinct geographic locations (different coordinates) with the same city name and similar AQI values, the fixed code SHALL generate different cache keys, preventing cross-contamination of diagnostic data.

**Validates: Requirements High-4**

Property 4: Bug Condition - Database References Corrected

_For any_ health profile or symptom operation, the fixed code SHALL reference the correct SETTINGS_TABLE environment variable, ensuring all database operations succeed in production environments.

**Validates: Requirements High-5**

Property 5: Bug Condition - Quota Retry Optimization

_For any_ API response with status code 429 or quota-related error messages, the fixed code SHALL detect this as a permanent failure and return immediately without retrying, saving response time and avoiding wasted API calls.

**Validates: Requirements High-6**

Property 6: Bug Condition - Consistency and Validation

_For any_ conversation or location input, the fixed code SHALL enforce consistent limits (message count alignment) and validate input lengths, preventing edge cases and providing accurate error messages that reflect all configured providers.

**Validates: Requirements Medium-7, Medium-8, Medium-9**

Property 7: Preservation - Non-Buggy Behavior Unchanged

_For any_ input that does NOT trigger any of the 12 identified bug conditions (valid requests with unique locations, correct data, normal usage patterns), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality including successful caching, rate limiting, database operations, and API calls.

**Validates: Requirements Preservation-1, Preservation-2, Preservation-3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, here are the specific changes needed:

**File**: `server.ts`

**Function**: `checkRateLimit` (line 222)

**Specific Changes**:
1. **Add Rate Limiter Cleanup**: After updating the Map with filtered requests, remove the IP entry entirely if no recent requests remain
   ```typescript
   if (recentRequests.length === 0) {
     diagnoseRateLimits.delete(ip);
   } else {
     diagnoseRateLimits.set(ip, recentRequests);
   }
   ```

2. **Add Periodic Rate Limiter Cleanup**: Implement a setInterval to periodically clean all IP entries that have no recent requests
   ```typescript
   setInterval(() => {
     const now = Date.now();
     for (const [ip, requests] of diagnoseRateLimits.entries()) {
       const recent = requests.filter(t => now - t < DIAGNOSE_RATE_WINDOW_MS);
       if (recent.length === 0) {
         diagnoseRateLimits.delete(ip);
       }
     }
   }, 5 * 60 * 1000); // Clean every 5 minutes
   ```

**Function**: `/api/diagnose` endpoint cache check (around line 256)

**Specific Changes**:
3. **Add Active Cache Cleanup**: When checking cache, also delete expired entries
   ```typescript
   const cached = diagnoseCache.get(cacheKey);
   if (cached) {
     if (now - cached.timestamp < CACHE_TTL_MS) {
       // Return cached data
     } else {
       diagnoseCache.delete(cacheKey); // Remove expired entry
     }
   }
   ```

4. **Add Periodic Cache Cleanup**: Implement a setInterval to clean expired entries even when cache isn't full
   ```typescript
   setInterval(() => {
     const now = Date.now();
     for (const [key, entry] of diagnoseCache.entries()) {
       if (now - entry.timestamp > CACHE_TTL_MS) {
         diagnoseCache.delete(key);
       }
     }
   }, 2 * 60 * 1000); // Clean every 2 minutes
   ```

**Function**: `getCacheKey` (line 217)

**Specific Changes**:
5. **Include Coordinates in Cache Key**: Add optional coordinates parameter and include them in the key
   ```typescript
   function getCacheKey(location: string, aqi: number | null, coordinates?: {lat: number, lon: number}): string {
     const aqiBucket = aqi != null ? Math.round(aqi / 5) * 5 : 'null';
     const coordPart = coordinates ? `:${coordinates.lat.toFixed(2)},${coordinates.lon.toFixed(2)}` : '';
     return `${location}${coordPart}:${aqiBucket}`;
   }
   ```

6. **Update getCacheKey Call**: Pass coordinates to getCacheKey in the `/api/diagnose` endpoint
   ```typescript
   const cacheKey = getCacheKey(String(location || 'Unknown'), aqi, coordinates);
   ```

**Function**: `/api/diagnose` endpoint validation (around line 242)

**Specific Changes**:
7. **Add Location Length Validation**: Validate location string length before processing
   ```typescript
   if (location && typeof location === 'string' && location.length > 300) {
     return res.status(400).json({ 
       success: false, 
       error: 'Location name is too long' 
     });
   }
   ```

8. **Update Message Limit Consistency**: Change the 40-message check to match the 20-message storage limit (in cloud.mjs, but noted here for consistency)

---

**File**: `infra/lambda/cloud.mjs`

**Function**: `/assistant/chat` endpoint health data mapping (around line where symptoms are mapped)

**Specific Changes**:
9. **Fix Symptoms Array Safety**: Add safe array handling before calling join
   ```javascript
   symptoms:(symptomsResult.Items||[]).map(s=>({
     recordedAt:s.recordedAt.slice(0,10),
     symptoms:Array.isArray(s.symptoms) ? s.symptoms.join('; ') : '',
     severity:s.severity,
     inhalerUsed:s.inhalerUsed,
     aqi:s.environmentalSnapshot?.aqi
   }))
   ```

**Function**: Multiple locations referencing environment variables

**Specific Changes**:
10. **Fix Database Table References**: Replace all instances of `PROFILE_TABLE` and `SYMPTOM_TABLE` with `SETTINGS_TABLE`
    - Line with: `if(!process.env.PROFILE_TABLE||!process.env.SYMPTOM_TABLE)` → change to `if(!process.env.SETTINGS_TABLE)`
    - The actual table operations already use `SETTINGS_TABLE` correctly, just the existence checks reference wrong names

**Function**: Groq and Gemini retry loops (multiple locations in `/assistant/chat`)

**Specific Changes**:
11. **Detect Quota Exhaustion and Skip Retry**: Add quota detection before retry logic
    ```javascript
    if(groqRes.status===429){
      const errorText = await groqRes.text();
      const isQuotaError = errorText.includes('quota') || errorText.includes('rate_limit_exceeded');
      if (isQuotaError) {
        console.log(`[chat] Groq quota exhausted, skipping retry`);
        return reply(429,{error:'API quota exhausted. Wait a moment and retry.'});
      }
      // Only retry for transient 429s
      const retryAfter=Number(groqRes.headers.get('retry-after'))||Math.pow(2,attempt);
      // ... existing retry logic
    }
    ```

12. **Fix Error Message**: Update error message to mention both providers
    ```javascript
    if(!process.env.GROQ_API_KEY&&(process.env.AI_PROVIDER!=='gemini'||!process.env.GEMINI_API_KEY))
      return reply(503,{error:'The assistant model is not configured. Set GROQ_API_KEY or configure Gemini with GEMINI_API_KEY and AI_PROVIDER=gemini.'});
    ```

**Function**: `/assistant/chat` message storage (around line with messages.slice(-20))

**Specific Changes**:
13. **Align Message Limits**: Change the 40-message check to 20 to match storage
    ```javascript
    const prior=existing.Item?.messages||[];
    if(prior.length>=20)  // Changed from 40
      return reply(400,{error:'This conversation reached its 20-message limit. Start a new conversation.'});
    ```

**Additional Low Priority Changes** (Optional):

14. **Add Cache Cleanup to Lambda**: Add cleanup for `environmentCache` Map in cloud.mjs similar to server.ts

15. **Verify Model Name**: Confirm whether `gemini-1.5-flash` or `gemini-3.8-flash` is correct and update consistently

16. **Add Request Deduplication**: Implement in-flight request tracking to prevent simultaneous identical API calls

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs BEFORE implementing the fix to confirm root causes, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate the bug conditions on the UNFIXED code to observe failures and confirm root causes.

**Test Cases**:

1. **Memory Leak Test - Rate Limiter** (will fail on unfixed code):
   - Simulate 100 unique IPs making requests
   - Wait 2 minutes (beyond 60-second window)
   - Assert: `diagnoseRateLimits.size === 100` (demonstrates leak - should be 0)
   - Expected: Map retains all 100 IPs even though windows expired

2. **Memory Leak Test - Cache** (will fail on unfixed code):
   - Add 150 cache entries with timestamp 15 minutes ago (expired)
   - Current size: 150 < 200 (below max)
   - Assert: `diagnoseCache.size === 150` (demonstrates leak)
   - Expected: All 150 expired entries remain in cache

3. **Runtime Error Test - Undefined Symptoms** (will fail on unfixed code):
   - Create symptom entry with `symptoms: undefined` in test database
   - Call `/assistant/chat` with `includeHealth: true`
   - Expected: Lambda crashes with TypeError "Cannot read property 'join' of undefined"

4. **Cache Collision Test** (will fail on unfixed code):
   - Request diagnostic for Springfield, IL (coords: 39.78, -89.65) with AQI 45
   - Request diagnostic for Springfield, MA (coords: 42.10, -72.59) with AQI 45
   - Expected: Both locations get the same cached response (demonstrates collision)

5. **Wrong Table Test** (will fail on unfixed code):
   - Attempt to load health profile with environment having only SETTINGS_TABLE set
   - Expected: Check references PROFILE_TABLE, causing 503 error or undefined check failure

6. **Quota Retry Test** (will fail on unfixed code):
   - Mock API to return 429 with quota error message
   - Measure time until response
   - Expected: ~7 seconds (1s + 2s + 4s retries) instead of immediate return

7. **Message Limit Inconsistency Test** (will fail on unfixed code):
   - Create conversation with exactly 20 messages
   - Try to add another message
   - Expected: Request succeeds (40-message limit) but causes confusion

8. **Error Message Test** (will fail on unfixed code):
   - Configure with AI_PROVIDER=gemini and GEMINI_API_KEY only
   - Call assistant without GROQ_API_KEY
   - Expected: Error mentions GROQ_API_KEY even though Gemini is configured

**Expected Counterexamples**:
- Rate limiter and cache maps grow unbounded
- Lambda crashes on malformed symptom data
- Cache returns wrong city's data for identical city names
- Database operations fail due to wrong table references
- API retries waste time on quota errors that won't recover
- Message limits are confusing and inconsistent

### Fix Checking

**Goal**: Verify that for all inputs where bug conditions hold, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition_AnyOf12Bugs(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Cases** (on FIXED code):

1. **Memory Leak Fixed - Rate Limiter**:
   - Simulate 100 unique IPs, wait 2 minutes
   - Assert: `diagnoseRateLimits.size === 0` (all expired IPs removed)

2. **Memory Leak Fixed - Cache**:
   - Add 150 expired entries
   - Trigger periodic cleanup or new request
   - Assert: Expired entries are removed even though size < 200

3. **Runtime Error Fixed - Symptoms Safety**:
   - Create entry with `symptoms: undefined`
   - Call `/assistant/chat`
   - Assert: No crash, response returns successfully with empty symptoms string

4. **Cache Collision Fixed**:
   - Request Springfield, IL and Springfield, MA with AQI 45
   - Assert: Different cache keys generated, different responses returned

5. **Database Tables Fixed**:
   - Call `/profile` endpoint with only SETTINGS_TABLE configured
   - Assert: Operation succeeds, no references to PROFILE_TABLE

6. **Quota Retry Fixed**:
   - Mock 429 quota error
   - Measure response time
   - Assert: Response returns in < 1 second without retries

7. **Message Limit Fixed**:
   - Create conversation with 20 messages
   - Try to add another
   - Assert: Error states 20-message limit (consistent)

8. **Error Message Fixed**:
   - Configure Gemini only
   - Trigger error
   - Assert: Error mentions both GROQ_API_KEY and Gemini configuration

### Preservation Checking

**Goal**: Verify that for all inputs where bug conditions do NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition_AnyOf12Bugs(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Capture baseline behavior on UNFIXED code for valid inputs, then write property-based tests ensuring fixed code matches that behavior.

**Test Cases**:

1. **Valid Diagnostic Requests Preservation**:
   - Test various unique locations with different AQIs
   - Assert: Same response structure, cache behavior, rate limiting

2. **Cache Hit Preservation**:
   - Test cache hits for unique locations within TTL
   - Assert: Cached responses returned identically

3. **Rate Limiting Preservation**:
   - Test legitimate rate-limited scenarios (7th request within 60s)
   - Assert: Rate limit correctly enforced, fallback response identical

4. **Database Operations Preservation**:
   - Test all CRUD operations for profiles, symptoms, documents
   - Assert: All operations succeed identically with valid data

5. **API Success Cases Preservation**:
   - Test successful Groq/Gemini API calls
   - Assert: Responses formatted identically, tokens counted same way

6. **Error Handling Preservation**:
   - Test network errors, 5xx errors, invalid inputs
   - Assert: Error responses identical (except updated error messages)

7. **Conversation Features Preservation**:
   - Test conversations under 20 messages with valid data
   - Assert: All features work identically (document evidence, sources, history)

8. **Non-AI Features Preservation**:
   - Test maps, routes, storage, alerts features
   - Assert: Completely unaffected by AI optimization fixes

### Unit Tests

- Test `checkRateLimit` function with expired timestamps
- Test `getCacheKey` function with coordinates parameter
- Test cache cleanup logic with expired entries
- Test symptoms mapping with undefined/null/non-array values
- Test environment variable checks for table names
- Test quota error detection logic
- Test message limit validation
- Test location length validation

### Property-Based Tests

- Generate random IP addresses and timestamps, verify rate limiter memory is bounded
- Generate random cache entries with varying expiration times, verify cache memory is bounded
- Generate random symptom entries (including malformed), verify no crashes
- Generate random location pairs with same city names but different coordinates, verify unique cache keys
- Generate random API error responses (including 429), verify appropriate retry behavior
- Generate random conversation histories up to 20 messages, verify consistent limits

### Integration Tests

- **24-hour load test**: Simulate production traffic for 24 hours, monitor memory usage
  - Assert: Memory stable, no unbounded growth
  - Assert: Both maps stay under 1000 entries
  
- **Cache collision test**: Test 100 cities with common names (Springfield, Salem, etc.)
  - Assert: Each city gets unique cache entries based on coordinates
  
- **Database operations test**: Test all health endpoints with SETTINGS_TABLE only
  - Assert: All operations succeed, no references to missing tables
  
- **API quota test**: Simulate quota exhaustion scenarios
  - Assert: Quick failure without retries, appropriate error messages
  
- **End-to-end assistant test**: Test full conversation flow with health data
  - Assert: Symptoms with malformed data don't crash Lambda
  - Assert: Error messages mention all configured providers
  
- **Staging deployment**: Deploy to staging for 48 hours
  - Assert: No production issues
  - Assert: All 12 bugs resolved
  - Assert: Existing features work identically
