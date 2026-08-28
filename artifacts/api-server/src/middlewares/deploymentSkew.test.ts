/**
 * Tests for the deployment skew protection system.
 *
 * Validates:
 * - Matching versions pass through
 * - Mismatched versions block mutations
 * - GET requests always pass through
 * - Exempt paths (health, admin) always pass through
 * - Local development mode always passes
 * - Missing client version is treated as compatible (backward compat)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock environment before importing the module
vi.mock("../lib/env", () => ({
  getEnv: () => ({
    NODE_ENV: "production",
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_DEPLOYMENT_ID: "dpl_test123",
    VERCEL_GIT_COMMIT_SHA: "abc123def456",
    VERCEL_URL: "focusarx.vercel.app",
  }),
}));

// Reset cached version between tests
beforeEach(() => {
  vi.resetModules();
});

describe("deploymentVersion", () => {
  it("uses VERCEL_DEPLOYMENT_ID when available", async () => {
    const { getDeploymentVersion } = await import("../lib/deploymentVersion");
    const version = getDeploymentVersion();
    expect(version).toBe("dpl_test123");
  });

  it("isDeploymentCompatible returns true for matching versions", async () => {
    const { isDeploymentCompatible, getDeploymentVersion } = await import("../lib/deploymentVersion");
    expect(isDeploymentCompatible(getDeploymentVersion())).toBe(true);
  });

  it("isDeploymentCompatible returns false for mismatched versions", async () => {
    const { isDeploymentCompatible } = await import("../lib/deploymentVersion");
    expect(isDeploymentCompatible("old-deployment-xyz")).toBe(false);
  });

  it("isDeploymentCompatible returns true for null/undefined (legacy client)", async () => {
    const { isDeploymentCompatible } = await import("../lib/deploymentVersion");
    expect(isDeploymentCompatible(null)).toBe(true);
    expect(isDeploymentCompatible(undefined)).toBe(true);
  });
});

describe("deploymentSkewGuard middleware", () => {
  let deploymentSkewGuard: any;
  let deploymentVersionHeaders: any;
  let DEPLOYMENT_HEADER: string;

  beforeEach(async () => {
    const mod = await import("./deploymentSkew");
    deploymentSkewGuard = mod.deploymentSkewGuard;
    deploymentVersionHeaders = mod.deploymentVersionHeaders;
    DEPLOYMENT_HEADER = mod.DEPLOYMENT_HEADER;
    // Force production mode
    process.env.NODE_ENV = "production";
    process.env.VERCEL = "1";
  });

  afterEach(() => {
    delete process.env.VERCEL;
  });

  function createMockReq(overrides: Record<string, any> = {}) {
    return {
      method: "POST",
      path: "/sessions/complete",
      headers: {},
      ...overrides,
    } as any;
  }

  function createMockRes() {
    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(key: string, value: string) { this.headers[key] = value; },
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; return this; },
    };
    return res;
  }

  it("attaches deployment version header to responses", () => {
    const req = createMockReq();
    const res = createMockRes();
    let nextCalled = false;
    deploymentVersionHeaders(req, res, () => { nextCalled = true; });

    expect(res.headers[DEPLOYMENT_HEADER]).toBeTruthy();
    expect(nextCalled).toBe(true);
  });

  it("allows GET requests even with version mismatch", () => {
    const req = createMockReq({
      method: "GET",
      path: "/tasks",
      headers: { [DEPLOYMENT_HEADER.toLowerCase()]: "wrong-version" },
    });
    const res = createMockRes();
    let nextCalled = false;
    deploymentSkewGuard(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it("blocks POST requests with version mismatch", () => {
    const req = createMockReq({
      method: "POST",
      path: "/sessions/complete",
      headers: { [DEPLOYMENT_HEADER.toLowerCase()]: "wrong-version" },
    });
    const res = createMockRes();
    let nextCalled = false;
    deploymentSkewGuard(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("DEPLOYMENT_SKEW");
  });

  it("allows mutations when versions match", async () => {
    const { getDeploymentVersion } = await import("../lib/deploymentVersion");
    const req = createMockReq({
      method: "POST",
      path: "/sessions/complete",
      headers: { [DEPLOYMENT_HEADER.toLowerCase()]: getDeploymentVersion() },
    });
    const res = createMockRes();
    let nextCalled = false;
    deploymentSkewGuard(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it("allows mutations when client sends no version (backward compat)", () => {
    const req = createMockReq({
      method: "POST",
      path: "/sessions/complete",
      headers: {},
    });
    const res = createMockRes();
    let nextCalled = false;
    deploymentSkewGuard(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it("always allows exempt paths (health, admin)", () => {
    const req = createMockReq({
      method: "POST",
      path: "/admin/drop",
      headers: { [DEPLOYMENT_HEADER.toLowerCase()]: "wrong-version" },
    });
    const res = createMockRes();
    let nextCalled = false;
    deploymentSkewGuard(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });

  it("never blocks mutations in local development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL;

    const req = createMockReq({
      method: "POST",
      path: "/sessions/complete",
      headers: { [DEPLOYMENT_HEADER.toLowerCase()]: "wrong-version" },
    });
    const res = createMockRes();
    let nextCalled = false;
    deploymentSkewGuard(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
  });
});
