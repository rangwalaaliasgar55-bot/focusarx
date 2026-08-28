import { describe, expect, it, vi } from "vitest";
import { UpstashRateLimitStore } from "./rateLimitStore";

/**
 * Unit tests with a scripted in-memory Redis double — verifies the fixed-window
 * counter semantics without network access (Upstash REST is exercised only in
 * deployments where the env vars are set).
 */
function fakeRedis() {
  const counts = new Map<string, number>();
  const ttls = new Map<string, number>();
  return {
    counts, ttls,
    incr: vi.fn(async (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    }),
    pexpire: vi.fn(async (key: string, ms: number) => {
      ttls.set(key, ms);
      return 1;
    }),
    pttl: vi.fn(async (key: string) => ttls.get(key) ?? -1),
    del: vi.fn(async (key: string) => {
      const had = counts.delete(key);
      ttls.delete(key);
      return had ? 1 : 0;
    }),
    incrby: vi.fn(async (key: string, delta: number) => {
      const next = (counts.get(key) ?? 0) + delta;
      counts.set(key, next);
      return next;
    }),
  };
}

function makeStore() {
  const redis = fakeRedis();
  const store = new UpstashRateLimitStore(60_000, "test", redis as never);
  return { store, redis };
}

describe("UpstashRateLimitStore", () => {
  it("counts hits per key and exposes them", async () => {
    const { store } = makeStore();
    const first = await store.increment("ip:1");
    const second = await store.increment("ip:1");
    const other = await store.increment("ip:2");
    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(other.totalHits).toBe(1);
  });

  it("sets a TTL only when the key is new", async () => {
    const { store, redis } = makeStore();
    await store.increment("ip:1");
    expect(redis.pexpire).toHaveBeenCalledTimes(1);
    await store.increment("ip:1");
    await store.increment("ip:1");
    expect(redis.pexpire).toHaveBeenCalledTimes(1); // not re-armed
  });

  it("arms the TTL with the limiter's window", async () => {
    const { store, redis } = makeStore();
    await store.increment("ip:1");
    expect(redis.pexpire).toHaveBeenCalledWith(expect.stringContaining("rl:test:"), 60_000);
  });

  it("returns a resetTime derived from the remaining TTL", async () => {
    const { store } = makeStore();
    await store.increment("ip:1");
    const response = await store.increment("ip:1");
    expect(response.resetTime).toBeInstanceOf(Date);
    expect(response.resetTime!.getTime()).toBeGreaterThan(Date.now());
  });

  it("resetKey deletes exactly one key", async () => {
    const { store } = makeStore();
    await store.increment("ip:1");
    await store.increment("ip:2");
    await store.resetKey("ip:1");
    const after = await store.increment("ip:1");
    expect(after.totalHits).toBe(1); // restarted
    const untouched = await store.increment("ip:2");
    expect(untouched.totalHits).toBe(2); // preserved
  });

  it("namespaces counters per limiter prefix", async () => {
    const redis = fakeRedis();
    const a = new UpstashRateLimitStore(60_000, "auth", redis as never);
    const b = new UpstashRateLimitStore(60_000, "general", redis as never);
    await a.increment("ip:1");
    const bHits = await b.increment("ip:1");
    expect(bHits.totalHits).toBe(1); // separate key space
  });
});
