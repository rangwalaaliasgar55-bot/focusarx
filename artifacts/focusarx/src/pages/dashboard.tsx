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
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiJson } from "@/lib/api";
import { useTasks } from "@/hooks/useTasks";
import { useSwipeToComplete } from "@/hooks/useSwipeToComplete";
import { useToast } from "@/components/Toast";
import StreakFreezeCard from "@/components/dashboard/StreakFreezeCard";
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

function getLevel(totalXp = 0) {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

function xpProgress(totalXp = 0) {
  const level = getLevel(totalXp);
  const start = (level - 1) ** 2 * 100;
  const end = level ** 2 * 100;
  return { level, value: ((totalXp - start) / Math.max(1, end - start)) * 100, remaining: end - totalXp };
}

function FocusHero({ onStart }: { onStart: () => void }) {
  const openGuide = () => {
    window.dispatchEvent(new CustomEvent("focusarx:open-guide"));
  };

  return (
    <Card elevation="glow" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,var(--brand-soft-hover),transparent_60%)]" />
      <CardContent className="relative grid min-h-[22rem] place-items-center px-5 py-10 text-center sm:min-h-[25rem]">
        <div>
          <Badge><Sparkles /> Science-Backed Deep Work</Badge>
          <div className="relative mx-auto mt-7 grid h-48 w-48 place-items-center rounded-full border border-[var(--card-border)] bg-[var(--surface-hover)] shadow-[inset_0_0_0_10px_var(--brand-soft)] sm:h-56 sm:w-56">
            <div className="absolute inset-3 rounded-full border border-dashed border-[var(--border-strong)]" aria-hidden="true" />
            <div>
              <p className="font-mono text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)] sm:text-6xl">25:00</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--foreground-subtle)]">Focus block</p>
            </div>
          </div>
          <h2 className="mt-7 text-xl font-semibold tracking-tight">Protect your flow state.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--foreground-muted)]">
            Choose your task, activate ambient audio, and let FocusArx handle the rhythm.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="min-w-40" onClick={onStart}>
              <Timer /> Start Focusing
            </Button>
            <Button size="lg" variant="outline" onClick={openGuide} className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10">
              <Compass /> Explore Features Guide
            </Button>
          </div>
          <p className="mt-3 text-xs text-[var(--foreground-subtle)]">
            Includes Web Worker drift-protection, 3D City growth, and Google Gemini AI coaching.
          </p>
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

  // Mobile lightweight endpoint
  const mobileStatsQuery = useQuery({
    queryKey: ["mobile-dashboard"],
    queryFn: () => apiJson<any>("/api/mobile/dashboard"),
    staleTime: 30_000,
    enabled: status === "authenticated" && isMobile,
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
          <FocusHero onStart={startFocus} />
          <TodaysFocus tasks={activeTasks} streak={stats.currentStreak} minutes={stats.totalStudyMinutesToday} onStart={startFocus} />

          <StreakFreezeCard />

          {/* Today progress */}
          <section aria-labelledby="pulse-title">
            <div className="mb-3 flex items-center justify-between">
              <div><h2 id="pulse-title" className="text-lg font-semibold">Today's Progress</h2><p className="text-sm text-[var(--foreground-muted)]">Live read on your momentum.</p></div>
              <Badge variant={stats.sessionsToday > 0 ? "success" : "secondary"}>{stats.sessionsToday > 0 ? "In motion" : "Ready to begin"}</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <PulseCard icon={<Flame />} label="Current streak" value={stats.currentStreak} detail={stats.currentStreak ? "days of showing up" : "Start with one session"} tone="warning" />
              <Card interactive className="min-h-36">
                <CardContent>
                  <div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-soft)] text-[var(--brand-strong)]"><Zap /></span><Badge>Level {xp.level}</Badge></div>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">{(walletQuery.data?.totalXp ?? 0).toLocaleString()} XP</p>
                  <Progress value={xp.value} className="mt-2" /><p className="mt-1 text-xs text-[var(--foreground-subtle)]">{Math.max(0, xp.remaining)} XP to next level</p>
                </CardContent>
              </Card>
              <PulseCard icon={<CheckSquare2 />} label="Tasks due" value={activeTasks.length} detail={activeTasks.length ? "active tasks in your queue" : "Nothing waiting"} tone="success" />
            </div>
          </section>

          {/* Quest preview */}
          <Card>
            <CardHeader className="flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2"><Target size={16}/> Quests</CardTitle><CardDescription>Daily & weekly challenges for Focus Tokens</CardDescription></div><Button asChild variant="ghost" size="sm"><Link href="/quests">View quests <ArrowRight /></Link></Button></CardHeader>
            <CardContent><p className="text-xs text-[var(--foreground-muted)]">Complete quests to earn Focus Tokens and unlock Premium. Premium gets more quests & streak token bonuses.</p></CardContent>
          </Card>

          {/* Pet preview */}
          <Card>
            <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Companion</CardTitle><CardDescription>Your active pet grows with focus</CardDescription></div><Button asChild variant="ghost" size="sm"><Link href="/pets">Manage pets <ArrowRight /></Link></Button></CardHeader>
            <CardContent><p className="text-xs text-[var(--foreground-muted)]">Bond level 1-20, unlocks at 1/3/5/8/10/15/20. Premium pets and 3D models available.</p></CardContent>
          </Card>

          {/* City preview */}
          <Card>
            <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Focus City</CardTitle><CardDescription>Build your civilization</CardDescription></div><Button asChild variant="ghost" size="sm"><Link href="/city">Open city <ArrowRight /></Link></Button></CardHeader>
            <CardContent><p className="text-xs text-[var(--foreground-muted)]">Premium unlocks night/sunset/weather/seasonal buildings, skyboxes, shareable snapshots.</p></CardContent>
          </Card>

          {/* Battle-pass preview */}
          <Card>
            <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Battle Pass</CardTitle><CardDescription>30 tiers • 28-30 day season</CardDescription></div><Button asChild variant="ghost" size="sm"><Link href="/battle-pass">View pass <ArrowRight /></Link></Button></CardHeader>
            <CardContent><p className="text-xs text-[var(--foreground-muted)]">Free + Premium tracks, token-only unlock, claim-all, grace period. No real-money.</p></CardContent>
          </Card>



          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,.75fr)]">
            <Card>
              <CardHeader className="flex-row items-start justify-between"><div><CardTitle>Weekly focus</CardTitle><CardDescription>Minutes protected over the last seven days.</CardDescription></div><BarChart3 className="text-[var(--brand-strong)]" /></CardHeader>
              <CardContent><Suspense fallback={<Skeleton className="h-56" />}><FocusChart data={stats.chartData} /></Suspense></CardContent>
            </Card>
            <QuickTasks />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <PulseCard icon={<Clock3 />} label="Minutes focused" value={stats.totalStudyMinutesToday} detail="minutes protected today" />
            <PulseCard icon={<Target />} label="Focus score" value={stats.avgFocusScore ?? 0} detail={stats.avgFocusScore ? "average session quality" : "complete a session to score"} tone="success" />
            <PulseCard icon={<Trophy />} label="Tasks completed" value={stats.completedTasks} detail="completed today" tone="warning" />
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
