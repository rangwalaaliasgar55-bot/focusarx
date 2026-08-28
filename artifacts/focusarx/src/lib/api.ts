import { clearToken, getToken, setToken } from "@/lib/auth";
import { FRONTEND_DEPLOYMENT_VERSION, recordServerVersion } from "@/lib/deploymentSkew";

export class ApiError extends Error {
  constructor(public status: number, message = "Request failed") {
    super(message);
    this.name = "ApiError";
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
        // Persist the new access token in localStorage so apiFetch can use
        // it as the Authorization header. Without this, the Bearer token
        // stays stale (or null) after refresh, and subsequent requests fail.
        try {
          const data = await res.json() as { accessToken?: string; token?: string };
          const newToken = data.accessToken ?? data.token;
          if (newToken) {
            setToken(newToken);
          }
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
  return path.startsWith("/api/auth/refresh") || path.startsWith("/api/auth/login") || path.startsWith("/api/auth/guest");
}

/** The only browser API entry point for authenticated application data. */
export async function apiFetch(path: string, init: RequestInit = {}, _retried = false): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // Attach deployment version header for skew protection.
  // This lets the server detect when the frontend and backend are from
  // different deployments and block mutations to prevent data corruption.
  headers.set("X-FocusArx-Deployment", FRONTEND_DEPLOYMENT_VERSION);

  const response = await fetch(path, { ...init, headers, credentials: "include" });

  // Record the server's deployment version from the response header.
  const serverVersion = response.headers.get("X-FocusArx-Deployment");
  if (serverVersion) recordServerVersion(serverVersion);

  // Handle deployment skew: 409 from the server means version mismatch on a mutation.
  if (response.status === 409) {
    const body = await response.json().catch(() => ({}));
    if (body?.error?.code === "DEPLOYMENT_SKEW") {
      window.dispatchEvent(
        new CustomEvent("focusarx:deployment-skew", {
          detail: { status: 409, code: "DEPLOYMENT_SKEW", serverVersion: body.error.serverVersion },
        })
      );
      throw new ApiError(409, body.error.message ?? "A new version is available. Please refresh.");
    }
  }

  if (response.status === 401 && !_retried && !isAuthPath(path)) {
    // Bearer token expired/absent — try the httpOnly cookie refresh once, then
    // replay the original request. Only a failed refresh clears the session.
    const refreshed = await tryRefreshSession();
    if (refreshed) return apiFetch(path, init, true);
    clearToken();
    window.dispatchEvent(new CustomEvent("focusarx:auth-expired"));
    throw new ApiError(401, "Your session expired. Please sign in again.");
  }
  if (!response.ok) throw new ApiError(response.status, `Request failed (${response.status})`);
  return response;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiFetch(path, init)).json() as Promise<T>;
}
