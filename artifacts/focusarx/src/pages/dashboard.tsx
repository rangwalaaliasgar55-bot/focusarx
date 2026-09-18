import { RollingClock } from "@/components/RollingClock";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Compass,
  Flame,
  LineChart,
  PawPrint,
  Plus,
  RefreshCw,
  Sparkles,
  Swords,
  Target,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { formatClock, useFocusSessionState } from "@/lib/focusSessionBus";
import { useAuth } from "@/lib/auth";
import { apiJson } from "@/lib/api";
import { useTasks } from "@/hooks/useTasks";
import { useSwipeToComplete } from "@/hooks/useSwipeToComplete";
import { useToast } from "@/components/Toast";
import StreakFreezeCard from "@/components/dashboard/StreakFreezeCard";
import WeeklyReviewCard from "@/components/dashboard/WeeklyReviewCard";
import RecapCard from "@/components/dashboard/RecapCard";
import CommunityNow from "@/components/dashboard/CommunityNow";
import OnboardingChecklist from "@/components/dashboard/OnboardingChecklist";
import PageHeader from "@/components/PageHeader";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import type { Trend } from "@/types/trend";
import type { Wallet } from "@/types/gamification";
import { MobileDashboard } from "@/components/mobile/MobileDashboard";
import { useIsMobile } from "@/hooks/useIsMobile";

const FocusChart = lazy(() => import("@/components/dashboard/FocusChart"));

type WeeklySummary = {
  totalMinutes: number;
  bestDay: { day: string; date: string; minutes: number };
  activeDays: number;
};

type Trends = {
  minutesVsYesterday: Trend;
  minutesVsAverage: Trend;
  sessionsVsYesterday: Trend;
  weekly: WeeklySummary;
  longestStreak: number;
};

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
  /**
   * Optional on purpose. The dashboard is the most-linked page in the app and
   * can be served from a prerendered shell or a warm client cache, so a payload
   * without `trends` is a real possibility — it must degrade to the "no
   * comparison yet" state rather than throwing on `trends.weekly.totalMinutes`.
   */
  trends?: Trends;
};

const SECONDARY_DESTINATIONS = [
  { href: "/quests", label: "Quests", icon: Target },
  { href: "/pets", label: "Companion", icon: PawPrint },
  { href: "/city", label: "Focus City", icon: Building2 },
  { href: "/battle-pass", label: "Battle Pass", icon: Swords },
  { href: "/analytics", label: "Analytics", icon: LineChart },
] as const;

/**
 * Words for "today vs your own typical day".
 *
 * This is the baseline that actually answers "is today normal?", which is a
 * different question from the pill's "is today better than yesterday?". Kept
 * as prose rather than a second arrow so the card has exactly one directional
 * glyph — two arrows for one metric is how a summary card becomes a chart.
 */
function describeAverage(trend: Trend | undefined): string | null {
  if (!trend?.comparable || trend.direction === "unknown") return null;
  if (trend.direction === "flat") return "in line with your 7-day average";
  if (trend.percent !== null) {
    const pct = Math.abs(Math.round(trend.percent));
    return trend.direction === "up"
      ? `${pct}% above your 7-day average`
      : `${pct}% below your 7-day average`;
  }
  const minutes = Math.abs(Math.round(trend.delta));
  return trend.direction === "up"
    ? `${minutes} min above your 7-day average`
    : `${minutes} min below your 7-day average`;
}

