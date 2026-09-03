import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { linkAnalyticsUser, trackSiteEvent } from "@/lib/site-analytics";
import { tryRefreshSession } from "@/lib/api";
import { trackEvent as trackGAEvent } from "@/lib/gtag";

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

type AuthSession = {
  user: AuthUser;
} | null;

type AuthContextType = {
  data: AuthSession;
  status: AuthStatus;
  signIn: (provider: string, opts: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "focusarx-auth-token";

export function getToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * The API returns errors as `{ error: { code, message } }` (or a plain string
 * from older/proxy paths). Auth forms store the result in a string state var,
 * so normalize the nested message here instead of leaking an object into React.
 */
export function apiErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === "string") return data.trim() || fallback;
  if (data && typeof data === "object") {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string") return err.trim() || fallback;
    if (err && typeof err === "object") {
      const message = (err as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
  }
  return fallback;
}

async function fetchSession(): Promise<AuthSession> {
  // Cookie-first: the httpOnly access cookie is the primary credential and the
  // 401-recovery path refreshes it silently. The localStorage bearer token is
  // a fallback for environments where Set-Cookie propagation is unreliable
  // (some Vercel serverless / edge scenarios).
  const token = getToken();
  try {
    const res = await fetch("/api/auth/session", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: "include",
    });

    if (!res.ok) {
      // If session check failed, try a silent refresh before giving up.
      // The 15-min access token/cookie may have expired while the 7-day
      // refresh cookie is still valid. This prevents unnecessary logouts.
      if (res.status === 401) {
        const refreshed = await tryRefreshSession();
        if (refreshed) {
          // After refresh, the server set new cookies. Also update the
          // localStorage token from the refresh response.
          const retryRes = await fetch("/api/auth/session", {
            headers: { Authorization: `Bearer ${getToken() ?? ""}` },
            credentials: "include",
          });
          if (retryRes.ok) {
            const data = await retryRes.json() as { user: AuthUser };
            if (data.user?.onboardingCompleted) {
              localStorage.setItem("onboardingComplete", "true");
            }
            return { user: data.user };
          }
        }
      }
      clearToken();
      return null;
    }
    const data = await res.json() as { user: AuthUser };
    // Keep the local onboarding flag in sync with the server so onboarding
    // completion is respected even for accounts created before the flag existed.
    if (data.user?.onboardingCompleted) {
      localStorage.setItem("onboardingComplete", "true");
    }
    return { user: data.user };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AuthSession>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = useCallback(async () => {
    setStatus("loading");
    const session = await fetchSession();
    setData(session);
    setStatus(session ? "authenticated" : "unauthenticated");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      linkAnalyticsUser(data.user.id);
    }
  }, [status, data?.user?.id]);

  useEffect(() => {
    const onExpired = () => {
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

      await refresh();
      trackSiteEvent("user_logged_in", { provider });
      trackGAEvent("login", { method: provider });
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
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
