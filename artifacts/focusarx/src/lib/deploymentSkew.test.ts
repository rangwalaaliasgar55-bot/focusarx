import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regression guard for the "skew banner that no refresh can clear" incident.
 *
 * The old `recordServerVersion` compared raw strings and latched the
 * mismatch flag forever: dev sentinels (`dev-local` vs `dev-<pid>`) and the
 * backend's per-instance versions raised a permanent "Update available"
 * banner, pinned polling to every 30s, and every refresh landed back on the
 * same banner. These tests pin the quiet-when-unverifiable + self-resolving
 * behaviour. The fast-poll cap and sequenced refresh live inside the React
 * hook and are covered by code review, not unit tests.
 */

async function fresh(frontendVersion?: string) {
  vi.resetModules();
  if (frontendVersion === undefined) {
    vi.stubEnv("VITE_DEPLOYMENT_VERSION", "");
  } else {
    vi.stubEnv("VITE_DEPLOYMENT_VERSION", frontendVersion);
  }
  return import("./deploymentSkew");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("isUnverifiableVersion", () => {
  it("flags dev sentinels, blanks and the backend sentinel", async () => {
    const { isUnverifiableVersion } = await fresh("front-1");
    expect(isUnverifiableVersion(null)).toBe(true);
    expect(isUnverifiableVersion(undefined)).toBe(true);
    expect(isUnverifiableVersion("")).toBe(true);
    expect(isUnverifiableVersion("dev-local")).toBe(true);
    expect(isUnverifiableVersion("dev-12345")).toBe(true);
    expect(isUnverifiableVersion("unverifiable")).toBe(true);
    expect(isUnverifiableVersion("UNVERIFIABLE")).toBe(true);
  });

  it("accepts real deployment ids", async () => {
    const { isUnverifiableVersion } = await fresh("front-1");
    expect(isUnverifiableVersion("dpl_7Gw5ZMBpQA8h9GF832KGp7nwbuh3")).toBe(false);
    expect(isUnverifiableVersion("efe5fe568afb")).toBe(false);
    expect(isUnverifiableVersion("release-42")).toBe(false);
  });
});

describe("recordServerVersion — quiet when skew cannot be judged", () => {
  it("ignores dev-sentinel server versions", async () => {
    const mod = await fresh("front-1");
    mod.recordServerVersion("dev-99");
    expect(mod.hasMismatch()).toBe(false);
    mod.recordServerVersion("unverifiable");
    expect(mod.hasMismatch()).toBe(false);
  });

  it("stays quiet when the frontend itself is a dev build", async () => {
    const mod = await fresh("");
    expect(mod.isUnverifiableVersion("dev-local")).toBe(true);
    mod.recordServerVersion("dpl_live123");
    expect(mod.hasMismatch()).toBe(false);
  });
});

describe("recordServerVersion — real skew still flags and resolves", () => {
  it("flags a verifiable mismatch", async () => {
    const mod = await fresh("front-1");
    mod.recordServerVersion("server-2");
    expect(mod.hasMismatch()).toBe(true);
    expect(mod.getServerVersion()).toBe("server-2");
  });

  it("clears the flag when versions agree again (no refresh needed)", async () => {
    const mod = await fresh("front-1");
    mod.recordServerVersion("server-2");
    expect(mod.hasMismatch()).toBe(true);
    mod.recordServerVersion("front-1");
    expect(mod.hasMismatch()).toBe(false);
  });

  it("matching versions from the start never flag", async () => {
    const mod = await fresh("front-1");
    mod.recordServerVersion("front-1");
    expect(mod.hasMismatch()).toBe(false);
  });
});
