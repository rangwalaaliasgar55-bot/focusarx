import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the reload coordinator — the single place allowed to
 * reload the page.
 *
 * The incident these pin down: a stale chunk after a deploy produced *two*
 * reloads from two independent counters, the URL grew `?_v=<ts>&_skew=1` on
 * every one of them, and because neither path cleared the service-worker cache
 * before navigating, each reload came back with the same stale index.html. The
 * user's experience was "I keep having to reload and the feature still will not
 * load".
 *
 * Covered here:
 *   • one reload in flight, one budget, shared across every reason;
 *   • the cross-tab lock, so four open tabs reload once;
 *   • noteBoot reconciliation — a reload that did not change the build is
 *     recorded as wasted and stops the loop;
 *   • cleanReloadParams — cache-busting params never survive boot;
 *   • purgeCaches — the worker is acked and the Cache API emptied *before*
 *     navigation, and a broken worker API must not block the reload.
 */

import {
  __beginNewPageLife,
  __resetReloadCoordinator,
  cleanReloadParams,
  clearCrossTabLock,
  noteBoot,
  purgeCaches,
  RELOAD_PARAMS,
  reloadsRemaining,
  requestCoordinatedReload,
} from "./reloadCoordinator";

// ─── Environment ─────────────────────────────────────────────────────────────

let replaceSpy: ReturnType<typeof vi.fn>;
let realLocation: Location;

function setLocation(href: string) {
  replaceSpy = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { href, replace: replaceSpy, pathname: new URL(href).pathname },
  });
}

/** A minimal CacheStorage + serviceWorker pair we can assert against. */
function installCacheStubs(options?: { ackWorker?: boolean; noRegistration?: boolean }) {
  const deleted: string[] = [];
  const posted: Array<Record<string, unknown>> = [];

  const cachesStub = {
    keys: vi.fn(async () => ["focusarx-sw-v8", "focusarx-sw-v9"]),
    delete: vi.fn(async (key: string) => {
      deleted.push(String(key));
      return true;
    }),
  };

  const active = {
    postMessage: vi.fn((message: Record<string, unknown>) => {
      posted.push(message);
      if (options?.ackWorker !== false) {
        // The real worker replies via the controller; emulate it on a microtask.
        queueMicrotask(() => {
          navigator.serviceWorker.dispatchEvent(
            new MessageEvent("message", { data: { type: "CLEAR_CACHE_DONE" } }),
          );
        });
      }
    }),
  };

  const registration = {
    active,
    waiting: null,
    installing: null,
    update: vi.fn(async () => undefined),
  };

  const serviceWorker = Object.assign(new EventTarget(), {
    getRegistration: vi.fn(async () => (options?.noRegistration ? undefined : registration)),
    controller: active,
  });

  Object.defineProperty(window, "caches", { configurable: true, writable: true, value: cachesStub });
  Object.defineProperty(globalThis, "caches", { configurable: true, writable: true, value: cachesStub });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    writable: true,
    value: serviceWorker,
  });

  return { deleted, posted, cachesStub, registration, active };
}

beforeEach(() => {
  __resetReloadCoordinator();
  sessionStorage.clear();
  localStorage.clear();
  realLocation = window.location;
  setLocation("https://www.focusarx.site/dashboard");
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: realLocation,
  });
  sessionStorage.clear();
  localStorage.clear();
  __resetReloadCoordinator();
});

/** Simulate the next page life: module state fresh, persisted budget intact. */
function newPageLife() {
  __beginNewPageLife();
  clearCrossTabLock();
}

