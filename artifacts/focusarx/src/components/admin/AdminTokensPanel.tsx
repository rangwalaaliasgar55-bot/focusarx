import { useCallback, useEffect, useState } from "react";
import { MotionTab, SectionHeader, StatCard, adminFetch } from "@/components/admin/AdminHelpers";

// ─── Types ──────────────────────────────────────────────────────────────────

type TokenLedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  transactionType: string;
  source: string;
  balanceAfter: number;
  adminReason: string | null;
  relatedEntityId: string | null;
  idempotencyKey: string;
  createdAt: string;
};

type TokenAnalytics = {
  totalCirculation?: number;
  totalEarned?: number;
  totalSpent?: number;
  totalAdminGrants?: number;
};

type TokenGrantResult = {
  error?: string;
  beforeBalance?: number;
  afterBalance?: number;
  ledgerId?: string;
};

// ─── Panel ──────────────────────────────────────────────────────────────────

export function AdminTokensPanel({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [ledger, setLedger] = useState<TokenLedgerEntry[]>([]);
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [grantForm, setGrantForm] = useState({ userId: "", amount: "", reason: "", type: "grant" as "grant" | "remove" });
  const [grantLoading, setGrantLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grantResult, setGrantResult] = useState<TokenGrantResult | null>(null);

  const loadLedger = useCallback(async () => {
    try {
      const r = await adminFetch("/api/admin/tokens/ledger?limit=50", { headers: authHeaders(), credentials: "include" });
      if (r.ok) { const d = await r.json(); setLedger(d.ledger ?? []); }
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const loadAnalytics = useCallback(async () => {
    try {
      const r = await adminFetch("/api/admin/tokens/analytics", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setAnalytics(await r.json());
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { void loadLedger(); void loadAnalytics(); }, [loadLedger, loadAnalytics]);

  async function grantTokens() {
    if (!grantForm.userId || !grantForm.amount || grantForm.reason.length < 5) return;
    setGrantLoading(true);
    setGrantResult(null);
    try {
      const r = await adminFetch("/api/admin/tokens/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ userId: grantForm.userId, amount: Number(grantForm.amount), reason: grantForm.reason, type: grantForm.type }),
      });
      const d = await r.json();
      if (r.ok) { setGrantResult(d); void loadLedger(); void loadAnalytics(); }
      else setGrantResult({ error: d.error });
    } finally { setGrantLoading(false); }
  }

  return (
    <MotionTab>
      <SectionHeader title="Token Economy" sub="Focus Tokens circulation, ledger audit, grant/remove with reason + immutable audit + before/after balance. Anti-abuse: idempotency, daily caps, rate limits." />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Total circulation" value={String(analytics?.totalCirculation ?? 0)} accent="amber" />
        <StatCard label="Total earned" value={String(analytics?.totalEarned ?? 0)} accent="emerald" />
        <StatCard label="Total spent" value={String(analytics?.totalSpent ?? 0)} accent="rose" />
        <StatCard label="Admin grants" value={String(analytics?.totalAdminGrants ?? 0)} accent="violet" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Grant / Remove Tokens (audit)</p>
          <input className="admin-input font-mono" placeholder="User ID" value={grantForm.userId} onChange={(e) => setGrantForm(f => ({ ...f, userId: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className="admin-input" type="number" placeholder="Amount" value={grantForm.amount} onChange={(e) => setGrantForm(f => ({ ...f, amount: e.target.value }))} />
            <select className="admin-input" value={grantForm.type} onChange={(e) => setGrantForm(f => ({ ...f, type: e.target.value as "grant" | "remove" }))}>
              <option value="grant">Grant</option>
              <option value="remove">Remove</option>
            </select>
          </div>
          <input className="admin-input" placeholder="Reason (min 5 chars, audited)" value={grantForm.reason} onChange={(e) => setGrantForm(f => ({ ...f, reason: e.target.value }))} />
          <button onClick={() => void grantTokens()} disabled={grantLoading || !grantForm.userId || !grantForm.amount || grantForm.reason.length < 5} className="w-full rounded-lg bg-[var(--palette-amber-700)] hover:bg-[var(--palette-amber-800)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition">
            🪙 {grantForm.type === "remove" ? "Remove" : "Grant"} Tokens
          </button>
          {grantResult && (
            <div className={`rounded-lg border p-3 text-xs ${grantResult.error ? "border-[var(--palette-red-800)] bg-[var(--palette-red-950)] text-[var(--palette-red-400)]" : "border-[var(--palette-emerald-800)] bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]"}`}>
              {grantResult.error ? grantResult.error : `Before: ${grantResult.beforeBalance} → After: ${grantResult.afterBalance} • Ledger ${grantResult.ledgerId?.slice(0, 8)}`}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-400)]">Recent ledger (immutable audit)</p>
            <button onClick={() => { setLoading(true); void loadLedger(); }} className="text-[10px] text-[var(--palette-zinc-500)]">Refresh</button>
          </div>
          <div className="max-h-[400px] space-y-1.5 overflow-auto">
            {ledger.map((e) => (
              <div key={e.id} className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/30 px-3 py-2 text-[11px]">
                <div className="flex justify-between">
                  <span className={e.amount > 0 ? "text-[var(--palette-emerald-400)]" : "text-[var(--palette-red-400)]"}>{e.amount > 0 ? "+" : ""}{e.amount} {e.transactionType}</span>
                  <span className="text-[var(--palette-zinc-600)]">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-[var(--palette-zinc-400)]">{e.source} • balance_after {e.balanceAfter} • {e.adminReason ?? e.relatedEntityId ?? ""}</p>
                <p className="font-mono text-[9px] text-[var(--palette-zinc-600)]">{e.userId.slice(0, 8)}… idemp {e.idempotencyKey?.slice(0, 16) ?? "—"}…</p>
              </div>
            ))}
            {loading ? (
              <p className="text-xs text-[var(--palette-zinc-500)]">Loading ledger…</p>
            ) : ledger.length === 0 ? (
              <p className="text-xs text-[var(--palette-zinc-500)]">No ledger entries</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/20 p-4 text-xs text-[var(--palette-zinc-500)]">
        <p className="font-semibold text-[var(--palette-zinc-300)]">Anti-abuse &amp; token sources</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Sources: focus session, daily/weekly quest, streak, battle-pass milestone, community challenges, pet milestones, city upgrades, admin grants, seasonal events, referral</li>
          <li>Server timer validation, min duration, duplicate prevention, rate limits, cooldowns, daily caps, idempotency, transactions</li>
          <li>Ledger is source of truth with idempotency_key unique, balance_after, type earn/spend/refund/admin_grant/adjustment/expiration</li>
        </ul>
      </div>
    </MotionTab>
  );
}
