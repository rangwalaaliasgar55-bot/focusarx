import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MotionTab, SectionHeader, StatusBadge, adminFetch } from "./AdminHelpers";
import type { AdminPanelProps } from "./AdminTypes";

type DropsState = {
  drops: any[];
  sparklines: Record<string, Array<{ bucket: string; n: number }>>;
  templates: Array<{ type: string; label: string; description: string; defaultPayload: Record<string, any> }>;
  items: Array<{ id: string; name: string; costCoins: number }>;
};

type DropForm = {
  type: string;
  title: string;
  description: string;
  startsInMin: number;
  durationH: number;
  coinsPerClaim: number;
  poolTotal: number;
  multiplier: number;
  targetMinutes: number;
  rewardCoins: number;
  rewardXp: number;
  itemId: string;
  discountPct: number;
  emailBlast: boolean;
};

const DEFAULT_FORM: DropForm = {
  type: "coin_rain",
  title: "",
  description: "",
  startsInMin: 15,
  durationH: 3,
  coinsPerClaim: 250,
  poolTotal: 25000,
  multiplier: 2,
  targetMinutes: 120,
  rewardCoins: 1000,
  rewardXp: 500,
  itemId: "",
  discountPct: 50,
  emailBlast: false,
};

export function AdminDropsPanel({ authHeaders }: AdminPanelProps) {
  const [state, setState] = useState<DropsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<DropForm>(DEFAULT_FORM);

  const load = useCallback(async () => {
    try {
      const r = await adminFetch("/api/admin/drops", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setState(await r.json());
    } finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => { if (!state) void load(); }, [load, state]);

  function dropPayloadFor(f: DropForm): Record<string, any> {
    switch (f.type) {
      case "coin_rain": return { coinsPerClaim: f.coinsPerClaim, poolTotal: f.poolTotal };
      case "streak_freeze": return { tokensPerClaim: 1, poolTotal: f.poolTotal };
      case "double_xp": return { multiplier: f.multiplier };
      case "board_shakeup": return { multiplier: f.multiplier, scope: "weekly" };
      case "flash_quest": return { targetMinutes: f.targetMinutes, rewardCoins: f.rewardCoins, rewardXp: f.rewardXp };
      case "item_flash_sale": return { itemId: f.itemId, discountPct: f.discountPct };
      default: return {};
    }
  }

  async function createDropNow() {
    if (!form.title.trim()) { alert("Give the drop a title."); return; }
    if (form.type === "item_flash_sale" && !form.itemId) { alert("Pick an item for the flash sale."); return; }
    setBusy(true);
    try {
      const start = new Date(Date.now() + form.startsInMin * 60 * 1000);
      const end = new Date(start.getTime() + form.durationH * 3600 * 1000);
      const r = await adminFetch("/api/admin/drops", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: form.type,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          payload: dropPayloadFor(form),
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          emailBlast: form.emailBlast,
        }),
      });
      const d = await r.json();
      alert(r.ok
        ? `Drop live — announced to ${d.fannedOut} members${d.emailBlast === "queued" ? " + email blast queued" : ""}.`
        : (d.error ?? "Failed"));
      await load();
    } finally { setBusy(false); }
  }

  async function dropAction(id: string, action: "end" | "cancel" | "duplicate") {
    setBusy(true);
    try {
      const r = await adminFetch(`/api/admin/drops/${id}/${action}`, {
        method: "POST", headers: authHeaders(), credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) alert(d.error ?? "Failed");
      await load();
    } finally { setBusy(false); }
  }

  const drops = state?.drops ?? [];
  const templates = state?.templates ?? [];
  const items = state?.items ?? [];
  const sparklines = state?.sparklines ?? {};
  const now = Date.now();
  const currentTemplate = templates.find((t) => t.type === form.type);


  const numField = (label: string, key: string, step = 1) => (
    <label className="block">
      <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--palette-zinc-400)]">{label}</span>
      <input
        type="number"
        step={step}
        min={0}
        value={form[key as keyof DropForm] as number}
        onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) || 0 }))}
        className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)] outline-none focus:border-[var(--accent)]"
      />
    </label>
  );

  return (
    <MotionTab>
      <SectionHeader
        title="Admin Drops"
        sub="Scheduled hype events — coin rain, double-XP hours, flash quests, streak-freeze giveaways, item flash sales and leaderboard shake-ups."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Create panel */}
        <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--palette-zinc-200)]">New drop</h3>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button
                key={t.type}
                onClick={() => setForm((f) => ({ ...f, type: t.type }))}
                title={t.description}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.6875rem] transition",
                  form.type === t.type
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--palette-zinc-700)] text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)]"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mb-3 text-[0.6875rem] leading-relaxed text-[var(--palette-zinc-500)]">{currentTemplate?.description}</p>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--palette-zinc-400)]">Title</span>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Monsoon Coin Rain — 250 coins"
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--palette-zinc-400)]">Announcement text</span>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Coins are raining — grab yours before the pool runs out!"
                className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {numField("Starts in (minutes)", "startsInMin")}
              {numField("Window length (hours)", "durationH")}
              {(form.type === "coin_rain" || form.type === "streak_freeze") && numField(form.type === "coin_rain" ? "Coins per claim" : "Tokens per claim", "coinsPerClaim")}
              {(form.type === "coin_rain" || form.type === "streak_freeze") && numField("Total pool", "poolTotal")}
              {(form.type === "double_xp" || form.type === "board_shakeup") && numField("XP multiplier (×)", "multiplier", 0.5)}
              {form.type === "flash_quest" && numField("Target focus minutes", "targetMinutes")}
              {form.type === "flash_quest" && numField("Reward coins", "rewardCoins")}
              {form.type === "flash_quest" && numField("Reward XP", "rewardXp")}
              {form.type === "item_flash_sale" && numField("Discount %", "discountPct")}
            </div>
            {form.type === "item_flash_sale" && (
              <label className="block">
                <span className="mb-1 block text-[0.6875rem] font-medium text-[var(--palette-zinc-400)]">Item</span>
                <select value={form.itemId} onChange={(e) => setForm((f) => ({ ...f, itemId: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-900)] px-3 py-2 text-xs text-[var(--palette-zinc-200)] outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Select an item…</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name} — {it.costCoins.toLocaleString()} coins</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--palette-zinc-400)]">
              <input type="checkbox" checked={form.emailBlast} onChange={(e) => setForm((f) => ({ ...f, emailBlast: e.target.checked }))} className="accent-[var(--accent)]" />
              Also send an email blast to every member
            </label>
            <button onClick={() => void createDropNow()} disabled={busy}
              className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Working…" : "Create & announce drop"}
            </button>
          </div>
        </div>

        {/* Live monitor */}
        <div className="rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-950)]/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--palette-zinc-200)]">Drops ({drops.length})</h3>
            <button onClick={() => { setLoading(true); void load(); }} className="text-xs text-[var(--palette-zinc-500)] hover:text-[var(--palette-zinc-300)] transition">
              <RefreshCw size={12} className={cn("inline mr-1", loading && "animate-spin")} />Refresh
            </button>
          </div>
          {drops.length === 0 && <p className="text-xs text-[var(--palette-zinc-500)]">No drops yet. Create your first drop — it announces instantly to every member.</p>}
          <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {drops.map((d) => {
              const state = d.live ? "live" : d.cancelledAt ? "cancelled" : d.startsAt > new Date(now) ? "upcoming" : "ended";
              const spark = sparklines[d.id] ?? [];
              const maxN = Math.max(1, ...spark.map((s: any) => s.n));
              const pct = d.poolTotal > 0 ? Math.max(0, Math.min(100, Math.round(((d.poolRemaining ?? 0) / d.poolTotal) * 100))) : null;
              return (
                <div key={d.id} className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold text-[var(--palette-zinc-200)]">{d.title}</span>
                        <StatusBadge status={state as any} />
                      </div>
                      {d.description && <p className="mt-0.5 truncate text-[0.6875rem] text-[var(--palette-zinc-500)]">{d.description}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.625rem] text-[var(--palette-zinc-500)]">
                        <span>{d.type.replace("_", " ")}</span>
                        <span>ends {new Date(d.endsAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-[var(--palette-zinc-300)]">{d.claims} claims{d.createdVia === "gemini" && " · via Gemini"}</span>
                        {pct !== null && <span className={pct === 0 ? "text-[var(--palette-rose-400)]" : undefined}>{d.poolRemaining ?? 0} / {d.poolTotal} left ({pct}%)</span>}
                      </div>
                      {pct !== null && (
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--palette-zinc-800)]">
                          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      {spark.length > 0 && (
                        <div className="mt-2 flex h-8 items-end gap-0.5">
                          {spark.map((sp: any, i: number) => (
                            <div key={i} className="flex-1 rounded-sm bg-[var(--accent)]/50" style={{ height: `${Math.max(8, (sp.n / maxN) * 100)}%` }} title={`${sp.bucket} — ${sp.n} claims`} />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {d.live && (
                        <>
                          <button onClick={() => { if (confirm(`End "${d.title}" now?`)) void dropAction(d.id, "end"); }} className="rounded border border-[var(--palette-zinc-700)] px-2 py-1 text-[0.625rem] text-[var(--palette-zinc-300)] hover:text-[var(--palette-zinc-100)]">End</button>
                          <button onClick={() => void dropAction(d.id, "duplicate")} className="rounded border border-[var(--palette-zinc-700)] px-2 py-1 text-[0.625rem] text-[var(--palette-zinc-300)] hover:text-[var(--palette-zinc-100)]">Repeat</button>
                        </>
                      )}
                      {!d.live && !d.cancelledAt && d.startsAt > new Date(now) && (
                        <button onClick={() => { if (confirm(`Cancel "${d.title}" before it starts?`)) void dropAction(d.id, "cancel"); }} className="rounded border border-[var(--palette-rose-800)] px-2 py-1 text-[0.625rem] text-[var(--palette-rose-400)] hover:bg-[var(--palette-rose-950)]">Cancel</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-[0.6875rem] leading-relaxed text-[var(--palette-zinc-500)]">
        <li>Pools are atomic — the last coin can never be oversold to two members; each member claims once per drop (enforced in the database).</li>
        <li>Double-XP and shake-up multipliers apply server-side to session rewards only while the window is live — nothing to claim, nothing to spoof.</li>
        <li>Expiry is a window check (no cron). The public /drops endpoint drives the live countdown chips in the app.</li>
      </ul>
    </MotionTab>
  );
}
