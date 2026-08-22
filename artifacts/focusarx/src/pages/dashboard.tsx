import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth, getToken } from "@/lib/auth";
import { apiJson } from "@/lib/api";
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
    <div className="rounded-lg border border-[rgba(124,58,237,0.3)] bg-[rgba(12,17,40,0.95)] px-3 py-2 text-xs text-[var(--foreground)] shadow-xl backdrop-blur-xl">
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
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">Study Streak</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-2xl font-bold text-[var(--foreground)]">
            🔥 <span>{streak}</span>
            <span className="text-sm font-normal text-[var(--foreground-subtle)]">days</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-[var(--foreground-subtle)]">Last 30 days</p>
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
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">Today's Goal</p>
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
          <span className="text-lg font-bold text-[var(--foreground)]">{sessionsToday}</span>
          <span className="text-[10px] text-[var(--foreground-subtle)]">of {target}</span>
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
          <p className="text-sm font-semibold text-[var(--foreground)]">Today's Habits</p>
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
            <span className={`flex-1 text-sm ${h.completedToday ? "line-through text-[var(--foreground-subtle)]" : "text-[var(--foreground)]"}`}>{h.name}</span>
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
        <Link href="/habits" className="mt-2 block text-center text-xs text-[var(--foreground-subtle)] hover:text-[#7C3AED]">
          +{habits.length - 6} more habits →
        </Link>
      )}
    </div>
  );
}

const SESSION_EMOJIS: Record<string, string> = {
  focus: "⏱", break: "☕", longBreak: "🛋", deep: "🧠", social: "🌐", exam: "📖", flow: "🌊"
};

const PET_EMOJIS: Record<string, string> = {
  owl: "🦉", fox: "🦊", dragon: "🐲", robot: "🤖", cat: "🐱", phoenix: "🦅",
};

type DashboardPet = {
  petType: string;
  petName: string | null;
  petLevel: number;
  petXp: number;
  mood: string;
  xpToNextLevel: number;
  evolutionName: string;
};

/** Live pet companion pulled from the real `/api/pets` endpoint, replacing the
 *  previously hardcoded "Sage the Owl" placeholder. Falls back to a friendly
 *  "adopt your companion" CTA when the user hasn't created a pet yet. */
