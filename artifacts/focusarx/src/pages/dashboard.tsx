import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CheckSquare2,
  Clock3,
  Compass,
  Flame,
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
import WeeklyGoalCard from "@/components/dashboard/WeeklyGoalCard";
import RecapCard from "@/components/dashboard/RecapCard";
import CommunityNow from "@/components/dashboard/CommunityNow";
import WeeklyReviewCard from "@/components/dashboard/WeeklyReviewCard";
import OnboardingChecklist from "@/components/dashboard/OnboardingChecklist";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import PageHeader from "@/components/PageHeader";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { Wallet } from "@/types/gamification";
import { MobileDashboard } from "@/components/mobile/MobileDashboard";
import { useIsMobile } from "@/hooks/useIsMobile";

const FocusChart = lazy(() => import("@/components/dashboard/FocusChart"));

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

const EXPLORE = [
  { href: "/quests", title: "Quests", description: "Daily and weekly challenges that pay out Focus Tokens.", cta: "View quests", icon: Target, color: "var(--brand-strong)", soft: "var(--brand-soft)" },
  { href: "/pets", title: "Companion", description: "Your pet bonds and levels up with every completed block.", cta: "Manage pets", icon: PawPrint, color: "var(--success)", soft: "var(--success-soft)" },
  { href: "/city", title: "Focus City", description: "Grow a hamlet into a civilization, one session at a time.", cta: "Open city", icon: Building2, color: "var(--info)", soft: "var(--info-soft)" },
  { href: "/battle-pass", title: "Battle Pass", description: "Thirty tiers of seasonal rewards. Tokens only, no real money.", cta: "View pass", icon: Swords, color: "var(--warning)", soft: "var(--warning-soft)" },
] as const;

