import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { setToken, getToken } from "@/lib/auth";

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const isNew = params.get("new") === "1";

    if (token) {
      setToken(token);
      window.history.replaceState({}, "", "/auth/callback");

      if (isNew) {
        setLocation("/onboarding");
        return;
      }

      // Check onboarding status for existing Google users
      void fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then((d: { user?: { onboardingCompleted?: boolean } } | null) => {
          if (d?.user?.onboardingCompleted === false) {
            setLocation("/onboarding");
          } else {
            setLocation("/dashboard");
          }
        })
        .catch(() => setLocation("/dashboard"));
    } else {
      setError("Authentication failed — no token received.");
    }
  }, [setLocation]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-400">{error}</p>
          <a href="/login" className="mt-4 inline-block text-rose-400 hover:underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-rose-400" />
    </div>
  );
}
