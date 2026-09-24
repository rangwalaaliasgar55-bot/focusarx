import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion, motion as m } from "framer-motion";
import { Check, ChevronDown, ClipboardList, Coins, Flame, Mic, Plus, Rocket, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { useFocusSessionState } from "@/lib/focusSessionBus";
import { useActivePet } from "@/hooks/useActivePet";
import { useAuth } from "@/lib/auth";
import { SessionRecoveryProvider } from "@/components/SessionRecoveryContext";
import Timer from "@/components/Timer";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { openVoiceCapture } from "@/lib/voiceCapture";
import { useTasks } from "@/hooks/useTasks";
import ReadinessCheckInModal from "@/components/ReadinessCheckInModal";
import MissedTaskReview, { useMissedTaskReview } from "@/components/MissedTaskReview";
import FeedbackModal, { useFeedbackTrigger } from "@/components/FeedbackModal";
import StreakNudge from "@/components/StreakNudge";
import SmartSuggestion from "@/components/SmartSuggestion";
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

/**
 * A collapsible group of panels.
 *
 * The side panel had grown to eight stacked widgets — mood, assistant, daily
 * goal, productivity score, missions and an AI camera — all rendered at full
 * weight beside the timer. Lower visual clutter is the single benefit reviewers
 * of focus timers cite most often, and a wall of secondary tools beside a
 * countdown competes directly with the one thing the page is for.
 *
 * Nothing is removed; the tools are one tap away and the summary says what is
 * inside, so the tap is informed rather than a gamble.
 */
function CollapsiblePanelGroup({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="ui-panel flex min-h-11 w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]"
      >
        <span className="min-w-0">
          <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--foreground-subtle)]">{title}</span>
          <span className="block text-xs text-[var(--foreground-muted)]">{summary}</span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--foreground-subtle)] transition-transform duration-[var(--duration-fast)] ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? <div className="flex flex-col gap-3">{children}</div> : null}
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

      {/*
        The widgets below are only mounted once opened. Besides the clutter
        argument, each one is a lazy chunk: leaving them collapsed means their
        JS is never downloaded during a session, which matters most on the
        low-end phones this app is used on.
      */}
      <CollapsiblePanelGroup title="Session tools" summary="Mood, daily goal, productivity, missions">
        <Suspense fallback={<HeavyWidgetFallback />}>
          <FocusMoodWidget />
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
      </CollapsiblePanelGroup>

      <CollapsiblePanelGroup title="Assist & camera" summary="Plan by voice, ask Arx, focus camera">
        {/* Voice planning is the fastest way into the product on a phone —
            speaking a plan is one action where typing it is six. It used to be
            genuinely absent (see components/VoiceCaptureMount.tsx). */}
        <button
          type="button"
          onClick={() => openVoiceCapture()}
          className="flex w-full items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5 text-left text-xs font-semibold text-[var(--foreground-muted)] transition-colors hover:border-[var(--brand-400)] hover:text-[var(--foreground)]"
        >
          <Mic size={14} aria-hidden="true" />
          Plan by voice
          <span className="ml-auto text-[11px] font-normal text-[var(--foreground-subtle)]">say it, get tasks · Alt+M</span>
        </button>
        <Suspense fallback={<HeavyWidgetFallback />}>
          <AskArx />
        </Suspense>
        <Suspense fallback={<HeavyWidgetFallback />}>
          <FocusCamera />
        </Suspense>
      </CollapsiblePanelGroup>
    </div>
  );
}

interface WalletSnapshot {
  coins: number;
  totalXp: number;
  level: number;
  weeklyXp: number;
}

/**
 * The wallet, with every field the header renders actually present.
 *
 * `useQuery<T>` is a *cast*, not a check: a 200 carrying anything other than a
 * wallet row — an error envelope, a proxy's `{}`, an API older than this build
 * — satisfied the type and then made `wallet.coins.toLocaleString()` throw
 * inside the timer page's render. `/focus` is the page this whole product is
 * about (and the Instagram funnel's landing), and a bad payload must degrade
 * to "no chip" rather than take the countdown down with it.
 */
function readWallet(payload: unknown): WalletSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Partial<Record<keyof WalletSnapshot, unknown>>;
  const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : NaN);
  const coins = num(raw.coins);
  const totalXp = num(raw.totalXp);
  const weeklyXp = num(raw.weeklyXp);
  // The three counters are the chip's whole content; missing any of them means
  // this is not a wallet, so render nothing instead of a row of NaNs.
  if ([coins, totalXp, weeklyXp].some(Number.isNaN)) return null;
  const level = num(raw.level);
  return {
    coins,
    totalXp,
    weeklyXp,
    // `level` is derivable from total XP, and the two must agree: the schema
    // stores a level, but a wallet written by an older build may not carry one.
    level: Number.isNaN(level) || level < 1 ? Math.floor(Math.sqrt(totalXp / 100)) + 1 : level,
  };
}

