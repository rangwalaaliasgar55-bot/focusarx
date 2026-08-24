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
 * Reload once to pick up the new index.html, then stop: the sessionStorage flag
 * means a genuinely broken build cannot put the user in a reload loop.
 */

const RELOAD_FLAG = "focusarx-chunk-reload";
const RELOAD_WINDOW_MS = 30_000;

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
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: string }).name === "ChunkLoadError")
  );
}

function recentlyReloaded(): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_FLAG);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < RELOAD_WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * Reload to recover a stale chunk. Returns false if we already reloaded
 * recently, so callers can fall back to showing an error instead of looping.
 */
export function recoverFromChunkError(): boolean {
  if (recentlyReloaded()) return false;
  try {
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* private mode — reload anyway, worst case we try once more */
  }
  window.location.reload();
  return true;
}

/** Clear the flag on a clean boot so the next deploy can recover again. */
export function clearChunkRecoveryFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}

/** Install the global Vite preload-error handler. Call once from main.tsx. */
export function installChunkRecovery(): void {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    recoverFromChunkError();
  });
}
