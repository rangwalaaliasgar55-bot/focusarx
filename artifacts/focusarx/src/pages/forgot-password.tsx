import { useState } from "react";
import { motion } from "framer-motion";
import { AuthCard, AuthLink } from "@/components/auth/AuthCard";
import { Link } from "wouter";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; devResetUrl?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
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
        subtitle=""
        footer={
          <p className="text-center text-sm text-zinc-500">
            <AuthLink href="/login">Back to sign in</AuthLink>
          </p>
        }
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <svg className="h-6 w-6 text-rose-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400">
            If an account exists for <span className="font-medium text-zinc-200">{email}</span>, a reset link has been sent. Check your spam folder if you don't see it.
          </p>
          <p className="text-xs text-zinc-600">The link expires in 1 hour.</p>

          {devResetUrl && (
            <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-3 text-left">
              <p className="text-xs font-medium text-amber-400 mb-1">Dev mode — email not configured</p>
              <p className="text-xs text-zinc-500 mb-2">No SMTP credentials set. Use this link directly:</p>
              <a
                href={devResetUrl}
                className="block break-all text-xs text-rose-400 hover:underline"
              >
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
        <p className="text-center text-sm text-zinc-500">
          <AuthLink href="/login">Back to sign in</AuthLink>
          {" · "}
          <Link href="/" className="text-zinc-600 hover:text-zinc-400">Timer</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-400" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
            placeholder="you@example.com"
          />
        </div>
        {error && (
          <p className="rounded-lg bg-rose-950/40 px-3 py-2 text-sm text-rose-400" role="alert">{error}</p>
        )}
        <motion.button
          type="submit"
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-1 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-300 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send reset link"}
        </motion.button>
      </form>
    </AuthCard>
  );
}