/** Let the coordinator's awaited purge finish and reach location.replace. */
async function flush() {
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// ─── Budget ──────────────────────────────────────────────────────────────────

describe("reload budget", () => {
  it("allows the first reload and records it", async () => {
    installCacheStubs();
    expect(reloadsRemaining()).toBe(3);

    const owned = requestCoordinatedReload({ reason: "stale-chunk", fromVersion: "abc1234" });
    expect(owned).toBe(true);
    await flush();

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(reloadsRemaining()).toBe(2);
  });

  it("stops reloading once the budget is spent, so a stuck build cannot loop", async () => {
    installCacheStubs();

    for (let i = 0; i < 3; i += 1) {
      // Each iteration is a separate page life: clear the in-flight guard the
      // way a reload would and release the lock (noteBoot does this on a real
      // boot), but keep the persisted budget.
      newPageLife();
      expect(requestCoordinatedReload({ reason: "deployment-skew" })).toBe(true);
      await flush();
    }

    newPageLife();
    expect(reloadsRemaining()).toBe(0);
    const navigationsBefore = replaceSpy.mock.calls.length;
    expect(navigationsBefore).toBe(3);
    expect(requestCoordinatedReload({ reason: "deployment-skew" })).toBe(false);
    await flush();
    // The fourth request never navigates.
    expect(replaceSpy.mock.calls.length).toBe(navigationsBefore);
  });

  it("shares one budget between chunk recovery and deployment skew", async () => {
    installCacheStubs();
    __resetReloadCoordinator();
    expect(requestCoordinatedReload({ reason: "stale-chunk" })).toBe(true);
    newPageLife();
    expect(requestCoordinatedReload({ reason: "deployment-skew" })).toBe(true);
    await flush();
    newPageLife();
    expect(requestCoordinatedReload({ reason: "stale-chunk" })).toBe(true);
    await flush();

    newPageLife();
    // Three reloads of any kind is the cap — not three per reason.
    expect(requestCoordinatedReload({ reason: "deployment-skew" })).toBe(false);
  });

  it("refuses a second reload in the same page life", async () => {
    installCacheStubs();
    expect(requestCoordinatedReload({ reason: "stale-chunk" })).toBe(true);
    expect(requestCoordinatedReload({ reason: "deployment-skew" })).toBe(false);
    await flush();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
  });

  it("survives a storage failure (private mode) without throwing", async () => {
    installCacheStubs();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => requestCoordinatedReload({ reason: "stale-chunk" })).not.toThrow();
    await flush();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });
});

// ─── Cross-tab lock ──────────────────────────────────────────────────────────

describe("cross-tab lock", () => {
  it("stands down when a sibling tab is already reloading", async () => {
    installCacheStubs();
    localStorage.setItem("focusarx:reload-lock", String(Date.now()));

    expect(requestCoordinatedReload({ reason: "stale-chunk" })).toBe(false);
    await flush();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("takes the lock so siblings stand down", async () => {
    installCacheStubs();
    expect(requestCoordinatedReload({ reason: "deployment-skew" })).toBe(true);
    const at = Number(localStorage.getItem("focusarx:reload-lock"));
    expect(Number.isFinite(at)).toBe(true);
    expect(Date.now() - at).toBeLessThan(5_000);
    await flush(); // let the navigation land before the location stub is torn down
  });

  it("ignores an expired lock", async () => {
    installCacheStubs();
    localStorage.setItem("focusarx:reload-lock", String(Date.now() - 60_000));
    expect(requestCoordinatedReload({ reason: "stale-chunk" })).toBe(true);
    await flush();
  });
});

// ─── URL construction ────────────────────────────────────────────────────────

describe("reload URL", () => {
  it("adds cache-busting params for a skew reload", async () => {
    installCacheStubs();
    requestCoordinatedReload({ reason: "deployment-skew" });
    await flush();

    const target = new URL(String(replaceSpy.mock.calls[0][0]));
    expect(target.pathname).toBe("/dashboard");
    expect(target.searchParams.has("_v")).toBe(true);
    expect(target.searchParams.get("_skew")).toBe("1");
  });

  it("keeps the user's URL clean for a chunk reload", async () => {
    installCacheStubs();
    requestCoordinatedReload({ reason: "stale-chunk", cacheBust: false });
    await flush();

    expect(String(replaceSpy.mock.calls[0][0])).toBe("https://www.focusarx.site/dashboard");
  });

  it("never stacks params from a previous reload", async () => {
    installCacheStubs();
    setLocation("https://www.focusarx.site/dashboard?_v=111&_skew=1&utm_source=x");
    requestCoordinatedReload({ reason: "deployment-skew" });
    await flush();

    const target = new URL(String(replaceSpy.mock.calls[0][0]));
    expect(target.searchParams.getAll("_v")).toHaveLength(1);
    expect(target.searchParams.getAll("_skew")).toHaveLength(1);
    // Unrelated params are the user's and must survive.
    expect(target.searchParams.get("utm_source")).toBe("x");
  });

  it("declares exactly the params it is responsible for", () => {
    expect([...RELOAD_PARAMS]).toEqual(["_v", "_skew"]);
  });
});

// ─── Boot reconciliation ─────────────────────────────────────────────────────

describe("noteBoot", () => {
  it("reports nothing to reconcile on a clean boot", () => {
    const boot = noteBoot("build-1");
    expect(boot.reloaded).toBe(false);
    expect(boot.buildChanged).toBe(false);
    expect(boot.remaining).toBe(3);
  });

  it("resets the budget when the reload delivered a new build", async () => {
    installCacheStubs();
    requestCoordinatedReload({ reason: "deployment-skew", fromVersion: "build-1" });
    await flush();

    newPageLife(); // new page life
    const boot = noteBoot("build-2");
    expect(boot.reloaded).toBe(true);
    expect(boot.buildChanged).toBe(true);
    expect(boot.remaining).toBe(3);
    expect(reloadsRemaining()).toBe(3);
    // The cross-tab lock is released so siblings can recover later.
    expect(localStorage.getItem("focusarx:reload-lock")).toBeNull();
  });

  it("counts a wasted reload and keeps the budget spent when the build did not change", async () => {
    installCacheStubs();
    requestCoordinatedReload({ reason: "stale-chunk", fromVersion: "build-1", cacheBust: false });
    await flush();

    newPageLife();
    const boot = noteBoot("build-1");
    expect(boot.reloaded).toBe(true);
    expect(boot.buildChanged).toBe(false);
    expect(boot.wasted).toBe(1);
    // Still capped: the reload bought nothing, so we must not repeat it freely.
    expect(reloadsRemaining()).toBe(2);
  });

  it("escalates to a hard stop after repeated wasted reloads", async () => {
    installCacheStubs();
    let boot: ReturnType<typeof noteBoot> | null = null;
    for (let i = 0; i < 3; i += 1) {
      newPageLife();
      requestCoordinatedReload({ reason: "stale-chunk", fromVersion: "build-1", cacheBust: false });
      await flush();
      newPageLife();
      boot = noteBoot("build-1");
    }

    // Three reloads that each came back on the same build: the budget is spent
    // and the wasted count says why, so the loop ends here.
    expect(boot?.wasted).toBe(3);
    expect(boot?.remaining).toBe(0);
    expect(reloadsRemaining()).toBe(0);

    newPageLife();
    const navigationsBefore = replaceSpy.mock.calls.length;
    expect(requestCoordinatedReload({ reason: "stale-chunk" })).toBe(false);
    await flush();
    expect(replaceSpy.mock.calls.length).toBe(navigationsBefore);
  });
});

// ─── URL hygiene ─────────────────────────────────────────────────────────────

describe("cleanReloadParams", () => {
  it("strips recovery params from the address bar on boot", () => {
    setLocation("https://www.focusarx.site/dashboard?_v=171&_skew=1");
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});

    expect(cleanReloadParams()).toBe(true);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(String(replaceState.mock.calls[0][2])).toBe("/dashboard");
  });

  it("keeps real query params", () => {
    setLocation("https://www.focusarx.site/goals?_v=171&tab=weekly");
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});

    cleanReloadParams();
    expect(String(replaceState.mock.calls[0][2])).toBe("/goals?tab=weekly");
  });

  it("is a no-op on a clean URL", () => {
    setLocation("https://www.focusarx.site/dashboard");
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    expect(cleanReloadParams()).toBe(false);
    expect(replaceState).not.toHaveBeenCalled();
  });
});

