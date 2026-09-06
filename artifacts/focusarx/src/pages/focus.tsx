import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion, motion as m } from "framer-motion";
import { Check, ChevronDown, ClipboardList, Coins, Flame, Plus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { useFocusSessionState } from "@/lib/focusSessionBus";
import { useAuth } from "@/lib/auth";
import { SessionRecoveryProvider } from "@/components/SessionRecoveryContext";
import Timer from "@/components/Timer";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useTasks } from "@/hooks/useTasks";
import ReadinessCheckInModal from "@/components/ReadinessCheckInModal";
import MissedTaskReview, { useMissedTaskReview } from "@/components/MissedTaskReview";
import FeedbackModal, { useFeedbackTrigger } from "@/components/FeedbackModal";
import StreakNudge from "@/components/StreakNudge";
import SmartSuggestion from "@/components/SmartSuggestion";
import { DropBanner } from "@/components/DropBanner";
import { useIsMobile } from "@/hooks/useIsMobile";
import { FocusTimerMobileFirst } from "@/components/mobile/FocusTimerMobileFirst";
import { NotificationPermissionPrompt } from "@/components/mobile/NotificationPermissionPrompt";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { parseFocusDeepLink, dispatchFocusDeepLink } from "@/lib/focusDeepLink";
import SceneBackdrop from "@/components/SceneBackdrop";

// Heavy features lazy-loaded after main interface is usable
const MissionsWidget = lazy(() => import("@/components/MissionsWidget"));
const ProductivityScoreWidget = lazy(() => import("@/components/ProductivityScoreWidget"));
const FocusCamera = lazy(() => import("@/components/camera/FocusCamera").then(m => ({ default: m.FocusCamera })));
const DailyGoal = lazy(() => import("@/components/DailyGoal"));
const FocusMoodWidget = lazy(() => import("@/components/FocusMoodWidget").then(m => ({ default: m.FocusMoodWidget })));
const AskArx = lazy(() => import("@/components/AskArx"));
const MonsterBattleArena = lazy(() => import("@/components/MonsterBattleArena"));
const YouTubeFocusTimer = lazy(() => import("@/components/YouTubeFocusTimer"));

function HeavyWidgetFallback() {
  return <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-1)]/50" />;
}

/** Matches the real task row height so the list does not jump when data lands. */
function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-2 py-1" aria-hidden="true">
      <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-full" />
      <Skeleton className="h-2.5 flex-1" />
    </div>
  );
}

