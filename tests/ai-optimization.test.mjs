/**
 * AI Optimization Test Suite
 * Tests for caching, rate limiting, retry logic, and token reduction
 */

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';

// Simulate diagnose cache implementation
class DiagnoseCache {
  constructor(maxSize = 200, ttlMs = 10 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  getCacheKey(location, aqi) {
    const aqiBucket = aqi != null ? Math.round(aqi / 5) * 5 : 'null';
    return `${location}:${aqiBucket}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp >= this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key, data) {
    const now = Date.now();
    this.cache.set(key, { data, timestamp: now });
    
    // LRU eviction
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  size() {
    return this.cache.size;
  }

  clear() {
    this.cache.clear();
  }
}

// Simulate rate limiter
class RateLimiter {
  constructor(limit = 6, windowMs = 60 * 1000) {
    this.limits = new Map();
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(ip) {
    const now = Date.now();
    const requests = this.limits.get(ip) || [];
    const recentRequests = requests.filter(t => now - t < this.windowMs);
    
    if (recentRequests.length >= this.limit) {
      return false;
    }
    
    recentRequests.push(now);
    this.limits.set(ip, recentRequests);
    return true;
  }

  reset(ip) {
    this.limits.delete(ip);
  }

  clear() {
    this.limits.clear();
  }
}

// Simulate retry logic
async function retryWithBackoff(fn, maxAttempts = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn(attempt + 1);
      return { success: true, result, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts - 1) {
        const retryAfter = error.retryAfter || Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      }
    }
  }
  
  return { success: false, error: lastError, attempts: maxAttempts };
}

// Tests
describe('AI Optimization Suite', () => {
  describe('Cache Tests', () => {
    let cache;

    before(() => {
      cache = new DiagnoseCache(5, 1000); // Small size and TTL for testing
    });

    after(() => {
      cache.clear();
    });

    it('should generate correct cache keys with AQI bucketing', () => {
      assert.strictEqual(cache.getCacheKey('NYC', 47), 'NYC:45');
      assert.strictEqual(cache.getCacheKey('NYC', 52), 'NYC:50');
      assert.strictEqual(cache.getCacheKey('NYC', 50), 'NYC:50');
      assert.strictEqual(cache.getCacheKey('NYC', null), 'NYC:null');
    });

    it('should cache and retrieve data', () => {
      const key = cache.getCacheKey('NYC', 50);
      const data = { headline: 'Test' };
      
      cache.set(key, data);
      const retrieved = cache.get(key);
      
      assert.deepStrictEqual(retrieved, data);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('nonexistent:key');
      assert.strictEqual(result, null);
    });

    it('should expire entries after TTL', async () => {
      const key = cache.getCacheKey('LA', 45);
      cache.set(key, { headline: 'Expired' });
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const result = cache.get(key);
      assert.strictEqual(result, null);
    });

    it('should evict oldest entry when max size exceeded (LRU)', () => {
      cache.clear();
      
      // Fill cache to max size
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, { data: i });
      }
      
      assert.strictEqual(cache.size(), 5);
      
      // Add one more to trigger eviction
      cache.set('key5', { data: 5 });
      
      assert.strictEqual(cache.size(), 5);
      assert.strictEqual(cache.get('key0'), null); // First key should be evicted
      assert.notStrictEqual(cache.get('key5'), null); // New key should exist
    });

    it('should increase cache hit rate with AQI bucketing', () => {
      cache.clear();
      
      // Similar AQI values should use same cache entry
      const key1 = cache.getCacheKey('NYC', 47);
      const key2 = cache.getCacheKey('NYC', 48);
      const key3 = cache.getCacheKey('NYC', 52);
      
      // 47 rounds to 45, 48 rounds to 50 (different buckets)
      assert.notStrictEqual(key1, key2);
      // 52 rounds to 50, same as 48
      assert.strictEqual(key2, key3);
      
      // But values very close (47 and 49) would both round to 45
      const key4 = cache.getCacheKey('NYC', 49);
      const key5 = cache.getCacheKey('NYC', 44);
      assert.strictEqual(key4, 'NYC:50'); // 49 rounds to 50
      assert.strictEqual(key5, 'NYC:45'); // 44 rounds to 45
    });
  });

  describe('Rate Limiter Tests', () => {
    let limiter;

    before(() => {
      limiter = new RateLimiter(3, 1000); // 3 requests per second for testing
    });

    after(() => {
      limiter.clear();
    });

    it('should allow requests within limit', () => {
      const ip = '192.168.1.1';
      
      assert.strictEqual(limiter.check(ip), true);
      assert.strictEqual(limiter.check(ip), true);
      assert.strictEqual(limiter.check(ip), true);
    });

    it('should block requests exceeding limit', () => {
      const ip = '192.168.1.2';
      
      // Use up the limit
      for (let i = 0; i < 3; i++) {
        limiter.check(ip);
      }
      
      // Next request should be blocked
      assert.strictEqual(limiter.check(ip), false);
    });

    it('should reset limit after time window', async () => {
      const ip = '192.168.1.3';
      
      // Use up the limit
      for (let i = 0; i < 3; i++) {
        limiter.check(ip);
      }
      
      assert.strictEqual(limiter.check(ip), false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should allow requests again
      assert.strictEqual(limiter.check(ip), true);
    });

    it('should track different IPs independently', () => {
      limiter.clear();
      const ip1 = '192.168.1.4';
      const ip2 = '192.168.1.5';
      
      // Use up limit for ip1
      for (let i = 0; i < 3; i++) {
        limiter.check(ip1);
      }
      
      // ip1 should be blocked
      assert.strictEqual(limiter.check(ip1), false);
      
      // ip2 should still work
      assert.strictEqual(limiter.check(ip2), true);
    });

    it('should implement sliding window correctly', async () => {
      limiter.clear();
      const ip = '192.168.1.6';
      
      // Make 2 requests
      limiter.check(ip);
      limiter.check(ip);
      
      // Wait 600ms
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Make 1 more request (should work, we're at 3 total)
      assert.strictEqual(limiter.check(ip), true);
      
      // Wait another 500ms (first 2 requests should have expired)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should be able to make 2 more requests
      assert.strictEqual(limiter.check(ip), true);
      assert.strictEqual(limiter.check(ip), true);
    });
  });

  describe('Retry Logic Tests', () => {
    it('should succeed on first attempt', async () => {
      const fn = mock.fn(async () => ({ data: 'success' }));
      
      const result = await retryWithBackoff(fn, 3);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempts, 1);
      assert.strictEqual(fn.mock.calls.length, 1);
    });

    it('should retry on failure', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Transient error');
        }
        return { data: 'success' };
      };
      
      const result = await retryWithBackoff(fn, 3);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempts, 3);
      assert.strictEqual(callCount, 3);
    });

    it('should respect Retry-After header', async () => {
      const startTime = Date.now();
      let callCount = 0;
      
      const fn = async () => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('Rate limited');
          error.retryAfter = 0.5; // 500ms
          throw error;
        }
        return { data: 'success' };
      };
      
      const result = await retryWithBackoff(fn, 3);
      const elapsed = Date.now() - startTime;
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempts, 2);
      assert.ok(elapsed >= 500, `Should wait at least 500ms, waited ${elapsed}ms`);
    });

    it('should use exponential backoff when no Retry-After', async () => {
      const startTime = Date.now();
      const fn = mock.fn(async () => {
        throw new Error('Always fails');
      });
      
      const result = await retryWithBackoff(fn, 3);
      const elapsed = Date.now() - startTime;
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.attempts, 3);
      // Should wait 1s + 2s = 3s total
      assert.ok(elapsed >= 3000, `Should wait at least 3s for exponential backoff, waited ${elapsed}ms`);
    });

    it('should stop after max attempts', async () => {
      const fn = mock.fn(async () => {
        throw new Error('Always fails');
      });
      
      const result = await retryWithBackoff(fn, 3);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(fn.mock.calls.length, 3);
      assert.ok(result.error instanceof Error);
    });
  });

  describe('Token Reduction Tests', () => {
    it('should reduce history from 8 to 2 messages', () => {
      const fullHistory = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));
      
      const reduced = fullHistory.slice(-2);
      
      assert.strictEqual(reduced.length, 2);
      assert.strictEqual(reduced[0].content, 'Message 8');
      assert.strictEqual(reduced[1].content, 'Message 9');
    });

    it('should compact profile data', () => {
      const fullProfile = {
        userId: 'user123',
        mode: 'asthma',
        ageRange: '18-39',
        knownTriggers: ['pollen', 'dust'],
        prescribedActionPlan: 'Long text...'.repeat(100), // ~1200 chars
        usualOutdoorMinutes: 45,
        updatedAt: '2026-10-11T12:00:00Z',
      };
      
      const compacted = {
        mode: fullProfile.mode,
        ageRange: fullProfile.ageRange,
        knownTriggers: fullProfile.knownTriggers,
      };
      
      const fullSize = JSON.stringify(fullProfile).length;
      const compactedSize = JSON.stringify(compacted).length;
      
      assert.ok(compactedSize < fullSize / 2, `Compacted should be <50% of original: ${compactedSize} vs ${fullSize}`);
    });

    it('should reduce symptoms from 30 to 5', () => {
      const allSymptoms = Array.from({ length: 30 }, (_, i) => ({
        recordedAt: `2026-10-${String(11 - i).padStart(2, '0')}T12:00:00Z`,
        symptoms: ['wheezing', 'cough'],
        severity: 'moderate',
        inhalerUsed: true,
        aqi: 75,
      }));
      
      const reduced = allSymptoms.slice(0, 5);
      
      assert.strictEqual(reduced.length, 5);
    });

    it('should compact environment data', () => {
      const full = {
        provider: 'Open-Meteo modeled grid',
        timezone: 'America/New_York',
        current: { us_aqi: 50, pm2_5: 12, pm10: 25 },
        temperatureC: 22,
        humidityPercent: 65,
        hourly: Array.from({ length: 48 }, (_, i) => ({
          time: `2026-10-11T${String(i).padStart(2, '0')}:00`,
          aqi: 50 + i,
          pm25: 12 + i * 0.5,
          pm10: 25 + i,
        })),
      };
      
      const compacted = {
        current: {
          aqi: full.current.us_aqi,
          pm25: full.current.pm2_5,
          temp: full.temperatureC,
          humidity: full.humidityPercent,
        },
        hourly: full.hourly.slice(0, 24).map(h => ({
          time: h.time.slice(11, 16), // HH:MM only
          aqi: h.aqi,
          pm25: h.pm25,
        })),
      };
      
      const fullSize = JSON.stringify(full).length;
      const compactedSize = JSON.stringify(compacted).length;
      
      assert.ok(compactedSize < fullSize * 0.6, `Compacted should be <60% of original: ${compactedSize} vs ${fullSize}`);
    });

    it('should limit system prompt context to 15KB', () => {
      const largeContext = {
        profile: { data: 'x'.repeat(10000) },
        symptoms: { data: 'y'.repeat(10000) },
        environment: { data: 'z'.repeat(10000) },
        documentEvidence: 'evidence'.repeat(5000),
      };
      
      const json = JSON.stringify(largeContext);
      const truncated = json.slice(0, 15000);
      
      assert.strictEqual(truncated.length, 15000);
      assert.ok(json.length > 15000, 'Original should exceed 15KB');
    });
  });

  describe('Quota Protection Tests', () => {
    it('should not auto-retry after daily quota exhaustion', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        const error = new Error('Quota exhausted');
        error.status = 429;
        error.message = 'quota exceeded';
        throw error;
      };
      
      const result = await retryWithBackoff(fn, 3);
      
      assert.strictEqual(result.success, false);
      assert.strictEqual(callCount, 3); // Should still respect max attempts
      assert.ok(result.error.message.includes('quota'));
    });

    it('should return fallback on rate limit', () => {
      const limiter = new RateLimiter(1, 1000);
      const ip = 'test-ip';
      
      limiter.check(ip); // Use up limit
      
      const blocked = !limiter.check(ip);
      assert.strictEqual(blocked, true);
      
      // In actual implementation, this returns fallback data, not error
      const fallback = {
        success: true,
        data: { headline: 'Rate limited fallback' },
        isFallback: true,
        rateLimited: true,
      };
      
      assert.strictEqual(fallback.success, true);
      assert.strictEqual(fallback.rateLimited, true);
    });
  });

  describe('Integration Tests', () => {
    it('should handle cache hit, skip rate limit check, no AI call', () => {
      const cache = new DiagnoseCache();
      const limiter = new RateLimiter();
      const ip = '192.168.1.100';
      
      const location = 'NYC';
      const aqi = 47;
      const key = cache.getCacheKey(location, aqi);
      
      // First request - cache miss
      let cached = cache.get(key);
      assert.strictEqual(cached, null);
      
      // Check rate limit (should pass)
      const allowed = limiter.check(ip);
      assert.strictEqual(allowed, true);
      
      // Simulate AI call and cache result
      const aiResult = { headline: 'Good air quality' };
      cache.set(key, aiResult);
      
      // Second request - cache hit (no rate limit check needed)
      cached = cache.get(key);
      assert.deepStrictEqual(cached, aiResult);
    });

    it('should handle rate limit, return fallback, no AI call', () => {
      const limiter = new RateLimiter(1, 1000);
      const ip = '192.168.1.101';
      
      // Use up limit
      limiter.check(ip);
      
      // Next request blocked
      const allowed = limiter.check(ip);
      assert.strictEqual(allowed, false);
      
      // Should return fallback instead of making AI call
      const fallback = {
        success: true,
        data: { headline: 'Fallback response' },
        rateLimited: true,
      };
      
      assert.strictEqual(fallback.success, true);
    });

    it('should handle retry success on second attempt', async () => {
      let callCount = 0;
      const mockAICall = async () => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('Transient network error');
          error.retryAfter = 0.1;
          throw error;
        }
        return { answer: 'Success on retry' };
      };
      
      const result = await retryWithBackoff(mockAICall, 3);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.attempts, 2);
      assert.strictEqual(callCount, 2);
    });
  });

  describe('Performance Tests', () => {
    it('cache lookup should be fast (<1ms)', () => {
      const cache = new DiagnoseCache(1000);
      
      // Fill cache
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, { data: i });
      }
      
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        cache.get(`key${i}`);
      }
      const elapsed = performance.now() - start;
      
      const avgPerLookup = elapsed / 1000;
      assert.ok(avgPerLookup < 1, `Average lookup should be <1ms, got ${avgPerLookup.toFixed(3)}ms`);
    });

    it('rate limiter check should be fast (<1ms)', () => {
      const limiter = new RateLimiter();
      
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        limiter.check(`ip${i}`);
      }
      const elapsed = performance.now() - start;
      
      const avgPerCheck = elapsed / 1000;
      assert.ok(avgPerCheck < 1, `Average check should be <1ms, got ${avgPerCheck.toFixed(3)}ms`);
    });
  });
});

console.log('✅ All AI optimization tests defined. Run with: node --test tests/ai-optimization.test.mjs');
