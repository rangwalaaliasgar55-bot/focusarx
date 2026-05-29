import { useState } from "react";
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
        setLocation("/onboarding");
      }
    } catch {
      toast("Something went wrong. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden forge-bg-glow flex items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-24 top-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.12),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.08),transparent_70%)] blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-2xl backdrop-blur-2xl">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight text-zinc-100">Create Account</h1>
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
            <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              placeholder="•••••••• (min 8 chars)" />
            <p className="mt-1 text-xs text-zinc-500">Minimum 8 characters</p>
          </div>
          <button type="submit" disabled={isLoading}
            className="mt-2 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-300 disabled:opacity-50">
            {isLoading ? "Creating account..." : "Sign Up"}
          </button>
        </form>
        <div className="mt-4">
          <div className="relative flex items-center justify-center">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="mx-3 text-xs text-zinc-600">or</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
          <a
            href="/api/auth/google"
            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-700 bg-zinc-900/50 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </a>
        </div>
        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account? <Link href="/login" className="text-rose-400 hover:text-rose-300">Log in</Link>
        </p>
      </div>
    </div>
  );
}