function StatRow({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "success" | "brand" }) {
  const color = tone === "success" ? "text-[var(--success)]" : tone === "brand" ? "text-[var(--brand-strong)]" : "text-[var(--foreground)]";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-[var(--foreground-muted)]">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function PanelSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ui-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function SidePanel() {
  const { focusSessionsToday } = useSessionHistory();
  const { tasks, activeTasks, completedTasks, toggleDone, addTask, isLoading, isError, refreshTasks } = useTasks();
  const [newTask, setNewTask] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const { showReview, missedTasks, dismiss } = useMissedTaskReview();
  const DAILY_TARGET = 8;
  const blockPct = Math.min(100, (focusSessionsToday / DAILY_TARGET) * 100);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) { addTask(newTask.trim()); setNewTask(""); }
  };

  return (
    <div className="flex w-full shrink-0 flex-col gap-3">
      {/* Missed Task Review modal — fires once per day if there are unreviewed tasks */}
      <MissedTaskReview open={showReview} tasks={missedTasks} onDone={dismiss} />

      <PanelSection title="Today">
        <div className="space-y-2.5">
          <StatRow label="Focus blocks" value={`${focusSessionsToday} / ${DAILY_TARGET}`} />
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]"
            role="progressbar"
            aria-valuenow={focusSessionsToday}
            aria-valuemin={0}
            aria-valuemax={DAILY_TARGET}
            aria-label="Focus blocks completed today"
          >
            <div className="h-full rounded-full bg-[var(--brand-500)] transition-[width] duration-[var(--duration-slow)]" style={{ width: `${blockPct}%` }} />
          </div>
          {focusSessionsToday === 0 && (
            <p className="text-[0.6875rem] text-[var(--foreground-subtle)]">Eight blocks is a full day of deep work. Start with one.</p>
          )}
          <StatRow
            label="Tasks done"
            tone="success"
            value={isLoading ? <Skeleton className="h-3 w-9" /> : isError ? <span className="font-normal text-[var(--foreground-subtle)]">unavailable</span> : tasks.length === 0 ? <span className="font-normal text-[var(--foreground-subtle)]">none yet</span> : `${completedTasks.length}/${tasks.length}`}
          />
          <StatRow label="Active tasks" tone="brand" value={isLoading ? <Skeleton className="h-3 w-5" /> : activeTasks.length} />
        </div>
      </PanelSection>

      <PanelSection title="Active tasks">
        <div className="max-h-40 space-y-0.5 overflow-y-auto">
          {isError ? (
            <ErrorState
              compact
              title="Tasks didn't load"
              message="Your timer still works — this only affects the task list."
              onRetry={() => { void refreshTasks(); }}
            />
          ) : isLoading ? (
            <div role="status" aria-label="Loading tasks">
              <span className="sr-only">Loading tasks…</span>
              {Array.from({ length: 3 }).map((_, i) => <TaskRowSkeleton key={i} />)}
            </div>
          ) : (
            <>
              {activeTasks.length === 0 && (
                <p className="py-1 text-xs text-[var(--foreground-subtle)]">Add a task to give this block a target.</p>
              )}
              {activeTasks.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleDone(t.id)}
                  aria-label={`Mark "${t.title}" done`}
                  className="group flex min-h-9 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-1.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 border-[var(--border-strong)] transition-colors group-hover:border-[var(--brand-500)]" aria-hidden="true" />
                  <span className="truncate text-xs leading-snug text-[var(--foreground-muted)] group-hover:text-[var(--foreground)]">{t.title}</span>
                </button>
              ))}
              {activeTasks.length > 6 && (
                <p className="pl-7 text-[0.6875rem] text-[var(--foreground-subtle)]">+{activeTasks.length - 6} more</p>
              )}
            </>
          )}
        </div>

        {/* Completed Tasks — collapsible section */}
        {completedTasks.length > 0 && (
          <div className="mt-3 border-t border-[var(--border-subtle)] pt-2">
            <button
              type="button"
              onClick={() => setShowCompleted(v => !v)}
              aria-expanded={showCompleted}
              className="flex min-h-8 w-full items-center gap-1.5 text-left"
            >
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)] transition-colors hover:text-[var(--foreground-muted)]">
                Completed ({completedTasks.length})
              </span>
              <ChevronDown size={12} className={`ml-auto text-[var(--foreground-subtle)] transition-transform duration-[var(--duration-fast)] ${showCompleted ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {showCompleted && (
              <div className="mt-1 max-h-28 space-y-0.5 overflow-y-auto">
                {completedTasks.slice(0, 5).map((t) => (
                  <button key={t.id} type="button" onClick={() => toggleDone(t.id)} aria-label={`Reopen "${t.title}"`} className="group flex min-h-8 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-1.5 text-left hover:bg-[var(--surface-hover)]">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--success)] text-[var(--neutral-0)]" aria-hidden="true">
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <span className="truncate text-xs leading-snug text-[var(--foreground-subtle)] line-through">{t.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleAddTask} className="mt-3 flex gap-1.5">
          <label htmlFor="focus-quick-task" className="sr-only">Add a task</label>
          <input
            id="focus-quick-task"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task…"
            className="min-h-9 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 text-xs text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--foreground-subtle)] focus-visible:border-[var(--brand-500)] focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
          />
          <button
            type="submit"
            disabled={!newTask.trim()}
            aria-label="Add task"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-600)] text-[var(--neutral-0)] transition-colors hover:bg-[var(--brand-700)] disabled:opacity-40"
          >
            <Plus size={14} />
          </button>
        </form>
      </PanelSection>

      <Suspense fallback={<HeavyWidgetFallback />}>
        <FocusMoodWidget />
      </Suspense>
      <Suspense fallback={<HeavyWidgetFallback />}>
        <AskArx />
      </Suspense>
      <Suspense fallback={<HeavyWidgetFallback />}>
        <DailyGoal />
      </Suspense>
      <Suspense fallback={<HeavyWidgetFallback />}>
        <ProductivityScoreWidget />
      </Suspense>
      <Suspense fallback={<HeavyWidgetFallback />}>
        <MissionsWidget />
      </Suspense>

      <PanelSection title="AI camera">
        <Suspense fallback={<HeavyWidgetFallback />}>
          <FocusCamera />
        </Suspense>
      </PanelSection>
    </div>
  );
}

function useWalletLive() {
  const { status } = useAuth();
  const query = useQuery<{ coins: number; totalXp: number; level: number; weeklyXp: number }>({
    queryKey: ["wallet"],
    queryFn: () => apiJson("/api/gamification/wallet"),
    enabled: status === "authenticated",
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  return query.data ?? null;
}

function CoinXPBar({ focusSessionsToday }: { focusSessionsToday: number }) {
  const wallet = useWalletLive();
  if (!wallet) return null;

  const level = wallet.level;
  const xpStart = (level - 1) ** 2 * 100;
  const xpEnd = level ** 2 * 100;
  const progress = Math.min(1, (wallet.totalXp - xpStart) / Math.max(1, xpEnd - xpStart));

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 sm:gap-3"
    >
      {focusSessionsToday > 0 && (
        <span className="hidden items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--warning)_24%,transparent)] bg-[var(--warning-soft)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--warning)] sm:flex">
          <Flame size={12} aria-hidden="true" /> {focusSessionsToday}
        </span>
      )}
      <div className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--brand-gold)_24%,transparent)] bg-[var(--brand-gold-dim)] px-2.5 py-1.5" aria-label={`${wallet.coins} coins`}>
        <Coins size={14} className="text-[var(--brand-gold)]" aria-hidden="true" />
        <span className="text-xs font-bold tabular-nums text-[var(--brand-gold)]">{wallet.coins.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--card-border)] bg-[var(--brand-soft)] px-2.5 py-1.5" aria-label={`Level ${level}, ${wallet.weeklyXp} XP this week`}>
        <div className="grid h-5 w-5 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--brand-600)] text-[0.625rem] font-semibold text-[var(--neutral-0)]">
          {level}
        </div>
        <div className="flex min-w-[52px] flex-col gap-0.5">
          <span className="text-[0.625rem] font-semibold leading-none tabular-nums text-[var(--brand-strong)]">{wallet.weeklyXp.toLocaleString()} <span className="text-[var(--foreground-subtle)]">wk XP</span></span>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)]"
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const MOTIVATIONAL = [
  "Your future self is counting on this session.",
  "One block at a time. That's how legends are built.",
  "The leaderboard is watching. 👀",
  "Distraction is the enemy. You are the weapon.",
  "Every expert was once a beginner who didn't quit.",
  "This session counts. Make it matter.",
];

/**
 * Picked once per mount and frozen: picking during render would reshuffle the
 * text every time the timer ticks, which reads as a glitch rather than a nudge.
 */
function MotivationalLine() {
  const [line] = useState(() => MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]);
  return <p className="mt-1 text-center text-xs text-[var(--foreground-subtle)]">{line}</p>;
}

/**
 * Battle arena + YouTube companion. Both used to be mounted with
 * `isActive={false}` and `sessionProgress={0}` frozen in, so the arena never
 * appeared and the video never played — they now follow the live session bus.
 */
function SessionCompanions() {
  const live = useFocusSessionState();
  const durationSec = live.totalSeconds;
  return (
    <div className="mt-6 w-full max-w-2xl space-y-4">
      <Suspense fallback={<HeavyWidgetFallback />}>
        <MonsterBattleArena
          isActive={live.active}
          sessionDuration={durationSec}
          sessionProgress={live.active ? live.progress : 0}
          petLevel={1}
        />
      </Suspense>
      <Suspense fallback={<HeavyWidgetFallback />}>
        <YouTubeFocusTimer isActive={live.active} sessionDuration={durationSec} />
      </Suspense>
    </div>
  );
}

function MobileSidePanelDrawer() {
  const [open, setOpen] = useState(false);
  const dragStartY = useRef<number | null>(null);

  // Background must not scroll behind the sheet (iOS ignores overflow:hidden on body).
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Swipe down to close
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0]?.clientY ?? 0;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const startY = dragStartY.current;
    if (startY === null) return;
    const diff = (e.touches[0]?.clientY ?? 0) - startY;
    if (diff > 0) {
      const sheet = document.getElementById("mobile-panel-sheet");
      if (sheet) sheet.style.transform = `translateY(${diff}px)`;
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = (e.changedTouches[0]?.clientY ?? 0) - (dragStartY.current ?? 0);
    const sheet = document.getElementById("mobile-panel-sheet");
    if (sheet) sheet.style.transform = "";
    dragStartY.current = null;
    if (diff > 100) setOpen(false);
  };

  return (
    <>
      {/* Floating trigger — mobile only, sits above the bottom tab bar */}
      <button
        aria-label="Open tasks & stats"
        onClick={() => setOpen(true)}
        className="fixed bottom-[76px] right-4 z-[var(--z-nav)] flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-overlay)] px-4 py-2.5 text-xs font-semibold text-[var(--brand-strong)] shadow-[var(--shadow-lg)] backdrop-blur-xl transition-colors active:bg-[var(--surface-hover)] md:bottom-5 lg:hidden"
      >
        <ClipboardList size={14} />
        Tasks & Stats
      </button>

      {/* Bottom sheet overlay */}
      <AnimatePresence>
        {open && (
          <>
            <m.div
              key="mobile-panel-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[var(--z-modal)] bg-[var(--scrim)] lg:hidden"
              onClick={() => setOpen(false)}
            />
            <m.div
              id="mobile-panel-sheet"
              key="mobile-panel-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[85dvh] flex-col rounded-t-[var(--radius-2xl)] border-t border-[var(--border-subtle)] bg-[var(--surface-overlay)] shadow-[var(--shadow-xl)] backdrop-blur-2xl lg:hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-panel-title"
            >
              <div className="modal-handle" aria-hidden="true" />
              <div className="flex items-center justify-between px-5 py-3">
                <span id="mobile-panel-title" className="text-sm font-semibold text-[var(--foreground)]">Tasks & Stats</span>
                <button onClick={() => setOpen(false)} className="min-h-[44px] min-w-[44px] grid place-items-center text-[var(--foreground-subtle)] active:text-[var(--foreground-muted)]" aria-label="Close tasks and stats">
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
                <SidePanel />
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function FocusChamberHeader() {
  const { data: session } = useAuth();
  const { focusSessionsToday } = useSessionHistory();
  const user = session?.user;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden text-[0.8125rem] font-semibold text-[var(--foreground)] sm:block">{greeting}, <span className="text-[var(--brand-strong)]">{firstName}</span></span>
        {focusSessionsToday > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--warning)_24%,transparent)] bg-[var(--warning-soft)] px-2 py-0.5 text-[0.625rem] font-bold text-[var(--warning)]">
            <Flame size={11} aria-hidden="true" /> {focusSessionsToday} {focusSessionsToday === 1 ? "session" : "sessions"} today
          </span>
        )}
      </div>
      <CoinXPBar focusSessionsToday={focusSessionsToday} />
    </div>
  );
}

export default function FocusHomePage() {
  const feedback = useFeedbackTrigger();
  const isMobile = useIsMobile();
  const { trackSessionCompleted } = useNotificationPermission();

  const handleSessionComplete = () => {
    trackSessionCompleted();
    feedback.recordSession();
  };

  // Deep-link entry (?duration=&task= from /go/ig and shared links).
  // Dispatched once on mount; child timers subscribe in their own effects
  // (which run before this parent effect) and apply it only when idle.
  useEffect(() => {
    try {
      const link = parseFocusDeepLink(window.location.search);
      if (link.armed) dispatchFocusDeepLink(link);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <SessionRecoveryProvider>
      <div className="flex flex-col min-h-[100dvh] focus-chamber relative">
        <SceneBackdrop />
        <FocusChamberHeader />
        <StreakNudge />
        <SmartSuggestion />
        <div className="w-full px-4 sm:px-6 pt-3 pb-1">
          <DropBanner />
        </div>
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-auto">
          {/* Timer area - mobile-first */}
          <div className="flex-1 flex flex-col items-center justify-start gap-3 px-4 sm:px-6 py-6 lg:py-8">
            <div className="w-full flex flex-col items-center">
              {isMobile ? (
                <FocusTimerMobileFirst onSessionComplete={handleSessionComplete} />
              ) : (
                <Timer onSessionComplete={handleSessionComplete} />
              )}
              <MotivationalLine />
              <SessionCompanions />
            </div>
          </div>
          {/* Desktop side panel */}
          <aside className="hidden shrink-0 border-l border-[var(--border-subtle)] p-4 lg:flex lg:w-[300px] lg:flex-col xl:w-[320px]" aria-label="Session tasks and stats">
            <SidePanel />
          </aside>
        </div>
        <MobileSidePanelDrawer />
        <ReadinessCheckInModal />
        <FeedbackModal open={feedback.show} onClose={feedback.dismiss} onSubmit={feedback.onSubmit} />
        <NotificationPermissionPrompt />
      </div>
    </SessionRecoveryProvider>
  );
}