function useWalletLive() {
  const { status } = useAuth();
  const query = useQuery<unknown>({
    queryKey: ["wallet"],
    queryFn: () => apiJson("/api/gamification/wallet"),
    enabled: status === "authenticated",
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  return readWallet(query.data);
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
        <div className="grid h-5 w-5 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--brand-600)] text-[11px] font-semibold text-[var(--neutral-0)]">
          {level}
        </div>
        <div className="flex min-w-[52px] flex-col gap-0.5">
          <span className="text-[11px] font-semibold leading-none tabular-nums text-[var(--brand-strong)]">{wallet.weeklyXp.toLocaleString()} <span className="text-[var(--foreground-subtle)]">wk XP</span></span>
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <motion.div
              className="h-full rounded-full bg-[var(--brand-600)]"
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ duration: 0.25, ease: "easeOut" }}
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
 * The arena's pet also used to be hard-coded to level 1 regardless of the
 * companion the user actually raised; it reads the active pet like the
 * companion widget does.
 */
function SessionCompanions() {
  const live = useFocusSessionState();
  const durationSec = live.totalSeconds;
  const { data: activePet } = useActivePet();
  return (
    <div className="mt-6 w-full max-w-2xl space-y-4">
      <Suspense fallback={<HeavyWidgetFallback />}>
        <MonsterBattleArena
          isActive={live.active}
          sessionDuration={durationSec}
          sessionProgress={live.active ? live.progress : 0}
          petLevel={activePet?.level ?? 1}
        />
      </Suspense>
      {/* YouTubeFocusTimer removed: it shipped placeholder video ids (including
          dead/terminated streams) and rendered a stray "Play @AJourneyR Videos"
          pill on the timer page. AmbientSoundBar covers focus audio now. */}
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
      {/* Floating trigger — mobile only, sits above the bottom tab bar. The
          right corner belongs to the coach + quick-launch orb column (see
          index.css), so this pill docks on the left, where the FloatingTimer
          would be — but that one hides on this exact route, so the two can
          never collide. */}
      <button
        aria-label="Open tasks & stats"
        onClick={() => setOpen(true)}
        className="fixed bottom-[76px] left-4 z-[var(--z-nav)] flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-overlay)] px-4 py-2.5 text-xs font-semibold text-[var(--brand-strong)] shadow-[var(--shadow-lg)] transition-colors active:bg-[var(--surface-hover)] md:bottom-5 lg:hidden"
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
              className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[85dvh] flex-col rounded-t-[var(--radius-2xl)] border-t border-[var(--border-subtle)] bg-[var(--surface-overlay)] shadow-[var(--shadow-lg)] lg:hidden"
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
          <span className="flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--warning)_24%,transparent)] bg-[var(--warning-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--warning)]">
            <Flame size={11} aria-hidden="true" /> {focusSessionsToday} {focusSessionsToday === 1 ? "session" : "sessions"} today
          </span>
        )}
      </div>
      <CoinXPBar focusSessionsToday={focusSessionsToday} />
    </div>
  );
}

/**
 * First run, for someone who has never used a focus timer.
 *
 * Every shared link, every Instagram bio and every `/go` redirect lands on this
 * screen, and until now the first thing a visitor read was "Good morning,
 * there" followed by a ring, six face options and a dozen chips. That is a lot
 * of interface in front of a student whose real question is "what do I do".
 *
 * So: three sentences, one per step, dismissible, and remembered — `localStorage`
 * so it never comes back once it has been read, and only shown to people with no
 * sign-in and no finished session, because the advice is only useful once.
 */
function FirstRunHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className="mx-4 mt-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3 sm:mx-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-400)]" aria-hidden="true">
          <Rocket size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">First time here? It takes three steps.</p>
          <ol className="mt-1.5 space-y-1 text-xs leading-relaxed text-[var(--foreground-muted)]">
            <li><span className="font-semibold text-[var(--foreground)]">1.</span> Pick a length — 25 minutes is the usual starting point.</li>
            <li><span className="font-semibold text-[var(--foreground)]">2.</span> Press start, then put the phone face-down. That is the whole trick.</li>
            <li><span className="font-semibold text-[var(--foreground)]">3.</span> When the block ends, you will see exactly what it earned. No account needed to try it — signing up later keeps the history.</li>
          </ol>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss the getting-started hint"
          className="shrink-0 rounded-lg p-1.5 text-[var(--foreground-subtle)] transition-colors hover:text-[var(--foreground)]"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

const FIRST_RUN_KEY = "focusarx:first-run-dismissed";

export default function FocusHomePage() {
  const feedback = useFeedbackTrigger();
  const isMobile = useIsMobile();
  const { trackSessionCompleted } = useNotificationPermission();
  const { status } = useAuth();
  const { focusSessionsToday } = useSessionHistory();
  const [showFirstRun, setShowFirstRun] = useState(() => {
    try {
      return localStorage.getItem(FIRST_RUN_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const dismissFirstRun = useCallback(() => {
    setShowFirstRun(false);
    try {
      localStorage.setItem(FIRST_RUN_KEY, "1");
    } catch {
      /* private mode: it will simply show again next visit */
    }
  }, []);

  // Signed-in students with sessions already know all of this, and saying it
  // again is the fastest way to make a product feel like it is talking to a
  // beginner. The hint is only ever for a genuine first run.
  const firstRunVisible = showFirstRun && status === "unauthenticated" && focusSessionsToday === 0;

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
        {/* The screen a shared link and an Instagram bio both land on had no
            heading of any kind — the first thing a visitor saw was a greeting
            ("Good morning, there") and a ring. Screen readers announced a page
            with no title, and the funnel's one indexable element was missing.
            Visually hidden on purpose: this page is the timer, and a headline
            above it would push the ring below the fold on a phone. The
            prerendered document keeps its own visible H1 for crawlers. */}
        <h1 className="sr-only">
          FocusArx focus timer — start a session free, no account needed
        </h1>
        <SceneBackdrop />
        <FocusChamberHeader />
        <AnimatePresence>{firstRunVisible ? <FirstRunHint onDismiss={dismissFirstRun} /> : null}</AnimatePresence>
        <StreakNudge />
        <SmartSuggestion />
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

