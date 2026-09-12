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

// ─── Version comparison ──────────────────────────────────────────────────────
//
// The second half of the "have to keep reloading" incident: the frontend and the
// backend disagreed about what "same deployment" means, so a single deploy was
// reported as a permanent mismatch. The backend accepted any of the deployment's
// known ids and an abbreviated-SHA prefix; the client compared one string for
// equality. These tests pin the client to the backend's rule.

describe("isVersionCompatible — mirrors the backend rule", () => {
  it("accepts an exact match", async () => {
    const { isVersionCompatible } = await fresh("dpl_9xQ2mNbVrT7yKpL");
    expect(isVersionCompatible("dpl_9xQ2mNbVrT7yKpL", ["dpl_9xQ2mNbVrT7yKpL"])).toBe(true);
  });

  it("accepts the build's git SHA when the runtime reports a deployment id", async () => {
    // vite.config.ts bakes VERCEL_DEPLOYMENT_ID → commit SHA → `git rev-parse
    // --short HEAD`. The runtime often has a *different* one of those three for
    // the same deploy, which strict equality called a mismatch.
    const { isVersionCompatible } = await fresh("a1b2c3d");
    expect(
      isVersionCompatible("a1b2c3d", ["dpl_9xQ2mNbVrT7yKpL", "a1b2c3d4e5f6", "a1b2c3d"]),
    ).toBe(true);
  });

  it("accepts an abbreviated SHA as a prefix of a longer runtime SHA", async () => {
    const { isVersionCompatible } = await fresh("efe5fe5");
    expect(isVersionCompatible("efe5fe5", ["efe5fe568afb"])).toBe(true);
  });

  it("accepts the reverse direction too (long build SHA, short server SHA)", async () => {
    const { isVersionCompatible } = await fresh("efe5fe568afb1234");
    expect(isVersionCompatible("efe5fe568afb1234", ["efe5fe5"])).toBe(true);
  });

  it("fails open when the server knows no stable id", async () => {
    const { isVersionCompatible } = await fresh("front-1");
    expect(isVersionCompatible("front-1", [])).toBe(true);
    expect(isVersionCompatible("front-1", [null, undefined, "", "  "])).toBe(true);
    expect(isVersionCompatible("front-1", null)).toBe(true);
  });

  it("treats a dev or unverifiable build as compatible", async () => {
    const { isVersionCompatible } = await fresh("");
    expect(isVersionCompatible("", ["dpl_1"])).toBe(true);
    expect(isVersionCompatible("dev-local", ["dpl_1"])).toBe(true);
    expect(isVersionCompatible("unverifiable", ["dpl_1"])).toBe(true);
    expect(isVersionCompatible("front-1", ["dev-99"])).toBe(true);
  });

  it("still rejects a genuinely different deployment", async () => {
    const { isVersionCompatible } = await fresh("a1b2c3d");
    expect(isVersionCompatible("a1b2c3d", ["dpl_9xQ2mNbVrT7yKpL", "f00ba12"])).toBe(false);
    expect(isVersionCompatible("release-41", ["release-42"])).toBe(false);
  });

  it("does not treat unrelated hex strings as prefix matches", async () => {
    const { isVersionCompatible } = await fresh("a1b2c3d");
    // "a1b2c3d" is not a prefix of "d1b2c3d" — a coincidental SHA-looking id
    // from a different commit must not be waved through.
    expect(isVersionCompatible("a1b2c3d", ["d1b2c3d4e5f6"])).toBe(false);
  });
});

describe("recordServerVersion with knownIds", () => {
  it("does not flag a mismatch when the build SHA is one of the server's ids", async () => {
    const mod = await fresh("a1b2c3d");
    mod.recordServerVersion("dpl_9xQ2mNbVrT7yKpL", ["dpl_9xQ2mNbVrT7yKpL", "a1b2c3d4e5f6"]);
    expect(mod.hasMismatch()).toBe(false);
    expect(mod.getServerKnownIds()).toEqual(["dpl_9xQ2mNbVrT7yKpL", "a1b2c3d4e5f6"]);
  });

  it("flags a mismatch when no known id matches the build", async () => {
    const mod = await fresh("a1b2c3d");
    mod.recordServerVersion("dpl_9xQ2mNbVrT7yKpL", ["dpl_9xQ2mNbVrT7yKpL", "f00ba1234567"]);
    expect(mod.hasMismatch()).toBe(true);
  });

  it("clears a flagged mismatch once the real deploy arrives", async () => {
    const mod = await fresh("a1b2c3d");
    mod.recordServerVersion("dpl_other", ["dpl_other"]);
    expect(mod.hasMismatch()).toBe(true);
    mod.recordServerVersion("dpl_mine", ["dpl_mine", "a1b2c3d"]);
    expect(mod.hasMismatch()).toBe(false);
  });

  it("a header-only observation never erases the richer known-id set", async () => {
    const mod = await fresh("a1b2c3d");
    mod.recordServerVersion("dpl_mine", ["dpl_mine", "a1b2c3d"]);
    // checkDeployment records the response header separately, without a body.
    mod.recordServerVersion("dpl_mine");
    expect(mod.getServerKnownIds()).toEqual(["dpl_mine", "a1b2c3d"]);
    expect(mod.hasMismatch()).toBe(false);
  });
});

