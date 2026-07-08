import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { Eye, EyeOff, Zap } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative min-h-screen overflow-hidden forge-bg-glow flex items-center justify-center px-4 py-12">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.15),transparent_70%)] blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.1),transparent_70%)] blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.05),transparent_70%)] blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] shadow-lg shadow-violet-900/40">
            <Zap size={22} className="text-white" fill="white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-[#E2E8F0]">FocusArx</h1>
            <p className="text-xs text-[#6B7280]">Your AI focus companion</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-[1.75rem] border border-[rgba(124,58,237,0.2)] bg-[rgba(8,12,28,0.85)] p-8 shadow-2xl shadow-black/60 backdrop-blur-2xl">
          <div className="mb-6">
            <h2 className="text-[1.4rem] font-semibold tracking-tight text-[#E2E8F0]">Welcome back</h2>
            <p className="mt-1 text-sm text-[#4B5563]">Sign in to continue your focus journey</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#94A3B8]" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.04)] px-4 py-2.5 text-sm text-[#E2E8F0] placeholder-[#374151] transition focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/50"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-[#94A3B8]" htmlFor="password">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-[#7C3AED] hover:text-[#A78BFA] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.04)] px-4 py-2.5 pr-10 text-sm text-[#E2E8F0] placeholder-[#374151] transition focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/50"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-[#94A3B8] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[rgba(124,58,237,0.12)]" />
            <span className="text-[10px] text-[#374151]">or</span>
            <div className="h-px flex-1 bg-[rgba(124,58,237,0.12)]" />
          </div>

          <Link
            href="/"
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-[rgba(124,58,237,0.2)] py-2.5 text-sm font-medium text-[#94A3B8] transition hover:border-[rgba(124,58,237,0.4)] hover:text-[#E2E8F0]"
          >
            Continue as guest
          </Link>
        </div>

        <p className="mt-5 text-center text-sm text-[#4B5563]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-[#A78BFA] hover:text-[#7C3AED] transition-colors">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
