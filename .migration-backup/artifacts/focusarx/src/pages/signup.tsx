import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signIn } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "google_not_configured") {
      toast("Google sign-in is not configured yet. Use email & password instead.", "error");
      window.history.replaceState({}, "", "/signup");
    }
  }, [toast]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast(data.error ?? "Failed to create account", "error");
        setIsLoading(false);
        return;
      }
      const loginRes = await signIn("credentials", { email, password });
      if (!loginRes.ok) {
        toast("Account created but failed to log in", "error");
        setLocation("/login");
      } else {
        toast("Account created successfully", "success");
        setLocation("/dashboard");
      }
    } catch {
      toast("Something went wrong. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-2xl backdrop-blur-2xl">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight text-zinc-100">Create Account</h1>
        <button
          type="button"
          onClick={() => window.location.href = "/api/auth/google"}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800/50 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700/50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign up with Google
        </button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-zinc-900/70 px-2 text-zinc-500">or continue with email</span></div>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="name">Name</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              placeholder="Your name (optional)" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              placeholder="you@example.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              placeholder="•••••••• (min 6 chars)" />
          </div>
          <button type="submit" disabled={isLoading}
            className="mt-2 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-300 disabled:opacity-50">
            {isLoading ? "Creating account..." : "Sign Up"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account? <Link href="/login" className="text-rose-400 hover:text-rose-300">Log in</Link>
        </p>
      </div>
    </div>
  );
}
