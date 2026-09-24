import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { tryRefreshSession } from "@/lib/api";
import { clearSessionCache } from "@/lib/queryClient";
import { resetOfflineQueue } from "@/hooks/useOfflineQueue";
import { safeGet, safeRemove, safeSet } from "@/lib/safeStorage";
import { hasAnalyticsConsent } from "@/lib/consent";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  isGuest?: boolean;
  role?: string;
  onboardingCompleted?: boolean;
};

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  return user?.role?.toLowerCase() === "admin";
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * A deletion request that has not been carried out yet.
 *
 * The account still works during the window, which is the point: the user can
 * sign back in and cancel. `cancellable` is computed server-side from the same
 * predicate the purge job uses, so the UI cannot offer a Cancel button for a
 * request the next job run will destroy regardless.
 */
export type PendingDeletion = {
  requestedAt: string;
  scheduledFor: string;
  daysRemaining: number;
  cancellable: boolean;
};

type AuthSession = {
  user: AuthUser;
  pendingDeletion?: PendingDeletion;
} | null;

type AuthContextType = {
  data: AuthSession;
  status: AuthStatus;
  signIn: (provider: string, opts: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  /** Re-read the session and publish it. Resolves with what the server said. */
  refresh: () => Promise<AuthSession>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "focusarx-auth-token";
const SESSION_HINT_COOKIE = "focusarx_session_hint";

/** Optional measurement must never become an auth-critical import or request.
 * These modules are fetched only after the visitor has explicitly allowed
 * analytics; successful sign-in stays fast and works when they are blocked. */
function linkConsentEligibleAnalyticsUser(userId: string): void {
  if (!hasAnalyticsConsent()) return;
  void import("@/lib/site-analytics")
    .then(({ linkAnalyticsUser }) => linkAnalyticsUser(userId))
    .catch(() => {});
}

function reportConsentEligibleLogin(provider: string): void {
  if (!hasAnalyticsConsent()) return;
  void Promise.all([import("@/lib/site-analytics"), import("@/lib/gtag")])
    .then(([analytics, gtag]) => {
      analytics.trackSiteEvent("user_logged_in", { provider });
      gtag.trackEvent("login", { method: provider });
    })
    .catch(() => {});
}

/**
 * A non-sensitive presence marker prevents anonymous visits from issuing a
 * guaranteed 401 session probe followed by a guaranteed 401 refresh probe.
 * The marker is never accepted by the API as a credential; it only tells the
 * client whether a real cookie/token may exist. A bearer token remains a
 * fallback for older sessions and constrained WebViews.
 */
export function hasSessionHint(): boolean {
  if (getToken()) return true;
  if (typeof document === "undefined") return false;
  return new RegExp(`(?:^|;\\s*)${SESSION_HINT_COOKIE}=1(?:;|$)`).test(document.cookie);
}

function clearSessionHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Token storage goes through safeStorage rather than localStorage directly.
 *
 * Safari/Firefox private mode and WebViews with a full or blocked disk throw
 * `QuotaExceededError` on `setItem`. That throw escaped `signIn` after a
 * successful /auth/login, the form reported a network failure, and the cookies
 * the server had just set were thrown away with the error — "sign in does
 * nothing" on exactly the browsers this product's users have. The guarded
 * helpers keep the token in memory instead, where the httpOnly cookies still
 * carry the session.
 */
export function getToken(): string | null {
  return safeGet(TOKEN_KEY);
}

export function setToken(token: string) {
  safeSet(TOKEN_KEY, token);
}

export function clearToken() {
  safeRemove(TOKEN_KEY);
}

/**
 * The API returns errors as `{ error: { code, message } }` (or a plain string
 * from older/proxy paths). Auth forms store the result in a string state var,
 * so normalize the nested message here instead of leaking an object into React.
 *
 * Also accepts the `ApiError` thrown by `apiFetch`, which keeps the parsed body
 * on `.data`. Callers used to pass the Error object itself and always fall back
 * to a generic sentence — "Current password is incorrect" and "Reset link is
 * invalid or expired" never reached the screen, so users retried the exact thing
 * that had just failed.
 */
export function apiErrorMessage(data: unknown, fallback: string): string {
  const fromShape = (value: unknown): string | null => {
    if (typeof value === "string") return value.trim() || null;
    if (value && typeof value === "object") {
      const err = (value as { error?: unknown }).error;
      if (typeof err === "string") return err.trim() || null;
      if (err && typeof err === "object") {
        const message = (err as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) return message.trim();
      }
    }
    return null;
  };

  const direct = fromShape(data);
  if (direct) return direct;

  // ApiError-shaped: { status, message, data: <response body> }
  if (data && typeof data === "object") {
    const nested = fromShape((data as { data?: unknown }).data);
    if (nested) return nested;
  }

  return fallback;
}

/** What the server said about our session, as opposed to "we could not ask". */
type SessionProbe =
  | { kind: "signed-in"; user: AuthUser; pendingDeletion?: PendingDeletion }
  | { kind: "signed-out" }
  | { kind: "unavailable" };

async function probeSessionOnce(): Promise<SessionProbe> {
  // Cookie-first: the httpOnly access cookie is the primary credential and the
  // 401-recovery path refreshes it silently. The localStorage bearer token is
  // a fallback for environments where Set-Cookie propagation is unreliable
  // (some Vercel serverless / edge scenarios).
  const token = getToken();
  let res: Response;
  try {
    res = await fetch("/api/auth/session", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: "include",
    });
  } catch {
    // The request never got an answer. `unavailable`, not `signed-out`.
    return { kind: "unavailable" };
  }

  if (res.ok) {
    try {
      const data = await res.json() as { user: AuthUser; pendingDeletion?: PendingDeletion };
      // Keep the local onboarding flag in sync with the server so onboarding
      // completion is respected even for accounts created before the flag
      // existed.
      if (data.user?.onboardingCompleted) {
        safeSet("onboardingComplete", "true");
      }
      return { kind: "signed-in", user: data.user, pendingDeletion: data.pendingDeletion };
    } catch {
      return { kind: "unavailable" };
    }
  }

  if (res.status === 401) {
    // Session check failed with the access token expired. The 15-min
    // access token/cookie may have lapsed while the 7-day refresh cookie is
    // still valid, so try a silent refresh before concluding anything — this
    // is what prevents unnecessary logouts.
    const refreshed = await tryRefreshSession();
    if (refreshed === "ok") {
      const retryRes = await fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        credentials: "include",
      }).catch(() => null);
      if (retryRes?.ok) {
        try {
          const data = await retryRes.json() as { user: AuthUser; pendingDeletion?: PendingDeletion };
          if (data.user?.onboardingCompleted) {
            safeSet("onboardingComplete", "true");
          }
          return { kind: "signed-in", user: data.user, pendingDeletion: data.pendingDeletion };
        } catch {
          return { kind: "unavailable" };
        }
      }
      // The refresh worked but the session call still failed — that is a
      // server problem, not a credential problem.
      return { kind: "unavailable" };
    }
    if (refreshed === "unavailable") return { kind: "unavailable" };
    return { kind: "signed-out" };
  }

  // 403/404 are verdicts; 5xx (and 503 CONFIG_ERROR during a bad deploy or a
  // database blip) are not. Only a verdict may end a session.
  if (res.status >= 400 && res.status < 500 && res.status !== 429) {
    return { kind: "signed-out" };
  }
  return { kind: "unavailable" };
}

