
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { generateId } from "@/lib/timerUtils";
import { haptic } from "@/lib/haptics";
import { unlockAudio } from "@/lib/soundEngine";
import { createTimerWorker } from "@/lib/timerWorker";
import { safeGetJson, safeSetJson, safeRemove } from "@/lib/safeStorage";
import { buildSnapshot, readSnapshot } from "@/lib/timerPersistence";
import { acquireTimerLead } from "@/lib/timerLeader";
import { publishSceneSnapshot, publishSceneComplete } from "@/lib/sceneBus";
import {
  finalizeSessionMetrics,
  resetFocusMonitor,
  updateFocusSessionDuration,
} from "@/store/studyMonitorStore";
import type { Session, TimerConfig, TimerMode, TimerStatus } from "@/types/timer";

interface UsePomodoroOptions {
  config?: Partial<TimerConfig>;
  onSessionComplete?: (session: Session) => void;
  onModeChange?: (mode: TimerMode) => void;
  /**
   * Guest-local snapshot key (safeStorage JSON). When set, running/paused
   * slices survive refresh, back-swipe, browser close and system sleep —
   * including for signed-out users, who have no server row. Server recovery
   * (when authed) arrives after mount and overwrites this via
   * `restoreFromSnapshot`, so the two never conflict.
   */
  persistKey?: string;
  /**
   * Elect a single leading tab while running (default true). A tab that
   * loses the election stands down to `paused` and reports `leaderBlocked`
   * so the UI can explain why. The server `clientNonce` idempotency is the
   * backstop on browsers without `navigator.locks`.
   */
  enableLeader?: boolean;
}

