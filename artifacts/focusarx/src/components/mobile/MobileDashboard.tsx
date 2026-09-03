
import { useMemo, useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Timer,
  Flame,
  CheckSquare2,
  Clock,
  Trophy,
  Target,
  Sparkles,
  ArrowRight,
  Play,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTasks } from "@/hooks/useTasks";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

interface MobileDashboardProps {
  onStartFocus: () => void;
  stats?: {
    totalStudyMinutesToday: number;
    sessionsToday: number;
    currentStreak: number;
    avgFocusScore: number | null;
  };
  recentSessions?: Array<{
    id: string;
    mode: string;
    durationSec: number;
    completedAt: string;
  }>;
  wallet?: {
    totalXp: number;
    coins: number;
    level: number;
  };
}

export function MobileDashboard({ onStartFocus, stats, recentSessions, wallet }: MobileDashboardProps) {
  const { data: session } = useAuth();
  const { activeTasks } = useTasks();
  const { focusSessionsToday } = useSessionHistory();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullOffset, setPullOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  const user = session?.user;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  const nextTask = useMemo(() => activeTasks.find((t) => t.priority === "high") || activeTasks[0], [activeTasks]);

  const todayMinutes = stats?.totalStudyMinutesToday ?? 0;
  const sessionsToday = stats?.sessionsToday ?? focusSessionsToday;
  const streak = stats?.currentStreak ?? 0;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mobile-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["auth", "session"] }),
      ]);
      // Haptic feedback
      if ("vibrate" in navigator) navigator.vibrate(20);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  }, [queryClient]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0]?.clientY ?? 0;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current || containerRef.current.scrollTop > 0) return;
    const curY = e.touches[0]?.clientY ?? 0;
    const diff = curY - startY.current;
    if (diff > 0 && diff < 120) {
      setPullOffset(diff * 0.5);
    }
  };
  const handleTouchEnd = () => {
    if (pullOffset > 50) {
      void handleRefresh();
    }
    setPullOffset(0);
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col gap-4 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:hidden overflow-auto"
      style={{ transform: `translateY(${pullOffset}px)`, transition: pullOffset === 0 ? "transform 0.2s" : "none" }}
    >
      {/* Pull to refresh indicator */}
      {pullOffset > 10 && (
        <div className="flex justify-center py-2" style={{ opacity: pullOffset / 60 }}>
          <RefreshCw size={20} className={cn("text-[var(--foreground-subtle)]", isRefreshing && "animate-spin")} />
        </div>
      )}
      {/* Greeting - immediate answer: What should I do now? */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, <span className="text-[var(--brand-400)]">{firstName}</span>
        </h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          {sessionsToday === 0
            ? "Ready to protect your first focus block?"
            : `You've focused ${todayMinutes} min today. Keep the momentum.`}
        </p>
      </div>

      {/* Start Focus card - primary CTA, above fold */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[1.25rem] border border-[var(--brand-500)]/20 bg-gradient-to-br from-[var(--brand-600)] to-[var(--brand-700)] p-5 text-white shadow-[var(--shadow-violet-md)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/70">Next session</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">Start focusing</h2>
              <p className="mt-1 max-w-[14rem] text-sm leading-snug text-white/80">
                {nextTask ? `Next up: ${nextTask.title}` : "25 min of deep work. One task, no noise."}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <Timer size={24} />
            </span>
          </div>
          <button
            type="button"
            onClick={onStartFocus}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[var(--brand-700)] shadow-lg transition-transform active:scale-[0.98]"
          >
            <Play size={18} fill="currentColor" />
            Start focus session
          </button>
        </div>
      </motion.div>

      {/* Today's focus progress */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5">
          <div className="flex items-center gap-2 text-[var(--foreground-subtle)]">
            <Clock size={14} />
            <span className="text-[11px] font-semibold uppercase tracking-widest">Today</span>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums">{todayMinutes}m</p>
          <p className="text-xs text-[var(--foreground-subtle)]">focused</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5">
          <div className="flex items-center gap-2 text-[var(--foreground-subtle)]">
            <Target size={14} />
            <span className="text-[11px] font-semibold uppercase tracking-widest">Sessions</span>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums">{sessionsToday}</p>
          <p className="text-xs text-[var(--foreground-subtle)]">completed</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5">
          <div className="flex items-center gap-2 text-[var(--warning)]">
            <Flame size={14} />
            <span className="text-[11px] font-semibold uppercase tracking-widest">Streak</span>
          </div>
          <p className="mt-2 text-xl font-bold tabular-nums">{streak}</p>
          <p className="text-xs text-[var(--foreground-subtle)]">days</p>
        </div>
      </div>

      {/* Next task - clear, not cluttered */}
      {nextTask ? (
        <Link
          href="/tasks"
          className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 transition-colors hover:bg-[var(--surface-hover)] active:scale-[0.99]"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-strong)]">
            <CheckSquare2 size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-widest text-[var(--foreground-subtle)]">Next task</span>
            <span className="block truncate text-sm font-medium">{nextTask.title}</span>
          </span>
          <ArrowRight size={16} className="text-[var(--foreground-subtle)]" />
        </Link>
      ) : (
        <Link
          href="/tasks"
          className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-1)]/50 p-4"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-hover)] text-[var(--foreground-subtle)]">
            <Sparkles size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">No tasks yet</span>
            <span className="block text-xs text-[var(--foreground-subtle)]">Add your next focus task</span>
          </span>
          <ArrowRight size={16} className="text-[var(--foreground-subtle)]" />
        </Link>
      )}

      {/* Current streak - motivational */}
      {streak > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--warning-soft)] p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--warning)]/20 text-[var(--warning)]">
            <Flame size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--warning)]">
              {streak} day streak — keep it alive!
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">One session today protects your streak.</p>
          </div>
        </div>
      )}

      {/* Recent sessions - simple, not chart heavy */}
      {recentSessions && recentSessions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent sessions</h3>
            <Link href="/analytics" className="text-xs font-medium text-[var(--brand-strong)] hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentSessions.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--surface-hover)]">
                  <Timer size={16} className="text-[var(--foreground-subtle)]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium capitalize">{s.mode.replace("_", " ")}</span>
                  <span className="block text-xs text-[var(--foreground-subtle)]">
                    {Math.round(s.durationSec / 60)} min • {new Date(s.completedAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="text-xs font-bold text-[var(--success)]">+{Math.floor(s.durationSec / 60 / 5) * 10} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wallet summary - minimal */}
      {wallet && (
        <div className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🪙</span>
            <span className="text-sm font-bold tabular-nums">{wallet.coins.toLocaleString()}</span>
            <span className="mx-2 h-4 w-px bg-[var(--border-subtle)]" />
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-[var(--brand-600)] text-[10px] font-semibold text-white">
              {wallet.level}
            </span>
            <span className="text-sm font-medium tabular-nums">{wallet.totalXp.toLocaleString()} XP</span>
          </div>
          <Link href="/wallet" className="text-xs font-medium text-[var(--brand-strong)]">
            Details
          </Link>
        </div>
      )}

      {/* Avoid showing above fold: no 3D city, no multiple charts, no leaderboards, no room activity */}
      <div className="pt-2 text-center">
        <p className="text-[11px] text-[var(--foreground-subtle)]">
          Need inspiration? <Link href="/focus-guide" className="font-medium text-[var(--brand-strong)] hover:underline">Browse focus guides</Link>
        </p>
      </div>
    </div>
  );
}
