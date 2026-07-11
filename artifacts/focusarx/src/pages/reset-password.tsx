import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setVerifying(false); return; }
    void fetch(`/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((d: { valid: boolean }) => setTokenValid(d.valid))
      .catch(() => setTokenValid(false))
      .finally(() => setVerifying(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? "Reset failed. The link may have expired."); return; }
      setDone(true);
      setTimeout(() => setLocation("/login"), 2500);
    } catch {
      setError("Could not reach server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Loading token verification
  if (verifying) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center forge-bg-glow">
        <div className="size-8 animate-spin rounded-full border-2 border-[var(--brand-violet)] border-t-transparent" />
      </div>
    );
  }

  // Invalid or expired token
  if (!token || !tokenValid) {
    return (
      <AuthCard
        title="Link expired"
        footer={<p className="text-center text-sm text-[var(--foreground-subtle)]"><AuthLink href="/forgot-password">Request a new link</AuthLink></p>}
      >
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-[rgba(245,158,11,0.10)] border border-[rgba(245,158,11,0.20)]">
            <AlertTriangle className="size-6 text-[var(--color-warning)]" />
          </div>
          <p className="text-sm text-[var(--foreground-muted)]">
            This reset link is invalid or has already been used.
          </p>
        </div>
      </AuthCard>
    );
  }

  // Success state
  if (done) {
    return (
      <AuthCard
        title="Password updated"
        footer={<p className="text-center text-sm text-[var(--foreground-subtle)]"><AuthLink href="/login">Sign in</AuthLink></p>}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.22)]">
            <CheckCircle2 className="size-6 text-[var(--color-success)]" />
          </div>
          <p className="text-sm text-[var(--foreground-muted)]">
            Your password has been updated. Redirecting to sign in…
          </p>
        </motion.div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set new password"
      subtitle="Choose a strong password for your account."
      footer={<p className="text-center text-sm text-[var(--foreground-subtle)]"><AuthLink href="/login">Back to sign in</AuthLink></p>}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[var(--foreground-muted)]" htmlFor="password">
            New password
          </label>
          <Input
            id="password"
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            leftSlot={<Lock className="size-4" />}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[var(--foreground-muted)]" htmlFor="confirm">
            Confirm password
          </label>
          <Input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            leftSlot={<Lock className="size-4" />}
            error={!!error && error.includes("match")}
            success={confirm.length >= 8 && confirm === password}
          />
        </div>

        {error && (
          <div
            className="flex items-center gap-2.5 rounded-[var(--radius-md)] bg-[rgba(239,68,68,0.10)] border border-[rgba(239,68,68,0.22)] px-3 py-2.5"
            role="alert"
          >
            <AlertCircle className="size-4 text-[var(--color-error)] shrink-0" />
            <span className="text-sm text-[var(--color-error)]">{error}</span>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full mt-1" loading={loading}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthCard>
  );
}
