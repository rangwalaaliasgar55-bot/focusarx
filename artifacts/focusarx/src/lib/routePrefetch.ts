import { routeChunkFor } from "./routeChunks";

/**
 * Load a page's code before the student asks for it.
 *
 * The complaint this answers is "the loading time of each thing": the app
 * lazy-loads every page, so the download for `/dashboard` starts when the route
 * renders and finishes a beat later on a phone — a spinner on every navigation
 * for the rest of the product's life. Prefetching moves that download into the
 * time the student was already spending deciding to click.
 *
 * Three triggers, in order of how certain they are:
 *
 *   1. intent — `pointerover`, `focusin`, `touchstart` on any link to a known
 *      route, plus `pointerdown` (which fires even when a hover did not, e.g.
 *      a stylus or a fast tap). A hover on desktop precedes the click by
 *      hundreds of ms; a finger landing on a link precedes the route change by
 *      the tap-to-navigate delay. Both are free time.
 *   2. idle — after the first paint, warm the two or three screens most
 *      likely to be next, so the first navigation is instant even with no
 *      hover at all.
 *   3. `popstate` — a Back gesture is a *guaranteed* navigation and is the
 *      slowest kind to wait on, because the user already expects the old page
 *      to be there. Listening for history navigation prefetches the previous
 *      entry.
 *
 * What it deliberately does not do:
 *   - prefetch anything while `navigator.connection.saveData` is set, or on a
 *     `2g`/`slow-2g` link — burning someone's metered data to save them 300 ms
 *     later is not a trade this code gets to make for them;
 *   - prefetch on `/admin` or route-parameter pages, which are unlikely next
 *     steps and (for admin) the single largest chunk in the app;
 *   - retry. A prefetch that fails is a cache miss; the route's own
 *     `lazyWithRetry` still owns real failures, and swallowing a duplicate
 *     error here would only hide it.
 */

const inFlight = new Set<string>();

/** True when the connection can spare a page-sized download. */
export function shouldPrefetch(): boolean {
  try {
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const conn = nav.connection;
    if (conn?.saveData) return false;
    if (conn?.effectiveType && /(^|-)(2g|slow-2g)$/.test(conn.effectiveType)) return false;
  } catch {
    /* no Network Information API — assume it can */
  }
  return true;
}

/** Routes worth having warm because a student is likely to navigate to them. */
const IDLE_WARMUP = ["/dashboard", "/focus", "/leaderboard", "/study-rooms"];

/** Paths whose chunks are large or unlikely — never prefetched speculatively. */
const EXCLUDED = [/^\/admin/, /^\/u\//, /^\/auth\//];

export function prefetchRoute(pathname: string): void {
  if (!shouldPrefetch()) return;
  const clean = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (EXCLUDED.some((re) => re.test(clean))) return;
  if (inFlight.has(clean)) return;
  const load = routeChunkFor(clean);
  if (!load) return;
  inFlight.add(clean);
  // `import()` is memoised by the bundler's module map, so when the route
  // actually renders this resolves immediately instead of re-fetching.
  void load().catch(() => {
    inFlight.delete(clean);
  });
}

/** Pathname of a same-origin link target, or null for external/anchor links. */
function linkPath(anchor: EventTarget | null): string | null {
  if (!(anchor instanceof HTMLElement)) return null;
  const a = anchor.closest("a[href]");
  if (!(a instanceof HTMLAnchorElement)) return null;
  if (a.target && a.target !== "_self") return null;
  if (a.hasAttribute("download")) return null;
  let url: URL;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (!url.pathname.startsWith("/")) return null;
  return url.pathname;
}

let installed = false;

/**
 * Attach the listeners once. Idempotent, so a hot reload or a double import
 * cannot stack handlers (the same class of bug as the SW registering twice).
 */
export function installRoutePrefetch(): () => void {
  if (installed) return () => {};
  installed = true;

  const onIntent = (event: Event) => {
    const path = linkPath(event.target);
    if (path) prefetchRoute(path);
  };

  document.addEventListener("pointerover", onIntent, { passive: true, capture: true });
  document.addEventListener("focusin", onIntent, { passive: true, capture: true });
  document.addEventListener("touchstart", onIntent, { passive: true, capture: true });
  document.addEventListener("pointerdown", onIntent, { passive: true, capture: true });

  // Back/forward: the destination is already known, so prefetch it as soon as
  // the browser tells us a history traversal started. `pageshow` covers the
  // bfcache restore, where the JS heap (and the module map) is reused.
  const onPopState = () => prefetchRoute(window.location.pathname);
  window.addEventListener("popstate", onPopState);

  // Idle warm-up: one route at a time, so the warm-up itself never competes
  // with a click the student just made.
  const schedule =
    typeof window.requestIdleCallback === "function"
      ? (cb: () => void) => window.requestIdleCallback(cb, { timeout: 4000 })
      : (cb: () => void) => window.setTimeout(cb, 2000);

  if (shouldPrefetch()) {
    let i = 0;
    const warm = () => {
      const path = IDLE_WARMUP[i++];
      if (!path) return;
      // Skip the screen the student is already on: its chunk is loaded.
      if (path !== window.location.pathname) prefetchRoute(path);
      if (i < IDLE_WARMUP.length) schedule(warm);
    };
    schedule(warm);
  }

  return () => {
    installed = false;
    document.removeEventListener("pointerover", onIntent, { capture: true });
    document.removeEventListener("focusin", onIntent, { capture: true });
    document.removeEventListener("touchstart", onIntent, { capture: true });
    document.removeEventListener("pointerdown", onIntent, { capture: true });
    window.removeEventListener("popstate", onPopState);
  };
}
