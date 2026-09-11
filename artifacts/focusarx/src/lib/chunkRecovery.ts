/**
 * Recover from stale lazy-loaded chunks without the user having to reload.
 *
 * The app code-splits every page (`lazy(() => import(...))`). After a deploy the
 * old hashed filenames under /assets/ are gone, so a tab that was already open
 * tries to fetch e.g. `profile-BkwlJInT.js`, gets a 404, and the dynamic import
 * rejects. Vite reports this as a `vite:preloadError` event. Without a handler
 * the route is simply broken until a hard refresh — which is the "have to keep
 * reloading to load a feature" behaviour.
 *
 * ── What actually made recovery fail in production ────────────────────────
 * The handler existed and still did not work, for three separate reasons:
 *
 *   1. **The reload came back stale.** `window.location.reload()` was called
 *      with the service worker still holding the previous build's index.html,
 *      which references the same missing chunks. Reload → same failure → the
 *      30 s guard blocks the second reload → the page stays broken. Caches are
 *      now purged *before* navigating (reloadCoordinator.purgeCaches).
 *   2. **A missing asset answered 200 with HTML.** vercel.json's catch-all
 *      rewrote every unknown path — including `/assets/gone-abc123.js` — to
 *      index.html. The browser failed to parse HTML as a module, and the service
 *      worker cached that HTML *under the asset URL*, so the poisoned entry
 *      outlived every reload. Missing assets now answer 404 with an empty body.
 *   3. **Two reload paths.** deploymentSkew's `unhandledrejection` listener and
 *      this `vite:preloadError` listener each decided to reload, each with its
 *      own counter, so one stale chunk produced a double reload. Both now go
 *      through reloadCoordinator, which owns a single shared budget.
 *
 * Recovery is as close to invisible as a reload can be: the scroll position is
 * stored and restored, the URL is unchanged (no cache-busting params on this
 * path), and the budget means a genuinely broken build shows an error instead of
 * looping.
 */

import logger from "./logger";
import { requestCoordinatedReload } from "./reloadCoordinator";

const SCROLL_KEY = "focusarx-chunk-scroll";
/** Legacy guard key, cleared on boot so an old value cannot block recovery. */
const LEGACY_FLAG_KEY = "focusarx-chunk-reload";

/** True when the error looks like a failed dynamic import of a build chunk. */
export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    /dynamically imported module/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /chunkloaderror/i.test(message) ||
    /failed to load module script/i.test(message) ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: string }).name === "ChunkLoadError")
  );
}

function saveScroll(): void {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY || 0));
  } catch {
    /* private mode — the reload still works, the user just starts at the top */
  }
}

/** Restore the scroll position left behind by a chunk-recovery reload. */
export function restoreScrollAfterRecovery(): boolean {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    sessionStorage.removeItem(SCROLL_KEY);
    if (raw === null) return false;
    const y = Number(raw);
    if (!Number.isFinite(y) || y <= 0) return false;
    // One frame later: the route component has to exist before it can be
    // scrolled to, and layout must have settled.
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Recover from a stale chunk. Returns false when a reload is not allowed (the
 * coordinator's budget is spent or another tab is already reloading), so callers
 * can fall back to showing an error instead of looping.
 */
export function recoverFromChunkError(fromVersion?: string): boolean {
  saveScroll();
  // Tell the skew detector a chunk just failed: that is evidence a new
  // deployment landed, so it should poll faster instead of waiting up to two
  // minutes to confirm what we already suspect.
  try {
    window.dispatchEvent(new CustomEvent("fx:chunk-recovered"));
  } catch {
    /* older browsers without CustomEvent — the poll still catches up */
  }
  const owned = requestCoordinatedReload({
    reason: "stale-chunk",
    fromVersion,
    // No cache-busting params here: the URL is the user's, and Vite's hashed
    // asset names already change with every build. The coordinator purges the
    // service worker and Cache API, which is what actually forces fresh HTML.
    cacheBust: false,
  });
  if (!owned) {
    logger.warn("[chunk-recovery] reload not permitted — surfacing the error state instead");
  }
  return owned;
}

/**
 * Clear legacy recovery state on a clean boot.
 *
 * The old module kept its own `focusarx-chunk-reload` timestamp; the budget now
 * lives in reloadCoordinator. Removing the stale key matters: a value left from
 * a previous build would otherwise look like "we just reloaded" to any code
 * path that still reads it.
 */
export function clearChunkRecoveryFlag(): void {
  try {
    sessionStorage.removeItem(LEGACY_FLAG_KEY);
  } catch {
    /* ignore */
  }
  restoreScrollAfterRecovery();
}

/**
 * Install the global Vite preload-error handler. Call once from main.tsx.
 *
 * Also listens for `unhandledrejection`, because a dynamic import that Vite did
 * not wrap in `__vitePreload` (a manual `import()` in app code) rejects without
 * ever firing `vite:preloadError`. Both paths converge on one coordinator call,
 * so at most one reload happens.
 */
export function installChunkRecovery(fromVersion?: string): void {
  clearChunkRecoveryFlag();

  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    logger.warn("[chunk-recovery] stale chunk detected — recovering");
    recoverFromChunkError(fromVersion);
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!isChunkLoadError(event.reason)) return;
    // Handled here: leaving it unhandled logs a console error on every retry and
    // React's error boundary paints a crash for what is a recoverable miss.
    event.preventDefault();
    logger.warn("[chunk-recovery] chunk load rejection — recovering");
    recoverFromChunkError(fromVersion);
  });
}
