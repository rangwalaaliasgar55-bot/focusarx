import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { Eye, EyeOff, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE, STAGGER, STAGGER_CHILD } from "@/lib/animations";

export default function LoginPage() {
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setIsLoading(true);
    const res = await signIn("credentials", { email, password });
    setIsLoading(false);
    if (!res.ok) {
      setFieldError(res.error ?? "Invalid email or password");
    } else {
      toast("Welcome back!", "success");
      const params = new URLSearchParams(window.location.search);
      setLocation(params.get("redirect") ?? "/dashboard");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden forge-bg-glow flex items-center justify-center px-4 py-12">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.13),transparent_65%)] blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.08),transparent_65%)] blur-3xl" />
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
            <p className="text-xs text-[var(--foreground-subtle)]">Your AI focus companion</p>
          </div>
        </motion.div>

        {/* Card */}
        <motion.div
          variants={STAGGER_CHILD}
          className="glass rounded-[var(--radius-2xl)] p-8 shadow-[var(--shadow-xl)]"
        >
          <div className="mb-6">
            <h1 className="text-h3 text-[var(--foreground)]">Welcome back</h1>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">Sign in to continue your focus journey</p>
          </div>

          <motion.form
            variants={STAGGER}
            initial="initial"
            animate="animate"
            onSubmit={handleLogin}
            className="flex flex-col gap-4"
            noValidate
          >
            {/* Error banner */}
            {fieldError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 rounded-[var(--radius-md)] bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.22)] px-3 py-2.5"
                role="alert"
              >
                <AlertCircle className="size-4 text-[var(--color-error)] shrink-0" />
                <span className="text-sm text-[var(--color-error)]">{fieldError}</span>
              </motion.div>
            )}

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
                error={!!fieldError}
              />
            </motion.div>

            <motion.div variants={STAGGER_CHILD} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--foreground-muted)]" htmlFor="password">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[var(--brand-violet-light)] hover:text-[var(--brand-violet)] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                error={!!fieldError}
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
            </motion.div>

            <motion.div variants={STAGGER_CHILD}>
              <Button
                type="submit"
                className="w-full mt-1"
                size="lg"
                loading={isLoading}
              >
                {isLoading ? "Signing in…" : "Sign In"}
              </Button>
            </motion.div>
          </motion.form>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)]">or</span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <Link href="/">
            <Button variant="outline" className="w-full mt-4" size="lg">
              Continue as guest
            </Button>
          </Link>
        </motion.div>

        <motion.p
          variants={STAGGER_CHILD}
          className="mt-5 text-center text-sm text-[var(--foreground-subtle)]"
        >
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-[var(--brand-violet-light)] hover:text-[var(--brand-violet)] transition-colors">
            Sign up free
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
