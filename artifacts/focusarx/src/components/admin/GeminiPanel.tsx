/**
 * Gemini chief-of-staff panel (Workstream G, G3).
 *
 * Self-contained admin component (same pattern as AnalyticsDashboard):
 *   - Budget & traffic (G5): daily caps, 24h purpose usage, 7-day cost
 *   - Idea backlog (G3): Gemini's running suggestions; approve/reject
 *   - Briefings (G7/G6): daily IST ops briefing + SEO officer, with
 *     one-click generate (idempotent per day, `force` to regenerate)
 *   - Bot fleet (G4): overview + AI ops review (suggest-only, never block)
 *
 * Everything degrades gracefully with zero AI keys (template briefings).
 */

import { adminFetch } from "./AdminHelpers";import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Brain, Cpu, Gauge, Lightbulb, Newspaper, Radio, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type ProviderStatus = {
  configured: boolean;
  model: string;
  used: number;
  cap: number;
  available: boolean;
  coolUntil: string | null;
};

type StatusData = {
  availability: { gemini: ProviderStatus; groq: ProviderStatus };
  budget: { gemini: number; geminiCap: number; geminiAvailable: boolean; coolUntil: string | null };
  purposeUsage: Array<{ purpose: string; calls: number; ok: number; fallback: number; avgLatencyMs: number }>;
  cost: { calls: number; usd: number; byProvider: Record<string, number> };
  botFleet: { bots: number; botPosts24h: number; botComments24h: number; guardrail: string };
  ideasBacklog: number;
};

type Idea = {
  id: string;
  title: string;
  body: string;
  category: string;
  effort: string;
  impact: string;
  source: string;
  status: string;
  createdAt: string;
};

type Briefing = {
  id: string;
  day: string;
  kind: string;
  summary: string;
  data: Record<string, unknown>;
  createdAt: string;
};

const CATEGORY_STYLE: Record<string, string> = {
  growth: "bg-[var(--palette-emerald-950)] text-[var(--palette-emerald-400)]",
  seo: "bg-[var(--palette-sky-950)] text-[var(--palette-sky-400)]",
  feature: "bg-[var(--palette-violet-950)] text-[var(--palette-violet-400)]",
  event: "bg-[var(--palette-amber-950)] text-[var(--palette-amber-400)]",
};

