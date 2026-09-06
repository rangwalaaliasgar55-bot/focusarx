import { useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MotionTab, SectionHeader, StatCard, adminFetch } from "./AdminHelpers";
import type { AdminPanelProps } from "./AdminTypes";

type EconomyState = {
  supply: { total: number; humans: number; bots: number; wallets: number };
  last7: { mints: number; burns: number; net: number };
  inflationPct: number;
  inflationAlert: boolean;
  daily: Array<{ day: string; mints: number; burns: number }>;
  topReasons: Array<{ reason: string; type: string; total: string; n: number }>;
  marketplace: Record<string, { n: number; total: number }>;
};

export function AdminEconomyPanel({ authHeaders }: AdminPanelProps) {
  const [state, setState] = useState<EconomyState | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/economy", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setState(await r.json());
    } finally { setLoading(false); }
  }, [authHeaders]);

  // Load on first render
  if (!state && !loading) { void load(); }

  const e = state;
  const fmt = (n: number) => n.toLocaleString("en-IN");
  const maxFlow = e ? Math.max(1, ...e.daily.map(d => Math.max(d.mints, d.burns))) : 1;

  const MARKETPLACE_FLOWS = [
    { label: "🛒 Purchases", key: "marketplace_purchase" },
    { label: "🎁 Gifts (incl. 5% tax)", key: "gift_purchase" },
    { label: "♻️ Sell-backs (50% refund)", key: "sellback" },
    { label: "📦 Bundles", key: "bundle_purchase" },
  ] as Array<{ label: string; key: string }>;

  return (
    <MotionTab>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SectionHeader
          title="Economy"
          sub="Circulating supply, coin flow and ledger health. Every mint/burn writes to coin_transactions (lib/coinLedger)."
        />
        <button onClick={() => void load()} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
          <RefreshCw size={12} className={cn("inline mr-1", loading && "animate-spin")} />Refresh
        </button>
      </div>

      {!e && <p className="text-xs text-[var(--palette-zinc-500)]">{loading ? "Loading…" : "No data yet."}</p>}

      {e && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Circulating supply" value={fmt(e.supply.total)} accent="violet" sub={`${fmt(e.supply.humans)} humans · ${fmt(e.supply.wallets)} wallets`} />
            <StatCard label="In AI rival wallets" value={fmt(e.supply.bots)} accent="sky" sub={`${e.supply.total > 0 ? Math.round((e.supply.bots / e.supply.total) * 100) : 0}% of supply (simulated economy)`} />
            <StatCard label="7-day mints" value={`+${fmt(e.last7.mints)}`} accent="emerald" sub={`${e.last7.net >= 0 ? "net +" : ""}${fmt(e.last7.net)}`} />
            <StatCard label="7-day burns" value={`-${fmt(e.last7.burns)}`} accent="rose" sub={`inflation ${e.inflationPct}% of supply / 7d`} />
          </div>

          {e.inflationAlert && (
            <div className="mt-4 rounded-xl border border-[var(--palette-amber-500)]/40 bg-[var(--palette-amber-500)]/10 p-4">
              <p className="text-xs font-semibold text-[var(--palette-amber-400)]">⚠️ Inflation alert</p>
              <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--palette-zinc-400)]">
                Net coin mints over 7 days are {e.inflationPct}% of circulating supply (threshold 5%). Consider raising coin sinks or lowering mint rates.
              </p>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* 14-day flow */}
            <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--palette-zinc-200)]">14-day coin flow (IST days)</h3>
              <div className="flex h-40 items-end gap-1">
                {e.daily.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day} — minted ${d.mints.toLocaleString()}, burned ${d.burns.toLocaleString()}`}>
                    <div className="flex w-full flex-1 items-end justify-center gap-px">
                      <div className="w-1/2 rounded-t-sm bg-[var(--palette-emerald-500)]/70" style={{ height: `${Math.max(3, (d.mints / maxFlow) * 100)}%` }} />
                      <div className="w-1/2 rounded-t-sm bg-[var(--palette-rose-500)]/70" style={{ height: `${Math.max(3, (d.burns / maxFlow) * 100)}%` }} />
                    </div>
                    <span className="text-[0.5rem] text-[var(--palette-zinc-600)]">{d.day.slice(3)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-4 text-[0.625rem] text-[var(--palette-zinc-500)]">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[var(--palette-emerald-500)]/70" /> minted</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[var(--palette-rose-500)]/70" /> burned</span>
              </div>
            </div>

            {/* Top reasons */}
            <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--palette-zinc-200)]">Top coin movers — last 7 days</h3>
              <div className="space-y-1.5">
                {e.topReasons.length === 0 && <p className="text-xs text-[var(--palette-zinc-500)]">No transactions yet.</p>}
                {e.topReasons.map((r) => {
                  const total = Number(r.total);
                  return (
                    <div key={`${r.reason}-${r.type}`} className="flex items-center justify-between rounded-lg bg-[var(--palette-zinc-900)]/50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[var(--palette-zinc-300)]">{r.reason.replace(/_/g, " ")}</p>
                        <p className="text-[0.625rem] text-[var(--palette-zinc-500)]">{r.n} transactions</p>
                      </div>
                      <span className={cn("shrink-0 text-xs font-bold", total >= 0 ? "text-[var(--palette-emerald-400)]" : "text-[var(--palette-rose-400)]")}>
                        {total >= 0 ? "+" : ""}{total.toLocaleString("en-IN")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Marketplace flows */}
          <div className="mt-4 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--palette-zinc-200)]">Marketplace flows — last 7 days</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              {MARKETPLACE_FLOWS.map(({ label, key }) => {
                const m = e.marketplace[key];
                return (
                  <div key={key} className="rounded-lg bg-[var(--palette-zinc-900)]/50 p-3">
                    <p className="text-[0.6875rem] text-[var(--palette-zinc-400)]">{label}</p>
                    <p className="mt-1 text-lg font-bold text-[var(--palette-zinc-200)]">{m?.n ?? 0}</p>
                    <p className={cn("text-[0.625rem]", (m?.total ?? 0) >= 0 ? "text-[var(--palette-emerald-400)]" : "text-[var(--palette-rose-400)]")}>
                      {(m?.total ?? 0) >= 0 ? "+" : ""}{(m?.total ?? 0).toLocaleString("en-IN")} coins
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </MotionTab>
  );
}
