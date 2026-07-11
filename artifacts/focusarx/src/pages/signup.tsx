import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { trackSiteEvent } from "@/lib/site-analytics";
import { Eye, EyeOff, Zap, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE, STAGGER, STAGGER_CHILD } from "@/lib/animations";

const PERKS = [
  "AI-powered focus coaching",
  "Pomodoro & deep work timer",
  "Streak tracking & XP rewards",
  "Session analytics & insights",
];

export default function SignupPage() {
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabel = ["", "Weak", "Good", "Strong"];
  const strengthColors = ["", "bg-red-500", "bg-yellow-400", "bg-emerald-400"];

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Failed to create account");
        setIsLoading(false);
        return;
      }
      const loginRes = await signIn("credentials", { email, password });
      if (!loginRes.ok) {
        toast("Account created — please sign in", "success");
        setLocation("/login");
      } else {
        toast("Welcome to FocusArx! 🎉", "success");
        trackSiteEvent("user_signed_up", { email: email.split("@")[1] ?? "unknown" });
        setLocation("/onboarding");
      }
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden forge-bg-glow flex items-center justify-center px-4 py-12">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.13),transparent_65%)] blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(6,214,160,0.06),transparent_65%)] blur-3xl" />
      </div>

      <motion.div
        variants={PAGE}
        initial="initial"
        animate="animate"
        className="relative z-10 w-full max-w-[400px]"
      >
        {/* Logo */}
        <motion.div variants={STAGGER_CHILD} className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] bg-gradient-to-br from-[var(--brand-violet)] to-[#4F46E5] shadow-[var(--shadow-violet-md)] logo-pulse">
            <Zap size={22} className="text-white" fill="white" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tracking-tight text-[var(--foreground)]">FocusArx</p>
            <p className="text-xs text-[var(--foreground-subtle)]">Free forever · No credit card needed</p>
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          variants={STAGGER_CHILD}
          className="glass rounded-[var(--radius-2xl)] p-8 shadow-[var(--shadow-xl)]"
        >
          <div className="mb-5">
            <h1 className="text-h3 text-[var(--foreground)]">Create your account</h1>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">Join thousands of focused learners</p>
          </div>

          {/* Perks grid */}
          <div className="mb-5 grid grid-cols-2 gap-1.5">
            {PERKS.map((perk) => (
              <div key={perk} className="flex items-center gap-1.5">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[rgba(124,58,237,0.15)]">
                  <Check size={9} className="text-[var(--brand-violet-light)]" strokeWidth={3} />
                </div>
                <span className="text-[10px] text-[var(--foreground-subtle)]">{perk}</span>
              </div>
            ))}
          </div>

          <motion.form
            variants={STAGGER}
            initial="initial"
            animate="animate"
            onSubmit={handleSignup}
            className="flex flex-col gap-4"
            noValidate
          >
            {/* Error banner */}
            {formError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 rounded-[var(--radius-md)] bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.22)] px-3 py-2.5"
                role="alert"
              >
                <AlertCircle className="size-4 text-[var(--color-error)] shrink-0" />
                <span className="text-sm text-[var(--color-error)]">{formError}</span>
              </motion.div>
            )}

            <motion.div variants={STAGGER_CHILD} className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--foreground-muted)]" htmlFor="name">
                Name <span className="text-[var(--foreground-subtle)]">(optional)</span>
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </motion.div>

            <motion.div variants={STAGGER_CHILD} className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--foreground-muted)]" htmlFor="email">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </motion.div>

            <motion.div variants={STAGGER_CHILD} className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--foreground-muted)]" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
              {password.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          strength >= level ? strengthColors[strength] : "bg-[rgba(255,255,255,0.08)]"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[var(--foreground-muted)]">{strengthLabel[strength]}</span>
                </div>
              )}
            </motion.div>

            <motion.div variants={STAGGER_CHILD}>
              <Button type="submit" className="w-full mt-1" size="lg" variant="glow" loading={isLoading}>
                {isLoading ? "Creating account…" : "Get Started Free →"}
              </Button>
            </motion.div>
          </motion.form>
        </motion.div>

        <motion.p
          variants={STAGGER_CHILD}
          className="mt-5 text-center text-sm text-[var(--foreground-subtle)]"
        >
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--brand-violet-light)] hover:text-[var(--brand-violet)] transition-colors">
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
