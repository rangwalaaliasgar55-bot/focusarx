import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const res = await signIn("credentials", { email, password });
    setIsLoading(false);
    if (!res.ok) {
      toast(res.error ?? "Invalid email or password", "error");
    } else {
      toast("Welcome back!", "success");
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect") ?? "/dashboard";
      setLocation(redirect);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden forge-bg-glow flex items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-24 top-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.12),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.08),transparent_70%)] blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-2xl backdrop-blur-2xl">
        <h1 className="mb-6 text-center text-2xl font-semibold tracking-tight text-zinc-100">Welcome back</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="email">Email</label>
            <input
              id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="password">Password</label>
            <input
              id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit" disabled={isLoading}
            className="mt-2 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-300 disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-zinc-600">
          <Link href="/forgot-password" className="hover:text-zinc-400">Forgot password?</Link>
          {" · "}
          <Link href="/" className="hover:text-zinc-400">Continue as guest</Link>
        </p>
        <p className="mt-4 text-center text-sm text-zinc-500">
          Don&apos;t have an account? <Link href="/signup" className="text-rose-400 hover:text-rose-300">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
