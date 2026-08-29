import { useState } from "react";
import { Link, useLocation } from "wouter";
import { AlertCircle, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { signIn } = useAuth();
  const { toast } = useToast();

  // Only allow same-app paths (no protocol-relative or cross-origin targets).
  const redirectTarget = () => {
    const target = new URLSearchParams(window.location.search).get("redirect");
    return target && target.startsWith("/") && !target.startsWith("//") ? target : "/dashboard";
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setLoading(true);
    const result = await signIn("credentials", { email: email.trim(), password });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "The email or password is incorrect.");
      return;
    }
    toast("Welcome back", "success");
    navigate(redirectTarget());
  };

  const continueAsGuest = async () => {
    setError(null);
    setLoading(true);
    let guestKey = localStorage.getItem("focusarx-guest-key");
    if (!guestKey) {
      guestKey = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("focusarx-guest-key", guestKey);
    }
    const result = await signIn("guest", { guestKey });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "A guest session could not be started. Try again.");
      return;
    }
    toast("Guest workspace ready", "success");
    navigate(redirectTarget());
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Return to your focus."
      subtitle="Sign in to recover your tasks, sessions, decks, and progress."
      footer={<>New to FocusArx? <Link href="/signup" className="font-semibold text-[var(--brand-strong)] hover:underline">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {error && <div className="flex gap-2.5 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={16} /><span>{error}</span></div>}
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium">Email address</label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus placeholder="you@example.com" leftSlot={<Mail />} error={!!error && !email.includes("@")} />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium">Password</label><Link href="/forgot-password" className="text-xs font-semibold text-[var(--brand-strong)] hover:underline">Forgot password?</Link></div>
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="Enter your password"
            leftSlot={<LockKeyhole />}
            rightSlot={<button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button>}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Sign in</Button>
      </form>
      <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-[var(--border-subtle)]" /><span className="text-xs uppercase tracking-wider text-[var(--foreground-subtle)]">or</span><span className="h-px flex-1 bg-[var(--border-subtle)]" /></div>
      <Button type="button" variant="outline" size="lg" className="w-full" loading={loading} onClick={() => void continueAsGuest()}>Continue as guest</Button>
    </AuthLayout>
  );
}
