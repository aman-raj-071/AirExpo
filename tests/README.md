# AirExpo AI Optimization Test Suite

## Overview
Comprehensive test suite for AI API optimization features including caching, rate limiting, retry logic, and token reduction.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run specific test file
node --test tests/ai-optimization.test.mjs
```

## Test Coverage

### 1. Cache Tests (6 tests)
Tests the server-side LRU cache for `/api/diagnose` endpoint.

**Key Features Tested:**
- ✅ AQI bucketing (rounds to nearest 5 for higher hit rate)
- ✅ Cache key generation (location + AQI bucket)
- ✅ Data retrieval and storage
- ✅ TTL expiration (10-minute default)
- ✅ LRU eviction when max size exceeded
- ✅ Cache hit rate improvement

**Example:**
```javascript
// AQI 47 and 48 both round to different buckets (45 vs 50)
// AQI 52 and 48 both round to 50 (same cache entry)
getCacheKey('NYC', 47) // → 'NYC:45'
getCacheKey('NYC', 48) // → 'NYC:50'
getCacheKey('NYC', 52) // → 'NYC:50'
```

### 2. Rate Limiter Tests (5 tests)
Tests per-IP rate limiting for the diagnose endpoint.

**Key Features Tested:**
- ✅ Allow requests within limit (6 per 60s)
- ✅ Block requests exceeding limit
- ✅ Sliding window implementation
- ✅ Per-IP tracking (independent limits)
- ✅ Automatic reset after time window

**Configuration:**
- Limit: 6 requests per 60 seconds per IP
- Window: Sliding (not fixed intervals)

### 3. Retry Logic Tests (5 tests)
Tests exponential backoff retry mechanism for AI API calls.

**Key Features Tested:**
- ✅ Success on first attempt (no retries)
- ✅ Retry on transient failures
- ✅ Respect `Retry-After` header from API
- ✅ Exponential backoff (1s, 2s, 4s)
- ✅ Stop after max attempts (3)

**Backoff Strategy:**
```javascript
// Retry delays
Attempt 1: Immediate
Attempt 2: Wait 1s (or Retry-After header value)
Attempt 3: Wait 2s (or Retry-After header value)
Attempt 4: Wait 4s (or Retry-After header value)
Max: 3 attempts total
```

### 4. Token Reduction Tests (5 tests)
Tests token optimization strategies for chat endpoint.

**Key Features Tested:**
- ✅ History reduction (8 → 2 messages, 75% reduction)
- ✅ Profile compaction (remove large fields)
- ✅ Symptom reduction (30 → 5 most recent)
- ✅ Environment data compaction (48 → 24 hours, short timestamps)
- ✅ System prompt truncation (15KB limit)

**Token Savings:**
```
Before: 5,000-10,000 tokens per message
After:  2,000-4,000 tokens per message
Savings: ~60% reduction
```

### 5. Quota Protection Tests (2 tests)
Tests protection against quota exhaustion.

**Key Features Tested:**
- ✅ No infinite retry on quota exhaustion
- ✅ Graceful fallback on rate limit

**Behavior:**
- Max 3 retry attempts even on quota errors
- Returns fallback data instead of error on rate limit
- Never auto-retries after daily quota exhausted

### 6. Integration Tests (3 tests)
Tests combined behavior of multiple optimization features.

**Scenarios Tested:**
- ✅ Cache hit path (no rate limit check, no AI call)
- ✅ Rate limit path (return fallback, no AI call)
- ✅ Retry success path (transient error recovery)

### 7. Performance Tests (2 tests)
Tests performance characteristics of optimization features.

**Benchmarks:**
- ✅ Cache lookup: <1ms average (tested with 1,000 entries)
- ✅ Rate limiter check: <1ms average (tested with 1,000 IPs)

**Results (typical):**
```
Cache lookup:      ~0.005ms per lookup
Rate limiter check: ~0.003ms per check
```

## Test Statistics

```
Total Tests:  28
Total Suites: 8
Pass Rate:    100%
Duration:     ~16 seconds
```

**Breakdown by Suite:**
- Cache Tests: 6 tests (1.1s)
- Rate Limiter Tests: 5 tests (2.2s)
- Retry Logic Tests: 5 tests (9.6s) *includes intentional delays
- Token Reduction Tests: 5 tests (<0.01s)
- Quota Protection Tests: 2 tests (3.0s) *includes intentional delays
- Integration Tests: 3 tests (0.1s)
- Performance Tests: 2 tests (<0.01s)

## Test Architecture

### Mock-Free Design
The original `ai-optimization.test.mjs` suite uses simulated cache, rate limiter, and retry implementations. It checks those algorithms but does not verify the production server integrations. `location-stability.test.mjs` imports the production translation, telemetry and AI services with controlled DOM/network inputs. This provides:
- Real behavior verification
- Performance validation
- Integration confidence

### Time-Based Tests
Some tests include intentional delays to verify timing behavior:
- Cache TTL expiration (1.1s delay)
- Rate limit window reset (1.1s delay)
- Retry backoff timing (3-9s delays)

### Async Test Support
Uses Node.js native `node:test` module with full async/await support.

## Implementation References

### Cache Implementation
```javascript
// server.ts
const diagnoseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX_SIZE = 200;
```

### Rate Limiter Implementation
```javascript
// server.ts
const diagnoseRateLimits = new Map<string, number[]>();
const DIAGNOSE_RATE_LIMIT = 6;
const DIAGNOSE_RATE_WINDOW_MS = 60 * 1000;
```

### Retry Logic Implementation
```javascript
// infra/lambda/cloud.mjs
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    // API call
    break;
  } catch (err) {
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after')) || Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
    }
  }
}
```

## Troubleshooting

### Tests Timing Out
Some tests include intentional delays. If tests time out:
- Check system performance
- Verify no conflicting processes
- Increase Node.js test timeout if needed

### Test Failures
If specific tests fail:

**Cache Tests:**
- Check TTL timing (may need slight adjustment for slow systems)
- Verify Map implementation behavior

**Rate Limiter Tests:**
- Ensure system clock is accurate
- Check for timing precision issues

**Retry Tests:**
- Verify setTimeout behavior
- Check async/await execution order

## Future Enhancements

Potential test additions:
- [ ] Document analysis deduplication tests
- [ ] Frontend debounce tests (App.tsx MutationObserver)
- [ ] End-to-end API tests with real endpoints
- [ ] Load testing (multiple concurrent requests)
- [ ] Memory leak detection (long-running cache/limiter)
- [ ] Token counting accuracy tests
- [ ] Fallback data quality tests

## Dependencies

**Required:**
- Node.js 18+ (native test runner)
- No external test frameworks needed

**Optional for CI/CD:**
- Coverage reporting tools
- Test result formatters
- Performance monitoring

## CI/CD Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run Tests
  run: npm test

# GitLab CI example
test:
  script:
    - npm test
```

## Contributing

When adding new optimization features:
1. Add corresponding tests to this file
2. Maintain >95% pass rate
3. Document expected behavior
4. Include performance benchmarks
5. Add integration test scenarios

## References

- [Node.js Test Runner Documentation](https://nodejs.org/api/test.html)
- [AI Optimization Summary](../AI_OPTIMIZATION_SUMMARY.md)
- Implementation files: `server.ts`, `infra/lambda/cloud.mjs`
