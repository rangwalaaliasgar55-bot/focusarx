import { lazy, type ComponentType } from "react";

const RELOAD_FLAG = "focusarx:chunk-reloaded";

/** Heuristic: did this error come from a failed dynamic chunk import? */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return /Loading chunk [\d]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|dynamically imported module/i.test(
    msg,
  );
}

/**
 * Like React.lazy, but when a chunk fails to load because the deployed assets
 * changed underneath an open tab (the classic "blank screen after a new
 * deployment"), it performs a single hard reload to fetch the fresh bundle
 * instead of surfacing a blank/error screen. The reload is guarded by a
 * sessionStorage flag so we never loop.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (err) {
      if (isChunkLoadError(err) && !sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        // Keep Suspense in its fallback state until the reload takes over.
        return await new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