// ─── Cache purge ─────────────────────────────────────────────────────────────

describe("purgeCaches", () => {
  it("clears the worker, updates the registration and empties the Cache API", async () => {
    const stubs = installCacheStubs();

    await purgeCaches();

    expect(stubs.posted).toEqual([{ type: "CLEAR_CACHE" }]);
    expect(stubs.registration.update).toHaveBeenCalledTimes(1);
    expect(stubs.deleted).toEqual(["focusarx-sw-v8", "focusarx-sw-v9"]);
  });

  it("does not wait forever when the worker never answers", async () => {
    vi.useFakeTimers();
    installCacheStubs({ ackWorker: false });

    const pending = purgeCaches();
    await vi.advanceTimersByTimeAsync(1_600);
    await pending;

    vi.useRealTimers();
  }, 15_000);

  it("reloads anyway when there is no service worker at all", async () => {
    installCacheStubs({ noRegistration: true });
    expect(requestCoordinatedReload({ reason: "stale-chunk", cacheBust: false })).toBe(true);
    await flush();
    expect(replaceSpy).toHaveBeenCalledTimes(1);
  });

  it("purges before navigating, not after", async () => {
    const stubs = installCacheStubs();
    const order: string[] = [];
    stubs.cachesStub.delete.mockImplementation(async (key: string) => {
      order.push(`purge:${String(key)}`);
      return true;
    });
    replaceSpy.mockImplementation(() => {
      order.push("navigate");
    });

    requestCoordinatedReload({ reason: "deployment-skew" });
    await flush();

    expect(order[order.length - 1]).toBe("navigate");
    expect(order.filter((step) => step.startsWith("purge:")).length).toBeGreaterThan(0);
  });
});
