import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { AlertCircle, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { apiErrorMessage, useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackSiteEvent } from "@/lib/site-analytics";
import { trackEvent as trackGAEvent } from "@/lib/gtag";
import { cn } from "@/lib/utils";

const BENEFITS = ["Focus timer and task sync", "Flashcards and study tools", "Session history and progress"];

function passwordScore(password: string) {
  return [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d|[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { signIn, refresh } = useAuth();
  const { toast } = useToast();
  const strength = useMemo(() => passwordScore(password), [password]);
  const strengthLabel = ["Add a password", "Weak", "Fair", "Good", "Strong"][strength];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
        credentials: "include",
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(apiErrorMessage(data, "Your account could not be created. Try again."));
        return;
      }

      // Register now auto-logs in (returns tokens + sets cookies).
      // Store the access token so subsequent requests work immediately.
      const responseData = data as { token?: string; accessToken?: string };
      const bearerToken = responseData.accessToken ?? responseData.token;
      if (bearerToken) {
        localStorage.setItem("focusarx-auth-token", bearerToken);
      }
      // Refresh the auth context to pick up the session.
      await refresh();

      trackSiteEvent("user_signed_up", { email: email.split("@")[1] ?? "unknown" });
      trackGAEvent("sign_up", { method: "email" });
      toast("Your FocusArx workspace is ready", "success");
      navigate("/onboarding");
    } catch {
      setError("We couldn't reach FocusArx. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Start free"
      title="Build a calmer work rhythm."
      subtitle="Create one account for your tasks, study tools, sessions, and progress."
      footer={<>Already have an account? <Link href="/login" className="font-semibold text-[var(--brand-strong)] hover:underline">Sign in</Link></>}
    >
      <div className="mb-6 grid gap-2 sm:grid-cols-3">
        {BENEFITS.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-xs leading-snug text-[var(--foreground-muted)]"><Check size={14} className="mt-0.5 shrink-0 text-[var(--success)]" />{benefit}</div>)}
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <div className="flex gap-2.5 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={16} /><span>{error}</span></div>}
        <div><label htmlFor="name" className="mb-2 block text-sm font-medium">Name <span className="font-normal text-[var(--foreground-subtle)]">(optional)</span></label><Input id="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="What should we call you?" leftSlot={<UserRound />} /></div>
        <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus placeholder="you@example.com" leftSlot={<Mail />} error={!!error && !email.includes("@")} /></div>
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label>
          <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" leftSlot={<LockKeyhole />} error={!!error && password.length < 8} rightSlot={<button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button>} />
          <div className="mt-2" aria-live="polite">
            <div className="grid grid-cols-4 gap-1">{[1, 2, 3, 4].map((level) => <span key={level} className={cn("h-1.5 rounded-full bg-[var(--surface-hover)] transition-colors duration-[var(--duration-normal)]", strength >= level && (strength <= 1 ? "bg-[var(--danger)]" : strength <= 2 ? "bg-[var(--warning)]" : "bg-[var(--success)]"))} />)}</div>
            <div className="mt-1.5 flex justify-between text-xs text-[var(--foreground-subtle)]"><span>{strengthLabel}</span><span>8+ characters · mixed characters recommended</span></div>
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Create account <span aria-hidden="true">→</span></Button>
      </form>
      <p className="mt-5 text-xs leading-relaxed text-[var(--foreground-subtle)]">By creating an account, you agree to the <Link href="/terms" className="underline hover:text-[var(--foreground)]">Terms</Link> and acknowledge the <Link href="/privacy" className="underline hover:text-[var(--foreground)]">Privacy Policy</Link>.</p>
    </AuthLayout>
  );
}