// ─── Refresh guard ───────────────────────────────────────────────────────────
//
// "Update now" used to reload the page on its own counter, with no cache purge,
// so the reload came back stale and the banner reappeared — an infinite refresh
// loop with a growing `?_v=<ts>&_skew=1` URL. It now delegates to the shared
// coordinator and must stand down when the coordinator refuses.

type CoordinatorMocks = {
  requestCoordinatedReload: ReturnType<typeof vi.fn>;
  reloadsRemaining: ReturnType<typeof vi.fn>;
  purgeCaches: ReturnType<typeof vi.fn>;
  noteBoot: ReturnType<typeof vi.fn>;
  cleanReloadParams: ReturnType<typeof vi.fn>;
};

async function freshWithCoordinator(frontendVersion: string, remaining = 3) {
  vi.resetModules();
  vi.stubEnv("VITE_DEPLOYMENT_VERSION", frontendVersion);

  const mocks: CoordinatorMocks = {
    requestCoordinatedReload: vi.fn(() => true),
    reloadsRemaining: vi.fn(() => remaining),
    purgeCaches: vi.fn(async () => undefined),
    noteBoot: vi.fn(() => ({ reloaded: false, reason: null, buildChanged: false, wasted: 0, remaining: 3 })),
    cleanReloadParams: vi.fn(() => false),
  };

  vi.doMock("./reloadCoordinator", () => mocks);
  const mod = await import("./deploymentSkew");
  return { mod, mocks };
}

describe("safeRefresh — one coordinated reload, guarded", () => {
  afterEach(() => {
    vi.doUnmock("./reloadCoordinator");
    document.body.innerHTML = "";
  });

  it("routes the refresh through the reload coordinator", async () => {
    const { mod, mocks } = await freshWithCoordinator("build-1");
    expect(mod.safeRefresh()).toBe(true);
    expect(mocks.requestCoordinatedReload).toHaveBeenCalledTimes(1);
    expect(mocks.requestCoordinatedReload.mock.calls[0][0]).toMatchObject({
      reason: "deployment-skew",
      fromVersion: "build-1",
      cacheBust: true,
    });
  });

  it("stands down and tells the UI when the reload budget is spent", async () => {
    const { mod, mocks } = await freshWithCoordinator("build-1", 0);
    expect(mod.safeRefresh()).toBe(false);
    expect(mocks.requestCoordinatedReload).not.toHaveBeenCalled();
    expect(mod.useDeploymentSkew).toBeTypeOf("function");
  });

  it("stands down when the coordinator refuses the reload", async () => {
    const { mod, mocks } = await freshWithCoordinator("build-1");
    mocks.requestCoordinatedReload.mockReturnValueOnce(false);
    mocks.reloadsRemaining.mockReturnValueOnce(2).mockReturnValueOnce(0);

    expect(mod.safeRefresh()).toBe(false);
    // The guard is released so a later, permitted reload can still happen.
    expect(mod.safeRefresh()).toBe(true);
  });

  it("defers instead of reloading while the user is typing", async () => {
    const { mod, mocks } = await freshWithCoordinator("build-1");
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    expect(mod.safeRefresh()).toBe(false);
    expect(mocks.requestCoordinatedReload).not.toHaveBeenCalled();

    // Once focus leaves the field the same call succeeds — the deferral did not
    // latch the guard.
    input.blur();
    document.body.innerHTML = "";
    expect(mod.safeRefresh()).toBe(true);
  });

  it("only asks once per page life", async () => {
    const { mod, mocks } = await freshWithCoordinator("build-1");
    expect(mod.safeRefresh()).toBe(true);
    // A second click on "Update now" — or a second skew poll landing in the same
    // tick — must not queue another reload.
    expect(mod.safeRefresh()).toBe(false);
    expect(mocks.requestCoordinatedReload).toHaveBeenCalledTimes(1);

    mod.resetRefreshGuard();
    expect(mod.safeRefresh()).toBe(true);
    expect(mocks.requestCoordinatedReload).toHaveBeenCalledTimes(2);
  });
});