function getLevel(totalXp = 0) {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

function xpProgress(totalXp = 0) {
  const level = getLevel(totalXp);
  const start = (level - 1) ** 2 * 100;
  const end = level ** 2 * 100;
  return { level, value: ((totalXp - start) / Math.max(1, end - start)) * 100, remaining: Math.max(0, end - totalXp) };
}

/**
 * The one thing to do next.
 *
 * Previously the dashboard answered "what should I do now?" twice — a hero
 * card with a generic CTA and a separate "Today's Focus" card with a
 * recommendation. Two cards, one decision, and they could disagree (the hero
 * said "Start focusing", the other said "Review today and plan tomorrow").
 * The recommendation is now the hero's own headline, so the page makes a
 * single, unambiguous offer and the reason for it is on the same line.
 */
function nextAction(args: {
  tasks: Array<{ title: string; priority?: string }>;
  streak: number;
  minutes: number;
  hour: number;
}) {
  const { tasks, streak, minutes, hour } = args;
  const task = tasks.find((item) => item.priority === "high") ?? tasks[0];
  if (task) {
    return {
      title: task.title,
      reason: task.priority === "high" ? "Your highest-priority task." : "Your clearest next action.",
      // Late in the day a long block will not finish; 25 fits, 45 does not.
      duration: hour >= 20 ? 25 : 45,
    };
  }
  if (minutes === 0) {
    return {
      title: "Start your first protected block",
      reason: streak ? `One session keeps your ${streak}-day streak honest.` : "A small first win creates momentum.",
      duration: 25,
    };
  }
  return {
    title: "Review today and plan tomorrow",
    reason: `${minutes} minutes protected today — close the loop while it is fresh.`,
    duration: 15,
  };
}

function FocusHero({
  onStart,
  minutes,
  sessions,
  streak,
  tasks,
}: {
  onStart: () => void;
  minutes: number;
  sessions: number;
  streak: number;
  tasks: Array<{ title: string; priority?: string }>;
}) {
  const live = useFocusSessionState();
  const [, navigate] = useLocation();
  const running = live.status !== "idle";
  const plan = useMemo(
    () => nextAction({ tasks, streak, minutes, hour: new Date().getHours() }),
    [tasks, streak, minutes],
  );
  const openGuide = () => {
    window.dispatchEvent(new CustomEvent("focusarx:open-guide"));
  };

  return (
    <Card elevation="glow" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_80%_20%,var(--brand-soft-hover),transparent_70%)]" aria-hidden="true" />
      <CardContent className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <Badge>{running ? <><span className="live-pill-dot" aria-hidden="true" /> {live.status === "paused" ? "Paused" : "In session"}</> : <><Sparkles /> Ready when you are</>}</Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            {running ? (live.mode === "focus" ? "A focus block is running." : "You're on a break.") : plan.title}
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--foreground-muted)]">
            {running
              ? `${formatClock(live.secondsLeft)} left in this block. Head back to the timer to stay with it.`
              : `${plan.reason} ${sessions > 0 ? `${minutes} minutes across ${sessions} ${sessions === 1 ? "block" : "blocks"} so far today.` : ""}`.trim()}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {running ? (
              <Button size="lg" className="min-w-40" onClick={() => navigate("/")}><Timer /> Back to timer</Button>
            ) : (
              // The CTA names the duration it will actually start. "Start
              // focusing" makes the user open the timer to find out what they
              // agreed to; the length is decided here and shown here.
              <Button size="lg" className="min-w-40" onClick={onStart}><Timer /> Start {plan.duration}-min block</Button>
            )}
            <Button size="lg" variant="ghost" onClick={openGuide}><Compass /> Feature guide</Button>
          </div>
        </div>
        <div className="relative mx-auto grid h-40 w-40 place-items-center rounded-full sm:h-44 sm:w-44" style={{ background: `conic-gradient(var(--brand-500) ${running ? live.progress : 0}%, var(--brand-soft) 0)` }} aria-hidden="true">
          <div className="absolute inset-2 rounded-full bg-[var(--surface)] shadow-[var(--shadow-sm)]" />
          <div className="relative text-center">
            <p className="font-display text-4xl font-semibold tracking-[-0.05em]" style={{ fontFeatureSettings: '"tnum" 1' }}><RollingClock value={running ? formatClock(live.secondsLeft) : `${plan.duration}:00`} /></p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-subtle)]">{running ? (live.mode === "focus" ? "Focus" : "Break") : "Suggested"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({ title, priority, onToggle }: { title: string; priority: string | undefined; onToggle: () => void }) {
  const swipe = useSwipeToComplete(onToggle);
  return (
    <motion.button
      layout
      type="button"
      onClick={onToggle}
      {...swipe}
      className="group flex min-h-12 w-full touch-pan-y items-center gap-3 rounded-[var(--radius-md)] px-2 text-left hover:bg-[var(--surface-hover)]"
    >
      <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-[var(--border-strong)] text-transparent group-hover:border-[var(--brand-500)]"><CheckCircle2 size={14} /></span>
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--foreground-muted)]">{title}</span>
      <Badge variant="secondary" className="hidden sm:flex">{priority}</Badge>
    </motion.button>
  );
}