function getLevel(totalXp = 0) {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

function xpProgress(totalXp = 0) {
  const level = getLevel(totalXp);
  const start = (level - 1) ** 2 * 100;
  const end = level ** 2 * 100;
  return { level, value: ((totalXp - start) / Math.max(1, end - start)) * 100, remaining: end - totalXp };
}

function FocusHero({ onStart, minutes, sessions }: { onStart: () => void; minutes: number; sessions: number }) {
  const live = useFocusSessionState();
  const [, navigate] = useLocation();
  const running = live.status !== "idle";
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
            {running ? (live.mode === "focus" ? "A focus block is running." : "You're on a break.") : sessions > 0 ? "Keep the momentum going." : "Protect your next 25 minutes."}
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--foreground-muted)]">
            {running
              ? `${formatClock(live.secondsLeft)} left in this block. Head back to the timer to stay with it.`
              : sessions > 0
                ? `${minutes} minutes protected across ${sessions} ${sessions === 1 ? "block" : "blocks"} today. One more keeps the streak honest.`
                : "Pick a task, start the timer, and let FocusArx keep the rhythm, the history, and the rewards."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {running ? (
              <Button size="lg" className="min-w-40" onClick={() => navigate("/")}><Timer /> Back to timer</Button>
            ) : (
              <Button size="lg" className="min-w-40" onClick={onStart}><Timer /> Start focusing</Button>
            )}
            <Button size="lg" variant="ghost" onClick={openGuide}><Compass /> Feature guide</Button>
          </div>
        </div>
        <div className="relative mx-auto grid h-40 w-40 place-items-center rounded-full sm:h-44 sm:w-44" style={{ background: `conic-gradient(var(--brand-500) ${running ? live.progress : 0}%, var(--brand-soft) 0)` }} aria-hidden="true">
          <div className="absolute inset-2 rounded-full bg-[var(--surface)] shadow-[var(--shadow-sm)]" />
          <div className="relative text-center">
            <p className="font-mono text-4xl font-semibold tracking-[-0.06em] tabular-nums">{running ? formatClock(live.secondsLeft) : "25:00"}</p>
            <p className="mt-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[var(--foreground-subtle)]">{running ? (live.mode === "focus" ? "Focus" : "Break") : "Focus block"}</p>
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

function PulseCard({ icon, label, value, detail, tone = "brand" }: { icon: React.ReactNode; label: string; value: number; detail: string; tone?: "brand" | "success" | "warning" }) {
  const colors = {
    brand: { color: "var(--brand-strong)", soft: "var(--brand-soft)" },
    success: { color: "var(--success)", soft: "var(--success-soft)" },
    warning: { color: "var(--warning)", soft: "var(--warning-soft)" },
  }[tone];
  return (
    <Card interactive className="min-h-36">
      <CardContent className="flex h-full items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-lg)] [&_svg]:size-5" style={{ color: colors.color, background: colors.soft }}>{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums"><AnimatedCounter value={value} duration={0.4} /></p>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">{detail}</p>
        </div>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div><CardTitle>Next up</CardTitle><CardDescription>Keep the next action visible.</CardDescription></div>
        <Button asChild variant="ghost" size="sm"><Link href="/tasks">All tasks <ArrowRight /></Link></Button>
      </CardHeader>
      <CardContent>
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

function RecentActivity({ sessions }: { sessions: DashboardStats["recentSessions"] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between">
        <div><CardTitle>Recent activity</CardTitle><CardDescription>Your latest completed sessions.</CardDescription></div>
        <Button asChild variant="ghost" size="sm"><Link href="/analytics">View analytics <ArrowRight /></Link></Button>
      </CardHeader>
      {sessions.length ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable data region must be keyboard-reachable
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
      ) : <EmptyState icon={<Clock3 />} title="No sessions yet" description="Your completed focus blocks will appear here with their duration and focus score." />}
    </Card>
  );
}

function TodaysFocus({ tasks, streak, minutes, onStart }: { tasks: Array<{ title: string; priority?: string }>; streak: number; minutes: number; onStart: () => void }) {
  const hour = new Date().getHours();
  const task = tasks.find((item) => item.priority === "high") ?? tasks[0];
  const recommendation = task
    ? { title: task.title, reason: `Your clearest next action${task.priority === "high" ? " and highest-priority task" : ""}.`, duration: hour >= 20 ? 25 : 45 }
    : minutes === 0
      ? { title: "Start your first protected block", reason: streak ? `Keep your ${streak}-day streak alive.` : "A small first win creates momentum.", duration: 25 }
      : { title: "Review today and plan tomorrow", reason: `You already protected ${minutes} minutes today.`, duration: 15 };
  return (
    <Card className="border-[var(--brand-500)]/30 bg-gradient-to-r from-[var(--brand-soft)] to-transparent">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-600)] text-white"><Target /></div>
        <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-strong)]">Today&apos;s Focus</p><h2 className="mt-1 truncate text-lg font-semibold">{recommendation.title}</h2><p className="mt-1 text-sm text-[var(--foreground-muted)]">{recommendation.reason} Recommended: {recommendation.duration} minutes.</p></div>
        <Button onClick={onStart}>Start now <ArrowRight /></Button>
      </CardContent>
    </Card>
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
  const xp = xpProgress(walletQuery.data?.totalXp ?? 0);
  const loading = status === "loading" || statsQuery.isLoading;

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
          recentSessions={stats.recentSessions}
          wallet={walletQuery.data ? { totalXp: walletQuery.data.totalXp, coins: walletQuery.data.coins, level: xp.level } : undefined}
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
        icon={<LayoutIcon />}
        actions={<Button onClick={startFocus}><Timer /> Start session</Button>}
      />

      <OnboardingChecklist />

      {loading ? (
        <div className="space-y-5" role="status" aria-label="Loading dashboard">
          <Skeleton className="h-96" />
          <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-36" />)}</div>
          <div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
        </div>
      ) : statsQuery.isError || !stats ? (
        <EmptyState icon={<RefreshCw />} title="Your dashboard could not be loaded" description="Your data is safe. Check your connection and try again." action={{ label: "Retry dashboard", onClick: () => void statsQuery.refetch() }} />
      ) : (
        <div className="space-y-5">
          {/* Priority: Start Focus > today progress > quest > pet > city > battle-pass > analytics > community */}
          <FocusHero onStart={startFocus} minutes={stats.totalStudyMinutesToday} sessions={stats.sessionsToday} />
          <TodaysFocus tasks={activeTasks} streak={stats.currentStreak} minutes={stats.totalStudyMinutesToday} onStart={startFocus} />

          {/* Today progress */}
          <section aria-labelledby="pulse-title">
            <div className="mb-3 flex items-center justify-between">
              <div><h2 id="pulse-title" className="text-lg font-semibold">Today's progress</h2><p className="text-sm text-[var(--foreground-muted)]">Live read on your momentum.</p></div>
              <Badge variant={stats.sessionsToday > 0 ? "success" : "secondary"}>{stats.sessionsToday > 0 ? "In motion" : "Ready to begin"}</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <PulseCard icon={<Clock3 />} label="Minutes focused" value={stats.totalStudyMinutesToday} detail="minutes protected today" />
              <PulseCard icon={<Flame />} label="Current streak" value={stats.currentStreak} detail={stats.currentStreak ? "days of showing up" : "Start with one session"} tone="warning" />
              <PulseCard icon={<Target />} label="Focus score" value={stats.avgFocusScore ?? 0} detail={stats.avgFocusScore ? "average session quality" : "complete a session to score"} tone="success" />
              <Card interactive className="min-h-36">
                <CardContent className="flex h-full items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-soft)] text-[var(--brand-strong)] [&_svg]:size-5"><Zap /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--foreground-subtle)]">Level {xp.level}</p><span className="text-xs tabular-nums text-[var(--foreground-subtle)]">{Math.max(0, xp.remaining)} XP to go</span></div>
                    <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{(walletQuery.data?.totalXp ?? 0).toLocaleString()}<span className="ml-1 text-sm font-medium text-[var(--foreground-muted)]">XP</span></p>
                    <Progress value={xp.value} className="mt-2" aria-label={`Level ${xp.level} progress`} />
                  </div>
                </CardContent>
              </Card>
              <PulseCard icon={<CheckSquare2 />} label="Tasks due" value={activeTasks.length} detail={activeTasks.length ? "active tasks in your queue" : "Nothing waiting"} tone="success" />
              <PulseCard icon={<Trophy />} label="Tasks completed" value={stats.completedTasks} detail="completed today" tone="warning" />
            </div>
          </section>

          <section aria-labelledby="explore-title">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div><h2 id="explore-title" className="text-lg font-semibold">Grow with every block</h2><p className="text-sm text-[var(--foreground-muted)]">Focus time feeds everything here.</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {EXPLORE.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="group block rounded-[var(--radius-xl)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]">
                    <Card interactive className="h-full">
                      <CardContent className="flex h-full flex-col gap-3 p-5">
                        <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-lg)] [&_svg]:size-5" style={{ color: item.color, background: item.soft }}><Icon /></span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{item.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--foreground-muted)]">{item.description}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-strong)]">{item.cta} <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
            <Card>
              <CardHeader className="flex-row items-start justify-between"><div><CardTitle>Weekly focus</CardTitle><CardDescription>Minutes protected over the last seven days.</CardDescription></div><BarChart3 className="text-[var(--brand-strong)]" /></CardHeader>
              <CardContent><Suspense fallback={<Skeleton className="h-56" />}><FocusChart data={stats.chartData} /></Suspense></CardContent>
            </Card>
            <QuickTasks />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <WeeklyGoalCard weekMinutes={stats.chartData.reduce((sum, d) => sum + (d.minutes || 0), 0)} />
            <StreakFreezeCard />
            <RecapCard />
          </div>

          <CommunityNow />

          <WeeklyReviewCard />

          <RecentActivity sessions={stats.recentSessions} />
        </div>
      )}
    </div>
  );
}

function LayoutIcon() {
  return <BarChart3 aria-hidden="true" />;
}
