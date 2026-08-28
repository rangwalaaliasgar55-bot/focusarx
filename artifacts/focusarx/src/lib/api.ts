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
 * Single-flight silent refresh. When multiple queries 401 at once, exactly one
 * POST /api/auth/refresh goes out; everyone awaits the same result. The httpOnly
 * refresh cookie rides along via credentials: "include".
 *
 * Cross-tab: the Web Locks API serializes refreshes browser-wide so two tabs
 * never rotate the same family concurrently (the cookie jar is shared, so the
 * second tab reads the freshly-rotated cookie). Falls back to per-tab
 * single-flight where locks are unsupported.
 */
let refreshInFlight: Promise<boolean> | null = null;

export function tryRefreshSession(): Promise<boolean> {
  const attempt = async (): Promise<boolean> => {
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
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const withLock = async (): Promise<boolean> => {
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

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, credentials: "include" });
  } catch (err) {
    // Network error — could be a chunk load failure if this was a dynamic import
    throw err;
  }

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
    const refreshed = await tryRefreshSession();
    if (refreshed) return apiFetch(path, init, true);
    clearToken();
    window.dispatchEvent(new CustomEvent("focusarx:auth-expired"));
    throw new ApiError(401, "Your session expired. Please sign in again.");
  }

  if (!response.ok) {
    let errorData: unknown = null;
    try { errorData = await response.json(); } catch { /* non-JSON error body */ }
    throw new ApiError(response.status, `Request failed (${response.status})`, errorData);
  }

  return response;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiFetch(path, init)).json() as Promise<T>;
}

// Re-export chunk error handler for use by lazy-loaded components
export { handleChunkLoadError };
