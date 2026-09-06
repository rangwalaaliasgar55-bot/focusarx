/**
 * Regression tests for the production incident where every /api/* endpoint
 * returned HTTP 500.
 *
 * Two independent defects were responsible, and both are structural rather
 * than incidental — they are the kind of bug that comes back the moment
 * somebody adds a variable or a route:
 *
 *  1. `getEnv()` threw during module evaluation in production. Because it is
 *     reachable at import time, one malformed variable crashed the whole
 *     serverless bundle and Vercel answered 500 for every route.
 *
 *  2. `router.use(authMiddleware)` with no path. A pathless router-level
 *     middleware applies to every request reaching that router, and since the
 *     main router mounts its sub-routers with `router.use(xRouter)` (no mount
 *     path), the auth gate leaked onto every router mounted afterwards —
 *     silently 401-ing /api/deployment, /api/feature-flags and friends.
 */
import { describe, it, expect, afterEach, vi } from "vitest";

const ENV_KEYS = [
  "NODE_ENV",
  "VERCEL",
  "VERCEL_ENV",
  "DATABASE_URL",
  "AUTH_SECRET",
  "SESSION_SECRET",
  "ADMIN_PASSWORD",
  "CRON_SECRET",
  "APP_URL",
  "PORT",
  "SMTP_PORT",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

let savedEnv: Record<string, string | undefined> = {};

/** Replace the whole environment for one scenario. */
function setEnv(overrides: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) process.env[key] = value;
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  savedEnv = {};
}

/**
 * Import a module with a clean module registry, so its module-level caches
 * (lib/env memoises the parsed environment) are rebuilt for this scenario.
 */
async function fresh<T>(spec: string): Promise<T> {
  vi.resetModules();
  return (await import(spec)) as T;
}

type EnvModule = typeof import("../lib/env");
type RateLimitModule = typeof import("../lib/rateLimitStore");

describe("env: never throws, always reports", () => {
  afterEach(restoreEnv);

  it("does not throw when a secret is too short in production", async () => {
    setEnv({ NODE_ENV: "production", AUTH_SECRET: "too-short" });
    const mod = await fresh<EnvModule>("../lib/env");
    expect(() => mod.getEnv()).not.toThrow();
    const issues = mod.getEnvIssues();
    expect(issues.some((i) => i.key === "AUTH_SECRET")).toBe(true);
    // The offending value must never be echoed back — only names + messages.
    expect(JSON.stringify(issues)).not.toContain("too-short");
  });

  it("does not throw when DATABASE_URL is an empty string", async () => {
    setEnv({ NODE_ENV: "production", DATABASE_URL: "" });
    const mod = await fresh<EnvModule>("../lib/env");
    expect(() => mod.getEnv()).not.toThrow();
    expect(mod.getEnvIssues().some((i) => i.key === "DATABASE_URL")).toBe(true);
  });

  it("keeps production mode when NODE_ENV is an unrecognised value", async () => {
    // A typo must never silently downgrade to development — that would disable
    // secure cookies and JWT verification on a live deployment.
    setEnv({ NODE_ENV: "prod", VERCEL_ENV: "production" });
    const mod = await fresh<EnvModule>("../lib/env");
    expect(mod.getEnv().NODE_ENV).toBe("production");
  });

  it("keeps valid variables when only one is malformed", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db.example.com/neondb",
      AUTH_SECRET: "short",
    });
    const mod = await fresh<EnvModule>("../lib/env");
    // DATABASE_URL survived even though AUTH_SECRET was rejected.
    expect(mod.getDatabaseUrl()).toBe("postgresql://user:pass@db.example.com/neondb");
    expect(mod.getEnvIssues().map((i) => i.key)).toEqual(["AUTH_SECRET"]);
  });

  it("returns a usable object when the entire environment is malformed", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "",
      AUTH_SECRET: "",
      ADMIN_PASSWORD: "x",
      PORT: "not-a-number",
    });
    const mod = await fresh<EnvModule>("../lib/env");
    const env = mod.getEnv();
    expect(env).toBeTypeOf("object");
    expect(env.NODE_ENV).toBe("production");
    expect(mod.getEnvIssues().length).toBeGreaterThan(0);
  });

  it("validateProductionEnv reports problems instead of throwing", async () => {
    setEnv({ NODE_ENV: "production" });
    const mod = await fresh<EnvModule>("../lib/env");
    const problems = mod.validateProductionEnv();
    expect(Array.isArray(problems)).toBe(true);
    expect(problems).toContain("DATABASE_URL (or POSTGRES_URL_NON_POOLING) is not set");
    expect(problems).toContain("AUTH_SECRET (min 32 chars) is not set");
  });

  it("validateProductionEnv returns an empty list for a complete environment", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db.example.com/neondb",
      AUTH_SECRET: "x".repeat(48),
      ADMIN_PASSWORD: "a-very-long-admin-password-123",
      APP_URL: "https://focusarx.example.com",
    });
    const mod = await fresh<EnvModule>("../lib/env");
    expect(mod.validateProductionEnv()).toEqual([]);
  });

  it("is a no-op outside production", async () => {
    setEnv({ NODE_ENV: "development" });
    const mod = await fresh<EnvModule>("../lib/env");
    expect(mod.validateProductionEnv()).toEqual([]);
  });
});

