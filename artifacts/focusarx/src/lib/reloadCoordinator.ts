/**
 * One coordinated reload, shared by every recovery path.
 * ══════════════════════════════════════════════════════════════════
 * Three separate mechanisms used to decide, independently, to reload the page:
 *
 *   • `deploymentSkew.safeRefresh()`      — a new deployment was detected
 *   • `deploymentSkew` unhandledrejection — a dynamic import failed
 *   • `chunkRecovery.recoverFromChunkError()` — Vite's `vite:preloadError`
 *
 * A single stale chunk after a deploy could therefore trigger two of them in
 * the same tick, and each kept its own counter in its own storage key, so the
 * observed behaviour was the one users reported: a reload, then another reload,
 * a URL that grew `?_v=<ts>&_skew=1`, and — because neither path cleared the
 * service-worker cache *before* navigating — the reload came back with the same
 * stale index.html and the same broken chunk.
 *
 * This module is the only thing allowed to reload the page. It provides:
 *
 *   1. **One reload in flight** — a module-level guard plus a cross-tab lock in
 *      localStorage, so four open tabs produce one reload, not four.
 *   2. **A budget** — at most `MAX_RELOADS` per `BUDGET_WINDOW_MS`, persisted in
 *      sessionStorage so it survives the reload it is counting.
 *   3. **Verification** — the build version present *before* the reload is
 *      recorded; on the next boot `noteBoot()` compares it with the version now
 *      running. If the reload did not change the build, that is a wasted reload
 *      and the budget is spent faster, so a stuck state stops reloading instead
 *      of looping.
 *   4. **Cache purge before navigation** — the SW is told to clear and update,
 *      the Cache API is emptied, and only then does the page navigate. Purging
 *      after (or concurrently with) the navigation is what made reloads come
 *      back stale.
 *   5. **URL hygiene** — `?_v` / `?_skew` are cache-busting internals. They are
 *      stripped from the address bar on boot (`cleanReloadParams`) so they are
 *      never shared, bookmarked, canonicalised or reported to analytics as
 *      separate pages.
 */

import logger from "./logger";

export type ReloadReason = "deployment-skew" | "stale-chunk";

/** Per-tab budget: sessionStorage, so it survives the reload it counts. */
const BUDGET_KEY = "focusarx:reload-budget";
/** Cross-tab lock: localStorage, so sibling tabs do not reload too. */
const LOCK_KEY = "focusarx:reload-lock";

const MAX_RELOADS = 3;
const BUDGET_WINDOW_MS = 5 * 60 * 1000;
/** Another tab's reload suppresses ours for this long. */
const CROSS_TAB_LOCK_MS = 15 * 1000;

/** Query params this module adds when it reloads. Never user-facing. */
export const RELOAD_PARAMS = ["_v", "_skew"] as const;

export interface ReloadBudget {
  count: number;
  startedAt: number;
  reason: ReloadReason | null;
  /** Build version that was running when the last reload was requested. */
  fromVersion: string | null;
  /** Set when a reload demonstrably did not change the build. */
  wasted: number;
}

const EMPTY_BUDGET: ReloadBudget = { count: 0, startedAt: 0, reason: null, fromVersion: null, wasted: 0 };

let inFlight = false;

function readBudget(): ReloadBudget {
  try {
    const raw = sessionStorage.getItem(BUDGET_KEY);
    if (!raw) return { ...EMPTY_BUDGET };
    const parsed = JSON.parse(raw) as Partial<ReloadBudget>;
    const startedAt = Number(parsed.startedAt);
    // An expired window is a fresh budget: a user who reloads once on Monday
    // must not be denied a recovery on Tuesday.
    if (!Number.isFinite(startedAt) || Date.now() - startedAt > BUDGET_WINDOW_MS) return { ...EMPTY_BUDGET };
    return {
      count: Number(parsed.count) || 0,
      startedAt,
      reason: parsed.reason === "stale-chunk" || parsed.reason === "deployment-skew" ? parsed.reason : null,
      fromVersion: typeof parsed.fromVersion === "string" ? parsed.fromVersion : null,
      wasted: Number(parsed.wasted) || 0,
    };
  } catch {
    return { ...EMPTY_BUDGET };
  }
}

