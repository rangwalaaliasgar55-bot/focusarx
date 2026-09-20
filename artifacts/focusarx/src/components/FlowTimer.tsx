/**
 * Flowtime stopwatch (Phase 9.1).
 *
 * No preset slice: work until a natural stopping point, then Finish.
 * A suggested break (~5 min per 25 worked, capped at 30) is shown at the
 * end. Completion flows through the same pipeline as countdown sessions
 * (record → sounds → cloud sync → summary), so XP/streaks behave alike.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Check, Sparkles, Coffee, Flame, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { generateId } from "@/lib/timerUtils";
import { flowSuggestedBreakMin } from "@/lib/sessionPresets";
import { haptic } from "@/lib/haptics";
import { publishFocusState, resetFocusState } from "@/lib/focusSessionBus";
import { abandonActiveSession, createActiveSession, syncActiveSession } from "@/lib/session-persistence-api";
import type { Session } from "@/types/timer";

const FLOW_SERVER_PLAN_SECONDS = 4 * 60 * 60;
const FLOW_SNAPSHOT_KEY = "focusarx-flowtime-session";
const FLOW_GOAL_KEY = "focusarx-flowtime-goal-seconds";
const FLOW_SNAPSHOT_TTL_MS = 12 * 60 * 60 * 1000;

type FlowSnapshot = {
  version: 1;
  running: boolean;
  accumulatedSeconds: number;
  startedAtMs: number | null;
  goalSeconds: number | null;
  serverSessionId: string | null;
  serverPlanSeconds: number;
  pendingCompletion?: boolean;
  pendingCompletionKey?: string | null;
  savedAt: number;
};

function readStoredFlowGoal(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const value = Number(window.localStorage.getItem(FLOW_GOAL_KEY));
    return Number.isFinite(value) && value >= 60 && value <= FLOW_SERVER_PLAN_SECONDS
      ? Math.round(value)
      : null;
  } catch {
    return null;
  }
}

function readFlowSnapshot(): FlowSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FLOW_SNAPSHOT_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<FlowSnapshot>;
    if (value.version !== 1 || typeof value.accumulatedSeconds !== "number" || !Number.isFinite(value.accumulatedSeconds)) return null;
    if (typeof value.savedAt !== "number" || Date.now() - value.savedAt > FLOW_SNAPSHOT_TTL_MS) {
      window.localStorage.removeItem(FLOW_SNAPSHOT_KEY);
      return null;
    }
    const running = value.running === true;
    const startedAtMs = typeof value.startedAtMs === "number" && Number.isFinite(value.startedAtMs)
      ? value.startedAtMs
      : null;
    const goalSeconds = typeof value.goalSeconds === "number" && Number.isFinite(value.goalSeconds) && value.goalSeconds > 0
      ? Math.round(value.goalSeconds)
      : null;
    const serverPlanSeconds = typeof value.serverPlanSeconds === "number" && Number.isFinite(value.serverPlanSeconds)
      ? Math.max(60, Math.min(FLOW_SERVER_PLAN_SECONDS, Math.round(value.serverPlanSeconds)))
      : (goalSeconds ?? FLOW_SERVER_PLAN_SECONDS);
    return {
      version: 1,
      running: running && startedAtMs !== null,
      accumulatedSeconds: Math.max(0, value.accumulatedSeconds),
      startedAtMs: running ? startedAtMs : null,
      goalSeconds,
      serverSessionId: typeof value.serverSessionId === "string" ? value.serverSessionId : null,
      serverPlanSeconds,
      pendingCompletion: value.pendingCompletion === true,
      pendingCompletionKey: typeof value.pendingCompletionKey === "string" ? value.pendingCompletionKey : null,
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}

interface FlowTimerProps {
  taskName?: string;
  onFinish: (session: Session, serverSessionId?: string | null) => boolean | void | Promise<boolean | void>;
  onExitPreset: () => void;
}

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function getFlowMilestone(minutes: number): { label: string; icon: React.ReactNode; color: string } | null {
  if (minutes >= 90) return { label: "Ultradian Peak (90m+)", icon: <Flame size={13} />, color: "var(--palette-amber-400)" };
  if (minutes >= 60) return { label: "Gold Flow Block (60m+)", icon: <Zap size={13} />, color: "var(--brand-gold)" };
  if (minutes >= 45) return { label: "Deep Work (45m+)", icon: <Sparkles size={13} />, color: "var(--brand-400)" };
  if (minutes >= 25) return { label: "Classic Block (25m+)", icon: <Check size={13} />, color: "var(--brand-teal)" };
  return null;
}

export default function FlowTimer({ taskName, onFinish, onExitPreset }: FlowTimerProps) {
  // Flowtime is local-first as well as server-backed. Without this snapshot a
  // refresh or a responsive remount silently turned a live stopwatch back to
  // 00:00 — the exact kind of data loss a focus timer must never introduce.
  const [restoredSnapshot] = useState<FlowSnapshot | null>(() => readFlowSnapshot());
  const [initialSeconds] = useState(() => {
    if (!restoredSnapshot) return 0;
    const runningSeconds = restoredSnapshot.running && restoredSnapshot.startedAtMs !== null
      ? Math.max(0, (Date.now() - restoredSnapshot.startedAtMs) / 1000)
      : 0;
    return Math.max(0, restoredSnapshot.accumulatedSeconds + runningSeconds);
  });
  const [running, setRunning] = useState(() => restoredSnapshot?.running ?? false);
  const [elapsed, setElapsed] = useState(() => Math.floor(initialSeconds));
  const [goalSeconds, setGoalSeconds] = useState<number | null>(() => restoredSnapshot?.goalSeconds ?? readStoredFlowGoal());
  const [pendingSync, setPendingSync] = useState(() => restoredSnapshot?.pendingCompletion === true);
  const startedAtRef = useRef<number | null>(
    restoredSnapshot?.running ? Date.now() : null,
  );
  const accRef = useRef(initialSeconds);
  const leavingRef = useRef(false);
  const finishingRef = useRef(false);
  const runningRef = useRef(running);
  const goalRef = useRef<number | null>(goalSeconds);
  const serverSessionIdRef = useRef<string | null>(restoredSnapshot?.serverSessionId ?? null);
  const serverPlanSecondsRef = useRef<number>(
    restoredSnapshot?.serverPlanSeconds ?? goalSeconds ?? FLOW_SERVER_PLAN_SECONDS,
  );
  const serverStartPromiseRef = useRef<Promise<string | null> | null>(null);
  const pendingCompletionRef = useRef<{ session: Session; serverSessionId: string } | null>(null);
  const pendingCompletionFlagRef = useRef(restoredSnapshot?.pendingCompletion === true);
  const pendingCompletionKeyRef = useRef<string | null>(restoredSnapshot?.pendingCompletionKey ?? null);

  // Sync with Focus Session Bus & Document Title. A goal is optional — Flow
  // remains an open-ended stopwatch — but when one is set all consumers see
  // the real target instead of the old hard-coded 25-minute surrogate.
  useEffect(() => {
    const totalSeconds = goalSeconds ?? Math.max(elapsed, 1500);
    const secondsLeft = goalSeconds === null ? elapsed : Math.max(0, goalSeconds - elapsed);
    if (running) {
      publishFocusState({
        mode: "focus",
        status: "running",
        secondsLeft,
        totalSeconds,
      });
      document.title = goalSeconds
        ? `[${fmt(elapsed)} / ${fmt(goalSeconds)} Flow] FocusArx`
        : `[${fmt(elapsed)} Flow] FocusArx`;
      window.dispatchEvent(new CustomEvent("fx:focus-start"));
    } else {
      if (elapsed > 0) {
        publishFocusState({
          mode: "focus",
          status: "paused",
          secondsLeft,
          totalSeconds,
        });
        document.title = goalSeconds
          ? `[Paused ${fmt(elapsed)} / ${fmt(goalSeconds)} Flow] FocusArx`
          : `[Paused Flow] FocusArx`;
      } else {
        resetFocusState();
        document.title = "FocusArx — Deep work, made clear";
      }
      window.dispatchEvent(new CustomEvent("fx:focus-stop"));
    }
  }, [running, elapsed, goalSeconds]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  // High-precision tick with drift compensation
  useEffect(() => {
    if (!running) return;
    startedAtRef.current = Date.now();
    const id = window.setInterval(() => {
      const base = accRef.current + (Date.now() - (startedAtRef.current ?? Date.now())) / 1000;
      setElapsed(Math.floor(base));
    }, 200);
    return () => {
      window.clearInterval(id);
      if (startedAtRef.current != null) {
        accRef.current += (Date.now() - startedAtRef.current) / 1000;
        startedAtRef.current = null;
      }
    };
  }, [running]);

  const currentDurationSeconds = useCallback(() => {
    const total = startedAtRef.current != null
      ? accRef.current + (Date.now() - startedAtRef.current) / 1000
      : accRef.current;
    return Math.max(0, total);
  }, []);

  const persistSnapshot = useCallback(() => {
    if (typeof window === "undefined") return;
    const isRunning = runningRef.current;
    const accumulatedSeconds = isRunning ? currentDurationSeconds() : Math.max(0, accRef.current);
    const snapshot: FlowSnapshot = {
      version: 1,
      running: isRunning,
      accumulatedSeconds,
      // Rebase a running snapshot at write time. On restore the elapsed value
      // is retained and only the time after this checkpoint is added.
      startedAtMs: isRunning ? Date.now() : null,
      goalSeconds: goalRef.current,
      serverSessionId: serverSessionIdRef.current,
      serverPlanSeconds: serverPlanSecondsRef.current,
      pendingCompletion: pendingCompletionFlagRef.current,
      pendingCompletionKey: pendingCompletionKeyRef.current,
      savedAt: Date.now(),
    };
    try {
      window.localStorage.setItem(FLOW_SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
      /* A private-storage quota error must never stop the stopwatch. */
    }
  }, [currentDurationSeconds]);

  const syncServerState = useCallback((timerStatus: "running" | "paused") => {
    const sessionId = serverSessionIdRef.current;
    if (!sessionId) return Promise.resolve(false);
    const planSeconds = serverPlanSecondsRef.current;
    const activeSeconds = Math.min(planSeconds, Math.floor(currentDurationSeconds()));
    return syncActiveSession({
      sessionId,
      mode: "focus",
      timerStatus,
      activeSeconds,
      secondsLeft: Math.max(0, planSeconds - activeSeconds),
      monitorEnabled: false,
    });
  }, [currentDurationSeconds]);

  // Checkpoint long Flowtime runs so a tab sleep or network retry never makes
  // the completion request depend on an unbounded client claim. The server
  // clock is still authoritative between checkpoints.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => syncServerState("running"), 10_000);
    return () => window.clearInterval(id);
  }, [running, syncServerState]);

  const ensureServerSession = useCallback(() => {
    if (serverSessionIdRef.current || serverStartPromiseRef.current) return;
    const requestedPlan = goalRef.current ?? FLOW_SERVER_PLAN_SECONDS;
    const planSeconds = Math.max(60, Math.min(FLOW_SERVER_PLAN_SECONDS, Math.round(requestedPlan)));
    serverPlanSecondsRef.current = planSeconds;
    serverStartPromiseRef.current = createActiveSession({
      mode: "focus",
      // Flowtime has no mandatory end. A bounded server plan gives the
      // anti-farming completion check a ceiling while the local stopwatch
      // remains open-ended (or follows the optional user goal).
      secondsLeft: planSeconds,
      timerStatus: "running",
      monitorEnabled: false,
    }).then((row) => {
      const id = row?.id ?? null;
      serverSessionIdRef.current = id;
      persistSnapshot();
      if (id && !runningRef.current) syncServerState("paused");
      return id;
    }).catch(() => null);
  }, [persistSnapshot, syncServerState]);

  // A restored running snapshot must recreate its server evidence without
  // waiting for a click. Guests simply get a null response from the API.
  useEffect(() => {
    if (!running) return;
    ensureServerSession();
    if (serverSessionIdRef.current) syncServerState("running");
  }, [ensureServerSession, running, syncServerState]);

  // Save a checkpoint locally even when the tab is backgrounded. The pagehide
  // listener is the final flush for a close/navigation.
  useEffect(() => {
    if (!running) return;
    persistSnapshot();
    const id = window.setInterval(persistSnapshot, 1_000);
    return () => window.clearInterval(id);
  }, [persistSnapshot, running]);

  useEffect(() => {
    const flush = () => persistSnapshot();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [persistSnapshot]);

  const resolveServerSessionId = useCallback(async () => {
    if (serverSessionIdRef.current) return serverSessionIdRef.current;
    if (serverStartPromiseRef.current) return serverStartPromiseRef.current;
    return null;
  }, []);

  const toggle = useCallback(() => {
    if (pendingSync) return;
    if (running) {
      haptic("tap");
      const total = currentDurationSeconds();
      accRef.current = total;
      startedAtRef.current = null;
      runningRef.current = false;
      setElapsed(Math.floor(total));
      // Checkpoint the pause before React runs the interval cleanup. The
      // server then stops charging wall-clock time while the local stopwatch
      // is paused.
      syncServerState("paused");
      persistSnapshot();
      setRunning(false);
    } else {
      haptic("select");
      startedAtRef.current = Date.now();
      runningRef.current = true;
      ensureServerSession();
      if (serverSessionIdRef.current) syncServerState("running");
      persistSnapshot();
      setRunning(true);
    }
  }, [currentDurationSeconds, ensureServerSession, pendingSync, persistSnapshot, running, syncServerState]);

  const reset = useCallback((abandonServer = true) => {
    runningRef.current = false;
    setRunning(false);
    setElapsed(0);
    accRef.current = 0;
    startedAtRef.current = null;
    if (typeof window !== "undefined") {
      try { window.localStorage.removeItem(FLOW_SNAPSHOT_KEY); } catch { /* ignore */ }
    }
    if (abandonServer) {
      const pending = serverStartPromiseRef.current;
      serverSessionIdRef.current = null;
      serverStartPromiseRef.current = null;
      // If Start was pressed and the POST is still in flight, wait for its id
      // before abandoning it; otherwise the just-created row could survive a
      // zero-second reset.
      void (pending ? pending.then(() => abandonActiveSession()) : abandonActiveSession());
    }
    resetFocusState();
  }, []);

  useEffect(() => {
    if (!pendingSync) return;
    const pendingKey = pendingCompletionKeyRef.current;
    if (!pendingKey) return;

    const completePendingFlow = () => {
      pendingCompletionFlagRef.current = false;
      pendingCompletionKeyRef.current = null;
      pendingCompletionRef.current = null;
      serverSessionIdRef.current = null;
      serverStartPromiseRef.current = null;
      setPendingSync(false);
      reset(false);
      onExitPreset();
    };

    const hasQueuedCompletion = () => {
      try {
        const raw = window.localStorage.getItem("focusarx-offline-queue");
        // No readable queue is ambiguous: storage may be unavailable while
        // the in-memory queue still protects the session. Keep the active row
        // until an explicit sync event rather than switching into recovery.
        if (!raw) return true;
        const queued = JSON.parse(raw);
        return Array.isArray(queued) && queued.some((item) => item?.idempotencyKey === pendingKey);
      } catch {
        return true;
      }
    };

    const onSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ idempotencyKey?: string }>).detail;
      if (detail?.idempotencyKey === pendingKey) completePendingFlow();
    };
    window.addEventListener("focusarx:offline-session-synced", onSynced);
    // Covers a page reload where the queue may have flushed before this
    // component registered its event listener.
    if (!hasQueuedCompletion()) completePendingFlow();
    return () => window.removeEventListener("focusarx:offline-session-synced", onSynced);
  }, [onExitPreset, pendingSync, reset]);

  const buildSession = useCallback((durationSeconds: number, partial: boolean): Session => {
    const plannedDurationSec = goalRef.current ?? (partial ? null : durationSeconds);
    const completionPercentage = plannedDurationSec && plannedDurationSec > 0
      ? Math.min(100, Math.round((durationSeconds / plannedDurationSec) * 100))
      : partial ? null : 100;
    return {
      id: generateId(),
      mode: "focus",
      completedAt: new Date().toISOString(),
      durationSeconds,
      focusScore: partial ? null : 100,
      focusQuality: partial ? null : "high",
      focusTimeline: null,
      stabilityRating: partial ? null : "High Stability",
      completedEarly: partial,
      plannedDurationSec,
      completionPercentage,
      sessionInsights: {
        summary: partial
          ? `Saved ${Math.floor(durationSeconds / 60)} minutes of Flowtime before exit.`
          : `Completed ${Math.floor(durationSeconds / 60)} minutes of continuous flow!`,
        bestFocusPeriod: "All session",
        worstDistractionPeriod: "None",
        totalInterruptions: 0,
        // SessionInsights uses the shared stability enum; the summary above
        // carries the more useful "partial" distinction without persisting an
        // invalid rating.
        stabilityRating: partial ? "Low Stability" : "High Stability",
      },
    };
  }, []);

  const finishAndRecord = useCallback(async (partial: boolean) => {
    if (finishingRef.current || pendingSync) return false;
    const preciseSeconds = currentDurationSeconds();
    if (preciseSeconds <= 0) {
      reset();
      return false;
    }
    finishingRef.current = true;
    // Session rows store whole seconds, but even a sub-second Flowtime exit
    // is real work. Round it up to one second instead of silently discarding it.
    const durationSeconds = Math.max(1, Math.round(preciseSeconds));
    // An optional goal makes an early manual finish an explicitly partial
    // session; open-ended Flowtime finishes remain full sessions.
    const goal = goalRef.current;
    const isPartial = partial || (goal !== null && durationSeconds < goal);
    const session = buildSession(durationSeconds, isPartial);
    accRef.current = preciseSeconds;
    startedAtRef.current = null;
    runningRef.current = false;
    setRunning(false);
    haptic(isPartial ? "tap" : "celebrate");

    // A slow / offline create-active request must not make the elapsed block
    // disappear. Wait for its id before completing so the server can verify
    // the wall-clock interval; guests simply resolve to null and still keep
    // their local history. Do not abandon the active row here: the completion
    // request consumes it transactionally. The local clock stays in `accRef`
    // until the checkpoint finishes, otherwise a late POST would sync zero
    // seconds immediately before the completion request.
    try {
      const serverSessionId = await resolveServerSessionId();
      if (serverSessionId) await syncServerState("paused");
      reset(false);
      let delivered = false;
      try {
        delivered = (await onFinish(session, serverSessionId)) !== false;
      } catch {
        // The local history entry is already safe; keep the active server row
        // and retry queue evidence when the completion callback itself fails.
        delivered = false;
      }

      if (!delivered && serverSessionId) {
        pendingCompletionRef.current = { session, serverSessionId };
        pendingCompletionFlagRef.current = true;
        pendingCompletionKeyRef.current = `completion_${session.id}`;
        serverSessionIdRef.current = serverSessionId;
        accRef.current = preciseSeconds;
        setElapsed(durationSeconds);
        setRunning(false);
        setPendingSync(true);
        persistSnapshot();
        // Stay in Flowtime until the queue reports an accepted completion.
        return false;
      }

      // An offline completion without a server row (for example, a guest) has
      // no countdown-recovery duplicate to protect against and may leave.
      serverSessionIdRef.current = null;
      serverStartPromiseRef.current = null;
      pendingCompletionFlagRef.current = false;
      pendingCompletionKeyRef.current = null;
      pendingCompletionRef.current = null;
      return true;
    } finally {
      finishingRef.current = false;
    }
  }, [buildSession, currentDurationSeconds, onFinish, pendingSync, persistSnapshot, reset, resolveServerSessionId, syncServerState]);

  const finish = useCallback(() => {
    finishAndRecord(false);
  }, [finishAndRecord]);

  /**
   * Flowtime is a stopwatch, so switching back to presets must not behave like
   * abandoning the countdown. Persist the elapsed slice first, then leave the
   * mode. The server receives `completed_early`, which keeps the partial work
   * in history without granting a full planned-block reward.
   */
  const leaveFlow = useCallback(async () => {
    if (leavingRef.current || pendingSync) return;
    leavingRef.current = true;
    // Keep Flowtime mounted until the completion pipeline consumes the active
    // server row. Switching presets first would re-enable countdown recovery,
    // which could briefly restore the same Flow session as a second timer.
    if (currentDurationSeconds() <= 0) {
      reset();
      onExitPreset();
      return;
    }
    const canLeave = await finishAndRecord(true);
    if (canLeave) onExitPreset();
  }, [currentDurationSeconds, finishAndRecord, onExitPreset, pendingSync, reset]);

  const handleGoalChange = useCallback((rawMinutes: string) => {
    if (pendingSync) return;
    const trimmed = rawMinutes.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isFinite(next) || next <= 0)) return;
    const nextSeconds = next === null
      ? null
      : Math.min(FLOW_SERVER_PLAN_SECONDS, Math.max(60, Math.round(next * 60)));
    goalRef.current = nextSeconds;
    setGoalSeconds(nextSeconds);
    try {
      if (nextSeconds === null) window.localStorage.removeItem(FLOW_GOAL_KEY);
      else window.localStorage.setItem(FLOW_GOAL_KEY, String(nextSeconds));
    } catch { /* ignore storage failures */ }
    // A new target affects the server plan only before the active row exists;
    // changing it later is still safe locally and never rewrites a running
    // server deadline underneath the user.
    if (!serverSessionIdRef.current && !serverStartPromiseRef.current) {
      serverPlanSecondsRef.current = nextSeconds ?? FLOW_SERVER_PLAN_SECONDS;
    }
    persistSnapshot();
  }, [pendingSync, persistSnapshot]);

  // Reset the title/bus if the parent switches presets and unmounts this
  // component before React gets to flush the `running=false` effect.
  useEffect(() => () => {
    resetFocusState();
    document.title = "FocusArx — Deep work, made clear";
    window.dispatchEvent(new CustomEvent("fx:focus-stop"));
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        leaveFlow();
      } else if (e.code === "KeyF" && elapsed >= 60) {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle, leaveFlow, finish, elapsed]);

  const workedMin = Math.floor(elapsed / 60);
  const milestone = getFlowMilestone(workedMin);
  const suggestedBreak = flowSuggestedBreakMin(workedMin);

  return (
    <div className="relative flex w-full flex-col items-center gap-5 py-4" role="timer" aria-label={`Flowtime elapsed ${fmt(elapsed)}`}>
      {/* Ambient Breathing Glow */}
      <motion.div
        className="pointer-events-none absolute -inset-6 rounded-full"
        style={{
          background: running
            ? "radial-gradient(circle, var(--rgba-124-58-237-0_22) 0%, transparent 70%)"
            : "radial-gradient(circle, var(--rgba-124-58-237-0_08) 0%, transparent 70%)",
          filter: "blur(32px)",
        }}
        animate={running ? { scale: [0.95, 1.06, 0.95], opacity: [0.6, 0.9, 0.6] } : { scale: 1, opacity: 0.3 }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      />

      {/* Mode Badge & Active Milestone */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--brand-strong)] border border-[var(--brand-500)]/30">
          <Sparkles size={12} /> Flowtime Mode
        </span>
        {milestone && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border"
            style={{ color: milestone.color, borderColor: `color-mix(in srgb, ${milestone.color} 30%, transparent)`, background: `color-mix(in srgb, ${milestone.color} 12%, transparent)` }}
          >
            {milestone.icon}
            {milestone.label}
          </motion.span>
        )}
      </div>

      {/* Main Stopwatch Face */}
      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          animate={running ? { scale: [1, 1.015, 1] } : { scale: 1 }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="select-none font-display text-[4.5rem] sm:text-[5.25rem] font-semibold leading-none tracking-[-0.055em] tabular-nums text-[var(--foreground)]"
          style={{
            fontFeatureSettings: '"tnum" 1, "ss01" 1',
            textShadow: running ? "0 0 32px var(--rgba-139-92-246-0_35)" : "none",
          }}
          aria-live="polite"
        >
          {fmt(elapsed)}
        </motion.div>

        {taskName ? (
          <p className="mt-2 line-clamp-2 max-w-xs text-center text-sm font-semibold text-[var(--foreground)]">{taskName}</p>
        ) : (
          <p className="mt-2 text-xs text-[var(--foreground-muted)]">Work continuously until you reach a natural stopping point.</p>
        )}
      </div>

      {/* Flowtime is open-ended, but a persisted optional goal makes the
          duration changeable when someone wants a defined block. */}
      <div className="relative z-10 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2">
        <label htmlFor="flow-goal-minutes" className="text-[11px] font-semibold text-[var(--foreground-muted)]">
          Optional goal
        </label>
        <input
          id="flow-goal-minutes"
          type="number"
          min={1}
          max={240}
          step={1}
          inputMode="numeric"
          value={goalSeconds === null ? "" : Math.round(goalSeconds / 60)}
          onChange={(event) => handleGoalChange(event.target.value)}
          disabled={pendingSync}
          placeholder="—"
          aria-label="Flow goal in minutes"
          className="w-16 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 py-1 text-center text-xs font-bold text-[var(--foreground)] outline-none transition focus:border-[var(--brand-400)]"
        />
        <span className="text-[11px] text-[var(--foreground-subtle)]">min</span>
        {goalSeconds !== null && (
          <span className={`text-[11px] font-semibold ${elapsed >= goalSeconds ? "text-[var(--success)]" : "text-[var(--foreground-subtle)]"}`}>
            {elapsed >= goalSeconds ? "Goal reached" : `${fmt(Math.max(0, goalSeconds - elapsed))} left`}
          </span>
        )}
      </div>

      {pendingSync && (
        <p role="status" className="relative z-10 rounded-full border border-[var(--brand-400)]/30 bg-[var(--brand-soft)] px-3 py-1.5 text-center text-[11px] font-semibold text-[var(--brand-strong)]">
          Saved locally — finishing this Flowtime block when the connection returns.
        </p>
      )}

      {/* Controls */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={toggle}
          disabled={pendingSync}
          className={`flex min-h-[54px] min-w-[140px] items-center justify-center gap-2 rounded-full px-6 text-sm font-bold shadow-lg transition-all ${
            running
              ? "bg-[var(--surface-raised)] border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
              : "bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-500)] text-white hover:from-[var(--brand-500)] hover:to-[var(--brand-400)] shadow-[0_8px_24px_-6px_var(--rgba-124-58-237-0_5)]"
          } disabled:cursor-not-allowed disabled:opacity-60`}
          aria-label={running ? "Pause flowtime" : elapsed > 0 ? "Resume flowtime" : "Start flowtime"}
        >
          {running ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          <span>{running ? "Pause" : elapsed > 0 ? "Resume" : "Start Flow"}</span>
        </motion.button>

        <button
          type="button"
          onClick={leaveFlow}
          disabled={pendingSync}
          title="Save elapsed Flowtime and leave (R)"
          className="grid min-h-[46px] min-w-[46px] place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Save elapsed Flowtime and leave"
        >
          <RotateCcw size={16} />
        </button>

        <AnimatePresence>
          {elapsed >= 60 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.85, x: -6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={finish}
              disabled={pendingSync}
              className="flex min-h-[46px] items-center gap-1.5 rounded-full bg-[var(--success-soft)] border border-[var(--success)]/40 px-5 text-xs font-bold text-[var(--success)] hover:bg-[var(--success)]/20 shadow-md transition disabled:cursor-not-allowed disabled:opacity-60"
              title="Finish flow session and earn XP (F)"
            >
              <Check size={16} /> Finish Session
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Suggested Break Pill */}
      {elapsed >= 60 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-1 text-xs text-[var(--foreground-muted)]"
        >
          <Coffee size={13} className="text-[var(--brand-teal)]" />
          <span>Suggested break after this block: <strong className="text-[var(--foreground)] font-semibold">{suggestedBreak} min</strong></span>
        </motion.div>
      )}

      {/* Back to presets */}
      <button
        type="button"
        onClick={leaveFlow}
        className="relative z-10 text-[11px] font-semibold text-[var(--foreground-subtle)] hover:text-[var(--foreground)] underline-offset-2 hover:underline transition-colors"
      >
        ← Save elapsed time & back to Pomodoro presets
      </button>
    </div>
  );
}