function PetCard() {
  const { status } = useAuth();
  const { data, isLoading } = useQuery<{ pet: DashboardPet | null }>({
    queryKey: ["pet"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/pets", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch pet");
      return res.json();
    },
    staleTime: 60_000,
    enabled: status === "authenticated",
  });

  const pet = data?.pet;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-5 backdrop-blur-xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--foreground-subtle)] mb-3">Focus Companion</p>

        {isLoading ? (
          <div className="h-16 w-16 animate-pulse rounded-full bg-white/5" />
        ) : pet ? (
          <motion.div
            animate={{ y: [0, -8, 0], scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="text-6xl mb-2 select-none drop-shadow-[0_0_20px_rgba(167,139,250,0.3)]"
          >
            {PET_EMOJIS[pet.petType] ?? "🦉"}
          </motion.div>
        ) : (
          <div className="text-6xl mb-2 select-none opacity-60 grayscale">🥚</div>
        )}

        {pet ? (
          <>
            <h4 className="text-sm font-bold text-[var(--foreground)]">{pet.petName || pet.evolutionName}</h4>
            <p className="text-[10px] text-[#A78BFA] font-medium">Level {pet.petLevel} · {pet.mood}</p>
            <div className="mt-3 w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                initial={false}
                animate={{ width: `${Math.min(100, Math.round((pet.petXp / Math.max(1, pet.petXp + pet.xpToNextLevel)) * 100))}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <p className="mt-1 text-[9px] text-[var(--foreground-subtle)]">{pet.petXp} XP · {pet.xpToNextLevel} to level {pet.petLevel + 1}</p>
            <Link href="/pets" className="mt-3 text-[10px] font-bold text-[#A78BFA] hover:underline uppercase tracking-widest">
              Visit my pet →
            </Link>
          </>
        ) : (
          !isLoading && (
            <>
              <h4 className="text-sm font-bold text-[var(--foreground)]">Adopt a Companion</h4>
              <p className="mt-1 text-[10px] text-[var(--foreground-subtle)] leading-relaxed">
                Hatch a pet that grows with every focus session.
              </p>
              <Link href="/pets" className="mt-3 inline-block rounded-lg bg-[#7C3AED]/15 px-3 py-1.5 text-[10px] font-bold text-[#A78BFA] hover:bg-[#7C3AED]/25 transition-colors">
                Choose your pet
              </Link>
            </>
          )
        )}
      </div>
    </div>
  );
}

/** Shown to brand-new users (zero sessions) as a friendly guided checklist. */
function GettingStarted({ sessionsToday, completedTasks }: { sessionsToday: number; completedTasks: number }) {
  const steps = [
    { done: sessionsToday > 0, icon: "⏱", label: "Complete your first focus session", href: "/" },
    { done: completedTasks > 0, icon: "✅", label: "Add and finish a task", href: "/dashboard" },
    { done: false, icon: "🔁", label: "Start a streak (focus 2 days in a row)", href: "/" },
    { done: false, icon: "🐣", label: "Adopt your focus companion", href: "/pets" },
  ];
  if (steps.every((s) => s.done)) return null;

  const remaining = steps.filter((s) => !s.done).length;

  return (
    <div className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-gradient-to-br from-[rgba(124,58,237,0.08)] to-transparent p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚀</span>
          <h2 className="text-sm font-bold text-[var(--foreground)]">Getting Started</h2>
        </div>
        <span className="rounded-full bg-[#7C3AED]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#A78BFA]">
          {remaining} step{remaining !== 1 ? "s" : ""} left
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
              s.done
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-[var(--border)] bg-[var(--muted)] hover:border-[#7C3AED]/40 hover:bg-[#7C3AED]/5"
            }`}
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${s.done ? "bg-emerald-500/15" : "bg-white/5"}`}>
              {s.done ? "✓" : s.icon}
            </span>
            <span className={`text-xs leading-snug ${s.done ? "text-[var(--foreground-subtle)] line-through" : "text-[var(--foreground-muted)]"}`}>
              {s.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * "Today's Pulse" — a personalized, emotionally connective line that reflects
 * the user's *actual* progress back at them. Every message is derived from real
 * data (streak, sessions, minutes, level) so it always feels true and personal,
 * never generic. This is the emotional anchor of the dashboard.
 */
function PersonalPulse({ stats, level }: { stats: DashboardStats; level: number }) {
  const { sessionsToday, totalStudyMinutesToday, currentStreak } = stats;
  const GOAL = 6;

  let emoji: string;
  let headline: string;
  let sub: string;

  if (currentStreak >= 30) {
    emoji = "🏆";
    headline = `A ${currentStreak}-day streak. Most people never get here.`;
    sub = "You've shown up for yourself for a full month. That's not luck — that's who you are now.";
  } else if (sessionsToday >= GOAL) {
    emoji = "🎉";
    headline = "Daily goal complete. You did the thing.";
    sub = `${totalStudyMinutesToday} minutes of real focus today. Tomorrow you, but slightly sharper.`;
  } else if (sessionsToday >= 1) {
    emoji = "⚡";
    headline = `You've already put in ${totalStudyMinutesToday} minute${totalStudyMinutesToday === 1 ? "" : "s"} today.`;
    sub = `Momentum is on your side — ${GOAL - sessionsToday} more block${GOAL - sessionsToday === 1 ? "" : "s"} and you've hit your goal.`;
  } else if (currentStreak >= 1) {
    emoji = "🔥";
    headline = `You're on a ${currentStreak}-day streak. Keep it alive.`;
    sub = "One session today protects everything you've built. I believe in you — let's go.";
  } else {
    emoji = "🌱";
    headline = "Day one of something that compounds.";
    sub = "The first session is the one that matters most. Start small — 25 minutes is enough.";
  }

  return (
    <motion.div
      variants={SLIDE_UP}
      initial="initial"
      animate="animate"
      className="rounded-2xl border border-[rgba(124,58,237,0.25)] bg-gradient-to-r from-[rgba(124,58,237,0.12)] via-[rgba(79,70,229,0.08)] to-[rgba(6,214,160,0.06)] p-5 backdrop-blur-xl"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(124,58,237,0.18)] text-2xl">
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-[var(--foreground)] leading-snug">{headline}</h2>
          <p className="mt-1 text-sm text-[var(--foreground-muted)] leading-relaxed">{sub}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(124,58,237,0.15)] px-2.5 py-1 text-[#A78BFA]">
              ⚡ Level {level}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(245,158,11,0.15)] px-2.5 py-1 text-amber-400">
              🔥 {currentStreak}-day streak
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(6,214,160,0.15)] px-2.5 py-1 text-emerald-400">
              🎯 {sessionsToday}/{GOAL} today
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const FALLBACK_TIP = "Start your timer and close every other tab — the hardest part is always the first two minutes.";

/** Live AI coach tip pulled from the real `/api/coach/session-tip` endpoint,
 *  with a graceful fallback so the card never looks broken offline. */
function CoachTipCard({ currentStreak }: { currentStreak?: number }) {
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

  // Personalize the fallback with the user's real streak so even the offline
  // message feels tailored to them rather than generic.
  const fallback =
    currentStreak && currentStreak > 0
      ? `You're on a ${currentStreak}-day streak — start your timer and keep it going. One focused block today is all it takes.`
      : FALLBACK_TIP;

  const tip = data?.tip?.trim() || fallback;

  return (
    <div className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-gradient-to-br from-[rgba(124,58,237,0.1)] to-transparent p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-[#A78BFA]" />
        <h3 className="text-sm font-bold text-[var(--foreground)]">AI Coach Tip</h3>
        {isLoading && (
          <span className="ml-auto h-2 w-2 rounded-full bg-[#A78BFA] animate-pulse" />
        )}
      </div>
      <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
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

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: retryStats } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiJson<DashboardStats>("/api/analytics/dashboard"),
    staleTime: 60_000,
    enabled: status === "authenticated",
  });

  const { data: wallet } = useQuery<Wallet>({
    queryKey: ["wallet"],
    queryFn: () => apiJson<Wallet>("/api/gamification/wallet"),
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
    <div className="min-h-screen bg-[var(--background)] pb-20 md:pb-10">
      <PageSEO {...PAGE_SEO.dashboard} />
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <PageTransition>
          <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <motion.div variants={SLIDE_DOWN} initial="initial" animate="animate">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--foreground-subtle)]">{dateLabel}</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--foreground)] sm:text-3xl">
                {greeting}, <span className="text-[#A78BFA]">{firstName}</span> 👋
              </h1>
              <p className="mt-1 text-sm text-[var(--foreground-subtle)]">Here's your mission briefing for today, Commander.</p>
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

          {!loading && statsError && (
            <section className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center">
              <p className="text-sm font-semibold text-[var(--foreground)]">Your dashboard could not be loaded.</p>
              <p className="mt-1 text-xs text-[var(--foreground-subtle)]">Your data is safe. Check your connection and try again.</p>
              <button onClick={() => void retryStats()} className="mt-4 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white">Retry dashboard</button>
            </section>
          )}

          {!loading && !statsError && stats && (
            <div className="space-y-6">
              <PersonalPulse stats={stats} level={wallet?.level ?? 1} />
              <GettingStarted sessionsToday={stats.sessionsToday} completedTasks={stats.completedTasks} />
              <div className="grid gap-6 lg:grid-cols-4">
                <StaggerContainer className="grid gap-4 sm:grid-cols-4 lg:col-span-4">
                  <StaggerItem>
                    <div className="rounded-2xl border border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.04)] p-5 backdrop-blur-xl flex flex-col items-center justify-center h-full">
                      <FocusGarden minutesToday={stats.totalStudyMinutesToday} />
                    </div>
                  </StaggerItem>
                  <StaggerItem>
                    <div className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.04)] p-5 backdrop-blur-xl flex flex-col items-center justify-center h-full min-h-[160px]">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)] mb-2">Stability</p>
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
                            <p className="text-[9px] uppercase tracking-wider text-[var(--foreground-subtle)]">{label}</p>
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
                    <h2 className="mb-5 text-sm font-semibold text-[var(--foreground)]">Weekly focus (minutes)</h2>
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
                  {/* Live Focus Companion */}
                  <PetCard />

                  <ReadinessWidget />
                  <DailyHabitsWidget />
                  <CoachTipCard currentStreak={stats.currentStreak} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[var(--foreground)]">Recent Activity</h2>
                  <Link href="/analytics" className="text-xs text-[var(--foreground-subtle)] hover:text-[#A78BFA]">View all history →</Link>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] backdrop-blur-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="border-b border-zinc-800/60 bg-zinc-900/20 text-[var(--foreground-subtle)]">
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
                          <td className="px-6 py-4 text-[var(--foreground-muted)]">{Math.round(s.durationSec / 60)}m</td>
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
                          <td className="px-6 py-4 text-[var(--foreground-subtle)]">
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
