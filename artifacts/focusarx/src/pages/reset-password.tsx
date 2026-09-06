import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/auth";
import { clearSessionCache } from "@/lib/queryClient";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  // `unknown` is its own state on purpose. The verification probe is a courtesy
  // check: when it fails (offline, 503, rate limited) the old code treated that
  // as "the link is expired" and refused the form — so a healthy link was
  // destroyed by a transient error, and the only way out was to start the whole
  // reset over. The server is the authority; it re-checks the token on submit.
  const [verifyState, setVerifyState] = useState<"pending" | "valid" | "invalid" | "unknown">(
    token ? "pending" : "invalid",
  );
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const query = new URLSearchParams({ token });
    void fetch(`/api/auth/reset-password/verify?${query}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`verify responded ${r.status}`))))
      .then((d: { valid?: boolean }) => {
        if (cancelled) return;
        setVerifyState(d?.valid ? "valid" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setVerifyState("unknown");
      });
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) { setError("This link is missing its reset token. Request a new one."); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
        credentials: "include",
      });
      // Tolerate a non-JSON body (an edge/proxy error page) — `res.json()`
      // used to throw here, which skipped the server's real explanation and
      // showed the generic "Could not reach server" instead.
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: unknown };
      if (!res.ok || !data.ok) {
        setError(apiErrorMessage(data, res.status === 503
          ? "FocusArx is temporarily unavailable. Your link is still valid — try again in a minute."
          : "Reset failed. The link may have expired."));
        return;
      }
      setDone(true);
      // The reset revoked every existing session, so anything this tab still
      // holds for the old credentials has to go with them.
      clearSessionCache();
      setTimeout(() => setLocation("/login"), 2500);
    } catch {
      setError("Could not reach server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // A missing or definitively-spent link is the only case where the form is
  // withheld. While the check is in flight we render the form directly (no
  // spinner gate) so a slow verify never looks like a broken link.
  if (verifyState === "invalid") {
    return (
      <AuthCard
        title="Link expired"
        footer={<p className="text-center text-sm text-[var(--foreground-subtle)]"><AuthLink href="/forgot-password">Request a new link</AuthLink></p>}
      >
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--rgba-245-158-11-0_10)] border border-[var(--rgba-245-158-11-0_20)]">
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
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--rgba-34-197-94-0_12)] border border-[var(--rgba-34-197-94-0_22)]">
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
            className="flex items-center gap-2.5 rounded-[var(--radius-md)] bg-[var(--rgba-239-68-68-0_10)] border border-[var(--rgba-239-68-68-0_22)] px-3 py-2.5"
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