function writeBudget(budget: ReloadBudget): void {
  try {
    sessionStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
  } catch {
    /* private mode: the in-memory guard still prevents a same-tick double reload */
  }
}

/** Another tab is already reloading — ours should wait, not follow. */
function lockedByAnotherTab(): boolean {
  try {
    const at = Number(localStorage.getItem(LOCK_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < CROSS_TAB_LOCK_MS;
  } catch {
    return false;
  }
}

function takeCrossTabLock(): void {
  try {
    localStorage.setItem(LOCK_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearCrossTabLock(): void {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
}

/** How many reloads this tab has left in the current window. */
export function reloadsRemaining(): number {
  return Math.max(0, MAX_RELOADS - readBudget().count);
}

/**
 * Purge every cache the page can reach, then tell the service worker to update.
 *
 * Awaited *before* navigation. Doing this after `location.replace()` — or in
 * the same tick as it — is a race the navigation routinely wins, which is why
 * the old recovery reloaded into the same stale index.html.
 */
export async function purgeCaches(): Promise<void> {
  try {
    // 1. Ask the worker to clear its own caches and wait for its ack. The worker
    //    re-precaches the app shell after a CLEAR_CACHE, so finishing before we
    //    navigate keeps it from repopulating a cache we are about to empty.
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration().catch(() => null);
      if (registration) {
        await clearWorkerCaches(registration);
        // 2. Pick up a newer worker if one is waiting. Without this the reload
        //    can be served by the very worker whose cache we just cleared.
        await registration.update().catch(() => undefined);
      }
    }
  } catch {
    // Best effort: a failed purge must never be the reason we do not reload.
  }

  // 3. Empty the Cache API from the page. Last, so it wins: no worker callback
  //    can leave a stale entry behind after this.
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys().catch(() => [] as string[]);
      await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
    }
  } catch {
    /* ignore */
  }
}

/** How long to wait for the worker's CLEAR_CACHE ack before moving on. */
const WORKER_ACK_TIMEOUT_MS = 1_500;

async function clearWorkerCaches(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  if (!worker) return;

  const controller = typeof navigator !== "undefined" ? navigator.serviceWorker : null;
  if (!controller) {
    try {
      worker.postMessage({ type: "CLEAR_CACHE" });
    } catch {
      /* the worker may already be gone */
    }
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      controller.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve();
    };
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === "CLEAR_CACHE_DONE") finish();
    };
    const timer = setTimeout(finish, WORKER_ACK_TIMEOUT_MS);
    controller.addEventListener("message", onMessage);
    try {
      worker.postMessage({ type: "CLEAR_CACHE" });
    } catch {
      finish();
    }
  });
}

export interface ReloadRequest {
  reason: ReloadReason;
  /** Build version currently running, used to verify the reload worked. */
  fromVersion?: string;
  /** Append `?_v=<ts>&_skew=1` (skew) or reload the same URL (chunk). */
  cacheBust?: boolean;
}

/**
 * Ask for the one reload. Returns true when this call owns it, false when a
 * reload is already in flight, another tab holds the lock, or the budget is
 * spent — callers must then show a UI affordance instead of reloading.
 */