describe("env: weak-but-usable values warn instead of disabling the feature", () => {
  afterEach(restoreEnv);

  /**
   * Regression guard for a self-inflicted lockout. The production admin
   * password is 13 characters. With a 16-character hard floor, `getEnv()`
   * would not crash — it would drop the key, silently disabling admin login
   * while every health check still reported green.
   */
  it("accepts a 13-character ADMIN_PASSWORD rather than dropping it", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db.example.com/neondb",
      AUTH_SECRET: "x".repeat(48),
      APP_URL: "https://focusarx.example.com",
      ADMIN_PASSWORD: "--aliasgar134", // 13 chars — the real production value
    });
    const mod = await fresh<EnvModule>("../lib/env");
    expect(mod.getEnv().ADMIN_PASSWORD).toBe("--aliasgar134");
  });

  it("records a weak password as a warning, not an error", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db.example.com/neondb",
      AUTH_SECRET: "x".repeat(48),
      APP_URL: "https://focusarx.example.com",
      ADMIN_PASSWORD: "--aliasgar134",
    });
    const mod = await fresh<EnvModule>("../lib/env");
    const advisory = mod.getEnvIssues().find((i) => i.key === "ADMIN_PASSWORD");
    expect(advisory).toBeDefined();
    expect(advisory?.severity).toBe("warning");
    expect(mod.getEnvErrors()).toEqual([]);
  });

  it("still rejects a genuinely unusable password (under 8 chars)", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db.example.com/neondb",
      AUTH_SECRET: "x".repeat(48),
      APP_URL: "https://focusarx.example.com",
      ADMIN_PASSWORD: "short", // 5 chars
    });
    const mod = await fresh<EnvModule>("../lib/env");
    expect(mod.getEnv().ADMIN_PASSWORD).toBeUndefined();
    expect(mod.getEnvErrors().some((i) => i.key === "ADMIN_PASSWORD")).toBe(true);
  });

  it("a weak password never makes the config gate report an error", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db.example.com/neondb",
      AUTH_SECRET: "x".repeat(48),
      APP_URL: "https://focusarx.example.com",
      ADMIN_PASSWORD: "--aliasgar134",
    });
    await fresh<EnvModule>("../lib/env");
    const config = await fresh<typeof import("../lib/config")>("../lib/config");
    expect(config.getConfigStatus().ok).toBe(true);
    expect(config.getConfigErrors()).toEqual([]);
  });
});

describe("config: gate reports safe, actionable errors", () => {
  afterEach(restoreEnv);

  it("never includes secret values in the reported errors", async () => {
    setEnv({
      NODE_ENV: "production",
      AUTH_SECRET: "short",
      ADMIN_PASSWORD: "hunter2-short",
      DATABASE_URL: "postgresql://user:supersecretpassword@db.example.com/neondb",
    });
    const envMod = await fresh<EnvModule>("../lib/env");
    const problems = [
      ...envMod.validateProductionEnv(),
      ...envMod.getEnvIssues().map((i) => `${i.key}: ${i.message}`),
    ];
    const blob = problems.join(" ");
    expect(blob).not.toContain("supersecretpassword");
    expect(blob).not.toContain("hunter2");
  });

  it("reports ok:false with named errors when configuration is missing", async () => {
    setEnv({ NODE_ENV: "production" });
    await fresh<EnvModule>("../lib/env");
    const config = await fresh<typeof import("../lib/config")>("../lib/config");
    const status = config.getConfigStatus();
    expect(status.ok).toBe(false);
    expect(status.database).toBe(false);
    expect(status.authSecret).toBe(false);
    expect(status.errors.length).toBeGreaterThan(0);
    // Every entry must name a variable — never a value, host or DSN.
    for (const entry of status.errors) {
      expect(entry).not.toContain("postgresql://");
    }
  });

  it("reports ok:true for a complete environment", async () => {
    setEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@db.example.com/neondb",
      AUTH_SECRET: "x".repeat(48),
      ADMIN_PASSWORD: "a-very-long-admin-password-123",
      APP_URL: "https://focusarx.example.com",
    });
    await fresh<EnvModule>("../lib/env");
    const config = await fresh<typeof import("../lib/config")>("../lib/config");
    const status = config.getConfigStatus();
    expect(status.ok).toBe(true);
    expect(status.database).toBe(true);
    expect(status.errors).toEqual([]);
  });
});

describe("rateLimitStore: does not touch the validated env at import", () => {
  afterEach(restoreEnv);

  it("imports cleanly with a malformed environment", async () => {
    // This is the exact import that crashed the serverless bundle: importing
    // the limiter with a bad AUTH_SECRET must not throw.
    setEnv({ NODE_ENV: "production", AUTH_SECRET: "nope" });
    await expect(fresh("../lib/rateLimiter")).resolves.toBeDefined();
  });

  it("returns undefined (memory store) when Upstash is not configured", async () => {
    setEnv({ NODE_ENV: "production" });
    const mod = await fresh<RateLimitModule>("../lib/rateLimitStore");
    expect(mod.isDistributedLimiterConfigured()).toBe(false);
    expect(mod.getRateLimitStore(1000, "test")).toBeUndefined();
  });

  it("uses the distributed store when Upstash is configured", async () => {
    setEnv({
      NODE_ENV: "production",
      AUTH_SECRET: "short", // still malformed — must not matter here
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    });
    const mod = await fresh<RateLimitModule>("../lib/rateLimitStore");
    expect(mod.isDistributedLimiterConfigured()).toBe(true);
    expect(mod.getRateLimitStore(1000, "test")).toBeDefined();
  });
});
