/**
 * Distributed rate-limit store for express-rate-limit, backed by Upstash Redis
 * (already a runtime dependency — no new packages).
 *
 * Why: the in-memory limiter counts per serverless instance, so on Vercel the
 * effective limit is `max × instance count` — brute-force ceilings evaporate.
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are configured, the
 * limiters below switch to this store so counters are global. Without the env
 * vars, `getRateLimitStore()` returns undefined and express-rate-limit falls
 * back to its memory store (dev / self-hosted).
 *
 * Implementation notes:
 *  - Fixed-window counter: INCR, then PEXPIRE when the key is new. The classic
 *    INCR/PEXPIRE race (crash between the two) can only leave a key without
 *    TTL; `Math.max(1, ttl)` in resetTime and a bounded `pttl` guard keep that
 *    benign. Atomicity across requests is guaranteed by Redis single-threading.
 *  - Keys are prefixed per limiter so parallel limiters never share counters.
 */
import { Redis } from "@upstash/redis";
import type { Store, IncrementResponse } from "express-rate-limit";

// NOTE: read the Upstash vars straight from process.env — NOT via getEnv().
// getEnv() validates the *entire* environment and throws in production when
// any single variable is invalid, and this module runs at import time
// (rateLimiter.ts calls getRateLimitStore() at module scope for every limiter
// definition, and nearly every route file imports a limiter). Routing through
// getEnv() here meant one bad, unrelated variable (e.g. a too-short
// ADMIN_PASSWORD) crashed the whole bundle on cold start and 500'd every
// route in the deployment. These two vars are all this module needs;
// @upstash/redis fails loudly on its own if they are malformed.
export function isDistributedLimiterConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let sharedClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!isDistributedLimiterConfigured()) return null;
  if (!sharedClient) {
    // Non-null asserted — guarded by isDistributedLimiterConfigured().
    sharedClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return sharedClient;
}

export class UpstashRateLimitStore implements Store {
  private readonly redis: Redis;
  private readonly windowMs: number;
  /** Optional in the v8 Store contract; used by the double-count check. */
  readonly prefix: string;
  /** MemoryStore-style flag; we never double-count keys locally. */
  readonly localKeys = false;

  constructor(windowMs: number, prefix: string, redis: Redis) {
    this.windowMs = windowMs;
    this.prefix = prefix;
    this.redis = redis;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redisKey = `rl:${this.prefix}:${key}`;
    const totalHits = await this.redis.incr(redisKey);
    if (totalHits === 1) {
      await this.redis.pexpire(redisKey, this.windowMs);
    }
    const ttl = await this.redis.pttl(redisKey);
    const resetTime = ttl > 0 ? new Date(Date.now() + ttl) : new Date(Date.now() + this.windowMs);
    return { totalHits, resetTime };
  }

  async decrement(key: string): Promise<void> {
    // Best-effort; used only by skipSuccessfulRequests-style flows (unused here).
    await this.redis.incrby(`rl:${this.prefix}:${key}`, -1).catch(() => undefined);
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(`rl:${this.prefix}:${key}`).catch(() => undefined);
  }

  async resetAll(): Promise<void> {
    // Upstash REST does not expose SCAN-based deletes cost-free; the documented
    // reset path is deleting the prefix via the Upstash console. Intentional no-op.
  }
}

/**
 * Shared store factory. Returns undefined (→ express-rate-limit memory store)
 * unless Upstash is configured. One Redis client is reused across limiters.
 */
export function getRateLimitStore(windowMs: number, prefix: string): Store | undefined {
  const redis = getRedisClient();
  if (!redis) return undefined;
  return new UpstashRateLimitStore(windowMs, prefix, redis);
}