export function requestCoordinatedReload(request: ReloadRequest): boolean {
  if (typeof window === "undefined") return false;
  if (inFlight) {
    logger.info(`[reload] already reloading (${request.reason} ignored)`);
    return false;
  }
  if (lockedByAnotherTab()) {
    logger.info(`[reload] another tab is reloading — standing down (${request.reason})`);
    return false;
  }

  const budget = readBudget();
  if (budget.count >= MAX_RELOADS) {
    logger.warn(
      `[reload] budget spent (${budget.count} reloads in the last ${Math.round(BUDGET_WINDOW_MS / 60000)} min, ` +
        `${budget.wasted} of them did not change the build) — not reloading for "${request.reason}". ` +
        `The update will apply on the next visit.`,
    );
    return false;
  }

  inFlight = true;
  takeCrossTabLock();
  writeBudget({
    count: budget.count + 1,
    startedAt: budget.startedAt || Date.now(),
    reason: request.reason,
    fromVersion: request.fromVersion ?? budget.fromVersion,
    wasted: budget.wasted,
  });

  logger.warn(`[reload] coordinated reload #${budget.count + 1} (${request.reason})`);

  void (async () => {
    await purgeCaches();
    const url = new URL(window.location.href);
    // Always clear a previous recovery's params before adding this one's, so
    // repeated reloads cannot stack `?_v=…&_skew=…&_v=…`.
    for (const param of RELOAD_PARAMS) url.searchParams.delete(param);
    if (request.cacheBust !== false) {
      url.searchParams.set("_v", Date.now().toString());
      if (request.reason === "deployment-skew") url.searchParams.set("_skew", "1");
    }
    window.location.replace(url.toString());
  })();

  return true;
}

/**
 * Called once on boot. Reconciles the previous reload with reality:
 *
 *   • the build changed → the recovery worked, budget resets;
 *   • the build did not change → the reload bought nothing, `wasted` increments
 *     and the budget stays spent, so a stuck deployment stops reloading.
 *
 * Returns what it decided so the caller (and tests) can react.
 */
export function noteBoot(currentVersion: string): {
  reloaded: boolean;
  reason: ReloadReason | null;
  buildChanged: boolean;
  wasted: number;
  remaining: number;
} {
  const budget = readBudget();
  if (budget.count === 0) {
    clearCrossTabLock();
    return { reloaded: false, reason: null, buildChanged: false, wasted: 0, remaining: MAX_RELOADS };
  }

  const buildChanged = Boolean(budget.fromVersion) && budget.fromVersion !== currentVersion;
  const wasted = buildChanged ? 0 : budget.wasted + 1;

  if (buildChanged) {
    // The reload delivered a new build: nothing to guard against any more.
    writeBudget({ ...EMPTY_BUDGET });
    clearCrossTabLock();
    return { reloaded: true, reason: budget.reason, buildChanged, wasted: 0, remaining: MAX_RELOADS };
  }

  // Same build came back. Keep the count (so the budget still caps us) and
  // record that it was wasted; release the cross-tab lock so a later, real
  // deployment can still be picked up by another tab.
  writeBudget({ ...budget, wasted });
  clearCrossTabLock();
  logger.warn(
    `[reload] the last reload did not change the build (still ${currentVersion}) — ` +
      `${wasted} wasted reload(s) recorded; ${Math.max(0, MAX_RELOADS - budget.count)} left in this window.`,
  );
  return {
    reloaded: true,
    reason: budget.reason,
    buildChanged,
    wasted,
    remaining: Math.max(0, MAX_RELOADS - budget.count),
  };
}

/**
 * Remove this module's cache-busting params from the address bar.
 *
 * They exist for one navigation only. Left in place they are shared,
 * bookmarked, indexed as URL variants and reported to analytics as separate
 * page_locations — an infinite tail of `?_v=<timestamp>` URLs pointing at one
 * page. Safe to call on every boot: it is a no-op without the params.
 */
export function cleanReloadParams(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  let changed = false;
  for (const param of RELOAD_PARAMS) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  }
  if (!changed) return false;
  const clean = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams}` : ""}${url.hash}`;
  try {
    window.history.replaceState(window.history.state, "", clean);
  } catch {
    /* older browsers: the params are cosmetic, leave them */
  }
  return true;
}

/**
 * Test hook: simulate a fresh page life.
 *
 * The in-memory `inFlight` guard is per-document, but the budget and the
 * cross-tab lock are deliberately not — they are what survives the reload and
 * stop the loop. Tests need to reset the former without wiping the latter, so
 * this is separate from `__resetReloadCoordinator`.
 */
export function __beginNewPageLife(): void {
  inFlight = false;
}

/** Test hook: full reset, including persisted budget and lock. */
export function __resetReloadCoordinator(): void {
  inFlight = false;
  try {
    sessionStorage.removeItem(BUDGET_KEY);
  } catch {
    /* ignore */
  }
  clearCrossTabLock();
}
