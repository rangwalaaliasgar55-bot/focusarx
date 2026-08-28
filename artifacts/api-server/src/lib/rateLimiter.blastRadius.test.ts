import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test for the 2026-08-28 production outage: ADMIN_PASSWORD was set
 * to a 13-char value while lib/env.ts demanded 16+, getEnv() threw in
 * production, and because rateLimiter.ts builds its limiters at module scope
 * through getRateLimitStore() → getEnv(), the throw happened at *import*
 * time — crashing the serverless bundle on cold start and 500-ing every route
 * (including ones that never touch the admin password).
 *
 * rateLimitStore now reads its two Upstash vars straight from process.env, so
 * no unrelated environment failure can take down module loading again, while
 * getEnv() itself still fails fast at the point of use.
 */

const ORIGINAL_ENV = { ...process.env };

describe("rate limiter module-load blast radius", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = "production";
    process.env.ADMIN_PASSWORD = "too-short"; // 9 chars — schema-invalid
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("getEnv() itself still fails fast in production on an invalid ADMIN_PASSWORD", async () => {
    const envModule = await import("./env");
    expect(() => envModule.getEnv()).toThrow(/ADMIN_PASSWORD/);
  });

  it("importing the rate limiter no longer throws on an unrelated invalid env var", async () => {
    await expect(import("./rateLimiter")).resolves.toBeTruthy();
  });

  it("falls back to the in-memory store (undefined) when Upstash is not configured", async () => {
    const { getRateLimitStore } = await import("./rateLimitStore");
    expect(getRateLimitStore(60_000, "test")).toBeUndefined();
  });

  it("uses the Upstash store when both Upstash vars are configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const { getRateLimitStore } = await import("./rateLimitStore");
    expect(getRateLimitStore(60_000, "test")).toBeDefined();
  });
});
