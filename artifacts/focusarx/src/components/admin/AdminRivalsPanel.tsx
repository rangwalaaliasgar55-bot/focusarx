import { useState, useCallback, useEffect } from "react";
import { RefreshCw, Bot, MessageSquare, Zap, Power, RotateCcw, Save } from "lucide-react";
import { EmptyState, LoadingState, MotionTab, SectionHeader, StatCard, adminFetch, QuickActionButton } from "./AdminHelpers";
import type { AdminPanelProps } from "./AdminTypes";

type BotsState = {
  bots: any[];
  total: number;
  personas: number;
  stats?: { total: number; today: { posts: number; comments: number; reactions: number; follows: number; pendingReplies: number } };
  preview?: Array<{ name: string; bio: string; xp: number; streak: number; timezone: string }>;
  istDay?: string;
};

/** Mirrors artifacts/api-server/src/lib/botSettings.ts */
type BotSettings = {
  enabled: boolean;
  dailyPostsMin: number; dailyPostsMax: number; dailyThreadsMax: number;
  dailyCommentsMin: number; dailyCommentsMax: number;
  reactionBurstsMin: number; reactionBurstsMax: number; dailyFollowsMax: number;
  perBotPosts: number; perBotComments: number; perBotReactions: number; perBotFollows: number;
  replyChanceHuman: number; repliesPerHumanPostMax: number; commentReplyChance: number;
  replyFastMinMinutes: number; replyFastMaxMinutes: number; replySlowMinHours: number; replySlowMaxHours: number;
  replyChanceBotPost: number;
  adminRepliesMin: number; adminRepliesMax: number; adminReactionsMin: number; adminReactionsMax: number; adminReplyDelayMaxMinutes: number;
  followsPerNewHuman: number;
  roomBanter: boolean; roomBanterChance: number;
};

type NumericKey = { [K in keyof BotSettings]: BotSettings[K] extends number ? K : never }[keyof BotSettings];

const inputCls = "w-full rounded-lg border border-[var(--palette-zinc-700)] bg-[var(--palette-zinc-950)] px-2.5 py-1.5 text-xs text-[var(--palette-zinc-100)] outline-none focus:border-[var(--palette-sky-600)]";

function NumField({ label, value, onChange, min = 0, max, step = 1, hint }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[var(--palette-zinc-400)]">{label}</span>
      <input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))} className={inputCls} />
      {hint && <span className="mt-0.5 block text-[10px] text-[var(--palette-zinc-600)]">{hint}</span>}
    </label>
  );
}

function PercentField({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-[var(--palette-zinc-400)]">
        {label} <span className="font-mono text-[var(--palette-zinc-300)]">{Math.round(value * 100)}%</span>
      </span>
      <input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-[var(--palette-sky-500)]" />
      {hint && <span className="mt-0.5 block text-[10px] text-[var(--palette-zinc-600)]">{hint}</span>}
    </label>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-[var(--palette-emerald-600)]" : "bg-[var(--palette-zinc-700)]"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span>
        <span className="block text-xs font-medium text-[var(--palette-zinc-200)]">{label}</span>
        {hint && <span className="block text-[10px] text-[var(--palette-zinc-500)]">{hint}</span>}
      </span>
    </label>
  );
}

function SettingsGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/20 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--palette-zinc-300)]">{icon}{title}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

