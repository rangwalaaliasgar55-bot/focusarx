import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query without a first-render lie.
 *
 * The previous hooks started at `false` and corrected themselves in an
 * effect, so every consumer rendered once with the wrong answer (animations
 * flashed for reduced-motion users; desktop chrome flashed on phones).
 * `useSyncExternalStore` reads the real value during the first render.
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener?.("change", onChange);
      return () => mql.removeEventListener?.("change", onChange);
    },
    () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : serverFallback),
    () => serverFallback,
  );
}
