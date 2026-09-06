import { clearToken, getToken, setToken } from "@/lib/auth";
import {
  FRONTEND_DEPLOYMENT_VERSION,
  recordServerVersion,
  queueMutation,
  handleChunkLoadError,
} from "@/lib/deploymentSkew";

export class ApiError extends Error {
  readonly data: unknown;
  constructor(public status: number, message = "Request failed", data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.data = data;
  }
}

/**
 * Outcome of a silent refresh attempt.
 *
 * The distinction is the whole point. `invalid` means the server looked at the
 * credential and refused it — the session is over and the client must sign the
 * user out. `unavailable` means nobody got an answer (network dropped, proxy
 * 502, cold start, rate limit, database blip) and the session may well still be
 * valid. Treating the second like the first is what logged people out mid-session
 * whenever an API instance restarted: the app "detected" an expired session that
 * had never expired at all.
 */
export type RefreshOutcome = "ok" | "invalid" | "unavailable";

/**
 * Single-flight silent refresh. When multiple queries 401 at once, exactly one
 * POST /api/auth/refresh goes out; everyone awaits the same result. The httpOnly
 * refresh cookie rides along via credentials: "include".
 *
 * Cross-tab: the Web Locks API serializes refreshes browser-wide so two tabs
 * never rotate the same family concurrently (the cookie jar is shared, so the
 * second tab reads the freshly-rotated cookie). Falls back to per-tab
 * single-flight where locks are unsupported.
 */
let refreshInFlight: Promise<RefreshOutcome> | null = null;

export function tryRefreshSession(): Promise<RefreshOutcome> {
  const attempt = async (): Promise<RefreshOutcome> => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        try {
          const data = await res.json() as { accessToken?: string; token?: string };
          const newToken = data.accessToken ?? data.token;
          if (newToken) setToken(newToken);
        } catch {
          // Non-JSON body — cookies are still the primary credential
        }
        return "ok";
      }
      // 401/403 with a structured error is the server's verdict on the token.
      // Anything else (429, 5xx, an HTML error page from an intermediary) is a
      // transport problem: keep the session and let the caller retry.
      if (res.status === 401 || res.status === 403) return "invalid";
      return "unavailable";
    } catch {
      return "unavailable";
    }
  };

  const withLock = async (): Promise<RefreshOutcome> => {
    if (typeof navigator !== "undefined" && navigator.locks?.request) {
      try {
        return await navigator.locks.request("focusarx:auth-refresh", attempt);
      } catch {
        // Lock manager unavailable/racy — fall through to plain attempt.
      }
    }
    return attempt();
  };

  refreshInFlight ??= withLock().finally(() => {
    setTimeout(() => { refreshInFlight = null; }, 0);
  });
  return refreshInFlight;
}

/** Paths that must never trigger (or retry after) a silent refresh. */
function isAuthPath(path: string): boolean {
  return path.startsWith("/api/auth/refresh") ||
         path.startsWith("/api/auth/login") ||
         path.startsWith("/api/auth/guest");
}

/**
 * The only browser API entry point for authenticated application data.
 *
 * Handles:
 * - Bearer token attachment from localStorage
 * - Deployment version header for skew protection
 * - Server version tracking from response headers
 * - 409 DEPLOYMENT_SKEW: queues the mutation for replay, dispatches skew event
 * - 401: silent refresh + single retry
 * - Chunk load errors: triggers recovery via deploymentSkew module
 */
export async function apiFetch(path: string, init: RequestInit = {}, _retried = false): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // Attach deployment version header for skew protection.
  headers.set("X-FocusArx-Deployment", FRONTEND_DEPLOYMENT_VERSION);

  // A failed fetch (offline, DNS, aborted) rejects and propagates as-is: the
  // only thing callers need to know is that the request never got an answer.
  const response = await fetch(path, { ...init, headers, credentials: "include" });

  // Record the server's deployment version from the response header.
  const serverVersion = response.headers.get("X-FocusArx-Deployment");
  if (serverVersion) recordServerVersion(serverVersion);

  // ── 409 DEPLOYMENT_SKEW handling ──────────────────────────────────────────
  if (response.status === 409) {
    let body: Record<string, unknown> = {};
    try { body = await response.json() as Record<string, unknown>; } catch { /* */ }

    const error = (body as { error?: Record<string, unknown> }).error;
    if (error?.code === "DEPLOYMENT_SKEW") {
      // Queue the mutation for replay after refresh (if idempotent)
      const method = init.method ?? "GET";
      const isIdempotent = Boolean(error.idempotent) ||
                           ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase()) ||
                           Boolean(headers.get("Idempotency-Key"));

      if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        queueMutation({
          url: path,
          method,
          body: typeof init.body === "string" ? init.body : (init.body ? JSON.stringify(init.body) : null),
          headers: Object.fromEntries(headers.entries()),
          timestamp: Date.now(),
          idempotent: isIdempotent,
        });
      }

      // Dispatch event for the deployment skew detector
      window.dispatchEvent(
        new CustomEvent("focusarx:deployment-skew", {
          detail: {
            status: 409,
            code: "DEPLOYMENT_SKEW",
            serverVersion: error.serverVersion,
            idempotent: isIdempotent,
          },
        })
      );

      throw new ApiError(409, (error.message as string) ?? "A new version is available. Please refresh.", body);
    }
  }

  // ── 401: silent refresh + single retry ────────────────────────────────────
  if (response.status === 401 && !_retried && !isAuthPath(path)) {
    const outcome = await tryRefreshSession();
    if (outcome === "ok") return apiFetch(path, init, true);
    if (outcome === "unavailable") {
      // Nobody refused the session — the network did. Keep the credentials,
      // keep the user where they are, and surface 503 so React Query retries
      // the query on its own. Signing the user out here is how a two-second
      // blip becomes a lost focus session.
      throw new ApiError(503, "FocusArx is unreachable. Your session is still active — retrying shortly.");
    }
    clearToken();
    window.dispatchEvent(new CustomEvent("focusarx:auth-expired"));
    throw new ApiError(401, "Your session expired. Please sign in again.");
  }

  if (!response.ok) {
    let errorData: unknown = null;
    try { errorData = await response.json(); } catch { /* non-JSON error body */ }
    // The old message was `Request failed (429)` — the number means nothing to
    // a user, while the server already said what to do ("Too many sign-in
    // attempts, wait a few minutes"). Prefer the server's own wording and keep
    // the status for programmatic handlers.
    throw new ApiError(response.status, messageFromEnvelope(errorData) ?? `Request failed (${response.status})`, errorData);
  }

  return response;
}

/** `{ error: { code, message } }` or `{ error: "message" }` → the message. */
function messageFromEnvelope(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const error = (data as { error?: unknown }).error;
  if (typeof error === "string") return error.trim() || null;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return null;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiFetch(path, init)).json() as Promise<T>;
}

// Re-export chunk error handler for use by lazy-loaded components
export { handleChunkLoadError };
