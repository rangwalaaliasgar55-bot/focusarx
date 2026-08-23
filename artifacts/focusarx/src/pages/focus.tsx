import { useEffect, useState } from "react";
import { AnimatePresence, motion, motion as m } from "framer-motion";
import { ClipboardList, X } from "lucide-react";
import MissionsWidget from "@/components/MissionsWidget";
import ProductivityScoreWidget from "@/components/ProductivityScoreWidget";
import { useAuth } from "@/lib/auth";
import { SessionRecoveryProvider } from "@/components/SessionRecoveryContext";
import Timer from "@/components/Timer";
import { FocusCamera } from "@/components/camera/FocusCamera";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useTasks } from "@/hooks/useTasks";
import ReadinessCheckInModal from "@/components/ReadinessCheckInModal";
import DailyGoal from "@/components/DailyGoal";
import MissedTaskReview, { useMissedTaskReview } from "@/components/MissedTaskReview";
import FeedbackModal, { useFeedbackTrigger } from "@/components/FeedbackModal";
import { FocusMoodWidget } from "@/components/FocusMoodWidget";
import StreakNudge from "@/components/StreakNudge";
import SmartSuggestion from "@/components/SmartSuggestion";

function SidePanel() {
  const { focusSessionsToday } = useSessionHistory();
  const { tasks, activeTasks, completedTasks, toggleDone, addTask } = useTasks();
  const [newTask, setNewTask] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const { showReview, missedTasks, dismiss } = useMissedTaskReview();

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) { addTask(newTask.trim()); setNewTask(""); }
  };

  return (
    <div className="flex flex-col gap-3 w-full lg:w-52 xl:w-56 shrink-0">
      {/* Missed Task Review modal — fires once per day if there are unreviewed tasks */}
      <MissedTaskReview open={showReview} tasks={missedTasks} onDone={dismiss} />

      <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--palette-4a4f62)] mb-3">Today's Stats</p>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--palette-5a5f72)]">Focus blocks</span>
            <span className="text-xs font-bold text-[var(--palette-e8eaf0)] font-mono">{focusSessionsToday}</span>
          </div>
          <div className="h-[3px] bg-[var(--rgba-255-255-255-0_06)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--palette-6c63ff)] rounded-full transition-all duration-[var(--duration-slow)]" style={{ width: `${Math.min(100, (focusSessionsToday / 8) * 100)}%` }} />
          </div>
          {focusSessionsToday === 0 && (
            <p className="text-[10px] text-[var(--palette-3a3d4a)] italic">You could hit 8 blocks today! 🚀</p>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--palette-5a5f72)]">Tasks done</span>
            {tasks.length === 0
              ? <span className="text-[10px] text-[var(--palette-3a3d4a)] italic">Add a task below ↓</span>
              : <span className="text-xs font-bold text-[var(--palette-22d387)] font-mono">{completedTasks.length}/{tasks.length}</span>
            }
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--palette-5a5f72)]">Active tasks</span>
            <span className="text-xs font-bold text-[var(--palette-a5a8ff)] font-mono">{activeTasks.length}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-4">
        {/* Active Tasks */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--palette-4a4f62)] mb-2">Active Tasks</p>
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {activeTasks.length === 0 && (
            <p className="text-[11px] text-[var(--palette-3a3d4a)] py-1 italic">✨ Add tasks to unlock your AI Timeline</p>
          )}
          {activeTasks.slice(0, 6).map((t) => (
            <button key={t.id} type="button" onClick={() => toggleDone(t.id)} className="flex items-center gap-2 w-full text-left py-1 group">
              <span className="w-3.5 h-3.5 rounded-full border border-[var(--palette-2a2d3a)] shrink-0 flex items-center justify-center transition-all group-hover:border-[var(--palette-6c63ff)]" />
              <span className="text-xs leading-snug text-[var(--palette-6b7080)] group-hover:text-[var(--palette-9095a8)]">{t.title}</span>
            </button>
          ))}
          {activeTasks.length > 6 && (
            <p className="text-[10px] text-[var(--palette-3a3d4a)] pl-5">+{activeTasks.length - 6} more</p>
          )}
        </div>

        {/* Completed Tasks — collapsible section */}
        {completedTasks.length > 0 && (
          <div className="mt-3 border-t border-[var(--palette-1a1d27)] pt-2">
            <button
              type="button"
              onClick={() => setShowCompleted(v => !v)}
              className="flex items-center gap-1.5 w-full text-left group"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--palette-3a3d4a)] group-hover:text-[var(--palette-5a5f72)] transition-colors">
                Completed ({completedTasks.length})
              </span>
              <span className={`ml-auto text-[10px] text-[var(--palette-3a3d4a)] transition-transform duration-[var(--duration-fast)] ${showCompleted ? "rotate-180" : ""}`}>▾</span>
            </button>
            {showCompleted && (
              <div className="space-y-1 mt-1.5 max-h-28 overflow-y-auto">
                {completedTasks.slice(0, 5).map((t) => (
                  <button key={t.id} type="button" onClick={() => toggleDone(t.id)} className="flex items-center gap-2 w-full text-left py-0.5 group">
                    <span className="w-3.5 h-3.5 rounded-full border bg-[var(--palette-22d387)] border-[var(--palette-22d387)] shrink-0 flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="var(--palette-white)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                    <span className="text-xs leading-snug line-through text-[var(--palette-3a3d4a)] group-hover:text-[var(--palette-4a4f62)]">{t.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleAddTask} className="mt-3 flex gap-1.5">
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add task…" className="flex-1 min-w-0 rounded-lg border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_03)] px-2.5 py-1.5 text-xs text-[var(--foreground)] placeholder-[var(--foreground-subtle)] outline-none focus:border-[var(--palette-6c63ff)] transition-colors" />
          <button type="submit" className="rounded-lg border border-[var(--palette-6c63ff)]/50 bg-[var(--palette-6c63ff)]/10 px-2.5 py-1.5 text-xs font-semibold text-[var(--palette-a5a8ff)] hover:bg-[var(--palette-6c63ff)]/20 transition-colors">+</button>
        </form>
      </div>

      <FocusMoodWidget />
      <DailyGoal />
      <ProductivityScoreWidget />
      <MissionsWidget />

      <div className="rounded-2xl border border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_025)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--palette-4a4f62)] mb-3">AI Camera</p>
        <FocusCamera />
      </div>
    </div>
  );
}

function useWalletLive() {
  const { status } = useAuth();
  const [wallet, setWallet] = useState<{ coins: number; totalXp: number; level: number; weeklyXp: number } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    const token = localStorage.getItem("focusarx-auth-token");
    if (!token) return;

    const fetch_ = () => {
      fetch("/api/gamification/wallet", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setWallet(d); })
        .catch(() => {});
    };

    fetch_();
    const id = setInterval(fetch_, 30000);
    return () => clearInterval(id);
  }, [status]);

  return wallet;
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
        <span className="hidden sm:flex items-center gap-1 rounded-full border border-[var(--palette-orange-500)]/20 bg-[var(--palette-orange-500)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--palette-orange-400)]">
          🔥 {focusSessionsToday}
        </span>
      )}
      <div className="flex items-center gap-1.5 rounded-xl border border-[var(--rgba-255-184-0-0_2)] bg-[var(--rgba-255-184-0-0_07)] px-2.5 py-1.5">
        <span className="text-sm">🪙</span>
        <span className="text-[12px] font-bold text-[var(--palette-amber-400)] tabular-nums">{wallet.coins.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_07)] px-2.5 py-1.5">
        <div className="flex items-center justify-center h-5 w-5 rounded-lg bg-gradient-to-br from-[var(--brand-600)] to-[var(--palette-4f46e5)] text-[10px] font-black text-[var(--palette-white)] shrink-0">
          {level}
        </div>
        <div className="flex flex-col gap-0.5 min-w-[52px]">
          <span className="text-[10px] font-semibold text-[var(--brand-400)] tabular-nums leading-none">{wallet.weeklyXp.toLocaleString()} <span className="text-[var(--foreground-subtle)]">wk XP</span></span>
          <div className="h-1 w-full rounded-full bg-[var(--rgba-124-58-237-0_15)] overflow-hidden">
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

