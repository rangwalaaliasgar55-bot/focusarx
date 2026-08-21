import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth, getToken } from "@/lib/auth";
import { PageTransition } from "@/components/PageTransition";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { TiltCard, StaggerContainer, StaggerItem } from "@/components/TiltCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import FocusGarden from "@/components/FocusGarden";
import FocusCity from "@/components/FocusCity";
import ReadinessWidget from "@/components/ReadinessWidget";
import WeatherWidget from "@/components/WeatherWidget";
import { LayoutDashboard, Zap, Clock, Target, Flame, CheckCircle, CheckSquare, Flag, Circle, CheckCircle2, Users, Trophy, Sparkles, BarChart3, Rocket, MessageSquare } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PAGE, CARD, STAGGER, STAGGER_CHILD, SLIDE_UP, SLIDE_DOWN, POP, COUNT_UP, BLUR_IN } from "@/lib/animations";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useCoinXP } from "../components/CoinXPBar";
import { SessionDots } from "../components/SessionDots";
import { useTasks } from "@/hooks/useTasks";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { useToast } from "@/components/Toast";
import { useSessionRecovery } from "@/components/SessionRecoveryContext";
import { usePomodoro } from "@/hooks/usePomodoro";
import { getModeLabel } from "@/lib/timerUtils";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { trackSiteEvent } from "@/lib/site-analytics";
import { trackSessionStart, trackSessionComplete, trackSessionAbandoned } from "@/lib/analytics";
import type { PersistedActiveSession } from "@/types/session-persistence";
import type { TimerMode } from "@/types/timer";
import type { Wallet, Mission } from "@/types/gamification";
import FocusLockOverlay, { LockModePicker } from "../components/FocusLockOverlay";
import type { LockMode } from "../components/FocusLockOverlay";
import DistractionModal from "../components/DistractionModal";
import TaskTimeline, { OverrunModal } from "../components/TaskTimeline";
import { SoundEngine } from "../components/SoundEngine";
import SessionTypePicker, { type SessionType, SESSION_TYPE_TINTS } from "../components/SessionTypePicker";
import AmbientSoundBar from "../components/AmbientSoundBar";
const StabilityOrb3D = lazy(() => import("@/components/StabilityOrb3D"));

/* Type definitions */
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

interface TooltipPayload {
  value: number;
  [key: string]: any;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
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
      <p className="text-xs text-[#6B7280]">
        {pct >= 1 ? "🎉 Goal reached!" : `${target - sessionsToday} block${target - sessionsToday !== 1 ? "s" : ""} to go`}
      </p>
    </div>
  );
}

interface Habit {
  id: string;
  name: string;
  icon: string;
  completedToday: boolean;
}

