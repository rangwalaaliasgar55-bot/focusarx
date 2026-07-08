import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { trackSiteEvent } from "@/lib/site-analytics";
import { Eye, EyeOff, Zap, Check } from "lucide-react";

const PERKS = [
  "AI-powered focus coaching",
  "Pomodoro & deep work timer",
  "Streak tracking & XP rewards",
  "Session analytics & insights",
];

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabel = ["", "Weak", "Good", "Strong"];
  const strengthColor = ["", "bg-red-500", "bg-yellow-400", "bg-emerald-400"];

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
        toast("Account created — welcome to FocusArx! 🎉", "success");
        trackSiteEvent("user_signed_up", { email: email.split("@")[1] ?? "unknown" });
        setLocation("/onboarding");
      }
    } catch {
      toast("Something went wrong. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden forge-bg-glow flex items-center justify-center px-4 py-12">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.15),transparent_70%)] blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.1),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] shadow-lg shadow-violet-900/40">
            <Zap size={22} className="text-white" fill="white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-[#E2E8F0]">FocusArx</h1>
            <p className="text-xs text-[#6B7280]">Free forever · No credit card needed</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-[1.75rem] border border-[rgba(124,58,237,0.2)] bg-[rgba(8,12,28,0.85)] p-8 shadow-2xl shadow-black/60 backdrop-blur-2xl">
          <div className="mb-6">
            <h2 className="text-[1.4rem] font-semibold tracking-tight text-[#E2E8F0]">Create your account</h2>
            <p className="mt-1 text-sm text-[#4B5563]">Join thousands of focused learners</p>
          </div>

          {/* Perks list */}
          <div className="mb-5 grid grid-cols-2 gap-1.5">
            {PERKS.map((perk) => (
              <div key={perk} className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[rgba(124,58,237,0.15)]">
                  <Check size={9} className="text-[#A78BFA]" strokeWidth={3} />
                </div>
                <span className="text-[10px] text-[#6B7280]">{perk}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#94A3B8]" htmlFor="name">
                Name <span className="text-[#374151]">(optional)</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.04)] px-4 py-2.5 text-sm text-[#E2E8F0] placeholder-[#374151] transition focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/50"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>

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
              <label className="mb-1.5 block text-xs font-medium text-[#94A3B8]" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.04)] px-4 py-2.5 pr-10 text-sm text-[#E2E8F0] placeholder-[#374151] transition focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/50"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
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
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          passwordStrength >= level ? strengthColor[passwordStrength] : "bg-[rgba(124,58,237,0.1)]"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[#6B7280]">{strengthLabel[passwordStrength]}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating account…
                </>
              ) : (
                "Get Started Free →"
              )}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-[#4B5563]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#A78BFA] hover:text-[#7C3AED] transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
