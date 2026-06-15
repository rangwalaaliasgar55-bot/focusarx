import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth, getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { TiltCard, StaggerContainer, StaggerItem } from "@/components/TiltCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import FocusGarden from "@/components/FocusGarden";
import FocusCity from "@/components/FocusCity";
import ReadinessWidget from "@/components/ReadinessWidget";
import WeatherWidget from "@/components/WeatherWidget";
import { LayoutDashboard, Zap, Clock, Target, Flame, CheckCircle, CheckSquare, Flag, Circle, CheckCircle2, Users, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type DashboardStats = {
  totalStudyMinutesToday: number;
  avgFocusScore: number | null;
  dominantStability: string;
  sessionsToday: number;
  currentStreak: number;
  completedTasks: number;
  chartData: Array<{ day: string; date: string; minutes: number }>;
  recentSessions: Array<{
    id: string;
    mode: string;
    durationSec: number;
    completedAt: string;
    focusScore: number | null;
    focusQuality: string | null;
    stabilityRating: string | null;
  }>;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[rgba(124,58,237,0.3)] bg-[rgba(12,17,40,0.95)] px-3 py-2 text-xs text-[#E2E8F0] shadow-xl backdrop-blur-xl">
      <p className="font-semibold">{label}</p>
      <p className="text-[#A78BFA]">{payload[0]?.value}m</p>
    </div>
  );
};

function StreakHeatmap({ chartData, streak }: { chartData: DashboardStats["chartData"]; streak: number }) {
  const today = useMemo(() => new Date(), []);
  const cells = useMemo(() => {
    const arr: { date: string; minutes: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]!;
      const found = chartData.find((c) => c.date === dateStr);
      arr.push({ date: dateStr, minutes: found?.minutes ?? 0 });
    }
    return arr;
  }, [chartData, today]);

  const maxMin = Math.max(...cells.map((c) => c.minutes), 1);

  return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#4B5563]">Study Streak</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-2xl font-bold text-[#E2E8F0]">
            🔥 <span>{streak}</span>
            <span className="text-sm font-normal text-[#4B5563]">days</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-[#4B5563]">Last 30 days</p>
          <p className="text-xs text-[#6B7280]">{cells.filter((c) => c.minutes > 0).length} active</p>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(30,1fr)] gap-0.5">
        {cells.map((cell) => {
          const intensity = cell.minutes / maxMin;
          const opacity = cell.minutes === 0 ? 0.06 : 0.15 + intensity * 0.85;
          return (
            <div
              key={cell.date}
              title={`${cell.date}: ${cell.minutes}m`}
              className="aspect-square rounded-sm"
              style={{ background: cell.minutes === 0 ? "rgba(124,58,237,0.08)" : `rgba(124,58,237,${opacity.toFixed(2)})` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[9px] text-[#374151]">
        <span>30d ago</span>
        <span>today</span>
      </div>
    </div>
  );
}

function GoalRing({ sessionsToday, target = 6 }: { sessionsToday: number; target?: number }) {
  const pct = Math.min(sessionsToday / target, 1);
  const r = 32;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl flex flex-col items-center justify-center gap-2">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#4B5563]">Today's Goal</p>
      <div className="relative">
        <svg width={88} height={88} className="-rotate-90">
          <circle cx={44} cy={44} r={r} fill="none" stroke="rgba(124,58,237,0.1)" strokeWidth={7} />
          <circle
            cx={44} cy={44} r={r}
            fill="none"
            stroke="url(#goal-grad)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
          <defs>
            <linearGradient id="goal-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#A78BFA" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-[#E2E8F0]">{sessionsToday}</span>
          <span className="text-[10px] text-[#4B5563]">of {target}</span>
        </div>
      </div>
      <p className="text-xs text-[#6B7280]">{pct >= 1 ? "🎉 Goal reached!" : `${target - sessionsToday} block${target - sessionsToday !== 1 ? "s" : ""} to go`}</p>
    </div>
  );
}

function DailyHabitsWidget() {
  const qc = useQueryClient();
  const { data: habits = [], isLoading } = useQuery<any[]>({
    queryKey: ["habits-today"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/habits", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });

  const toggle = async (id: string, completedToday: boolean) => {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (completedToday) {
      await fetch(`/api/habits/${id}/complete`, { method: "DELETE", headers });
    } else {
      await fetch(`/api/habits/${id}/complete`, { method: "POST", headers, body: JSON.stringify({}) });
    }
    qc.invalidateQueries({ queryKey: ["habits-today"] });
  };

  if (isLoading) return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 animate-pulse">
      <div className="h-3.5 w-36 rounded bg-[rgba(255,255,255,0.06)] mb-4" />
      <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-9 rounded-xl bg-[rgba(255,255,255,0.04)]" />)}</div>
    </div>
  );
  if (!habits.length) return null;

  const done = habits.filter((h: any) => h.completedToday).length;

  return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckSquare size={15} className="text-[#A78BFA]" />
          <p className="text-sm font-semibold text-[#E2E8F0]">Today's Habits</p>
        </div>
        <span className="text-xs font-bold text-[#A78BFA]">{done}/{habits.length}</span>
      </div>
      <div className="space-y-2">
        {habits.slice(0, 6).map((h: any) => (
          <button key={h.id} onClick={() => toggle(h.id, h.completedToday)}
            className="w-full flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5 hover:bg-[rgba(124,58,237,0.05)] transition-colors text-left">
            <span className="text-base leading-none">{h.icon}</span>
            <span className={`flex-1 text-sm ${h.completedToday ? "line-through text-[#4B5563]" : "text-[#E2E8F0]"}`}>{h.name}</span>
            {h.completedToday
              ? <div className="h-4 w-4 rounded-full bg-[#7C3AED] flex items-center justify-center"><span className="text-[8px] text-white">✓</span></div>
              : <div className="h-4 w-4 rounded-full border border-[#3a3d4a]" />}
          </button>
        ))}
      </div>
      {habits.length > 6 && (
        <Link to="/habits" className="mt-2 block text-center text-xs text-[#4B5563] hover:text-[#7C3AED]">+{habits.length - 6} more habits →</Link>
      )}
      <div className="mt-3 h-1.5 w-full rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] transition-all" style={{ width: `${habits.length ? (done / habits.length) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function ActiveMissionsWidget() {
  const { data: missionsData, isLoading } = useQuery<any>({
    queryKey: ["missions-dashboard"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/missions", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 120_000,
  });

  if (isLoading) return (
    <div className="rounded-2xl border border-[rgba(245,158,11,0.15)] bg-[rgba(245,158,11,0.03)] p-5 animate-pulse">
      <div className="h-3.5 w-40 rounded bg-[rgba(255,255,255,0.06)] mb-4" />
      <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="space-y-1.5"><div className="h-3 w-full rounded bg-[rgba(255,255,255,0.04)]" /><div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.04)]" /></div>)}</div>
    </div>
  );
  const missions: any[] = missionsData?.missions ?? [];
  const active = missions.filter((m: any) => !m.completed && !m.claimed).slice(0, 4);
  if (!active.length) return null;

  return (
    <div className="rounded-2xl border border-[rgba(245,158,11,0.15)] bg-[rgba(245,158,11,0.03)] p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={15} className="text-amber-400" />
          <p className="text-sm font-semibold text-[#E2E8F0]">Active Missions</p>
        </div>
        <Link to="/missions" className="text-[10px] text-amber-400 hover:underline">See all</Link>
      </div>
      <div className="space-y-3">
        {active.map((m: any) => {
          const pct = m.target > 0 ? Math.min(100, Math.round((m.progress / m.target) * 100)) : 0;
          return (
            <div key={m.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#CBD5E1] truncate flex-1 mr-2">{m.icon} {m.title}</p>
                <span className="text-[10px] text-[#4B5563] shrink-0">{m.progress}/{m.target}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BuddyActivityWidget() {
  const { data: activity = [], isLoading } = useQuery<any[]>({
    queryKey: ["buddy-activity-dashboard"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/social/activity", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 120_000,
  });

  if (isLoading || !activity.length) return null;

  return (
    <div className="rounded-2xl border border-[rgba(6,214,160,0.15)] bg-[rgba(6,214,160,0.03)] p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-emerald-400" />
          <p className="text-sm font-semibold text-[#E2E8F0]">Buddy Activity</p>
        </div>
        <Link to="/social" className="text-[10px] text-emerald-400 hover:underline">Community</Link>
      </div>
      <div className="space-y-2.5">
        {activity.slice(0, 5).map((item: any, i: number) => {
          const mins = Math.round(item.durationSec / 60);
          const when = (() => {
            const diff = Date.now() - new Date(item.completedAt).getTime();
            if (diff < 3600_000) return `${Math.round(diff / 60000)}m ago`;
            if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
            return `${Math.round(diff / 86400_000)}d ago`;
          })();
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                {(item.userName || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#CBD5E1] truncate">
                  <span className="font-medium">{item.userName || "Someone"}</span>
                  <span className="text-[#4B5563]"> focused for </span>
                  <span className="text-emerald-400 font-medium">{mins}m</span>
                  {item.focusScore != null && <span className="text-[#4B5563]"> · {item.focusScore}%</span>}
                </p>
              </div>
              <span className="text-[9px] text-[#374151] shrink-0">{when}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalsWidget() {
  const { data, isLoading } = useQuery<{ goals: any[] }>({
    queryKey: ["goals-widget"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/goals", { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 120_000,
  });

  if (isLoading) return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 animate-pulse">
      <div className="h-3.5 w-28 rounded bg-[rgba(255,255,255,0.06)] mb-4" />
      <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-5 rounded bg-[rgba(255,255,255,0.04)]" />)}</div>
    </div>
  );
  const goals: any[] = data?.goals ?? [];
  if (!goals.length) return null;
  const active = goals.filter(g => !g.completed);
  const done = goals.filter(g => g.completed).length;
  const pct = goals.length > 0 ? Math.round((done / goals.length) * 100) : 0;

  return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flag size={15} className="text-[#7C3AED]" />
          <p className="text-sm font-semibold text-[#E2E8F0]">Focus Goals</p>
        </div>
        <Link to="/goals" className="text-[10px] text-[#7C3AED] hover:underline">{done}/{goals.length} done</Link>
      </div>
      <div className="space-y-2 mb-3">
        {active.slice(0, 4).map((g: any) => (
          <div key={g.id} className="flex items-center gap-2 text-sm text-[#94A3B8]">
            <Circle size={12} className="text-[#4B5563] shrink-0" />
            <span className="truncate">{g.title}</span>
          </div>
        ))}
        {active.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 size={12} className="shrink-0" />
            <span>All goals completed!</span>
          </div>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const SESSION_EMOJIS: Record<string, string> = { focus: "🧠", break: "☕", longBreak: "🌊" };

function DashboardCommandBar({ stats, loading }: { stats: DashboardStats | null; loading: boolean }) {
  const { data: session } = useAuth();
  const user = session?.user;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-gradient-to-r from-[rgba(124,58,237,0.08)] via-[rgba(79,70,229,0.05)] to-transparent p-5 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4B5563] mb-1">Command Center</p>
          <h2 className="text-xl font-bold text-[#E2E8F0]">
            {greeting}, <span className="text-[#A78BFA]">{firstName}</span>
          </h2>
          <p className="text-[12px] text-[#4B5563] mt-1">
            {loading ? "Loading your stats…" : stats
              ? stats.sessionsToday === 0
                ? "No sessions today yet. Start your first block now →"
                : `${stats.sessionsToday} session${stats.sessionsToday !== 1 ? "s" : ""} completed · ${stats.totalStudyMinutesToday}m focused today`
              : "Ready to build deep focus habits."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/" className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-4 py-2 text-[12px] font-bold text-white hover:opacity-90 transition-opacity shadow-lg shadow-[rgba(124,58,237,0.2)]">
            <Zap size={12} /> Start Focus
          </Link>
          <Link href="/habits" className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-[12px] font-semibold text-[#94A3B8] hover:bg-[rgba(255,255,255,0.06)] transition-colors">
            <CheckCircle size={12} /> Tasks
          </Link>
          <Link href="/goals" className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-[12px] font-semibold text-[#94A3B8] hover:bg-[rgba(255,255,255,0.06)] transition-colors">
            <Flag size={12} /> Goals
          </Link>
        </div>
      </div>
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
          {[
            { icon: Flame,        label: "Streak",    value: `${stats.currentStreak}d`,             color: "#F97316" },
            { icon: Clock,        label: "Today",     value: `${stats.totalStudyMinutesToday}m`,    color: "#A78BFA" },
            { icon: Target,       label: "Sessions",  value: `${stats.sessionsToday}`,              color: "#FFB800" },
            { icon: CheckCircle,  label: "Tasks",     value: `${stats.completedTasks}`,             color: "#4ADE80" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
              <Icon size={14} style={{ color }} className="shrink-0" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#374151]">{label}</p>
                <p className="text-[15px] font-bold tabular-nums" style={{ color }}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { status } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") { setLoading(false); return; }
    const token = localStorage.getItem("focusarx-auth-token");
    fetch("/api/stats", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json() as Promise<DashboardStats>)
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [status]);

  const overviewCards = stats ? [
    { icon: Clock,       label: "Study today",  value: `${stats.totalStudyMinutesToday}m`,                              color: "#A78BFA" },
    { icon: Zap,         label: "Avg focus",    value: stats.avgFocusScore != null ? `${stats.avgFocusScore}` : "—",    color: "#06D6A0" },
    { icon: Target,      label: "Sessions",     value: `${stats.sessionsToday}`,                                        color: "#FFB800" },
    { icon: Flame,       label: "Streak",       value: `${stats.currentStreak}d`,                                       color: "#F97316" },
    { icon: CheckCircle, label: "Tasks done",   value: `${stats.completedTasks}`,                                       color: "#4ADE80" },
    { icon: LayoutDashboard, label: "Stability", value: stats.dominantStability.split(" ")[0] ?? "—",                  color: "#60A5FA" },
  ] : [];

  return (
    <div className="relative min-h-[100dvh] overflow-hidden forge-bg-glow">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.1),transparent_68%)] blur-2xl" />
      </div>
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <PageTransition>
          <DashboardCommandBar stats={stats} loading={loading && status !== "unauthenticated"} />

          {status === "unauthenticated" && (
            <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-8 text-center backdrop-blur-xl">
              <p className="text-[#94A3B8] text-sm">Sign in to see your dashboard stats.</p>
              <Link href="/login" className="mt-4 inline-block rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-6 py-2 text-sm font-medium text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]">
                Sign in
              </Link>
            </div>
          )}

          {loading && status !== "unauthenticated" && (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-[rgba(255,255,255,0.03)]" />
              ))}
            </div>
          )}

          {!loading && stats && (
            <div className="space-y-6">
              {/* Streak heatmap + Goal ring */}
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <StreakHeatmap chartData={stats.chartData} streak={stats.currentStreak} />
                <GoalRing sessionsToday={stats.sessionsToday} target={6} />
              </div>

              {/* Focus Weather */}
              <WeatherWidget />

              {/* Daily Habits Widget */}
              <DailyHabitsWidget />

              {/* Active Missions */}
              <ActiveMissionsWidget />

              {/* Goals Widget */}
              <GoalsWidget />

              {/* Buddy Activity */}
              <BuddyActivityWidget />

              {/* Readiness Widget */}
              <ReadinessWidget />

              {/* Focus City */}
              <FocusCity />

              {/* Focus Garden + Stats grid */}
              <StaggerContainer className="grid gap-4 sm:grid-cols-3">
                <StaggerItem>
                  <div className="rounded-2xl border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.04)] p-5 backdrop-blur-xl flex flex-col items-center">
                    <FocusGarden minutesToday={stats.totalStudyMinutesToday} />
                  </div>
                </StaggerItem>
                <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                  {overviewCards.map(({ icon: Icon, label, value, color }, i) => (
                    <StaggerItem key={label}>
                      <TiltCard intensity={8} className="h-full">
                        <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-3 text-center backdrop-blur-xl shadow-3d-violet h-full">
                          <motion.div
                            whileHover={{ scale: 1.15, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 400, damping: 15 }}
                            className="mx-auto mb-1 inline-flex"
                          >
                            <Icon size={14} style={{ color }} />
                          </motion.div>
                          <p className="text-[9px] uppercase tracking-wider text-[#4B5563]">{label}</p>
                          <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color }}>{value}</p>
                        </div>
                      </TiltCard>
                    </StaggerItem>
                  ))}
                </div>
              </StaggerContainer>

              {/* Bar chart */}
              <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                <h2 className="mb-5 text-sm font-semibold text-[#E2E8F0]">Weekly focus (minutes)</h2>
                {stats.chartData.every((d) => d.minutes === 0) ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-[#4B5563]">
                    <p className="text-sm">No focus time this week yet.</p>
                    <Link href="/" className="text-xs text-[#A78BFA] hover:text-[#7C3AED]">Start your first session →</Link>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={stats.chartData} margin={{ top: 0, right: 4, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.08)" />
                      <XAxis dataKey="day" tick={{ fill: "#4B5563", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#4B5563", fontSize: 10 }} axisLine={false} tickLine={false} unit="m" />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="minutes" fill="#7C3AED" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Recent sessions */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-[#E2E8F0]">Recent sessions</h2>
                {stats.recentSessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800/60 bg-zinc-950/30 px-6 py-10 text-center text-sm text-zinc-500">
                    Complete a focus block to see session insights here.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] backdrop-blur-xl">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800/60 text-[#4B5563]">
                          <th className="px-4 py-3 text-left font-medium">Mode</th>
                          <th className="px-4 py-3 text-left font-medium">Duration</th>
                          <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Focus</th>
                          <th className="px-4 py-3 text-left font-medium">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentSessions.map((s) => (
                          <tr key={s.id} className="border-b border-zinc-800/30 transition-colors hover:bg-zinc-800/20 last:border-0">
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1.5 font-medium text-[#A78BFA]">
                                <span>{SESSION_EMOJIS[s.mode] ?? "⏱"}</span>
                                <span>{s.mode}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-400">{Math.round(s.durationSec / 60)}m</td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              {s.focusScore != null ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
                                    <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]" style={{ width: `${s.focusScore}%` }} />
                                  </div>
                                  <span className="font-medium text-[#A78BFA]">{s.focusScore}</span>
                                </div>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-500">
                              {new Date(s.completedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && !stats && status === "authenticated" && (
            <div className="rounded-2xl border border-dashed border-zinc-800/60 bg-zinc-950/30 px-6 py-12 text-center text-sm text-zinc-500">
              <p className="mb-2 text-zinc-400">No data yet</p>
              <p>Complete your first focus session to see stats appear here.</p>
              <Link href="/" className="mt-4 inline-block text-xs text-[#A78BFA] hover:text-[#7C3AED]">Go to Timer →</Link>
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
}
