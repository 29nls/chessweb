/**
 * Rate limiter powered by Upstash Redis (@upstash/ratelimit).
 *
 * In production (Vercel with UPSTASH_REDIS_REST_URL set), uses a distributed
 * sliding-window algorithm shared across all serverless instances.
 *
 * Falls back to an in-memory Map when the Upstash URL is not configured,
 * so local development and tests continue to work without credentials.
 *
 * ─── Public API (unchanged from original) ──────────────────
 *
 * async checkRateLimit(key, windowMs, maxRequests) → { allowed, remaining, resetAt }
 *   key         – unique identifier (e.g. "engines:192.168.1.1")
 *   windowMs    – time window in milliseconds
 *   maxRequests – max requests allowed in the window
 *
 * resetRateLimit(key?) – clears counters for the given key (or all keys).
 *   Only effective with the in-memory fallback; no-op against Upstash.
 */

// ── Upstash Redis client (lazy-init) ─────────────────────

let redisClient = null;

function getRedisClient() {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    // Dynamic require so the build doesn't fail when packages are missing
    // (e.g. in GitHub Actions without npm install)
    const { Redis } = require('@upstash/redis');
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (err) {
    console.warn('[rateLimit] Failed to initialize Upstash Redis client:', err.message);
    return null;
  }
}

// ── Limiter cache (one per windowMs / maxRequests combo) ──

const limiterCache = new Map();

function getUpstashLimiter(windowMs, maxRequests) {
  const cacheKey = `${windowMs}:${maxRequests}`;
  if (limiterCache.has(cacheKey)) return limiterCache.get(cacheKey);

  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const { Ratelimit } = require('@upstash/ratelimit');
    // Convert windowMs to a duration string compatible with @upstash/ratelimit
    const durationStr = windowMs >= 60000
      ? `${Math.round(windowMs / 60000)}m`
      : `${Math.round(windowMs / 1000)}s`;

    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, durationStr),
      analytics: false,
      prefix: 'chessweb:rl',
    });

    limiterCache.set(cacheKey, limiter);
    return limiter;
  } catch (err) {
    console.warn('[rateLimit] Failed to create Upstash limiter:', err.message);
    return null;
  }
}

// ── In-memory fallback ───────────────────────────────────

const store = new Map();

function inMemoryCheckRateLimit(key, windowMs, maxRequests) {
  const now = Date.now();
  const windowStart = now - windowMs;

  if (!store.has(key)) {
    store.set(key, []);
  }

  const timestamps = store.get(key);

  while (timestamps.length > 0 && timestamps[0] <= windowStart) {
    timestamps.shift();
  }

  const allowed = timestamps.length < maxRequests;
  const resetAt = timestamps.length > 0 ? timestamps[0] + windowMs : now + windowMs;

  if (allowed) {
    timestamps.push(now);
  }

  return {
    allowed,
    remaining: Math.max(0, maxRequests - timestamps.length),
    resetAt,
  };
}

function inMemoryResetRateLimit(key) {
  if (key) {
    store.delete(key);
  } else {
    store.clear();
  }
}

// ── Public API ───────────────────────────────────────────

/**
 * Check rate limit. Uses Upstash when available, falls back to in-memory.
 */
async function checkRateLimit(key, windowMs, maxRequests) {
  const limiter = getUpstashLimiter(windowMs, maxRequests);

  if (limiter) {
    try {
      const { success, limit, remaining, reset } = await limiter.limit(key);
      return {
        allowed: success,
        remaining: Math.min(remaining, maxRequests),
        resetAt: reset,
      };
    } catch (err) {
      console.warn('[rateLimit] Upstash limit() failed, falling back to in-memory:', err.message);
      return inMemoryCheckRateLimit(key, windowMs, maxRequests);
    }
  }

  return inMemoryCheckRateLimit(key, windowMs, maxRequests);
}

/**
 * Reset rate limit counters. Only effective with the in-memory fallback.
 */
function resetRateLimit(key) {
  inMemoryResetRateLimit(key);
  // Upstash does not support server-side reset — keys expire naturally.
}

module.exports = { checkRateLimit, resetRateLimit };
