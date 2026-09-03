import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression guard for the "skew protection does nothing but break things"
 * incident.
 *
 * The old `isDeploymentCompatible` compared the client version against ONE
 * primary value whose last-resort fallback was `dev-${process.pid}` — a
 * different value on every serverless instance. Any production deployment
 * without a stable identifier therefore 409'd every mutation forever while
 * the frontend banner (which no refresh could clear) screamed about an
 * "update". These tests pin the fail-open replacement:
 *   - every stable id a deployment is known by is accepted (build-time and
 *     runtime contexts don't always see the same variables);
 *   - abbreviated SHAs match (build `git rev-parse --short` vs runtime slice);
 *   - with NO stable id the guard admits it and lets traffic through.
 *
 * Real environment (stubbed per test) — no mocks, so reset modules every
 * time: both the version cache and getEnv() memoize per module instance.
 */

const FULL_SHA = "efe5fe568afb3c998ad7d293ef5ad05958a3f0bd";

async function fresh() {
  vi.resetModules();
  return import("./deploymentVersion");
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");
  vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
  vi.stubEnv("DEPLOYMENT_VERSION", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getKnownDeploymentIds", () => {
  it("collects every stable identifier, ignoring blanks", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_live123");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", FULL_SHA);
    const { getKnownDeploymentIds } = await fresh();
    expect(getKnownDeploymentIds().sort()).toEqual(["dpl_live123", FULL_SHA.slice(0, 12)].sort());
  });

  it("accepts an explicit DEPLOYMENT_VERSION override", async () => {
    vi.stubEnv("DEPLOYMENT_VERSION", "release-42");
    const { getKnownDeploymentIds } = await fresh();
    expect(getKnownDeploymentIds()).toEqual(["release-42"]);
  });

  it("is empty when nothing stable is configured", async () => {
    const { getKnownDeploymentIds } = await fresh();
    expect(getKnownDeploymentIds()).toEqual([]);
  });
});

describe("isDeploymentCompatible — stable deployments stay strict", () => {
  it("accepts the primary deployment id", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_live123");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", FULL_SHA);
    const { isDeploymentCompatible } = await fresh();
    expect(isDeploymentCompatible("dpl_live123")).toBe(true);
  });

  it("accepts the commit SHA even when the deployment id is primary", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_live123");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", FULL_SHA);
    const { isDeploymentCompatible } = await fresh();
    expect(isDeploymentCompatible(FULL_SHA.slice(0, 12))).toBe(true);
  });

  it("accepts a build-time abbreviated SHA (git rev-parse --short)", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", FULL_SHA);
    const { isDeploymentCompatible } = await fresh();
    expect(isDeploymentCompatible(FULL_SHA.slice(0, 7))).toBe(true);
  });

  it("still rejects a genuinely different deployment", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_live123");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", FULL_SHA);
    const { isDeploymentCompatible } = await fresh();
    expect(isDeploymentCompatible("dpl_other456")).toBe(false);
    expect(isDeploymentCompatible("deadbee1234")).toBe(false);
  });

  it("still accepts legacy clients that send no version", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_live123");
    const { isDeploymentCompatible } = await fresh();
    expect(isDeploymentCompatible(null)).toBe(true);
    expect(isDeploymentCompatible(undefined)).toBe(true);
    expect(isDeploymentCompatible("")).toBe(true);
  });

  it("never judges dev-sentinel clients as skewed", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_live123");
    const { isDeploymentCompatible } = await fresh();
    expect(isDeploymentCompatible("dev-local")).toBe(true);
    expect(isDeploymentCompatible("dev-12345")).toBe(true);
  });
});

describe("isDeploymentCompatible — fail open without a stable id", () => {
  it("lets traffic through instead of 409ing the whole product", async () => {
    const { isDeploymentCompatible, getKnownDeploymentIds } = await fresh();
    expect(getKnownDeploymentIds()).toEqual([]);
    expect(isDeploymentCompatible("anything-at-all")).toBe(true);
  });

  it("answers a fixed sentinel every instance agrees on", async () => {
    const { getDeploymentVersion, UNVERIFIABLE_DEPLOYMENT_VERSION } = await fresh();
    expect(getDeploymentVersion()).toBe(UNVERIFIABLE_DEPLOYMENT_VERSION);
    expect(getDeploymentVersion()).toBe(getDeploymentVersion());
  });

  it("reports skew protection as unavailable", async () => {
    const { isSkewProtectionAvailable } = await fresh();
    expect(isSkewProtectionAvailable()).toBe(false);
  });
});

describe("isSkewProtectionAvailable — healthy deployments", () => {
  it("is available when any stable id exists", async () => {
    vi.stubEnv("DEPLOYMENT_VERSION", "release-42");
    const { isSkewProtectionAvailable } = await fresh();
    expect(isSkewProtectionAvailable()).toBe(true);
  });
});
