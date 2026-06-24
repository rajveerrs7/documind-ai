// ─────────────────────────────────────────────────────────────────────────────
// Redis Client (Upstash)
//
// Uses Upstash Redis — a serverless Redis compatible with Vercel Edge.
// Upstash free tier: 10,000 commands/day, 256MB storage
//
// Used for:
//   1. Rate limiting (5 requests/minute per user)
//   2. Caching (document processing status, admin stats)
//   3. Session blacklisting (for logout)
//
// The @upstash/redis client works via HTTP (REST API), making it
// compatible with serverless/Edge environments where raw TCP
// connections (ioredis) aren't available.
// ─────────────────────────────────────────────────────────────────────────────

import { Redis } from "@upstash/redis";

// ── Redis Client Singleton ────────────────────────────────────────────────────

let redisInstance: Redis | null = null;

/**
 * Returns a singleton Upstash Redis client.
 *
 * @throws {Error} If Upstash env vars are not set
 */
export function getRedisClient(): Redis {
  if (redisInstance) return redisInstance;

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    throw new Error("UPSTASH_REDIS_REST_URL environment variable is not set");
  }
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("UPSTASH_REDIS_REST_TOKEN environment variable is not set");
  }

  redisInstance = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    // Retry on failure (network hiccups)
    retry: {
      retries: 3,
      backoff: (retryCount) => Math.pow(2, retryCount) * 100, // Exponential backoff
    },
  });

  return redisInstance;
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────

// Rate limit: 5 requests per 60 seconds per user
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60; // seconds

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp when window resets
}

/**
 * Checks and enforces rate limits using a sliding window counter.
 *
 * Uses Redis INCR + EXPIRE for atomic counting.
 * Key format: rate_limit:{action}:{userId}
 *
 * @param userId - The user making the request
 * @param action - The action being rate-limited (e.g., "chat", "upload")
 * @param maxRequests - Max allowed requests (default: 5)
 * @param windowSeconds - Time window in seconds (default: 60)
 * @returns RateLimitResult
 */
export async function checkRateLimit(
  userId: string,
  action: string = "chat",
  maxRequests: number = RATE_LIMIT_MAX,
  windowSeconds: number = RATE_LIMIT_WINDOW,
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const key = `rate_limit:${action}:${userId}`;

  try {
    // Atomic increment
    const current = await redis.incr(key);

    // Set expiry on first request (key didn't exist before)
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    // Get remaining TTL for reset time
    const ttl = await redis.ttl(key);
    const resetAt =
      Math.floor(Date.now() / 1000) + (ttl > 0 ? ttl : windowSeconds);

    const allowed = current <= maxRequests;
    const remaining = Math.max(0, maxRequests - current);

    if (!allowed) {
      console.warn(
        `[RateLimit] User ${userId} exceeded ${action} limit: ${current}/${maxRequests}`,
      );
    }

    return { allowed, remaining, resetAt };
  } catch (error) {
    // If Redis is down, fail open (allow the request)
    // Better to have no rate limiting than to block all users
    console.error("[RateLimit] Redis error, failing open:", error);
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: Math.floor(Date.now() / 1000) + windowSeconds,
    };
  }
}

// ── Caching Utilities ─────────────────────────────────────────────────────────

/**
 * Generic cache get/set with JSON serialization.
 *
 * @param key - Cache key
 * @returns Cached value or null
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  try {
    const value = await redis.get<T>(key);
    return value;
  } catch (error) {
    console.error(`[Cache] GET failed for key ${key}:`, error);
    return null;
  }
}

/**
 * Sets a value in cache with optional TTL.
 *
 * @param key - Cache key
 * @param value - Value to cache (will be JSON serialized)
 * @param ttlSeconds - Time to live in seconds (default: 5 minutes)
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = 300,
): Promise<void> {
  const redis = getRedisClient();
  try {
    await redis.setex(
      key,
      ttlSeconds,
      value as Parameters<typeof redis.setex>[2],
    );
  } catch (error) {
    console.error(`[Cache] SET failed for key ${key}:`, error);
    // Non-fatal — caching failures shouldn't break the app
  }
}

/**
 * Deletes a cache key.
 *
 * @param key - Cache key to delete
 */
export async function cacheDelete(key: string): Promise<void> {
  const redis = getRedisClient();
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`[Cache] DEL failed for key ${key}:`, error);
  }
}

// ── Session Blacklist ─────────────────────────────────────────────────────────
// Used to invalidate JWTs on logout before they expire naturally

const SESSION_BLACKLIST_PREFIX = "blacklist:jwt:";

/**
 * Adds a JWT token ID to the blacklist.
 * The token remains blacklisted until its natural expiry.
 *
 * @param jti - JWT token ID (from payload.jti)
 * @param expiresAt - Token expiry timestamp (Unix seconds)
 */
export async function blacklistToken(
  jti: string,
  expiresAt: number,
): Promise<void> {
  const redis = getRedisClient();
  const key = `${SESSION_BLACKLIST_PREFIX}${jti}`;
  const ttl = expiresAt - Math.floor(Date.now() / 1000);

  if (ttl > 0) {
    try {
      await redis.setex(key, ttl, "1");
    } catch (error) {
      console.error("[Blacklist] Failed to blacklist token:", error);
    }
  }
}

/**
 * Checks if a JWT token has been blacklisted.
 *
 * @param jti - JWT token ID
 * @returns true if blacklisted (should reject), false if valid
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${SESSION_BLACKLIST_PREFIX}${jti}`;

  try {
    const value = await redis.get(key);
    return value !== null;
  } catch (error) {
    console.error("[Blacklist] Check failed:", error);
    // Fail closed — if we can't check, assume not blacklisted
    // (prevents legitimate users from being locked out on Redis downtime)
    return false;
  }
}

// ── Document Processing Status Cache ─────────────────────────────────────────

/**
 * Caches document processing status to avoid DB polling.
 * Frontend polls this during upload to show progress.
 *
 * @param documentId - Prisma Document.id
 * @param status - Current processing status
 */
export async function setDocumentProcessingStatus(
  documentId: string,
  status: string,
): Promise<void> {
  await cacheSet(`doc:status:${documentId}`, status, 300); // 5 min TTL
}

/**
 * Gets cached document processing status.
 *
 * @param documentId - Prisma Document.id
 * @returns Status string or null if not cached
 */
export async function getDocumentProcessingStatus(
  documentId: string,
): Promise<string | null> {
  return cacheGet<string>(`doc:status:${documentId}`);
}

// ── Admin Stats Cache ─────────────────────────────────────────────────────────

const ADMIN_STATS_CACHE_KEY = "admin:stats";
const ADMIN_STATS_TTL = 300; // 5 minutes

/**
 * Caches admin dashboard stats to avoid expensive DB queries on every load.
 */
export async function cacheAdminStats<T>(stats: T): Promise<void> {
  await cacheSet(ADMIN_STATS_CACHE_KEY, stats, ADMIN_STATS_TTL);
}

/**
 * Gets cached admin stats.
 */
export async function getCachedAdminStats<T>(): Promise<T | null> {
  return cacheGet<T>(ADMIN_STATS_CACHE_KEY);
}

/**
 * Invalidates admin stats cache.
 * Called when data changes that would affect the stats.
 */
export async function invalidateAdminStatsCache(): Promise<void> {
  await cacheDelete(ADMIN_STATS_CACHE_KEY);
}