function QuickTasks() {
  const { activeTasks, addTask, toggleDone, isLoading } = useTasks();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = title.trim();
    if (!next || adding) return;
    setAdding(true);
    setTitle("");
    try {
      await addTask(next);
      toast("Task added", "success");
    } catch {
      setTitle(next);
      toast("Task could not be added", "danger");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Today&apos;s plan</CardTitle>
          <CardDescription>
            {activeTasks.length ? `${activeTasks.length} open ${activeTasks.length === 1 ? "task" : "tasks"}` : "Nothing queued"}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm"><Link href="/tasks">All tasks <ArrowRight /></Link></Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <form onSubmit={submit} className="flex gap-2">
          <Input ref={inputRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Quick-add a task" aria-label="Quick-add task" />
          <Button type="submit" size="icon" loading={adding} disabled={!title.trim()} aria-label="Add task"><Plus /></Button>
        </form>
        <div className="mt-4 space-y-1">
          {isLoading ? Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12" />) : activeTasks.length ? activeTasks.slice(0, 4).map((task) => (
            <TaskRow key={task.id} title={task.title} priority={task.priority} onToggle={() => toggleDone(task.id)} />
          )) : (
            <div className="py-7 text-center"><CheckCircle2 className="mx-auto text-[var(--success)]" /><p className="mt-2 text-sm font-medium">Your task list is clear.</p><p className="mt-1 text-xs text-[var(--foreground-subtle)]">Add the next thing worth doing.</p></div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The week at a glance.
 *
 * The chart and its summary were two cards reading the same array — a bar
 * chart on the left and a "weekly goal" card on the right, each recomputing
 * the total from `chartData`. One card now owns both, so the number in the
 * header and the bars underneath cannot disagree, and the section answers
 * "how is this week going, and which day carried it?" without a second glance.
 */
function WeeklyFocus({ chartData, weekly }: { chartData: DashboardStats["chartData"]; weekly?: WeeklySummary }) {
  const total = weekly?.totalMinutes ?? chartData.reduce((sum, d) => sum + (d.minutes || 0), 0);
  const best = weekly?.bestDay;
  const activeDays = weekly?.activeDays ?? chartData.filter((d) => d.minutes > 0).length;
  const hasData = total > 0;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>This week</CardTitle>
          <CardDescription>
            {hasData && best && best.minutes > 0
              ? `${total.toLocaleString()} minutes across ${activeDays} of ${chartData.length} days — best was ${best.day}`
              : "Minutes protected over the last seven days."}
          </CardDescription>
        </div>
        <BarChart3 className="shrink-0 text-[var(--brand-strong)]" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {hasData ? (
          <Suspense fallback={<Skeleton className="h-56" />}>
            <FocusChart data={chartData} />
          </Suspense>
        ) : (
          <EmptyState
            icon={<BarChart3 />}
            title="Your week starts with one block"
            description="Finish a focus session and this chart fills in day by day."
          />
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({ sessions }: { sessions: DashboardStats["recentSessions"] }) {
  if (!sessions.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Your latest completed sessions.</CardDescription></CardHeader>
        <CardContent><EmptyState icon={<Clock3 />} title="No sessions yet" description="Completed focus blocks appear here with their duration and focus score." /></CardContent>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between">
        <div><CardTitle>Recent activity</CardTitle><CardDescription>Your latest completed sessions.</CardDescription></div>
        <Button asChild variant="ghost" size="sm"><Link href="/analytics">View analytics <ArrowRight /></Link></Button>
      </CardHeader>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable data region must be keyboard-reachable */}
      <div className="mt-5 overflow-x-auto" role="region" aria-label="Recent focus activity" tabIndex={0}>
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-[var(--surface-raised)] text-xs uppercase tracking-wider text-[var(--foreground-subtle)]">
            <tr><th className="px-6 py-3 font-semibold">Session</th><th className="px-6 py-3 font-semibold">Duration</th><th className="px-6 py-3 font-semibold">Focus score</th><th className="px-6 py-3 font-semibold">Completed</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {sessions.slice(0, 5).map((session) => (
              <tr key={session.id} className="hover:bg-[var(--surface-hover)]">
                <td className="px-6 py-4 font-medium capitalize">{session.mode.replaceAll("_", " ")}</td>
                <td className="px-6 py-4 text-[var(--foreground-muted)]">{Math.round(session.durationSec / 60)} min</td>
                <td className="px-6 py-4"><span className="inline-flex items-center gap-2"><Progress value={session.focusScore ?? 0} className="w-16" /><span className="tabular-nums text-xs">{session.focusScore ?? "—"}{session.focusScore ? "%" : ""}</span></span></td>
                <td className="px-6 py-4 text-[var(--foreground-subtle)]">{new Date(session.completedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * Progressive disclosure.
 *
 * Research finding: past ~9 components a dashboard stops being scannable,
 * because everything competes at the same weight and the reader has to triage
 * instead of decide. The previous layout put streak freezes, a weekly recap, a
 * community feed, a review prompt, a five-row table and four destination cards
 * all on the same visual plane as "minutes focused today".
 *
 * Nothing was deleted — the sections are below the fold and one tap away, and
 * the summary line says what is down there so the tap is informed. That is the
 * difference between hiding content and deferring it.
 */
function SecondarySection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="more-insights-title" className="space-y-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="more-insights"
        className="flex min-h-12 w-full items-center justify-between gap-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-3 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]"
      >
        <span className="min-w-0">
          <span id="more-insights-title" className="block font-semibold">More insights</span>
          <span className="block text-xs text-[var(--foreground-muted)]">Streak protection, weekly recap, community, and recent sessions</span>
        </span>
        <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-[var(--foreground-subtle)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div id="more-insights" className="space-y-5">{children}</div> : null}
    </section>
  );
}

export default function DashboardPage() {
  const { status, data: session } = useAuth();
  const [, navigate] = useLocation();
  const { activeTasks } = useTasks();
  const isMobile = useIsMobile();
  const now = useMemo(() => new Date(), []);
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const firstName = session?.user?.name?.split(" ")[0] || session?.user?.email?.split("@")[0] || "there";

  const statsQuery = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiJson<DashboardStats>("/api/stats"),
    staleTime: 60_000,
    enabled: status === "authenticated",
  });

  const walletQuery = useQuery<Wallet>({
    queryKey: ["wallet"],
    queryFn: () => apiJson<Wallet>("/api/gamification/wallet"),
    staleTime: 60_000,
    enabled: status === "authenticated",
  });

  const startFocus = () => {
    navigate("/");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("focusarx:start-focus")), 120);
  };

  const stats = statsQuery.data;
  const trends = stats?.trends;
  const totalXp = walletQuery.data?.totalXp ?? 0;
  const xp = xpProgress(totalXp);
  const loading = status === "loading" || statsQuery.isLoading;
  const weekMinutes = useMemo(
    () => trends?.weekly.totalMinutes ?? (stats?.chartData ?? []).reduce((sum, d) => sum + (d.minutes || 0), 0),
    [trends, stats],
  );

  // Mobile-first dashboard
  if (isMobile && !loading && stats) {
    return (
      <>
        <PageSEO {...PAGE_SEO.dashboard} />
        <MobileDashboard
          onStartFocus={startFocus}
          stats={{
            totalStudyMinutesToday: stats.totalStudyMinutesToday,
            sessionsToday: stats.sessionsToday,
            currentStreak: stats.currentStreak,
            avgFocusScore: stats.avgFocusScore,
          }}
          trends={trends}
          recentSessions={stats.recentSessions}
          wallet={walletQuery.data ? { totalXp, coins: walletQuery.data.coins, level: xp.level } : undefined}
        />
      </>
    );
  }

  return (
    <div className="page-container">
      <PageSEO {...PAGE_SEO.dashboard} />
      <PageHeader
        eyebrow={now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        title={`${greeting}, ${firstName}`}
        subtitle="One clear plan for your focus, tasks, and momentum today."
        icon={<BarChart3 aria-hidden="true" />}
        actions={<Button onClick={startFocus}><Timer /> Start session</Button>}
      />

      <OnboardingChecklist />

      {loading ? (
        <div className="space-y-5" role="status" aria-label="Loading dashboard">
          <Skeleton className="h-96" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40" />)}</div>
          <div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
        </div>
      ) : statsQuery.isError || !stats ? (
        <EmptyState icon={<RefreshCw />} title="Your dashboard could not be loaded" description="Your data is safe. Check your connection and try again." action={{ label: "Retry dashboard", onClick: () => void statsQuery.refetch() }} />
      ) : (
        <div className="space-y-5">
          {/*
            Reading order is deliberate and follows the F/Z scan pattern:
              1. what to do now            (hero, full width)
              2. how am I doing            (KPI strip, decision-critical card top-left)
              3. what is left to do today  (tasks)
              4. how has the week gone     (chart)
              5. everything else           (one disclosure)
            The previous order led with a hero, immediately repeated the same
            question with a second CTA card, then spread six equally-weighted
            metrics in a grid.
          */}
          <FocusHero onStart={startFocus} minutes={stats.totalStudyMinutesToday} sessions={stats.sessionsToday} streak={stats.currentStreak} tasks={activeTasks} />

          <section aria-labelledby="pulse-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 id="pulse-title" className="text-lg font-semibold">Today at a glance</h2>
                <p className="text-sm text-[var(--foreground-muted)]">Every number against the last one that matters.</p>
              </div>
              <Badge variant={stats.sessionsToday > 0 ? "success" : "secondary"}>{stats.sessionsToday > 0 ? "In motion" : "Ready to begin"}</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {/*
                The primary metric is top-left and twice the size of the rest —
                Fitts's Law says the most important number should be the most
                reachable and the easiest to target, and it is the number that
                answers "did today count?".
              */}
              <StatCard
                emphasis="primary"
                label="Minutes focused"
                value={stats.totalStudyMinutesToday}
                unit="min"
                icon={<Clock3 />}
                trend={trends?.minutesVsYesterday}
                detail={[
                  `${stats.sessionsToday} ${stats.sessionsToday === 1 ? "block" : "blocks"} today`,
                  describeAverage(trends?.minutesVsAverage),
                ]
                  .filter(Boolean)
                  .join(" \u00b7 ")}
                sparkline={stats.chartData.map((d) => d.minutes)}
              />
              <StatCard
                label="Current streak"
                value={stats.currentStreak}
                unit="days"
                icon={<Flame />}
                tone="warning"
                href="/quests"
                badge={
                  stats.currentStreak === 0 ? undefined : trends && stats.currentStreak >= trends.longestStreak ? (
                    <Badge variant="gold"><Trophy /> Personal best</Badge>
                  ) : trends && trends.longestStreak > 0 ? (
                    <Badge variant="secondary">{trends.longestStreak - stats.currentStreak} to your record</Badge>
                  ) : undefined
                }
                detail={
                  stats.currentStreak > 0 ? "Showing up is the whole game" : "One session starts it"
                }
              />
              <StatCard
                label="Focus score"
                value={stats.avgFocusScore ?? 0}
                unit={stats.avgFocusScore ? "%" : ""}
                icon={<Target />}
                tone="success"
                href="/analytics"
                badge={
                  stats.avgFocusScore && stats.dominantStability && stats.dominantStability !== "unknown" ? (
                    <Badge variant="secondary" className="capitalize">{stats.dominantStability} sessions</Badge>
                  ) : undefined
                }
                detail={stats.avgFocusScore ? "Average session quality today" : "Finish a session to score one"}
              />
              <StatCard
                label={`Level ${xp.level}`}
                value={totalXp}
                unit="XP"
                icon={<Zap />}
                trend={null}
                detail={xp.remaining > 0 ? `${xp.remaining.toLocaleString()} XP to level ${xp.level + 1}` : "Maxed for this level"}
                footer={<Progress value={xp.value} aria-label={`Level ${xp.level} progress`} />}
              />
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <WeeklyFocus chartData={stats.chartData} weekly={trends?.weekly} />
            <QuickTasks />
          </div>

          <nav aria-label="More sections" className="flex flex-wrap gap-2">
            {SECONDARY_DESTINATIONS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground-muted)] transition-colors hover:border-[var(--card-border)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <SecondarySection>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <StreakFreezeCard />
                <RecapCard />
              </div>
              <div className="space-y-5">
                <WeeklyReviewCard />
                <CommunityNow />
              </div>
            </div>
            <RecentActivity sessions={stats.recentSessions} />
          </SecondarySection>

          {/* Weekly total is real data the user earned; it belongs in the summary, not only in the chart. */}
          {weekMinutes > 0 ? (
            <p className="flex items-center justify-center gap-2 pt-1 text-center text-xs text-[var(--foreground-subtle)]">
              <Trophy aria-hidden="true" className="size-3.5" />
              {weekMinutes.toLocaleString()} minutes protected this week
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
