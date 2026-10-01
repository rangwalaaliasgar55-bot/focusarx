import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { AlertCircle, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { safeGet, safeSet } from "@/lib/safeStorage";
import { useToast } from "@/components/Toast";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redirectFromSearch } from "@/lib/safeRedirect";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";

/**
 * Sign-in is two steps for 2FA accounts:
 *
 *   1. email + password  → /auth/login either establishes the session or
 *      answers `mfaRequired` with a short-lived challenge token.
 *   2. authenticator code → /auth/login/mfa exchanges challenge + code for
 *      the session.
 *
 * The challenge token is not a credential — the code step exists so a stolen
 * password alone cannot sign in. The email/password stay in state (never
 * re-asked) so "back" from the code step is lossless; the challenge expires
 * server-side in five minutes, and a stale one simply routes the user to a
 * fresh step 1.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const mfaInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const { signIn, verifyMfa } = useAuth();
  const { toast } = useToast();

  // Redirect handling lives in @/lib/safeRedirect (redirectFromSearch), which
  // also rejects the `/\evil.example` backslash form, control characters and
  // auth-page loops. A local startsWith("/") check is not enough.

  const finish = (message: string) => {
    toast(message, "success");
    navigate(redirectFromSearch());
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
    if (result.mfaChallenge) {
      // Password verified — now the factor. Keep credentials in state so the
      // user can go back without retyping.
      setMfaChallenge(result.mfaChallenge);
      setMfaCode("");
      requestAnimationFrame(() => mfaInputRef.current?.focus());
      return;
    }
    if (!result.ok) {
      setError(result.error ?? "The email or password is incorrect.");
      return;
    }
    finish("Welcome back");
  };

  const submitMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!mfaChallenge) return;
    if (!/^\d{6}$/.test(mfaCode.trim()) && mfaCode.trim().length < 6) {
      setError("Enter the 6-digit code from your authenticator app, or a backup code.");
      return;
    }
    setLoading(true);
    const result = await verifyMfa(mfaChallenge, mfaCode.trim());
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "That code was not accepted.");
      return;
    }
    finish("Welcome back");
  };

  const continueAsGuest = async () => {
    setError(null);
    setLoading(true);
    // safeStorage, not localStorage: a private-mode `setItem` throw here used
    // to abort the whole guest sign-in before the request was even sent.
    let guestKey = safeGet("focusarx-guest-key");
    if (!guestKey) {
      guestKey = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      safeSet("focusarx-guest-key", guestKey);
    }
    const result = await signIn("guest", { guestKey });
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "A guest session could not be started. Try again.");
      return;
    }
    finish("Guest workspace ready");
  };

  return (
    <>
      <PageSEO {...PAGE_SEO.login} />
      <AuthLayout
      eyebrow={mfaChallenge ? "Two-factor check" : "Welcome back"}
      title={mfaChallenge ? "One more step." : "Return to your focus."}
      subtitle={mfaChallenge
        ? "Your account is protected with two-factor authentication."
        : "Sign in to recover your tasks, sessions, decks, and progress."}
      footer={mfaChallenge
        ? undefined
        : <>New to FocusArx? <Link href="/signup" className="font-semibold text-[var(--brand-strong)] hover:underline">Create an account</Link></>}
    >
      {mfaChallenge ? (
        <form onSubmit={submitMfa} className="space-y-5" noValidate>
          {error && <div className="flex gap-2.5 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={16} /><span>{error}</span></div>}
          <div>
            <label htmlFor="mfa-code" className="mb-2 flex items-center gap-2 text-sm font-medium"><ShieldCheck size={16} /> Verification code</label>
            <Input
              ref={mfaInputRef}
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              placeholder="123 456"
              leftSlot={<ShieldCheck />}
            />
            <p className="mt-2 text-xs text-[var(--foreground-subtle)]">
              Enter the 6-digit code from your authenticator app, or one of your single-use backup codes.
            </p>
          </div>
          <Button type="submit" size="lg" className="w-full" loading={loading}>Verify and sign in</Button>
          <button
            type="button"
            className="w-full text-center text-xs font-semibold text-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
            onClick={() => { setMfaChallenge(null); setMfaCode(""); setError(null); }}
          >
            Use a different account
          </button>
        </form>
      ) : (
        <>
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
        </>
      )}
      </AuthLayout>
    </>
  );
}
