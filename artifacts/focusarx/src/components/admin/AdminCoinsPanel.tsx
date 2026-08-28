import { useState } from "react";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { SectionHeader, MotionTab } from "./AdminHelpers";
import type { AdminPanelProps, AdminUser } from "./AdminTypes";

export function AdminCoinsPanel({ authHeaders, users }: AdminPanelProps & { users: AdminUser[] }) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ newBalance: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function grant() {
    if (!userId || !amount) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const r = await fetch("/api/admin/cms/grant-coins", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, amount: Number(amount), reason }),
      });
      const d = await r.json();
      if (r.ok) { setResult(d); setUserId(""); setAmount(""); setReason(""); }
      else setError(d.error ?? "Failed");
    } finally { setLoading(false); }
  }

  return (
    <MotionTab>
      <SectionHeader title="Coin Grants" sub="Manually grant coins to specific users." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Grant Coins</p>

          <div>
            <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">User ID</label>
            <input className="admin-input font-mono" placeholder="paste user UUID here…" value={userId} onChange={e => setUserId(e.target.value)} />
            <p className="text-[10px] text-[var(--palette-zinc-600)] mt-1">Find user IDs in the Users tab (grey monospace under each name)</p>
          </div>

          <div>
            <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Amount (coins)</label>
            <input className="admin-input" type="number" min="1" placeholder="500" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-[var(--palette-zinc-500)] mb-1">Reason (optional)</label>
            <input className="admin-input" placeholder="e.g. Bug compensation, contest winner" value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          <button onClick={() => void grant()} disabled={loading || !userId || !amount}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--palette-amber-700)] hover:bg-[var(--palette-amber-600)] px-4 py-2.5 text-sm font-medium text-[var(--palette-white)] disabled:opacity-50 transition"
          >
            {loading ? <><RefreshCw size={14} className="animate-spin" /> Granting…</> : <>🪙 Grant Coins</>}
          </button>

          {result && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-emerald-800)]/50 bg-[var(--palette-emerald-950)]/30 px-4 py-3 text-[var(--palette-emerald-400)] text-sm">
              <CheckCircle size={14} /> Coins granted! New balance: {result.newBalance.toLocaleString()} 🪙
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--palette-red-800)]/50 bg-[var(--palette-red-950)]/30 px-4 py-3 text-[var(--palette-red-400)] text-sm">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)] mb-3">Quick Users</p>
            <p className="text-xs text-[var(--palette-zinc-500)] mb-3">Click a user to auto-fill their ID</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.map(u => (
                <button key={u.id} onClick={() => setUserId(u.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition ${userId === u.id ? "border-[var(--palette-amber-700)]/50 bg-[var(--palette-amber-950)]/20" : "border-[var(--palette-zinc-800)] hover:border-[var(--palette-zinc-600)] hover:bg-[var(--palette-zinc-800)]/40"}`}
                >
                  <p className="text-xs font-medium text-[var(--palette-zinc-300)]">{u.name ?? "Unnamed"}</p>
                  <p className="text-[10px] text-[var(--palette-zinc-500)] font-mono">{u.id.slice(0, 16)}…</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MotionTab>
  );
}
