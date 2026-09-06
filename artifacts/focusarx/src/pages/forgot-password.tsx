import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, AlertCircle } from "lucide-react";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Trim before sending. "you@example.com " is what autofill and a paste from
    // an email app actually produce, and it used to come back as a validation
    // error on a form that only asked for an address.
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: unknown; devResetUrl?: string };
      if (!res.ok || !data.ok) {
        setError(apiErrorMessage(data, "Something went wrong. Try again."));
        return;
      }
      setSubmitted(true);
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
    } catch {
      setError("Could not reach server. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthCard
        title="Check your inbox"
        footer={<p className="text-center text-sm text-[var(--foreground-subtle)]"><AuthLink href="/login">Back to sign in</AuthLink></p>}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 text-center"
        >
          {/* Icon */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--rgba-124-58-237-0_12)] border border-[var(--rgba-124-58-237-0_20)]">
            <Mail className="size-6 text-[var(--brand-violet-light)]" />
          </div>
          <p className="text-sm text-[var(--foreground-muted)]">
            If an account exists for{" "}
            <span className="font-medium text-[var(--foreground)]">{email}</span>
            , a reset link has been sent. Check your spam folder if you don't see it.
          </p>
          <p className="text-xs text-[var(--foreground-subtle)]">The link expires in 1 hour.</p>

          {devResetUrl && (
            <div className="rounded-[var(--radius-md)] border border-[var(--rgba-245-158-11-0_30)] bg-[var(--rgba-245-158-11-0_08)] p-4 text-left">
              <p className="text-xs font-semibold text-[var(--color-warning)] mb-1.5">Dev mode — email not configured</p>
              <p className="text-xs text-[var(--foreground-muted)] mb-2">No SMTP credentials set. Use this link directly:</p>
              <a href={devResetUrl} className="block break-all text-xs text-[var(--brand-violet-light)] hover:underline">
                {devResetUrl}
              </a>
            </div>
          )}
        </motion.div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <p className="text-center text-sm text-[var(--foreground-subtle)]">
          <AuthLink href="/login">Back to sign in</AuthLink>
          {" · "}
          <Link href="/" className="text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors">
            Timer
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-[var(--foreground-muted)]" htmlFor="email">
            Email address
          </label>
          <Input
            id="email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            error={!!error}
            leftSlot={<Mail className="size-4" />}
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
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}
