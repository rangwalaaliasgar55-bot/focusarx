import { useCallback, useEffect, useState, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { motion } from "framer-motion";

type Overview = {
  totalVisits: number;
  uniqueVisitors: number;
  returningVisitors: number;
  onlineUsers: number;
  activeToday: number;
  activeWeek: number;
  activeMonth: number;
  returningRate: number;
};

type Charts = {
  daily: Array<{ date: string; visitors: number }>;
  weekly: Array<{ week: string; visitors: number }>;
  monthly: Array<{ month: string; visitors: number }>;
  growthPct: number;
};

type Devices = {
  devices: Array<{ name: string; count: number }>;
  browsers: Array<{ name: string; count: number }>;
  os: Array<{ name: string; count: number }>;
};

type LiveEvent = {
  id: string;
  eventType: string;
  eventData: unknown;
  createdAt: string;
  visitorId: string;
};

type LiveUser = {
  userId: string;
  name: string;
  isGuest: boolean;
  mode: string;
  timerStatus: string;
  secondsLeft: number;
  activeSeconds: number;
  startedAt: string;
};

type LiveSnapshot = {
  onlineVisitors: number;
  focusingNow: number;
  users: LiveUser[];
};

function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const PIE_COLORS = ["var(--brand-600)", "var(--palette-4f46e5)", "var(--brand-400)", "var(--palette-6366f1)", "var(--brand-500)", "var(--foreground-muted)"];

const EVENT_LABELS: Record<string, string> = {
  focus_session_started: "Started focus session",
  task_created: "Created a task",
  roadmap_generated: "Generated roadmap",
  ai_feature_used: "Used AI feature",
  user_logged_in: "Logged in",
  user_signed_up: "Signed up",
  page_view: "Viewed page",
};

function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function AnalyticsDashboard({ authHeaders }: { authHeaders: () => Record<string, string> }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [devices, setDevices] = useState<Devices | null>(null);
  const [live, setLive] = useState<LiveEvent[]>([]);
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveError, setLiveError] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastPollRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const headers = authHeaders();
      const [ov, ch, dev] = await Promise.all([
        fetch("/api/admin/analytics/overview", { headers, credentials: "include" }),
        fetch("/api/admin/analytics/charts", { headers, credentials: "include" }),
        fetch("/api/admin/analytics/devices", { headers, credentials: "include" }),
      ]);
      if (ov.ok) setOverview(await ov.json() as Overview);
      if (ch.ok) setCharts(await ch.json() as Charts);
      if (dev.ok) setDevices(await dev.json() as Devices);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const pollLive = useCallback(async () => {
    const headers = authHeaders();
    const since = lastPollRef.current;
    const url = since
      ? `/api/admin/analytics/live?since=${encodeURIComponent(since)}`
      : "/api/admin/analytics/live";
    try {
      const res = await fetch(url, { headers, credentials: "include" });
      if (!res.ok) { setLiveError(true); return; }
      setLiveError(false);
      const json = await res.json() as {
        events: LiveEvent[]; serverTime: string; live?: LiveSnapshot;
      };
      if (json.events.length) {
        setLive((prev) => {
          const ids = new Set(prev.map((e) => e.id));
          const merged = [...json.events.filter((e) => !ids.has(e.id)), ...prev];
          return merged.slice(0, 40);
        });
      }
      if (json.live) setSnapshot(json.live);
      setLastUpdated(new Date(json.serverTime));
      lastPollRef.current = json.serverTime;
    } catch {
      setLiveError(true);
    }
  }, [authHeaders]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void pollLive();
    // 4s feels genuinely "live"; 10s read as stale. The endpoint is a bounded
    // read (limit 50 + two counts), so the extra polls are cheap.
    const id = setInterval(() => void pollLive(), 4_000);
    return () => clearInterval(id);
  }, [pollLive]);
  // Keep the headline metrics moving without a manual refresh.
  useEffect(() => {
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--palette-zinc-700)] border-t-[var(--palette-violet-400)]" />
      </div>
    );
  }

  const dailyChart = (charts?.daily ?? []).map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-[var(--palette-zinc-100)]">Site Analytics</h2>
        <p className="text-sm text-[var(--palette-zinc-500)]">Accurate visitor, session, and activity metrics.</p>
      </div>

      {/* Overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total visits" value={overview?.totalVisits ?? 0} accent="violet" />
        <MetricCard label="Unique visitors" value={overview?.uniqueVisitors ?? 0} />
        <MetricCard label="Returning visitors" value={overview?.returningVisitors ?? 0} accent="sky" />
        <MetricCard label="Online now" value={overview?.onlineUsers ?? 0} accent="rose" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Active today" value={overview?.activeToday ?? 0} />
        <MetricCard label="Active this week" value={overview?.activeWeek ?? 0} />
        <MetricCard label="Active this month" value={overview?.activeMonth ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)]">Daily visitors — 30 days</p>
            {charts && (
              <span className={`text-xs font-semibold ${charts.growthPct >= 0 ? "text-[var(--palette-emerald-400)]" : "text-[var(--palette-rose-400)]"}`}>
                {charts.growthPct >= 0 ? "+" : ""}{charts.growthPct}% vs last month
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dailyChart}>
              <defs>
                <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-600)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--brand-600)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--palette-52525b)" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "var(--palette-18181b)", border: "1px solid var(--palette-3f3f46)", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="visitors" stroke="var(--brand-600)" fill="url(#vGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-1">Returning rate</p>
          <p className="text-4xl font-bold text-[var(--palette-violet-400)]">{overview?.returningRate ?? 0}%</p>
          <p className="text-xs text-[var(--palette-zinc-500)] mt-2">Visitors with more than one session</p>
          <div className="mt-4 h-2 rounded-full bg-[var(--palette-zinc-800)] overflow-hidden">
            <div className="h-full bg-[var(--palette-violet-500)] rounded-full" style={{ width: `${overview?.returningRate ?? 0}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-4">Weekly visitors — 12 weeks</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={charts?.weekly ?? []}>
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: "var(--palette-52525b)" }} axisLine={false} tickLine={false} tickFormatter={(v) => String(v).slice(5)} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "var(--palette-18181b)", border: "1px solid var(--palette-3f3f46)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="visitors" fill="var(--palette-6366f1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-4">Monthly visitors — 12 months</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={charts?.monthly ?? []}>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "var(--palette-52525b)" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "var(--palette-18181b)", border: "1px solid var(--palette-3f3f46)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="visitors" fill="var(--brand-400)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DevicePie title="Devices" data={devices?.devices ?? []} />
        <DevicePie title="Browsers" data={devices?.browsers ?? []} />
        <DevicePie title="Operating systems" data={devices?.os ?? []} />
      </div>

      <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)]">On the site right now</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-[var(--palette-zinc-800)] px-2.5 py-1 text-xs text-[var(--palette-zinc-300)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--palette-emerald-400)] animate-pulse" />
              {snapshot?.onlineVisitors ?? 0} online
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-[var(--palette-zinc-800)] px-2.5 py-1 text-xs text-[var(--palette-zinc-300)]">
              <Zap className="h-3 w-3 text-[var(--palette-violet-400)]" />
              {snapshot?.focusingNow ?? 0} focusing
            </span>
            <span className="text-[10px] font-mono text-[var(--palette-zinc-600)]">
              {liveError ? "reconnecting…" : lastUpdated ? `updated ${lastUpdated.toLocaleTimeString()}` : "connecting…"}
            </span>
          </div>
        </div>

        {(snapshot?.users.length ?? 0) > 0 ? (
          <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {snapshot!.users.map((u) => (
              <div key={u.userId} className="flex items-center justify-between rounded-lg border border-[var(--palette-zinc-800)]/60 bg-[var(--palette-zinc-950)]/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-[var(--palette-zinc-200)]">{u.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--palette-zinc-600)]">
                    {u.timerStatus === "running" ? "focusing" : u.timerStatus} · {u.mode.replaceAll("_", " ")}
                  </p>
                </div>
                <span className="ml-2 shrink-0 font-mono text-xs tabular-nums text-[var(--palette-emerald-400)]">
                  {mmss(u.activeSeconds)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-5 text-sm text-[var(--palette-zinc-600)]">Nobody is mid-session right now.</p>
        )}

        <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">Live activity feed</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {live.length === 0 && (
            <p className="text-sm text-[var(--palette-zinc-600)] py-4 text-center">Waiting for events…</p>
          )}
          {live.map((ev) => (
            <div key={ev.id} className="flex items-center justify-between rounded-lg border border-[var(--palette-zinc-800)]/60 bg-[var(--palette-zinc-950)]/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--palette-emerald-400)] animate-pulse" />
                <span className="text-sm text-[var(--palette-zinc-300)]">{EVENT_LABELS[ev.eventType] ?? ev.eventType}</span>
              </div>
              <span className="text-[10px] text-[var(--palette-zinc-600)] font-mono">{relativeTime(ev.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

import { ArrowUpRight, TrendingUp, BarChart2, Zap, LayoutDashboard, MousePointer2 } from "lucide-react";

function MetricCard({ label, value, accent, trend }: { label: string; value: number; accent?: "violet" | "sky" | "rose"; trend?: number }) {
  const color = accent === "violet" ? "text-[var(--palette-violet-400)]" : accent === "sky" ? "text-[var(--palette-sky-400)]" : accent === "rose" ? "text-[var(--palette-rose-400)]" : "text-[var(--palette-zinc-100)]";
  return (
    <div className="rounded-2xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
         <MousePointer2 size={40} className={color} />
      </div>
      <div className="relative z-[var(--z-content)]">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--palette-zinc-500)] mb-2">{label}</p>
        <div className="flex items-end gap-3">
          <p className={`text-3xl font-black ${color} tracking-tight tabular-nums`}>{value.toLocaleString()}</p>
          {trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-[10px] font-bold mb-1 ${trend >= 0 ? "text-[var(--palette-emerald-400)]" : "text-[var(--palette-rose-400)]"}`}>
               <ArrowUpRight size={10} className={trend < 0 ? "rotate-90" : ""} />
               {Math.abs(trend)}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DevicePie({ title, data }: { title: string; data: Array<{ name: string; count: number }> }) {
  const total = data.reduce((a, d) => a + d.count, 0) || 1;
  return (
    <div className="rounded-xl border border-[var(--palette-zinc-800)]/80 bg-[var(--palette-zinc-900)]/40 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--palette-zinc-500)] mb-3">{title}</p>
      {data.length === 0 ? (
        <p className="text-sm text-[var(--palette-zinc-600)] py-6 text-center">No data yet</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--palette-18181b)", border: "1px solid var(--palette-3f3f46)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {data.slice(0, 4).map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-[var(--palette-zinc-400)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}
                </span>
                <span className="text-[var(--palette-zinc-500)]">{Math.round((d.count / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