function DailyHabitsWidget() {
  const qc = useQueryClient();
  const { data: habits = [], isLoading } = useQuery<Habit[]>({
    queryKey: ["habits-today"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/habits", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });

  const toggle = async (id: string, currentlyDone: boolean) => {
    try {
      const token = getToken();
      await fetch(`/api/habits/${id}/${currentlyDone ? 'uncomplete' : 'complete'}`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      qc.invalidateQueries({ queryKey: ["habits-today"] });
    } catch {}
  };

  if (isLoading) return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 animate-pulse">
      <div className="h-3.5 w-36 rounded bg-[rgba(255,255,255,0.06)] mb-4" />
      <div className="space-y-2">{[...Array(3)].map((_, i) => (
        <div key={i} className="h-9 rounded-xl bg-[rgba(255,255,255,0.04)]" />
      ))}</div>
    </div>
  );

  if (!habits.length) return null;
  const done = habits.filter((h) => h.completedToday).length;

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
        {habits.slice(0, 6).map((h) => (
          <button
            key={h.id}
            onClick={() => toggle(h.id, h.completedToday)}
            className="w-full flex items-center gap-3 rounded-xl border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5 hover:bg-[rgba(124,58,237,0.05)] transition-colors text-left"
          >
            <span className="text-base leading-none">{h.icon}</span>
            <span className={`flex-1 text-sm ${h.completedToday ? "line-through text-[#4B5563]" : "text-[#E2E8F0]"}`}>{h.name}</span>
            {h.completedToday ? (
              <div className="h-4 w-4 rounded-full bg-[#7C3AED] flex items-center justify-center">
                <span className="text-[8px] text-white">✓</span>
              </div>
            ) : (
              <div className="h-4 w-4 rounded-full border border-[#3a3d4a]" />
            )}
          </button>
        ))}
      </div>
      {habits.length > 6 && (
        <Link href="/habits" className="mt-2 block text-center text-xs text-[#4B5563] hover:text-[#7C3AED]">
          +{habits.length - 6} more habits →
        </Link>
      )}
    </div>
  );
}

const SESSION_EMOJIS: Record<string, string> = {
  focus: "⏱", break: "☕", longBreak: "🛋", deep: "🧠", social: "🌐", exam: "📖", flow: "🌊"
};

const FALLBACK_TIP = "Start your timer and close every other tab — the hardest part is always the first two minutes.";

/** Live AI coach tip pulled from the real `/api/coach/session-tip` endpoint,
 *  with a graceful fallback so the card never looks broken offline. */
function CoachTipCard() {
  const { status } = useAuth();
  const { data, isLoading } = useQuery<{ tip: string }>({
    queryKey: ["coach-tip"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/coach/session-tip", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch coach tip");
      return res.json();
    },
    staleTime: 5 * 60_000,
    enabled: status === "authenticated",
  });

  const tip = data?.tip?.trim() || FALLBACK_TIP;

  return (
    <div className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-gradient-to-br from-[rgba(124,58,237,0.1)] to-transparent p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-[#A78BFA]" />
        <h3 className="text-sm font-bold text-white">AI Coach Tip</h3>
        {isLoading && (
          <span className="ml-auto h-2 w-2 rounded-full bg-[#A78BFA] animate-pulse" />
        )}
      </div>
      <p className="text-xs leading-relaxed text-[#94A3B8]">
        "{tip}"
      </p>
      <Link href="/ai-insights">
        <button className="mt-4 text-[10px] font-bold text-[#A78BFA] hover:underline uppercase tracking-widest">
          Full Insights →
        </button>
      </Link>
    </div>
  );
}

const DashboardPage = () => {
  const { status, data: session } = useAuth();
  const [, setLocation] = useLocation();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session?.user?.name?.split(" ")[0] || session?.user?.email?.split("@")[0] || "there";
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/analytics/dashboard", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      return res.json();
    },
    staleTime: 60_000,
    enabled: status === "authenticated",
  });

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/gamification/wallet", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch wallet");
      return res.json();
    },
    staleTime: 60_000,
    enabled: status === "authenticated",
  });

  const loading = statsLoading || status === "loading";

  const overviewCards = [
    { label: "Focus Score", value: stats?.avgFocusScore ? `${stats.avgFocusScore}%` : "—", icon: Zap, color: "#A78BFA" },
    { label: "Minutes Today", value: stats?.totalStudyMinutesToday ?? 0, icon: Clock, color: "#60A5FA" },
    { label: "Tasks Done", value: stats?.completedTasks ?? 0, icon: CheckCircle2, color: "#10B981" },
  ];

  return (
    <div className="min-h-screen bg-[#030308] pb-20 md:pb-10">
      <PageSEO {...PAGE_SEO.dashboard} />
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <PageTransition>
          <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <motion.div variants={SLIDE_DOWN} initial="initial" animate="animate">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#4B5563]">{dateLabel}</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[#E2E8F0] sm:text-3xl">
                {greeting}, <span className="text-[#A78BFA]">{firstName}</span> 👋
              </h1>
              <p className="mt-1 text-sm text-[#4B5563]">Here's your focus command center for today.</p>
            </motion.div>
            <div className="flex items-center gap-3">
              <WeatherWidget />
              <Link href="/">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-4 py-2 text-xs font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.35)] transition-all hover:brightness-110"
                >
                  ▶ Start New Session
                </motion.button>
              </Link>
            </div>
          </header>

          {loading && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 rounded-2xl border border-zinc-800/60 bg-zinc-950/20 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && stats && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-4">
                <StaggerContainer className="grid gap-4 sm:grid-cols-4 lg:col-span-4">
                  <StaggerItem>
                    <div className="rounded-2xl border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.04)] p-5 backdrop-blur-xl flex flex-col items-center justify-center h-full">
                      <FocusGarden minutesToday={stats.totalStudyMinutesToday} />
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.04)] p-5 backdrop-blur-xl flex flex-col items-center justify-center h-full min-h-[160px]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#4B5563] mb-2">Stability</p>
                      <Suspense fallback={null}>
                        <StabilityOrb3D stability={stats.avgFocusScore ?? 0} />
                      </Suspense>
                      <p className="text-xs font-bold text-[#A78BFA] mt-2">{stats.avgFocusScore ?? 0}%</p>
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

                <div className="lg:col-span-3 space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <StreakHeatmap chartData={stats.chartData} streak={stats.currentStreak} />
                    <GoalRing sessionsToday={stats.sessionsToday} />
                  </div>
                  
                  <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-6 backdrop-blur-xl">
                    <h2 className="mb-5 text-sm font-semibold text-[#E2E8F0]">Weekly focus (minutes)</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats.chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.08)" />
                        <XAxis dataKey="day" tick={{ fill: "#4B5563", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#4B5563", fontSize: 10 }} unit="m" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="minutes" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <FocusCity className="w-full" />
                </div>

                <div className="space-y-6">
                  {/* AI Focus Buddy */}
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex flex-col items-center text-center">
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4B5563] mb-4">Focus Companion</p>
                       <motion.div 
                         animate={{ y: [0, -8, 0], scale: [1, 1.05, 1] }}
                         transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                         className="text-6xl mb-4 select-none drop-shadow-[0_0_20px_rgba(167,139,250,0.3)]"
                       >
                         🦉
                       </motion.div>
                       <h4 className="text-sm font-bold text-white">Sage the Owl</h4>
                       <p className="text-[10px] text-[#A78BFA] font-medium">Monitoring Flow State...</p>
                       <div className="mt-4 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                            animate={{ width: ["20%", "80%", "20%"] }}
                            transition={{ repeat: Infinity, duration: 8 }}
                          />
                       </div>
                    </div>
                  </div>

                  <ReadinessWidget />
                  <DailyHabitsWidget />
                  <CoachTipCard />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[#E2E8F0]">Recent Activity</h2>
                  <Link href="/analytics" className="text-xs text-[#4B5563] hover:text-[#A78BFA]">View all history →</Link>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] backdrop-blur-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-zinc-800/60 bg-zinc-900/20 text-[#4B5563]">
                      <tr>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider">Mode</th>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider">Duration</th>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider hidden sm:table-cell">Score</th>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/30">
                      {stats.recentSessions.map((s) => (
                        <tr key={s.id} className="transition-colors hover:bg-zinc-800/10">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{SESSION_EMOJIS[s.mode] ?? "⏱"}</span>
                              <span className="font-medium text-[#A78BFA] capitalize">{s.mode}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[#94A3B8]">{Math.round(s.durationSec / 60)}m</td>
                          <td className="px-6 py-4 hidden sm:table-cell">
                            {s.focusScore ? (
                              <div className="flex items-center gap-2">
                                <div className="h-1 w-12 rounded-full bg-zinc-800">
                                  <div className="h-full rounded-full bg-[#7C3AED]" style={{ width: `${s.focusScore}%` }} />
                                </div>
                                <span className="text-[#A78BFA]">{s.focusScore}%</span>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-6 py-4 text-[#4B5563]">
                            {new Date(s.completedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </PageTransition>
      </main>
    </div>
  );
};

export default DashboardPage;
