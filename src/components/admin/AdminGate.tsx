"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Access denied");
        return;
      }

      router.refresh();
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[100dvh] items-center justify-center px-4"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-8 shadow-2xl backdrop-blur-xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          FocusArx
        </p>
        <h1 className="mt-2 text-xl font-semibold text-zinc-100">Admin access</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Enter the admin password to open the control panel.
        </p>

        <label className="mt-6 block text-xs font-medium text-zinc-400">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-zinc-700/80 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-0 placeholder:text-zinc-600 focus:border-rose-500/60 focus:ring-2 focus:ring-rose-500/20"
            placeholder="••••••••"
            required
          />
        </label>

        {error && (
          <p className="mt-3 text-sm text-rose-400" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-rose-600 py-2.5 text-sm font-medium text-white transition hover:bg-rose-500 disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Unlock admin"}
        </button>
      </form>
    </motion.div>
  );
}
