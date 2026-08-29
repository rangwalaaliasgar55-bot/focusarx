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

/**
 * Reads `process.env` directly — deliberately NOT `getEnv()` from lib/env.
 *
 * `getRateLimitStore()` is called eight times at module-evaluation time from
 * `lib/rateLimiter.ts`. Routing that through the validated env accessor made
 * the whole serverless bundle depend on env validation succeeding before it
 * could even be imported: one malformed variable crashed the module and Vercel
 * answered every request with HTTP 500.
 *
 * These two variables are only ever used together and only when both are
 * present, so no schema validation is needed here — a missing or malformed
 * pair simply means "no distributed store", which is a supported configuration.
 */
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
