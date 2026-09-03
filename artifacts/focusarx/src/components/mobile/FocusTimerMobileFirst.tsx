
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pause, Play, RotateCcw, Volume2, VolumeX, CheckCircle, AlertTriangle } from "lucide-react";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useSessionPersistence } from "@/hooks/useSessionPersistence";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useTasks } from "@/hooks/useTasks";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useToast } from "@/components/Toast";
import { syncFocusSessionToCloud } from "@/lib/sync-focus-session";
import { haptic } from "@/lib/haptics";
import { getToken } from "@/lib/auth";
import { MobileFocusMode } from "./MobileFocusMode";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { trackSessionStart, trackSessionComplete } from "@/lib/analytics";
import { playCoachVoice } from "@/lib/soundEngine";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return { m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0"), total: totalSeconds };
}

export function FocusTimerMobileFirst({ onSessionComplete }: { onSessionComplete?: () => void } = {}) {
  const { addSession } = useSessionHistory();
  const { activeTasks, completedTasks } = useTasks();
  const { toast } = useToast();
  const { isOffline, status: netStatus } = useNetworkStatus();
  const { enqueue: enqueueOffline, queueCount } = useOfflineQueue();

  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showMobileFocus, setShowMobileFocus] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [totalPlanned, setTotalPlanned] = useState(25 * 60);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<{ minutes: number; xp: number; coins: number } | null>(null);

  const currentTask = useMemo(() => activeTasks[0]?.title || "", [activeTasks]);

  const {
    mode,
    status,
    secondsLeft,
    progress,
    completedFocusSessions,
    toggle,
    reset,
    setCustomDuration,
    getSnapshot,
    restoreFromSnapshot,
    getActiveSeconds,
  } = usePomodoro({
    onSessionComplete: async (session) => {
      addSession(session);
      if (session.mode === "focus") {
        trackSessionComplete(session.durationSeconds, session.focusScore ?? 0, 0, false);
      }
      // Haptic + sound
      haptic("celebrate");
      if (soundEnabled) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        } catch {}
      }

      setIsSaving(true);
      const dbSessionId = persistenceRef.current?.getDbSessionId() ?? null;

      // Offline handling with idempotency key
      if (!navigator.onLine) {
        const idempotencyKey = `completion_${session.id}`;
        enqueueOffline(
          {
            mode: session.mode,
            durationSec: session.durationSeconds,
            completedAt: session.completedAt,
            clientNonce: session.id,
            sessionId: dbSessionId,
            focusScore: session.focusScore,
            idempotencyKey,
          },
          idempotencyKey
        );
        setIsSaving(false);
        await persistenceRef.current?.onPhaseCompleted();
        toast("Offline — saved locally, will sync when reconnected", "info");
        setSummary({ minutes: Math.round(session.durationSeconds / 60), xp: 0, coins: 0 });
        setShowSummary(true);
        onSessionComplete?.();
        return;
      }

      const res = await syncFocusSessionToCloud(session, dbSessionId);
      setIsSaving(false);
      await persistenceRef.current?.onPhaseCompleted();

      if (res.offline) {
        const idempotencyKey = `completion_${session.id}`;
        enqueueOffline(
          {
            mode: session.mode,
            durationSec: session.durationSeconds,
            completedAt: session.completedAt,
            clientNonce: session.id,
            sessionId: dbSessionId,
            idempotencyKey,
          },
          idempotencyKey
        );
        toast("Saved offline, will sync", "info");
      } else if (!res.success) {
        toast(`Failed to save: ${res.error}`, "error");
      } else {
        setSummary({ minutes: Math.round(session.durationSeconds / 60), xp: res.earnedXp ?? 0, coins: res.earnedCoins ?? 0 });
        setShowSummary(true);
        onSessionComplete?.();
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Focus session complete — time for a break.");
        }
      }
    },
  });

  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isIdle = status === "idle";

  // Wake lock during focus
  const { isLocked: wakeLocked, supported: wakeSupported } = useWakeLock(isRunning && mode === "focus");

  // Persistence
  const persistenceRef = useRef<ReturnType<typeof useSessionPersistence> | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);

  const persistence = useSessionPersistence({
    getTimerSnapshot: getSnapshot,
    restoreTimer: restoreFromSnapshot,
    isMonitorEnabled: () => false,
    onRecovered: () => toast("Session restored — pick up where you left off", "info"),
    onRecoveryReady: () => setRecoveryReady(true),
  });
  persistenceRef.current = persistence;

  // Track status for persistence
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (!recoveryReady) return;
    if (prevStatusRef.current === status) return;
    const was = prevStatusRef.current;
    prevStatusRef.current = status;
    if (status === "running" && (was === "idle" || was === "paused")) {
      void persistence.onTimerStarted();
    }
  }, [status, recoveryReady, persistence]);

  // Emit focus events for bottom nav hiding
  useEffect(() => {
    if (status === "running" && mode === "focus") {
      window.dispatchEvent(new CustomEvent("fx:focus-start"));
    } else {
      window.dispatchEvent(new CustomEvent("fx:focus-stop"));
    }
  }, [status, mode]);

  // Title update
  useEffect(() => {
    if (!recoveryReady) return;
    const m = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
    const s = (secondsLeft % 60).toString().padStart(2, "0");
    document.title = isRunning ? `${m}:${s} · FocusArx` : "FocusArx";
    return () => {
      document.title = "FocusArx";
    };
  }, [secondsLeft, isRunning, recoveryReady]);

  const handleToggle = useCallback(() => {
    if (isIdle && mode === "focus") {
      setTotalPlanned(secondsLeft);
      if (secondsLeft > 2 * 60 * 60) {
        toast("Planning >2h? Consider breaking into smaller blocks for better focus.", "info");
      }
      trackSessionStart("deep_work", secondsLeft, activeTasks.length > 0);
      playCoachVoice("session_start");
    }
    if (isRunning) haptic("tap");
    else haptic("select");
    toggle();
  }, [isIdle, mode, secondsLeft, toggle, activeTasks.length, toast]);

  const handleReset = useCallback(() => {
    const snap = getSnapshot();
    if (snap.status === "running" && snap.mode === "focus") {
      setShowExitConfirm(true);
      return;
    }
    persistence.clearDbSession();
    reset(false);
  }, [getSnapshot, persistence, reset]);

  const handleCompleteEarly = useCallback(async () => {
    const activeSec = getActiveSeconds();
    if (activeSec < 10) {
      persistence.clearDbSession();
      reset(false);
      setShowExitConfirm(false);
      return;
    }
    setShowExitConfirm(false);
    setIsSaving(true);
    const dbSessionId = persistenceRef.current?.getDbSessionId() ?? null;
    const actualSec = Math.floor(activeSec);
    const res = await syncFocusSessionToCloud(
      {
        id: `early-${Date.now()}`,
        mode: "focus",
        completedAt: new Date().toISOString(),
        durationSeconds: actualSec,
        focusScore: null,
        focusQuality: null,
        focusTimeline: null,
        stabilityRating: null,
        sessionInsights: null,
      },
      dbSessionId,
      {
        plannedDurationSec: totalPlanned,
        completedEarly: true,
        completionPercentage: Math.min(100, Math.round((actualSec / totalPlanned) * 100)),
        sessionStatus: "completed_early",
      }
    );
    setIsSaving(false);
    persistence.clearDbSession();
    reset(false);
    if (res.success) {
      toast(`Saved — ${Math.floor(actualSec / 60)}m recorded!`, "success");
      setSummary({ minutes: Math.floor(actualSec / 60), xp: res.earnedXp ?? 0, coins: res.earnedCoins ?? 0 });
      setShowSummary(true);
    } else if (res.offline) {
      const key = `completion_early-${Date.now()}`;
      enqueueOffline(
        {
          mode: "focus",
          durationSec: actualSec,
          completedAt: new Date().toISOString(),
          clientNonce: key,
          sessionId: dbSessionId,
          idempotencyKey: key,
        },
        key
      );
      toast(`Saved ${Math.floor(actualSec / 60)}m offline`, "info");
    }
  }, [getActiveSeconds, persistence, reset, totalPlanned, toast, enqueueOffline]);

  const { m, s } = formatTime(secondsLeft);

  if (!recoveryReady) {
    return (
      <div className="w-full max-w-sm px-4">
        <div className="animate-pulse rounded-[2rem] bg-[var(--surface-1)] p-8">
          <div className="mx-auto h-40 w-40 rounded-full bg-[var(--surface-hover)]" />
          <p className="mt-4 text-center text-sm text-[var(--foreground-subtle)]">Restoring session…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full max-w-sm flex-col items-center gap-6 px-4 py-6">
        {/* Mode + task context */}
        <div className="flex w-full items-center justify-between">
          <span className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--brand-strong)]">
            {mode === "focus" ? "Deep Work" : mode === "break" ? "Break" : "Long Break"}
          </span>
          {wakeSupported && (
            <span className={`text-[10px] ${wakeLocked ? "text-[var(--success)]" : "text-[var(--foreground-subtle)]"}`}>
              {wakeLocked ? "● Screen awake" : "○ Screen may dim"}
            </span>
          )}
        </div>

        {/* Large timer text - mobile-first, huge */}
        <div className="relative flex flex-col items-center">
          <motion.div
            key={Math.floor(secondsLeft / 60)}
            initial={{ scale: 0.97 }}
            animate={{ scale: 1 }}
            className="select-none font-mono text-[5.5rem] font-semibold leading-none tracking-[-0.06em] sm:text-[6.5rem]"
            style={{
              backgroundImage: `linear-gradient(135deg, var(--foreground) 20%, var(--brand-400) 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
            aria-live="polite"
            aria-atomic="true"
            role="timer"
          >
            {m}:{s}
          </motion.div>
          <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-[var(--border-subtle)]">
            <motion.div
              className="h-full bg-[var(--brand-500)]"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-[var(--foreground-subtle)]">
            {isRunning ? "in progress" : isPaused ? "paused" : "ready"} • {Math.floor(secondsLeft / 60)}m planned
          </p>
        </div>

        {/* One obvious Start/Pause button - 44px+ */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isSaving}
          className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-full bg-gradient-to-br from-[var(--brand-600)] to-[var(--brand-700)] px-6 py-4 text-base font-bold text-white shadow-[0_0_0_8px_var(--brand-soft),0_12px_32px_rgba(124,58,237,0.35)] transition-transform active:scale-[0.97] disabled:opacity-60"
          aria-label={isRunning ? "Pause" : isPaused ? "Resume" : "Start focus session"}
        >
          {isRunning ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
          <span>{isRunning ? "Pause" : isPaused ? "Resume" : "Start focusing"}</span>
        </button>

        {/* Current task clearly */}
        {currentTask ? (
          <div className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">Current task</p>
            <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{currentTask}</p>
          </div>
        ) : (
          <div className="w-full rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-1)]/60 px-4 py-3 text-center">
            <p className="text-xs text-[var(--foreground-subtle)]">No task selected — <span className="font-medium text-[var(--brand-strong)]">add one to stay focused</span></p>
          </div>
        )}

        {/* Secondary controls - Finish separated from Pause */}
        <div className="flex w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)]"
              aria-label="Reset timer"
            >
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              onClick={() => setSoundEnabled(v => !v)}
              className="grid min-h-[44px] min-w-[44px] place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)]"
              aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            {isRunning && (
              <button
                type="button"
                onClick={() => setShowMobileFocus(true)}
                className="min-h-[44px] rounded-full bg-[var(--surface-1)] px-4 text-xs font-semibold text-[var(--foreground-muted)]"
              >
                Focus mode
              </button>
            )}
          </div>
          {isRunning && mode === "focus" && (
            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              className="min-h-[44px] rounded-full border border-[var(--success)]/20 bg-[var(--success-soft)] px-5 text-xs font-bold text-[var(--success)]"
            >
              Finish
            </button>
          )}
        </div>

        {/* Session dots */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--foreground-subtle)]">Session {completedFocusSessions + 1} of {DEFAULT_CONFIG.sessionsBeforeLongBreak}</span>
          <div className="flex gap-1">
            {Array.from({ length: DEFAULT_CONFIG.sessionsBeforeLongBreak }).map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < completedFocusSessions ? "bg-[var(--brand-500)]" : "bg-[var(--border-strong)]"}`} />
            ))}
          </div>
        </div>

        {/* Duration chips - numeric keyboard friendly */}
        {isIdle && mode === "focus" && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[25, 50, 90, 120].map(min => (
              <button
                key={min}
                type="button"
                onClick={() => setCustomDuration("focus", min * 60)}
                className={`min-h-[36px] rounded-full border px-3.5 text-xs font-bold ${Math.floor(secondsLeft / 60) === min ? "border-[var(--brand-500)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)]"}`}
                inputMode="numeric"
                aria-label={`Set focus duration to ${min} minutes`}
              >
                {min}m
              </button>
            ))}
          </div>
        )}

        {/* Offline indicator */}
        {isOffline && (
          <div className="flex w-full items-center gap-2 rounded-xl bg-[var(--warning-soft)] px-3 py-2.5 text-xs">
            <AlertTriangle size={14} className="text-[var(--warning)]" />
            <span className="flex-1">Offline — timer keeps running, will sync later{queueCount > 0 ? ` (${queueCount} pending)` : ""}</span>
          </div>
        )}
      </div>

      {/* Mobile focus mode overlay */}
      <MobileFocusMode
        isActive={showMobileFocus && isRunning && mode === "focus"}
        mode={mode}
        secondsLeft={secondsLeft}
        progress={progress}
        taskName={currentTask}
        sessionNumber={completedFocusSessions + 1}
        totalSessions={DEFAULT_CONFIG.sessionsBeforeLongBreak}
        onPause={() => { haptic("tap"); toggle(); }}
        onResume={() => { haptic("select"); toggle(); }}
        onEnd={() => { setShowMobileFocus(false); setShowExitConfirm(true); }}
        isRunning={isRunning}
        ambientSoundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(v => !v)}
      />

      {/* Exit confirmation - prevents accidental completion */}
      <AnimatePresence>
        {showExitConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm" onClick={() => setShowExitConfirm(false)} />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[var(--z-modal)] rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 shadow-2xl md:left-1/2 md:top-1/2 md:bottom-auto md:w-full md:max-w-sm md:-translate-x-1/2 md:-translate-y-1/2"
              role="alertdialog"
              aria-modal="true"
            >
              <h3 className="text-base font-semibold">End this focus session?</h3>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">Your progress will be saved, but the session will be marked incomplete.</p>
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setShowExitConfirm(false)} className="min-h-[44px] flex-1 rounded-full bg-[var(--brand-600)] px-4 py-2.5 text-sm font-bold text-white" autoFocus>
                  Continue focusing
                </button>
                <button type="button" onClick={() => void handleCompleteEarly()} className="min-h-[44px] flex-1 rounded-full border border-[var(--border-subtle)] px-4 py-2.5 text-sm font-medium">
                  End session
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Summary */}
      <AnimatePresence>
        {showSummary && summary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-sm rounded-[1.5rem] bg-[var(--surface-1)] p-6 text-center shadow-2xl">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                <CheckCircle size={28} />
              </div>
              <h3 className="mt-4 text-lg font-bold">Session complete!</h3>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">{summary.minutes} minutes of deep work protected</p>
              {(summary.xp > 0 || summary.coins > 0) && (
                <div className="mt-3 flex justify-center gap-3 text-sm font-bold">
                  {summary.xp > 0 && <span className="text-[var(--brand-400)]">+{summary.xp} XP</span>}
                  {summary.coins > 0 && <span className="text-[var(--palette-amber-400)]">+{summary.coins} coins</span>}
                </div>
              )}
              <button type="button" onClick={() => setShowSummary(false)} className="mt-5 min-h-[44px] w-full rounded-full bg-[var(--brand-600)] px-4 py-2.5 text-sm font-bold text-white">
                Continue
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