export function usePomodoro(options: UsePomodoroOptions = {}) {
  const config: TimerConfig = { ...DEFAULT_CONFIG, ...options.config };

  const onSessionCompleteRef = useRef(options.onSessionComplete);
  const onModeChangeRef = useRef(options.onModeChange);

  // One-shot guest restore: a still-valid local snapshot (written by a
  // previous mount of this hook) seeds the initial state. Runs once, before
  // the state below so restored values become the initial values.
  const [restored] = useState(() => {
    if (!options.persistKey || typeof window === "undefined") return null;
    try {
      return readSnapshot(safeGetJson(options.persistKey, null));
    } catch {
      return null;
    }
  });
  const persistKeyRef = useRef(options.persistKey ?? null);
  persistKeyRef.current = options.persistKey ?? null;

  const [mode, setMode] = useState<TimerMode>(() => restored?.mode ?? "focus");
  const [status, setStatus] = useState<TimerStatus>(() => restored?.status ?? "idle");
  const [customConfigs, setCustomConfigs] = useState<Partial<TimerConfig>>(() =>
    restored?.plannedSeconds ? { [`${restored.mode}Duration`]: restored.plannedSeconds } : {},
  );
  const [leaderBlocked, setLeaderBlocked] = useState(false);

  const getDuration = useCallback(
    (m: TimerMode) => {
      if (m === "focus") return customConfigs.focusDuration ?? config.focusDuration;
      if (m === "longBreak") return customConfigs.longBreakDuration ?? config.longBreakDuration;
      return customConfigs.breakDuration ?? config.breakDuration;
    },
    [config, customConfigs]
  );

  const [secondsLeft, setSecondsLeft] = useState(() => restored?.secondsLeft ?? getDuration("focus"));
  const [completedFocusSessions, setCompletedFocusSessions] = useState(0);

  const modeRef = useRef(mode);
  const statusRef = useRef(status);
  const completedRef = useRef(completedFocusSessions);
  const secondsLeftRef = useRef(secondsLeft);
  // A restored `running` snapshot keeps its original wall-clock deadline, so
  // resume-after-close/sleep lands on the true remaining time.
  const deadlineMsRef = useRef<number | null>(
    restored?.status === "running" ? restored.deadlineMs : null,
  );
  const completingRef = useRef(false);
  const activeSecondsRef = useRef(restored?.activeSeconds ?? 0);
  const lastTickRef = useRef<number | null>(null);
  const lastGuestSaveRef = useRef(0);
  const leadReleaseRef = useRef<(() => void) | null>(null);
  const lastScenePushRef = useRef(0);

  // Publish a reactive-scene snapshot (throttled to 1 Hz). Visuals mirror
  // real session state; the bus is fire-and-forget so it can never break
  // the timer.
  const publishScene = useCallback((status: TimerStatus) => {
    if (typeof window === "undefined") return;
    publishSceneSnapshot({
      mode: modeRef.current,
      status: status === "running" || status === "paused" ? status : "idle",
      secondsLeft: Math.max(0, Math.floor(secondsLeftRef.current)),
      totalSeconds: Math.max(1, Math.floor(getDuration(modeRef.current))),
    });
  }, [getDuration]);

  useLayoutEffect(() => {
    onSessionCompleteRef.current = options.onSessionComplete;
    onModeChangeRef.current = options.onModeChange;
  }, [options.onModeChange, options.onSessionComplete]);

  useLayoutEffect(() => {
    modeRef.current = mode;
    statusRef.current = status;
    completedRef.current = completedFocusSessions;
    secondsLeftRef.current = secondsLeft;
  }, [mode, status, completedFocusSessions, secondsLeft]);



  const armDeadline = useCallback(() => {
    const slice = Math.max(0, secondsLeftRef.current);
    deadlineMsRef.current = Date.now() + slice * 1000;
    completingRef.current = false;
    lastTickRef.current = Date.now();
  }, []);

  const clearDeadline = useCallback(() => {
    deadlineMsRef.current = null;
    if (lastTickRef.current !== null) {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      activeSecondsRef.current += delta;
      updateFocusSessionDuration(delta);
      lastTickRef.current = null;
    }
  }, []);

  const advancePhase = useCallback(
    (record: boolean) => {
      completingRef.current = false;
      const currentMode = modeRef.current;

      if (record) {
        // Record the exact active seconds tracked during this phase
        if (lastTickRef.current !== null) {
          const now = Date.now();
          const delta = (now - lastTickRef.current) / 1000;
          activeSecondsRef.current += delta;
          updateFocusSessionDuration(delta);
          lastTickRef.current = now;
        }

        // Reactive scene: a completed focus phase bursts, then re-forms.
        if (currentMode === "focus" && typeof window !== "undefined") {
          publishSceneComplete();
        }

        const durationSeconds = Math.floor(activeSecondsRef.current);
        const metrics =
          currentMode === "focus"
            ? finalizeSessionMetrics(durationSeconds)
            : null;

        const session: Session = {
          id: generateId(),
          mode: currentMode,
          completedAt: new Date().toISOString(),
          durationSeconds,
          focusScore: metrics?.focusScore ?? null,
          focusQuality: metrics?.focusQuality ?? null,
          focusTimeline: metrics?.focusTimeline ?? null,
          stabilityRating: metrics?.stabilityRating ?? null,
          sessionInsights: metrics?.sessionInsights ?? null,
        };
        onSessionCompleteRef.current?.(session);
        resetFocusMonitor();
      } else {
        resetFocusMonitor();
      }
      activeSecondsRef.current = 0;
      lastTickRef.current = null;

      let nextMode: TimerMode;
      if (currentMode === "focus") {
        let effectiveCompleted = completedRef.current;
        if (record) {
          effectiveCompleted = completedRef.current + 1;
          setCompletedFocusSessions(effectiveCompleted);
        }
        const isLongBreak =
          record &&
          effectiveCompleted > 0 &&
          effectiveCompleted % config.sessionsBeforeLongBreak === 0;
        nextMode = isLongBreak ? "longBreak" : "break";
      } else {
        nextMode = "focus";
      }

      const nextSeconds = getDuration(nextMode);
      setMode(nextMode);
      setSecondsLeft(nextSeconds);
      onModeChangeRef.current?.(nextMode);
      secondsLeftRef.current = nextSeconds;
      deadlineMsRef.current = Date.now() + nextSeconds * 1000;
      setStatus("running");
    },
    [config.sessionsBeforeLongBreak, getDuration]
  );

  // ── Guest-local snapshot (safeStorage). Written on transitions and at
  // most every 5 s while running; flushed on pagehide. Never throws.
  const writeGuestSnapshot = useCallback((force = false) => {
    const key = persistKeyRef.current;
    if (!key || typeof window === "undefined") return;
    const st = statusRef.current;
    if (st !== "running" && st !== "paused") return;
    const now = Date.now();
    if (!force && st === "running" && now - lastGuestSaveRef.current < 5000) return;
    lastGuestSaveRef.current = now;
    const snap = buildSnapshot({
      mode: modeRef.current,
      status: st,
      secondsLeft: secondsLeftRef.current,
      activeSeconds: activeSecondsRef.current,
      deadlineMs: deadlineMsRef.current,
      plannedSeconds: getDuration(modeRef.current),
      now,
    });
    if (snap) safeSetJson(key, snap);
  }, [getDuration]);

  useEffect(() => {
    // Persist transitions synchronously enough to survive a kill/refresh:
    // pauses always, running slices throttled (see writeGuestSnapshot).
    writeGuestSnapshot(statusRef.current === "paused");
  }, [mode, status, secondsLeft, writeGuestSnapshot]);

  useEffect(() => {
    const key = persistKeyRef.current;
    if (!key) return;
    const flush = () => writeGuestSnapshot(true);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [writeGuestSnapshot]);

  useEffect(() => {
    if (status !== "running") return;

    const worker = createTimerWorker();

    worker.start(() => {
      const now = Date.now();
      if (lastTickRef.current !== null) {
        const delta = (now - lastTickRef.current) / 1000;
        activeSecondsRef.current += delta;
        updateFocusSessionDuration(delta);
      }
      lastTickRef.current = now;

      const end = deadlineMsRef.current;
      if (end == null) return;

      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSecondsLeft((prev) => (prev !== left ? left : prev));

      // Mirror to reactive visuals at most once per second.
      if (now - lastScenePushRef.current > 1000) {
        lastScenePushRef.current = now;
        publishScene("running");
      }

      if (left <= 0 && !completingRef.current) {
        completingRef.current = true;
        queueMicrotask(() => advancePhase(true));
      }
    });

    return () => worker.destroy();
  }, [status, advancePhase, publishScene]);

  const toggle = useCallback(() => {
    if (status === "running") {
      const end = deadlineMsRef.current;
      if (end != null) {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        setSecondsLeft(left);
        secondsLeftRef.current = left;
      }
      clearDeadline();
      setStatus("paused");
      publishScene("paused");
      haptic("tap");
      return;
    }

    unlockAudio();
    armDeadline();
    setStatus("running");
    publishScene("running");
    haptic("select");
  }, [armDeadline, clearDeadline, publishScene, status]);

  const reset = useCallback(
    (keepMode = false) => {
      clearDeadline();
      completingRef.current = false;
      resetFocusMonitor();
      setStatus("idle");
      publishScene("idle");
      if (persistKeyRef.current) safeRemove(persistKeyRef.current);
      if (!keepMode) {
        setMode("focus");
        const s = getDuration("focus");
        setSecondsLeft(s);
        secondsLeftRef.current = s;
      } else {
        const s = getDuration(modeRef.current);
        setSecondsLeft(s);
        secondsLeftRef.current = s;
      }
      activeSecondsRef.current = 0;
      lastTickRef.current = null;
    },
    [clearDeadline, config.focusDuration, getDuration, publishScene]
  );

  const skipToNext = useCallback(() => {
    clearDeadline();
    completingRef.current = false;
    queueMicrotask(() => advancePhase(false));
  }, [advancePhase, clearDeadline]);

  const selectMode = useCallback(
    (next: TimerMode) => {
      if (status === "running") return;
      clearDeadline();
      completingRef.current = false;
      setMode(next);
      const s = getDuration(next);
      setSecondsLeft(s);
      secondsLeftRef.current = s;
      setStatus("idle");
    },
    [clearDeadline, getDuration, status]
  );

  const start = useCallback(() => {
    unlockAudio();
    armDeadline();
    setStatus("running");
  }, [armDeadline]);

  const pause = useCallback(() => {
    const end = deadlineMsRef.current;
    if (end != null) {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSecondsLeft(left);
      secondsLeftRef.current = left;
    }
    clearDeadline();
    setStatus("paused");
  }, [clearDeadline]);

  const pauseRef = useRef(pause);
  pauseRef.current = pause;

  // ── Single-leader enforcement. When this tab enters `running`, it races
  // for the browser-wide timer lock; a tab that loses stands back down to
  // `paused` (slice preserved) and surfaces `leaderBlocked` for the UI.
  // The lock auto-releases on tab close/crash — leaders can never go stale.
  //
  // Acquisition retries a few times first: lock release propagates
  // asynchronously, so a remount (or two tabs starting on the same tick)
  // can observe a stale denial. Only a sustained denial stands the timer
  // down — genuine second tabs still lose, just ~600 ms later.
  useEffect(() => {
    if (status !== "running" || options.enableLeader === false) return;
    let cancelled = false;
    let attempts = 0;
    const tryAcquire = () => {
      void acquireTimerLead().then((grant) => {
        if (cancelled) {
          grant.release();
          return;
        }
        if (!grant.acquired) {
          attempts += 1;
          if (attempts < 4) {
            window.setTimeout(() => {
              if (!cancelled) tryAcquire();
            }, 150);
            return;
          }
          setLeaderBlocked(true);
          pauseRef.current();
          return;
        }
        setLeaderBlocked(false);
        leadReleaseRef.current?.();
        leadReleaseRef.current = grant.release;
      });
    };
    tryAcquire();
    return () => {
      cancelled = true;
      leadReleaseRef.current?.();
      leadReleaseRef.current = null;
    };
  }, [status, options.enableLeader]);

  const totalSeconds = getDuration(mode);
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;

  const getSnapshot = useCallback(() => {
    return {
      mode: modeRef.current,
      status: statusRef.current,
      secondsLeft: secondsLeftRef.current,
      activeSeconds: activeSecondsRef.current,
    };
  }, []);

  const restoreFromSnapshot = useCallback(
    (snapshot: {
      mode: TimerMode;
      status: TimerStatus;
      secondsLeft: number;
      activeSeconds: number;
      plannedSeconds?: number;
    }) => {
      completingRef.current = false;
      // Adopt the restored phase length so `progress`/`totalSeconds` reflect
      // the session that was actually running, not the default preset.
      if (snapshot.plannedSeconds && snapshot.plannedSeconds > 0) {
        const planned = Math.floor(snapshot.plannedSeconds);
        setCustomConfigs((prev) => ({ ...prev, [`${snapshot.mode}Duration`]: planned }));
      }
      modeRef.current = snapshot.mode;
      statusRef.current = snapshot.status;
      secondsLeftRef.current = snapshot.secondsLeft;
      activeSecondsRef.current = snapshot.activeSeconds;
      setLeaderBlocked(false);

      setMode(snapshot.mode);
      setSecondsLeft(snapshot.secondsLeft);
      setStatus(snapshot.status);

      if (snapshot.status === "running") {
        deadlineMsRef.current = Date.now() + snapshot.secondsLeft * 1000;
        lastTickRef.current = Date.now();
      } else {
        deadlineMsRef.current = null;
        lastTickRef.current = null;
      }
    },
    []
  );

  const setCustomDuration = useCallback((m: TimerMode, seconds: number) => {
    setCustomConfigs((prev) => ({
      ...prev,
      [`${m}Duration`]: seconds,
    }));
    if (modeRef.current === m && status === "idle") {
      setSecondsLeft(seconds);
      secondsLeftRef.current = seconds;
    }
  }, [status]);

  return {
    mode,
    status,
    secondsLeft,
    totalSeconds,
    progress,
    completedFocusSessions,
    leaderBlocked,
    start,
    pause,
    toggle,
    reset,
    skipToNext,
    selectMode,
    setCustomDuration,
    getSnapshot,
    restoreFromSnapshot,
    getActiveSeconds: () => activeSecondsRef.current,
  };
}