export function GeminiPanel({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaStatusFilter, setIdeaStatusFilter] = useState("backlog");
  const [ideaBusy, setIdeaBusy] = useState<string | null>(null);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<string | null>(null);

  /* `loading` starts true because this loader runs from the mount effect: a
     `setLoading(true)` as its first statement would make that effect set state
     synchronously, which is the cascade the react-hooks rule exists to catch. */
  const loadStatus = useCallback(async () => {
    try {
      const r = await adminFetch("/api/admin/gemini/status", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setStatus(await r.json());
    } finally { setLoading(false); }
  }, [authHeaders]);

  const loadIdeas = useCallback(async () => {
    try {
      const r = await adminFetch(`/api/admin/gemini/ideas?status=${ideaStatusFilter}`, { headers: authHeaders(), credentials: "include" });
      if (r.ok) setIdeas(((await r.json()) as { ideas?: Idea[] }).ideas ?? []);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, ideaStatusFilter]);

  const loadBriefings = useCallback(async () => {
    try {
      const r = await adminFetch("/api/admin/gemini/briefings", { headers: authHeaders(), credentials: "include" });
      if (r.ok) setBriefings(((await r.json()) as { briefings?: [] }).briefings ?? []);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { void loadStatus(); void loadBriefings(); }, [loadStatus, loadBriefings]);
  useEffect(() => { void loadIdeas(); }, [loadIdeas]);

  const decideIdea = async (id: string, decision: "approve" | "reject") => {
    setIdeaBusy(id);
    try {
      const r = await adminFetch(`/api/admin/gemini/ideas/${id}/${decision}`, { method: "POST", headers: authHeaders(), credentials: "include" });
      if (r.ok) {
        await loadIdeas();
        await loadStatus();
      }
    } finally { setIdeaBusy(null); }
  };

  const generate = async (kind: "daily" | "seo") => {
    setGenBusy(kind);
    setGenResult(null);
    try {
      const r = await adminFetch(`/api/admin/gemini/briefings/${kind}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ force: false }),
      });
      const d = await r.json();
      setGenResult(
        r.ok
          ? d.already ? `Today's ${kind === "seo" ? "SEO officer" : "briefing"} already ran (idempotent).` : `Generated (${d.source ?? "template"}).`
          : `Error: ${d.error ?? "Failed"}`
      );
      await loadBriefings();
      await loadIdeas();
    } finally { setGenBusy(null); }
  };

  const botOps = async () => {
    setGenBusy("botops");
    setGenResult(null);
    try {
      const r = await adminFetch("/api/admin/gemini/bot-ops", {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
      });
      const d = await r.json();
      setGenResult(r.ok ? `Bot ops review filed as a backlog idea (${d.source}).` : `Error: ${d.error ?? "Failed"}`);
      await loadIdeas();
    } finally { setGenBusy(null); }
  };

  const pct = (n: number, cap: number) => (cap > 0 ? Math.min(100, Math.round((n / cap) * 100)) : 0);

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      {/* ── Budget & traffic ─────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["gemini", "groq"] as const).map((p) => {
          const v = status?.availability[p];
          return (
            <div key={p} className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
                  <Cpu size={13} /> {p}
                </p>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  !v ? "bg-[var(--surface-hover)] text-[var(--foreground-subtle)]"
                    : v.configured ? "bg-[var(--success-soft)] text-[var(--success)]"
                    : "bg-[var(--surface-hover)] text-[var(--foreground-subtle)]"
                )}>
                  {!v ? "…" : v.configured ? (v.available ? "available" : "budget out") : "no key"}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--foreground)]">
                {v ? `${v.used} <span className="text-sm font-medium text-[var(--foreground-subtle)]">/ {v.cap} today</span>` : "—"}
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
                <div
                  className={cn("h-full rounded-full transition-all", v && v.used >= v.cap ? "bg-[var(--danger)]" : "bg-[var(--brand-strong)]")}
                  style={{ width: `${v ? pct(v.used, v.cap) : 0}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--foreground-subtle)]">{v?.model}</p>
            </div>
          );
        })}
        <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
            <Gauge size={13} /> 7-day cost (est.)
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--foreground)]">
            ${status?.cost.usd ?? 0}
            <span className="ml-1 text-sm font-medium text-[var(--foreground-subtle)]">{status?.cost.calls ?? 0} calls</span>
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--foreground-subtle)]">
            {status
              ? Object.entries(status.cost.byProvider).map(([k, v]) => `${k} $${v}`).join(" · ") || "no calls yet"
              : "display estimate only — never billing"}
          </p>
        </div>
        <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
            <Radio size={13} /> Bot fleet (24h)
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--foreground)]">
            {status?.botFleet.bots ?? "—"}
            <span className="ml-1 text-sm font-medium text-[var(--foreground-subtle)]">bots</span>
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--foreground-subtle)]">
            {status ? `${status.botFleet.botPosts24h} posts · ${status.botFleet.botComments24h} comments` : "loading…"}
          </p>
        </div>
      </section>

      {/* 24h purpose usage */}
      {status && status.purposeUsage.length > 0 && (
        <section className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
            <Activity size={13} /> AI calls — last 24h by purpose
          </p>
          <div className="flex flex-wrap gap-2">
            {status.purposeUsage.map((u) => (
              <div key={u.purpose} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-hover)]/50 px-3 py-2">
                <p className="text-xs font-semibold text-[var(--foreground)]">{u.purpose}</p>
                <p className="text-[11px] text-[var(--foreground-muted)]">
                  {u.calls} calls · {u.ok} ok · {u.fallback} fallback · ~{u.avgLatencyMs}ms
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* ── Idea backlog ───────────────────────────────────────────── */}
        <section className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
              <Lightbulb size={13} /> Idea backlog {status ? `(${status.ideasBacklog} pending)` : ""}
            </p>
            <div className="flex items-center gap-1.5">
              {["backlog", "approved", "all"].map((f) => (
                <button
                  key={f}
                  onClick={() => setIdeaStatusFilter(f)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition",
                    ideaStatusFilter === f
                      ? "border-[var(--brand-strong)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                      : "border-[var(--border-subtle)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {f}
                </button>
              ))}
              <button disabled={loading} onClick={() => { setLoading(true); void loadIdeas(); }} className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
          <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {ideas.length === 0 && (
              <p className="py-6 text-center text-xs text-[var(--foreground-subtle)]">
                No ideas {ideaStatusFilter === "all" ? "" : `in “${ideaStatusFilter}” yet`}. The SEO officer and bot-ops review file ideas here automatically.
              </p>
            )}
            {ideas.map((idea) => (
              <motion.div key={idea.id} layout className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", CATEGORY_STYLE[idea.category] ?? CATEGORY_STYLE.feature)}>
                    {idea.category}
                  </span>
                  <span className="rounded-full bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] text-[var(--foreground-muted)]">{idea.effort} · impact {idea.impact}</span>
                  <span className="ml-auto text-[11px] text-[var(--foreground-subtle)]">{idea.source} · {new Date(idea.createdAt).toLocaleDateString("en-IN")}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-[var(--foreground)]">{idea.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">{idea.body}</p>
                {idea.status === "backlog" && (
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => void decideIdea(idea.id, "approve")}
                      disabled={ideaBusy === idea.id}
                      className="rounded-lg border border-[var(--success)] bg-[var(--success-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--success)] disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => void decideIdea(idea.id, "reject")}
                      disabled={ideaBusy === idea.id}
                      className="rounded-lg border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--danger)] disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--foreground-subtle)]">
            Auto-publish is OFF by design: AI-suggested work stays a backlog item until a human approves it. Every decision is written to the immutable AI action audit log.
          </p>
        </section>

        {/* ── Briefings + officers ───────────────────────────────────── */}
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
              <Sparkles size={13} /> Officers (lazy ticks — no cron)
            </p>
            <div className="space-y-2">
              <button
                onClick={() => void generate("daily")}
                disabled={genBusy !== null}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--brand-strong)] bg-[var(--brand-soft)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--brand-strong)] disabled:opacity-50"
              >
                <Newspaper size={14} />
                {genBusy === "daily" ? "Writing daily briefing…" : "Run daily IST briefing (G7)"}
              </button>
              <button
                onClick={() => void generate("seo")}
                disabled={genBusy !== null}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-hover)]/40 px-3 py-2.5 text-left text-xs font-semibold text-[var(--foreground)] disabled:opacity-50"
              >
                <Brain size={14} />
                {genBusy === "seo" ? "SEO officer working…" : "Run daily SEO officer (G6)"}
              </button>
              <button
                onClick={() => void botOps()}
                disabled={genBusy !== null}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-hover)]/40 px-3 py-2.5 text-left text-xs font-semibold text-[var(--foreground)] disabled:opacity-50"
              >
                <Cpu size={14} />
                {genBusy === "botops" ? "Reviewing fleet…" : "Bot ops review (G4)"}
              </button>
              {genResult && <p className="text-[11px] font-medium text-[var(--success)]">{genResult}</p>}
              <p className="text-[11px] leading-relaxed text-[var(--foreground-subtle)]">
                {status?.botFleet.guardrail ?? "Guardrail: the AI can suggest but never block, mute, or ban."}
              </p>
            </div>
          </div>

          <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
                <Newspaper size={13} /> Briefings
              </p>
              <button disabled={loading} onClick={() => { setLoading(true); void loadBriefings(); }} className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
                <RefreshCw size={12} />
              </button>
            </div>
            <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
              {briefings.length === 0 && (
                <p className="py-4 text-center text-xs text-[var(--foreground-subtle)]">
                  No briefings yet — run the daily briefing above (works with zero AI keys via templates).
                </p>
              )}
              {briefings.map((b) => (
                <details key={b.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 p-3">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--foreground)]">
                    <span className={cn("mr-1.5 rounded-full px-1.5 py-0.5 text-[11px] uppercase tracking-wide", b.kind === "daily" ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "bg-[var(--success-soft)] text-[var(--success)]")}>
                      {b.kind}
                    </span>
                    {b.day}
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--foreground-muted)]">{b.summary}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
