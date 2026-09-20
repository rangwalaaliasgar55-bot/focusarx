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
import { Activity, Brain, Compass, Cpu, Gauge, Lightbulb, Newspaper, Radio, RefreshCw, ShoppingBag, Sparkles } from "lucide-react";
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

type FeatureFlagRow = {
  key: string;
  description: string | null;
  rolloutPercentage: number;
  enabled: boolean;
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
  /* Auto-publish (feature flag `gemini_auto_publish`): while ON, approving
     an idea ships it straight to the community feed. The server defaults ON
     when the flag row is absent, so the optimistic default here matches. */
  const [autoPublish, setAutoPublish] = useState(true);
  const [autoPublishBusy, setAutoPublishBusy] = useState(false);
  const [adminAction, setAdminAction] = useState<"feed_post" | "announcement" | "quest_builder" | "marketplace_steward">("feed_post");
  const [actionTitle, setActionTitle] = useState("");
  const [actionBody, setActionBody] = useState("");
  const [actionTheme, setActionTheme] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const r = await adminFetch("/api/admin/feature-flags", { headers: authHeaders(), credentials: "include" });
        if (!r.ok || !alive) return;
        const d = await r.json();
        const flag = (d.flags as FeatureFlagRow[] | undefined)?.find((f) => f.key === "gemini_auto_publish");
        // Absent row = server default = ON.
        if (alive) setAutoPublish(flag ? flag.enabled : true);
      } catch { /* keep the optimistic default */ }
    })();
    return () => { alive = false; };
  }, [authHeaders]);

  const toggleAutoPublish = async () => {
    const next = !autoPublish;
    setAutoPublishBusy(true);
    try {
      const r = await adminFetch("/api/admin/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          key: "gemini_auto_publish",
          enabled: next,
          description: "Auto-publish approved Gemini ideas to the community feed",
        }),
      });
      if (r.ok) setAutoPublish(next);
    } finally { setAutoPublishBusy(false); }
  };

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

  /* Ship an approved idea: feed posts land as the admin (the bot fleet
     reacts to admin posts within minutes), announcements go to the site-wide
     banner. This is the step that stops approvals from being a dead end. */
  const publishIdea = async (id: string, channel: "feed" | "announcement") => {
    setIdeaBusy(id);
    try {
      const r = await adminFetch(`/api/admin/gemini/ideas/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ channel }),
      });
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

  /**
   * Steward jobs: Gemini produces the artefacts instead of the summary.
   * The server clamps everything it writes, so the UI just reports what
   * actually landed in the catalogue/quest log.
   */
  const steward = async (job: "quests" | "marketplace") => {
    setGenBusy(job);
    setGenResult(null);
    try {
      const r = await adminFetch(`/api/admin/gemini/${job === "quests" ? "quest-builder" : "marketplace-steward"}`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) { setGenResult(`Error: ${d.error ?? "Failed"}`); return; }
      if (job === "quests") {
        setGenResult(d.created?.length
          ? `Published ${d.created.length} quest(s) via ${d.source}: ${d.created.join(", ")}`
          : "No new quests needed — the rotation already covers today.");
      } else {
        const intro = d.introduced?.map((i: { name: string }) => i.name).join(", ") || "none";
        const retired = d.retired?.map((x: { id: string }) => x.id).join(", ") || "none";
        setGenResult(`Introduced: ${intro} · Retired: ${retired} (${d.source}).`);
      }
    } finally { setGenBusy(null); }
  };

  const executeAdminAction = async () => {
    setActionBusy(true);
    setActionResult(null);
    try {
      const r = await adminFetch("/api/admin/gemini/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          action: adminAction,
          ...(adminAction === "feed_post" || adminAction === "announcement"
            ? { title: actionTitle, body: actionBody }
            : adminAction === "quest_builder"
              ? { theme: actionTheme || undefined, count: 1 }
              : { introduce: 1, retire: 1 }),
        }),
      });
      const d = await r.json() as { message?: string; error?: string; postId?: string };
      if (!r.ok) {
        setActionResult(`Error: ${d.error ?? "Action failed"}`);
        return;
      }
      setActionResult(d.message ?? (d.postId ? `Published post ${d.postId}.` : "Action completed."));
      if (adminAction === "feed_post" || adminAction === "announcement") {
        setActionTitle("");
        setActionBody("");
      }
      await loadStatus();
      await loadIdeas();
    } catch {
      setActionResult("Error: could not reach the admin action service.");
    } finally {
      setActionBusy(false);
    }
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
                {v ? (
                  <>
                    {v.used}
                    <span className="ml-1 text-sm font-medium text-[var(--foreground-subtle)]">/ {v.cap} today</span>
                  </>
                ) : "—"}
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
              {["backlog", "approved", "published", "all"].map((f) => (
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

          {/* Auto-publish switch — approval becomes the publish trigger. */}
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-hover)]/40 px-3 py-2">
            <div>
              <p className="text-xs font-semibold">Auto-publish</p>
              <p className="text-[11px] text-[var(--foreground-subtle)]">
                {autoPublish ? "ON — approving an idea posts it to the community feed instantly." : "OFF — approved ideas wait for a manual publish click."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoPublish}
              aria-label="Auto-publish approved ideas"
              disabled={autoPublishBusy}
              onClick={() => void toggleAutoPublish()}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${autoPublish ? "bg-[var(--success)]" : "bg-[var(--palette-zinc-700)]"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--palette-white)] transition-transform ${autoPublish ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
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
                {idea.status === "approved" && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void publishIdea(idea.id, "feed")}
                      disabled={ideaBusy === idea.id}
                      className="rounded-lg border border-[var(--brand-strong)] bg-[var(--brand-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--brand-strong)] disabled:opacity-50"
                    >
                      📣 Publish to community feed
                    </button>
                    <button
                      onClick={() => void publishIdea(idea.id, "announcement")}
                      disabled={ideaBusy === idea.id}
                      className="rounded-lg border border-[var(--border-subtle)] px-3 py-1 text-[11px] font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] disabled:opacity-50"
                    >
                      📌 Set as site announcement
                    </button>
                  </div>
                )}
                {idea.status === "published" && (
                  <p className="mt-2.5 text-[11px] font-semibold text-[var(--success)]">✓ Published — live on the site</p>
                )}
              </motion.div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--foreground-subtle)]">
            {autoPublish
              ? "Auto-publish is ON: approving an idea ships it to the community feed at once (the bot fleet reacts to the admin post within minutes). Use the publish buttons for announcements or ideas you approved earlier. Every decision and publish is written to the immutable AI action audit log."
              : "Auto-publish is OFF: approve an idea, then use the publish buttons to ship it to the community feed or the site announcement. Every decision and publish is written to the immutable AI action audit log."}
          </p>
        </section>

        {/* ── Briefings + officers ───────────────────────────────────── */}
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">
              <Sparkles size={13} /> Officers (lazy ticks — no cron)
            </p>

            {/* Explicit command centre: admins choose a bounded operation and
                enter the content/parameters. It executes on the server and
                reports the actual post/quest result instead of pretending that
                a prompt was acted on. */}
            <div className="mb-4 rounded-xl border border-[var(--brand-strong)]/25 bg-[var(--brand-soft)]/30 p-3">
              <p className="text-xs font-semibold text-[var(--foreground)]">Gemini action centre</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--foreground-subtle)]">
                Give Gemini a safe, concrete operation. Publishing is immediate and audit-logged; it never moderates accounts or moves currency.
              </p>
              <select
                value={adminAction}
                onChange={(e) => setAdminAction(e.target.value as typeof adminAction)}
                className="mt-2 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)]"
                aria-label="Gemini admin action"
              >
                <option value="feed_post">Publish a community feed post</option>
                <option value="announcement">Publish a site announcement</option>
                <option value="quest_builder">Build one quest for everyone</option>
                <option value="marketplace_steward">Curate one marketplace item</option>
              </select>
              {(adminAction === "feed_post" || adminAction === "announcement") ? (
                <div className="mt-2 space-y-2">
                  <input
                    value={actionTitle}
                    onChange={(e) => setActionTitle(e.target.value)}
                    placeholder={adminAction === "feed_post" ? "Post title" : "Announcement title"}
                    maxLength={140}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--brand-strong)]"
                  />
                  <textarea
                    value={actionBody}
                    onChange={(e) => setActionBody(e.target.value)}
                    placeholder={adminAction === "feed_post" ? "What should Gemini publish?" : "What should everyone see?"}
                    maxLength={4000}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--brand-strong)]"
                  />
                </div>
              ) : adminAction === "quest_builder" ? (
                <input
                  value={actionTheme}
                  onChange={(e) => setActionTheme(e.target.value)}
                  placeholder="Optional quest theme, e.g. JEE revision"
                  maxLength={120}
                  className="mt-2 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--brand-strong)]"
                />
              ) : (
                <p className="mt-2 text-[11px] text-[var(--foreground-subtle)]">Introduces one bounded item and retires one eligible item.</p>
              )}
              <button
                type="button"
                onClick={() => void executeAdminAction()}
                disabled={actionBusy || ((adminAction === "feed_post" || adminAction === "announcement") && (!actionTitle.trim() || !actionBody.trim()))}
                className="mt-2 w-full rounded-lg border border-[var(--brand-strong)] bg-[var(--brand-strong)] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {actionBusy ? "Executing…" : "Execute selected action"}
              </button>
              {actionResult && <p role="status" className={cn("mt-2 text-[11px] font-medium", actionResult.startsWith("Error:") ? "text-[var(--danger)]" : "text-[var(--success)]")}>{actionResult}</p>}
            </div>

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
              <button
                onClick={() => void steward("quests")}
                disabled={genBusy !== null}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-hover)]/40 px-3 py-2.5 text-left text-xs font-semibold text-[var(--foreground)] disabled:opacity-50"
              >
                <Compass size={14} />
                {genBusy === "quests" ? "Writing quests…" : "Build new quests for everyone (G8)"}
              </button>
              <button
                onClick={() => void steward("marketplace")}
                disabled={genBusy !== null}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-hover)]/40 px-3 py-2.5 text-left text-xs font-semibold text-[var(--foreground)] disabled:opacity-50"
              >
                <ShoppingBag size={14} />
                {genBusy === "marketplace" ? "Curating catalogue…" : "Curate marketplace — introduce & retire items (G9)"}
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
