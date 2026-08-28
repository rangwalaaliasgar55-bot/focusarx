import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the 2026-08-28 production outage. ADMIN_PASSWORD was
 * 13 chars while lib/env.ts demanded 16+, getEnv() threw in production, and
 * rateLimiter.ts built its limiters at module scope via getRateLimitStore() →
 * getEnv() — so the throw happened at *import* time, crashing the serverless
 * bundle on cold start and 500-ing every route (including ones that never
 * touch the admin password).
 *
 * Post-fix contract:
 *  1. rateLimitStore reads its two Upstash vars from process.env, so importing
 *     the rate limiter can never throw on an unrelated env failure.
 *  2. getEnv() itself never throws either — it drops the invalid key and keeps
 *     every valid one, so one bad variable degrades that one feature instead
 *     of the whole API. Required-in-production gaps surface as 503
 *     CONFIG_ERROR via getConfigErrors(), naming the variable.
 *  3. Both real-world password shapes ("--aliasgar134", 13 chars, and a
 *     dash-less "aliasgar134", 10 chars) parse as valid.
 */

const ORIGINAL_ENV = { ...process.env };

describe("rate limiter module-load blast radius", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = "production";
    process.env.ADMIN_PASSWORD = "short"; // 5 chars — schema-invalid
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("getEnv() recovers in production instead of throwing: drops the bad key, keeps the rest", async () => {
    const envModule = await import("./env");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = envModule.getEnv();
    // The invalid key is dropped rather than failing the whole parse…
    expect(parsed.ADMIN_PASSWORD).toBeUndefined();
    // …while everything else survives.
    expect(parsed.NODE_ENV).toBe("production");
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining("Ignoring invalid ADMIN_PASSWORD"));
    consoleWarn.mockRestore();
  });

  it("a scrubbed ADMIN_PASSWORD is reported by getConfigErrors as a clean, named gap", async () => {
    const { getConfigErrors } = await import("./config");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getConfigErrors()).toContain("ADMIN_PASSWORD");
    consoleWarn.mockRestore();
  });

  it("importing the rate limiter does not throw on an unrelated invalid env var", async () => {
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

  it("accepts the real-world admin password shapes (13 chars with dashes, 10 without)", async () => {
    for (const value of ["--aliasgar134", "aliasgar134"]) {
      vi.resetModules();
      process.env = { ...ORIGINAL_ENV };
      process.env.NODE_ENV = "production";
      process.env.ADMIN_PASSWORD = value;
      // eslint-disable-next-line no-await-in-loop
      const fresh = await import("./env");
      expect(fresh.getEnv().ADMIN_PASSWORD).toBe(value);
    }
  });
});
