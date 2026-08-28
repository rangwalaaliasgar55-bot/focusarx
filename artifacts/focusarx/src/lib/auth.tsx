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
  // a legacy fallback (old clients / the OAuth token-param callback).
  const token = getToken();
  try {
    const res = await fetch("/api/auth/session", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: "include",
    });
    if (!res.ok) {
      if (res.status === 401 && !token) return null;
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

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
        credentials: "include",
      });

      // Tolerate non-JSON responses (e.g. a proxy/edge error page) so we can
      // surface a clean message instead of throwing during JSON parsing.
      let data: unknown = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        const fallback = res.status === 429
          ? "Too many attempts. Please wait a moment and try again."
          : "Authentication failed. Please try again.";
        return {
          ok: false,
          error: apiErrorMessage(data, fallback),
        };
      }

      // Bearer retirement: do not persist the legacy token. The httpOnly
      // cookies set by this response carry the session from here on; the
      // silent-refresh path renews them. (Old builds still read a stored
      // token via getToken(), so previously-issued tokens keep working.)
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
