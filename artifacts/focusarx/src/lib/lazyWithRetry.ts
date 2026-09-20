import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Resilient lazy component importer with automatic retry and chunk reload handling.
 *
 * Why this matters:
 * When a user is navigating or a new version is deployed, dynamically imported
 * chunks can fail with "Failed to fetch dynamically imported module" or transient
 * network dropouts. `lazyWithRetry` attempts up to `retries` times, and if a chunk
 * version mismatch occurs after a deployment, automatically triggers a single page
 * reload to fetch fresh chunks without breaking the user experience into a white screen.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  intervalMs = 800
): LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch((error: unknown) => {
            if (remaining <= 0) {
              const message = (error instanceof Error ? error.message : String(error)) || "";
              const isChunkError =
                message.includes("Failed to fetch dynamically imported module") ||
                message.includes("Importing a module script failed") ||
                message.includes("error loading dynamically imported module") ||
                (error instanceof Error && error.name === "ChunkLoadError");

              const storageKey = "focusarx:last_chunk_reload";
              const lastReload = Number(sessionStorage.getItem(storageKey) || "0");
              const now = Date.now();

              // If it is a chunk load failure and we haven't reloaded in the last 20 seconds, reload once
              if (isChunkError && now - lastReload > 20_000) {
                sessionStorage.setItem(storageKey, String(now));
                window.location.reload();
                return;
              }

              reject(error);
              return;
            }

            setTimeout(() => attempt(remaining - 1), intervalMs);
          });
      };

      attempt(retries);
    })
  );
}