export function AdminRivalsPanel({ authHeaders, onManageUser }: AdminPanelProps & { onManageUser: (id: string) => void }) {
  const [state, setState] = useState<BotsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<BotSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastReport, setLastReport] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        adminFetch("/api/admin/bots", { headers: authHeaders(), credentials: "include" }),
        adminFetch("/api/admin/bots/settings", { headers: authHeaders(), credentials: "include" }),
      ]);
      if (r.ok) setState(await r.json());
      if (s.ok) {
        const d = await s.json();
        setSettings(d.settings);
        setSavedSettings(d.settings);
      }
    } finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => { if (!state) void load(); }, [load, state]);

  const dirty = settings && savedSettings && JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const set = <K extends keyof BotSettings>(key: K, value: BotSettings[K]) => setSettings((s) => (s ? { ...s, [key]: value } : s));
  const num = (key: NumericKey, opts: { label: string; min?: number; max?: number; step?: number; hint?: string }) =>
    settings ? <NumField key={key} label={opts.label} value={settings[key]} min={opts.min} max={opts.max} step={opts.step} hint={opts.hint} onChange={(v) => set(key, v)} /> : null;

  async function saveSettings(patch?: Partial<BotSettings>) {
    if (!settings) return;
    setSaving(true);
    try {
      const body = patch ?? settings;
      const r = await adminFetch("/api/admin/bots/settings", {
        method: "PUT", headers: { ...authHeaders(), "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error?.message ?? d.error ?? "Could not save"); return; }
      setSettings(d.settings);
      setSavedSettings(d.settings);
      setLastReport(`Settings saved ${new Date().toLocaleTimeString()}`);
    } finally { setSaving(false); }
  }

  async function resetSettings() {
    if (!confirm("Restore the default bot behaviour?")) return;
    setSaving(true);
    try {
      const r = await adminFetch("/api/admin/bots/settings/reset", { method: "POST", headers: authHeaders(), credentials: "include" });
      const d = await r.json();
      if (r.ok) { setSettings(d.settings); setSavedSettings(d.settings); setLastReport("Defaults restored"); }
    } finally { setSaving(false); }
  }

  async function runTick() {
    setBusy(true);
    try {
      const r = await adminFetch("/api/admin/bots/tick", { method: "POST", headers: authHeaders(), credentials: "include" });
      const d = await r.json();
      if (!r.ok) { alert(d.error?.message ?? d.error ?? "Failed"); return; }
      setLastReport(d.skipped
        ? `Tick skipped: ${d.skipped === "disabled" ? "bots are switched off" : "no bots seeded"}`
        : `Tick done in ${d.ms} ms — +${d.posts} posts, +${d.comments} comments, +${d.reactions} reactions, +${d.follows} follows`);
      await load();
    } finally { setBusy(false); }
  }

  async function flushReplies() {
    setBusy(true);
    try {
      const r = await adminFetch("/api/admin/bots/flush-replies", { method: "POST", headers: authHeaders(), credentials: "include" });
      const d = await r.json();
      if (!r.ok) { alert(d.error?.message ?? d.error ?? "Failed"); return; }
      setLastReport(`Delivered ${d.delivered} queued repl${d.delivered === 1 ? "y" : "ies"} now`);
      await load();
    } finally { setBusy(false); }
  }

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
  const enabled = settings?.enabled ?? true;

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="AI rivals live" value={String(state?.total ?? bots.length)} accent="sky" />
        <StatCard label="Posts today" value={String(stats?.today.posts ?? 0)} />
        <StatCard label="Comments today" value={String(stats?.today.comments ?? 0)} />
        <StatCard label="Follows today" value={String(stats?.today.follows ?? 0)} />
        <StatCard label="Replies queued" value={String(stats?.today.pendingReplies ?? 0)} accent="amber" sub="land on schedule" />
      </div>

      {/* Master switch + quick actions */}
      <div className={`rounded-xl border p-4 ${enabled ? "border-[var(--palette-emerald-900)] bg-[var(--palette-emerald-950)]/30" : "border-[var(--palette-rose-900)] bg-[var(--palette-rose-950)]/30"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Power size={16} className={enabled ? "text-[var(--palette-emerald-400)]" : "text-[var(--palette-rose-400)]"} />
            <div>
              <p className="text-sm font-semibold text-[var(--palette-zinc-100)]">Bot talking is {enabled ? "ON" : "OFF"}</p>
              <p className="text-[11px] text-[var(--palette-zinc-400)]">
                {enabled ? "Rivals post, reply, react, follow and banter within the limits below." : "Everything is paused — queued replies wait until you switch back on."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QuickActionButton variant={enabled ? "danger" : "success"} loading={saving} onClick={() => void saveSettings({ enabled: !enabled })}>
              {enabled ? "Pause all bots" : "Resume bots"}
            </QuickActionButton>
            <QuickActionButton variant="primary" loading={busy} disabled={!enabled || !bots.length} onClick={() => void runTick()}>
              <Zap size={12} /> Run today's activity now
            </QuickActionButton>
            <QuickActionButton loading={busy} disabled={!enabled || !(stats?.today.pendingReplies ?? 0)} onClick={() => void flushReplies()}>
              <MessageSquare size={12} /> Deliver queued replies
            </QuickActionButton>
          </div>
        </div>
        {lastReport && <p className="mt-2 text-[11px] text-[var(--palette-zinc-400)]">→ {lastReport}</p>}
      </div>

      {/* Talking controls */}
      {settings && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--palette-zinc-500)]">Bot talking controls</p>
            <div className="flex items-center gap-2">
              <QuickActionButton onClick={() => void resetSettings()} loading={saving}><RotateCcw size={12} /> Defaults</QuickActionButton>
              <QuickActionButton variant="success" disabled={!dirty} loading={saving} onClick={() => void saveSettings()}><Save size={12} /> Save changes</QuickActionButton>
            </div>
          </div>

          <SettingsGroup title="Following humans" icon={<Bot size={12} />}>
            {num("followsPerNewHuman", { label: "Rivals that follow each new sign-up", max: 25, hint: "0 = off. Happens instantly after registration." })}
            {num("dailyFollowsMax", { label: "New follows per day (all bots)", max: 500, hint: "Targets: admins first, then active humans." })}
            {num("perBotFollows", { label: "Per-bot follows / day", max: 50 })}
          </SettingsGroup>

          <SettingsGroup title="Replying to humans" icon={<MessageSquare size={12} />}>
            <PercentField label="Chance a human post gets replies" value={settings.replyChanceHuman} onChange={(v) => set("replyChanceHuman", v)} />
            {num("repliesPerHumanPostMax", { label: "Max replies per human post", min: 1, max: 6 })}
            <PercentField label="Chance a human comment gets a reply" value={settings.commentReplyChance} onChange={(v) => set("commentReplyChance", v)} />
            <PercentField label="Chance a bot post gets a bot reply" value={settings.replyChanceBotPost} onChange={(v) => set("replyChanceBotPost", v)} hint="Keeps bot threads alive." />
            {num("replyFastMinMinutes", { label: "First reply after (min, minutes)", max: 240 })}
            {num("replyFastMaxMinutes", { label: "First reply after (max, minutes)", max: 240 })}
            {num("replySlowMinHours", { label: "Later replies after (min, hours)", max: 48, step: 0.5 })}
            {num("replySlowMaxHours", { label: "Later replies after (max, hours)", max: 48, step: 0.5 })}
          </SettingsGroup>

          <SettingsGroup title="Admin posts (always engaged)" icon={<Zap size={12} />}>
            {num("adminRepliesMin", { label: "Replies per admin post (min)", max: 10 })}
            {num("adminRepliesMax", { label: "Replies per admin post (max)", max: 10 })}
            {num("adminReplyDelayMaxMinutes", { label: "All replies land within (minutes)", max: 240 })}
            {num("adminReactionsMin", { label: "Reactions per admin post (min)", max: 30 })}
            {num("adminReactionsMax", { label: "Reactions per admin post (max)", max: 30 })}
          </SettingsGroup>

          <SettingsGroup title="Bots posting on their own (per day)" icon={<Bot size={12} />}>
            {num("dailyPostsMin", { label: "Posts (min)", max: 200 })}
            {num("dailyPostsMax", { label: "Posts (max)", max: 500, hint: "Scales with human activity between min and max." })}
            {num("dailyThreadsMax", { label: "Bot-to-bot threads (max)", max: 10 })}
            {num("dailyCommentsMin", { label: "Comments (min)", max: 500 })}
            {num("dailyCommentsMax", { label: "Comments (max)", max: 1000 })}
            {num("reactionBurstsMin", { label: "Reaction bursts (min)", max: 500 })}
            {num("reactionBurstsMax", { label: "Reaction bursts (max)", max: 1000 })}
          </SettingsGroup>

          <SettingsGroup title="Per-bot daily caps (anti-spam)" icon={<Bot size={12} />}>
            {num("perBotPosts", { label: "Posts", max: 10 })}
            {num("perBotComments", { label: "Comments", max: 50 })}
            {num("perBotReactions", { label: "Reactions", max: 100 })}
          </SettingsGroup>

          <SettingsGroup title="Study rooms" icon={<MessageSquare size={12} />}>
            <div className="sm:col-span-2">
              <Toggle label="Bot banter in study rooms" checked={settings.roomBanter} onChange={(v) => set("roomBanter", v)} hint="Two rivals exchange a few lines in non-silent rooms." />
            </div>
            <div className="sm:col-span-2">
              <PercentField label="Share of 12-minute slots with banter" value={settings.roomBanterChance} onChange={(v) => set("roomBanterChance", v)} />
            </div>
          </SettingsGroup>

          {dirty && (
            <div className="flex items-center justify-end gap-2">
              <QuickActionButton onClick={() => setSettings(savedSettings)}>Discard</QuickActionButton>
              <QuickActionButton variant="success" loading={saving} onClick={() => void saveSettings()}><Save size={12} /> Save changes</QuickActionButton>
            </div>
          )}
        </div>
      )}

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
            {busy ? "Working…" : "Idempotent + resumable."}
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
          <li>Each rival earns XP and advances its streak once a day — triggered lazily when anyone views the leaderboard or community feed, or instantly with “Run today's activity now”.</li>
          <li>Daily rhythm (all tunable above): own posts across IST 06:00–now, bot-to-bot threads, topic-matched comments, reaction bursts and new follows.</li>
          <li>When a human posts, rivals reply with a natural lag (first one fast, the rest hours later). Admin posts always get guaranteed quick replies and extra reactions.</li>
          <li>New sign-ups are followed by a few rivals immediately so nobody starts at zero followers.</li>
          <li>Rivals stay internally flagged role="bot" for admin analytics; every limit is enforced per IST day.</li>
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
