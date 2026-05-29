import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

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
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function fetchSession(): Promise<AuthSession> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/auth/session", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      clearToken();
      return null;
    }
    const data = await res.json() as { user: AuthUser };
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
      });

      const json = await res.json() as { token?: string; error?: string };

      if (!res.ok || !json.token) {
        return { ok: false, error: json.error ?? "Authentication failed" };
      }

      setToken(json.token);
      await refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  }, [refresh]);

  const signOut = useCallback(async () => {
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
