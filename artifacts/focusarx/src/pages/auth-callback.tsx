import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { setToken } from "@/lib/auth";

export default function AuthCallbackPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      setToken(token);
      // Clean the URL
      window.history.replaceState({}, "", "/auth/callback");
      setLocation("/dashboard");
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