function HomeTopBar() {
  const { data: session } = useAuth();
  const { focusSessionsToday } = useSessionHistory();
  const user = session?.user;
  const initials = (user?.name?.slice(0, 1) || user?.email?.slice(0, 1) || "?").toUpperCase();
  return (
    <div className="hidden md:flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--palette-1a1d24)] shrink-0 bg-[var(--palette-080b14)]/80 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <p className="text-[9px] font-mono text-[var(--palette-4a4f62)] uppercase tracking-[0.18em] leading-none">Deep Work</p>
          <p className="text-base font-bold text-[var(--palette-e8eaf0)] tracking-tight leading-tight">FocusArx</p>
        </div>
        {focusSessionsToday > 0 && (
          <span className="sm:hidden flex items-center gap-1 rounded-full border border-[var(--palette-orange-500)]/20 bg-[var(--palette-orange-500)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--palette-orange-400)]">
            🔥 {focusSessionsToday}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <CoinXPBar focusSessionsToday={focusSessionsToday} />
        {user && !user.isGuest && (
          <a href="/profile" className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--palette-6c63ff)] to-[var(--brand-400)] flex items-center justify-center text-[11px] font-bold text-[var(--palette-white)] hover:scale-105 transition-transform shrink-0">
            {initials}
          </a>
        )}
      </div>
    </div>
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

function MotivationalLine() {
  const line = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];
  return <p className="text-[11px] italic text-[var(--palette-3a3d4a)] text-center mt-1">{line}</p>;
}

function MobileSidePanelDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [open]);

  return (
    <>
      {/* Floating trigger — mobile only, sits above the bottom tab bar */}
      <button
        aria-label="Open tasks & stats"
        onClick={() => setOpen(true)}
        className="fixed bottom-[76px] md:bottom-5 right-4 z-[var(--z-nav)] flex min-h-11 items-center gap-2 rounded-full border border-[var(--rgba-255-255-255-0_1)] bg-[var(--rgba-15-17-30-0_9)] px-4 py-2.5 text-xs font-semibold text-[var(--palette-a5a8ff)] shadow-lg shadow-[var(--palette-black)]/40 backdrop-blur-xl transition-colors active:bg-[var(--rgba-255-255-255-0_08)] lg:hidden"
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
              className="fixed inset-0 z-[var(--z-modal)] bg-[var(--palette-black)]/70 lg:hidden"
              onClick={() => setOpen(false)}
            />
            <m.div
              key="mobile-panel-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[var(--z-modal)] max-h-[85dvh] rounded-t-2xl border-t border-[var(--rgba-255-255-255-0_08)] bg-[var(--palette-0d0f1a)] backdrop-blur-2xl lg:hidden"
            >
              <div className="mx-auto mt-3 h-1.5 w-16 rounded-full bg-[var(--rgba-255-255-255-0_1)]" />
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm font-semibold text-[var(--foreground)]">Tasks & Stats</span>
                <button onClick={() => setOpen(false)} className="text-[var(--foreground-subtle)] active:text-[var(--foreground-muted)]">
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto px-4 pb-8">
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
    <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--rgba-255-255-255-0_04)] shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-semibold text-[var(--foreground)] hidden sm:block">{greeting}, <span className="text-[var(--brand-400)]">{firstName}</span></span>
        {focusSessionsToday > 0 && (
          <span className="flex items-center gap-1 rounded-full border border-[var(--palette-orange-500)]/20 bg-[var(--palette-orange-500)]/08 px-2 py-0.5 text-[10px] font-bold text-[var(--palette-orange-400)]">
            🔥 {focusSessionsToday} {focusSessionsToday === 1 ? "session" : "sessions"} today
          </span>
        )}
      </div>
      <CoinXPBar focusSessionsToday={focusSessionsToday} />
    </div>
  );
}

export default function FocusHomePage() {
  const feedback = useFeedbackTrigger();
  return (
    <SessionRecoveryProvider>
      <div className="flex flex-col min-h-[100dvh] focus-chamber">
        <FocusChamberHeader />
        <StreakNudge />
        <SmartSuggestion />
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-auto">
          {/* Timer area */}
          <div className="flex-1 flex flex-col items-center justify-start gap-3 px-4 sm:px-6 py-6 lg:py-8">
            <div className="w-full flex flex-col items-center">
              <Timer onSessionComplete={feedback.recordSession} />
              <MotivationalLine />
            </div>
          </div>
          {/* Desktop side panel */}
          <div className="hidden lg:flex lg:flex-col lg:w-[300px] xl:w-[320px] shrink-0 border-l border-[var(--rgba-255-255-255-0_04)]">
            <SidePanel />
          </div>
        </div>
        <MobileSidePanelDrawer />
        <ReadinessCheckInModal />
        <FeedbackModal open={feedback.show} onClose={feedback.dismiss} onSubmit={feedback.onSubmit} />
      </div>
    </SessionRecoveryProvider>
  );
}