/**
 * Resolve the session, retrying transient failures.
 *
 * Returns the session when signed in, `null` when the user is genuinely signed
 * out, and `null` after exhausting retries on an unreachable API — but in that
 * last case the credentials are LEFT ALONE, so the next mount can pick the
 * session straight back up. Clearing the token on a 5xx is what turned a
 * 20-second cold start into "your session expired, sign in again".
 */
const TRANSIENT_RETRY_DELAYS_MS = [500, 2000];

export async function resolveSession(
  options: { retryDelaysMs?: number[] } = {},
): Promise<{ session: AuthSession; signedOut: boolean }> {
  // Most page loads are anonymous. Do not put two known-failing auth requests
  // on their critical path; an actual credential always leaves either the
  // server-issued presence marker or the legacy bearer-token fallback.
  if (!hasSessionHint()) return { session: null, signedOut: true };

  const delays = options.retryDelaysMs ?? TRANSIENT_RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt += 1) {
    const probe = await probeSessionOnce();
    if (probe.kind === "signed-in") {
      return { session: { user: probe.user, pendingDeletion: probe.pendingDeletion }, signedOut: false };
    }
    if (probe.kind === "signed-out") {
      clearToken();
      clearSessionHint();
      return { session: null, signedOut: true };
    }
    // Out of patience: report "not signed in" for rendering purposes, but keep
    // the credentials — the next mount may well succeed.
    if (attempt >= delays.length) return { session: null, signedOut: false };
    await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AuthSession>(null);
  // Anonymous is the common case. Starting there lets public, prerendered
  // routes render immediately instead of showing a spinner while two expected
  // 401s resolve. A real session still begins in loading until it is verified.
  const [status, setStatus] = useState<AuthStatus>(() => hasSessionHint() ? "loading" : "unauthenticated");

  const refresh = useCallback(async () => {
    // No setStatus("loading") here: status already initializes to "loading",
    // and a sync setState in the mount effect below trips cascading renders.
    const { session } = await resolveSession();
    setData(session);
    setStatus(session ? "authenticated" : "unauthenticated");
    return session;
  }, []);

  useEffect(() => {
    // Subscription-style (not sync setState): resolves a *possible* session,
    // then publishes. A new anonymous visit has no marker, so it is already in
    // its final state and performs no network I/O.
    if (!hasSessionHint()) return;
    let cancelled = false;
    void resolveSession().then(({ session }) => {
      if (cancelled) return;
      setData(session);
      setStatus(session ? "authenticated" : "unauthenticated");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the httpOnly refresh cookie warm: rotate it every 14 minutes while
  // signed in. Uses the shared single-flight + Web-Locks helper so concurrent
  // tabs share one rotation instead of racing the same refresh family.
  useEffect(() => {
    if (status !== "authenticated") return;
    const id = window.setInterval(() => {
      void tryRefreshSession();
    }, 14 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status === "authenticated" && data?.user?.id) {
      linkConsentEligibleAnalyticsUser(data.user.id);
      // Referral auto-apply (?ref= captured pre-signup). Fire-and-forget,
      // idempotent server-side; never blocks auth.
      void import("./referral").then((m) => m.tryApplyPendingReferral()).catch(() => {});
    }
  }, [status, data?.user?.id]);

  useEffect(() => {
    const onExpired = () => {
      // Same reason as in signOut: the cache belongs to the session that just
      // ended, and the next person to sign in in this tab must not inherit it.
      clearSessionCache();
      clearSessionHint();
      setData(null);
      setStatus("unauthenticated");
    };
    window.addEventListener("focusarx:auth-expired", onExpired);
    return () => window.removeEventListener("focusarx:auth-expired", onExpired);
  }, []);

  const signIn = useCallback(async (
    provider: string,
    opts: Record<string, string>
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      let endpoint = "/api/auth/login";
      if (provider === "guest") endpoint = "/api/auth/guest";

      const doPost = () => fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
        credentials: "include",
      });

      const readBody = async (res: Response): Promise<unknown> => {
        // Tolerate non-JSON responses (e.g. a proxy/edge error page) so we can
        // surface a clean message instead of throwing during JSON parsing.
        try {
          return await res.json();
        } catch {
          return {};
        }
      };

      let res = await doPost();
      let data = await readBody(res);

      // A 503 here is usually transient (cold start, rolling deploy, brief
      // dependency blip): retry once after a short pause. The exception is
      // CONFIG_ERROR — a persistent misconfiguration no retry can fix, so
      // surface it immediately instead of burning the rate-limit budget and
      // making the user wait for an answer we already have.
      const errorCode = (data as { error?: { code?: unknown } })?.error?.code;
      if (res.status === 503 && errorCode !== "CONFIG_ERROR") {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        res = await doPost();
        data = await readBody(res);
      }

      if (!res.ok) {
        const fallback = res.status === 429
          ? "Too many attempts. Please wait a moment and try again."
          : res.status === 503
            ? "The sign-in service is temporarily unavailable. Please wait a moment and try again."
            : "Authentication failed. Please try again.";
        return {
          ok: false,
          error: apiErrorMessage(data, fallback),
        };
      }

      // Persist the short-lived access token in localStorage as a fallback
      // for the Authorization header. The httpOnly cookies remain the primary
      // credential (automatic cookie sending via credentials: "include"), but
      // some serverless/edge environments don't propagate Set-Cookie reliably.
      // The localStorage token ensures apiFetch always has a Bearer to attach.
      const responseData = data as { token?: string; accessToken?: string };
      const bearerToken = responseData.accessToken ?? responseData.token;
      if (bearerToken) {
        setToken(bearerToken);
      }

      // Confirm the session actually resolved before declaring success.
      //
      // The old code reported `ok` on a 200 from /login and let the page
      // navigate; if the follow-up session read hiccuped, ProtectedRoute still
      // saw "unauthenticated" and bounced straight back to the login form —
      // "it says welcome back and then throws me at the sign-in page forever".
      // The user is genuinely signed in at that point, so a clean retry message
      // beats an infinite loop, and the credentials stay put.
      const session = await refresh();
      if (!session) {
        return {
          ok: false,
          error: "FocusArx confirmed your sign-in but could not load your session. Try again — you may already be signed in.",
        };
      }
      reportConsentEligibleLogin(provider);
      return { ok: true };
    } catch {
      return { ok: false, error: "We couldn't reach FocusArx. Check your connection and try again." };
    }
  }, [refresh]);

  const signOut = useCallback(async () => {
    // Revoke the server-side refresh token + clear httpOnly cookies. A local
    // clear alone used to leave perfectly valid credentials in the browser.
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Offline or server unreachable — still clear local state below.
    }
    clearToken();
    clearSessionHint();
    // Every cached server response belongs to the account that just left.
    clearSessionCache();
    // The offline queue belongs to the account that just left too. Its payloads
    // are that user's completed sessions, the delivery loop attaches whatever
    // token is in storage, and it keeps flushing on a 15-second timer — so
    // leaving it would let the next person on this device silently submit the
    // previous user's focus history under their own session.
    resetOfflineQueue();
    setData(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ data, status, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useSession must be used within AuthProvider");
  return ctx;
}

export function useAuth() {
  return useSession();
}
