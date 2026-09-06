/**
 * Diagnostic logger.
 *
 * ── Why this exists ───────────────────────────────────────────────
 * Several modules logged straight to `console`, so a completely healthy page
 * load still produced output in DevTools:
 *
 *   • `socket.ts`  — "realtime unavailable on this host — falling back to
 *                    polling" is the NORMAL production path (socket.io is not
 *                    initialised on Vercel, see api-server/src/index.ts), so
 *                    every visitor saw an info line
 *   • `analytics.ts` — a debug line per tracked event
 *   • `main.tsx`   — "[pwa] updated build ready" after any deploy
 *
 * The requirement is a clean F12 console on a healthy load, so routine
 * diagnostics now route through here and are silent unless explicitly enabled.
 *
 * ── What deliberately does NOT route through here ─────────────────
 * Genuine failures (error boundaries, camera init failure, storage write
 * failure) still call `console.error`/`console.warn` directly. Suppressing a
 * real crash to make the console look clean would be strictly worse than the
 * noise — the point is to hide *routine* chatter, not to hide problems.
 *
 * ── Enabling ──────────────────────────────────────────────────────
 *   localStorage.setItem("focusarx:debug", "1")   // then reload
 * or set `VITE_DEBUG=true` at build time.
 */

function enabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem("focusarx:debug") === "1") return true;
  } catch {
    // Storage can throw in private mode — fall through to the build flag.
  }
  return import.meta.env.VITE_DEBUG === "true";
}

/** Cache the flag per load so a hot path never touches localStorage. */
let cached: boolean | null = null;
function on(): boolean {
  if (cached === null) cached = enabled();
  return cached;
}

/** Reset the cache — used by tests. */
export function __resetLoggerCache(): void {
  cached = null;
}

export const logger = {
  /** Routine diagnostics. Silent unless debug is enabled. */
  debug(...args: unknown[]): void {
    // eslint-disable-next-line no-console -- the one sanctioned debug sink
    if (on()) console.debug(...args);
  },
  /** Informational, still not something a healthy load should print. */
  info(...args: unknown[]): void {
    // eslint-disable-next-line no-console -- the one sanctioned info sink
    if (on()) console.info(...args);
  },
  /**
   * Recoverable degradation. Gated, because several "warnings" here describe
   * expected fallbacks rather than problems.
   */
  warn(...args: unknown[]): void {
    if (on()) console.warn(...args);
  },
  /**
   * A real failure. ALWAYS printed — never gated. If something is genuinely
   * broken the developer must see it.
   */
  error(...args: unknown[]): void {
    console.error(...args);
  },
};

export default logger;
