# Bugfix Specification: AI Optimization Issues

**Feature:** ai-optimization-bugfix  
**Type:** Bugfix  
**Created:** 2026-10-11  
**Status:** Draft

---

## Bug Condition

The recently implemented AI optimization features contain 12 bugs ranging from critical memory leaks to data corruption issues.

### Critical Issues (3)

1. **Memory Leak: Rate Limiter** - `diagnoseRateLimits` Map never removes old IPs, grows unbounded
2. **Memory Leak: Cache** - Expired entries never deleted, only evicted when size > 200  
3. **Runtime Error** - `s.symptoms.join()` crashes if symptoms undefined/not-array

### High Priority (3)

4. **Cache Key Collision** - "Springfield, IL" matches "Springfield, MA" (no coordinates in key)
5. **Wrong DB Tables** - References PROFILE_TABLE/SYMPTOM_TABLE (should be SETTINGS_TABLE)
6. **Inefficient Retry** - Retries 3x on quota exhaustion (won't recover, wastes 7s)

### Medium Priority (3)

7. **Inconsistent Limit** - Checks 40 messages but stores 20
8. **Misleading Error** - Says "Set GROQ_API_KEY" (Gemini also valid)
9. **Missing Validation** - No location string length check

### Low Priority (3)

10. **Model Name** - gemini-1.5-flash vs original gemini-3.8-flash
11. **No Cleanup** - Maps never auto-clean during idle
12. **No Dedup** - Simultaneous identical requests all call API

---

## Expected Correct Behavior

- Rate limiter map bounded to ~1,000 active IPs
- Cache auto-removes expired entries
- Lambda handles malformed data gracefully
- Cache keys include coordinates (unique per location)
- Uses SETTINGS_TABLE for all health data
- Detects quota exhaustion, skips retry

---

## Validation Criteria

**Critical:**
- [ ] Memory stable after 24-hour load test
- [ ] Springfield IL ≠ Springfield MA in cache
- [ ] Lambda doesn't crash on null symptoms

**High:**
- [ ] Database queries work with SETTINGS_TABLE
- [ ] Quota 429 returns immediately (no retry)

**Medium:**
- [ ] Conversation limit consistent (20)
- [ ] Error mentions both GROQ and GEMINI

---

## Affected Files

- `server.ts` - Cache/rate-limiter cleanup, getCacheKey(), validation
- `infra/lambda/cloud.mjs` - Symptom filtering, table names, retry logic

---

## Acceptance Criteria

- [ ] All 12 bugs fixed
- [ ] 8+ new unit tests
- [ ] 6 integration test scenarios pass
- [ ] 24-hour load test (no crashes)
- [ ] Cache collision test (100 cities)
- [ ] Staging deployment (48 hours)

---

**Priority:** P0 (Critical - blocks production)
**Effort:** 1-2 days dev + 2 days testing
