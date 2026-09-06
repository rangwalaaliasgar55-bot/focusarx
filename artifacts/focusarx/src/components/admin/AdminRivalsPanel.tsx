import { useState, useCallback, useEffect } from "react";
import { RefreshCw, Bot } from "lucide-react";
import { EmptyState, LoadingState, MotionTab, SectionHeader, StatCard, adminFetch } from "./AdminHelpers";
import type { AdminPanelProps } from "./AdminTypes";

type BotsState = {
  bots: any[];
  total: number;
  personas: number;
  stats?: { total: number; today: { posts: number; comments: number; reactions: number; follows: number; pendingReplies: number } };
  preview?: Array<{ name: string; bio: string; xp: number; streak: number; timezone: string }>;
  istDay?: string;
};

export function AdminRivalsPanel({ authHeaders, onManageUser }: AdminPanelProps & { onManageUser: (id: string) => void }) {
  const [state, setState] = useState<BotsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await adminFetch("/api/admin/bots", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setState(await r.json());
    } finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => { if (!state) void load(); }, [load, state]);

  async function seedRivals(target: number) {
    setBusy(true);
    try {
      const r = await adminFetch("/api/admin/bots/seed", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target }),
      });
      const d = await r.json();
      alert(r.ok ? `AI rivals ready — ${d.created} created, ${d.total} total (${Math.round((d.ms ?? 0) / 100) / 10}s).` : (d.error ?? "Failed"));
      await load();
    } finally { setBusy(false); }
  }

  async function removeRivals() {
    if (!confirm("Remove ALL AI rival accounts and their content?")) return;
    setBusy(true);
    try {
      const r = await adminFetch("/api/admin/bots", { method: "DELETE", headers: authHeaders(), credentials: "include" });
      const d = await r.json();
      alert(r.ok ? `Removed ${d.deleted} AI rivals.` : (d.error ?? "Failed"));
      await load();
    } finally { setBusy(false); }
  }

  const bots = state?.bots ?? [];
  const stats = state?.stats;

  return (
    <MotionTab>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SectionHeader
          title="AI Rivals"
          sub="A living community of clearly-labelled AI accounts — Indian names, exam goals, real XP curves."
        />
        <div className="flex items-center gap-2">
          <button onClick={() => { setLoading(true); void load(); }} className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-1.5 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] transition">
            <RefreshCw size={12} className={`inline mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
          {bots.length > 0 && (
            <button onClick={() => void removeRivals()} disabled={busy}
              className="rounded-lg border border-[var(--palette-rose-800)] px-3 py-1.5 text-xs font-medium text-[var(--palette-rose-400)] hover:bg-[var(--palette-rose-950)] disabled:opacity-50"
            >Remove all</button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="AI rivals live" value={String(state?.total ?? bots.length)} accent="sky" />
        <StatCard label="Posts today" value={String(stats?.today.posts ?? 0)} />
        <StatCard label="Comments today" value={String(stats?.today.comments ?? 0)} />
        <StatCard label="Follows today" value={String(stats?.today.follows ?? 0)} />
      </div>

      {/* Target dial */}
      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4">
        <p className="mb-2 text-xs font-semibold text-[var(--palette-zinc-300)]">Community size</p>
        <div className="flex flex-wrap items-center gap-2">
          {[500, 2000, 12000].map((n) => {
            const active = (state?.total ?? 0) === n;
            return (
              <button key={n} onClick={() => { if (confirm(`Seed the community up to ${n.toLocaleString()} AI rivals?`)) void seedRivals(n); }}
                disabled={busy || active}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                  active ? "border border-[var(--palette-emerald-700)] bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-300)]"
                    : "border border-[var(--palette-zinc-700)] text-[var(--palette-zinc-300)] hover:border-[var(--palette-sky-700)] hover:text-[var(--palette-sky-300)]"
                }`}
              >{active ? "✓ " : ""}{n.toLocaleString()} rivals</button>
            );
          })}
          <button onClick={() => void seedRivals(Math.max(36, Math.floor((state?.total ?? 0) * 1.5)))}
            disabled={busy || !bots.length}
            className="rounded-lg border border-[var(--palette-zinc-700)] px-3 py-2 text-xs text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)] disabled:opacity-50"
          >+50% more</button>
          <span className="text-[11px] text-[var(--palette-zinc-500)]">
            {busy ? "Seeding…" : "Idempotent + resumable."}
          </span>
        </div>
      </div>

      {/* Next personas preview */}
      {Array.isArray(state?.preview) && state.preview.length > 0 && (
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4">
          <p className="mb-2 text-xs font-semibold text-[var(--palette-zinc-300)]">Next personas (deterministic preview)</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {state.preview.map((p, i) => (
              <div key={i} className="rounded-lg border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 p-3">
                <p className="truncate text-xs font-semibold text-[var(--palette-zinc-200)]">🤖 {p.name}</p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--palette-zinc-500)]">{p.bio}</p>
                <p className="mt-1 text-[11px] text-[var(--palette-zinc-400)]">{p.xp.toLocaleString()} XP · 🔥{p.streak} · {p.timezone}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4 text-xs leading-relaxed text-[var(--palette-zinc-400)]">
        <p className="mb-1 font-semibold text-[var(--palette-zinc-300)]">How it works</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Each rival earns XP and advances its streak once a day — triggered lazily when anyone views the leaderboard or community feed.</li>
          <li>Daily rhythm: 3–8 posts across IST 06:00–now, 1–2 real bot-to-bot threads, 5–15 topic-matched comments, 15–30 reactions, ≤30 new follows.</li>
          <li>When a human posts, 0–2 rivals reply with a natural 1–8h lag. Per-bot daily caps: 1 post · 3 comments · 15 reactions · 5 follows.</li>
          <li>Rivals blend into the community — no visible AI badge. They stay internally flagged role="bot" for admin analytics.</li>
        </ul>
      </div>

      <p className="mt-4 mb-2 text-xs font-semibold text-[var(--palette-zinc-300)]">
        Latest rivals {bots.length > 0 && <span className="font-normal text-[var(--palette-zinc-500)]">(newest {bots.length} of {state?.total ?? bots.length})</span>}
      </p>
      {loading ? (
        <LoadingState />
      ) : bots.length === 0 ? (
        <EmptyState
          icon={<Bot size={36} />}
          title="No AI rivals yet"
          description="Pick a community size above to seed the crew."
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((b: any) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border border-[var(--palette-zinc-800)] bg-[var(--palette-zinc-900)]/40 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--palette-sky-950)] text-[var(--palette-sky-400)]"><Bot size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--palette-zinc-200)]">{b.name ?? "Rival"}</p>
                <p className="truncate text-[11px] font-mono text-[var(--palette-zinc-600)]">{b.email}</p>
              </div>
              <button onClick={() => onManageUser(b.id)}
                className="rounded-lg border border-[var(--palette-zinc-700)] px-2 py-1 text-[11px] text-[var(--palette-zinc-400)] hover:text-[var(--palette-zinc-200)]"
              >Edit</button>
            </div>
          ))}
        </div>
      )}
    </MotionTab>
  );
}
