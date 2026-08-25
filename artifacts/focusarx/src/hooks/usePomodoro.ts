"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { generateId } from "@/lib/timerUtils";
import { haptic } from "@/lib/haptics";
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
}

export function usePomodoro(options: UsePomodoroOptions = {}) {
  const config: TimerConfig = { ...DEFAULT_CONFIG, ...options.config };

  const onSessionCompleteRef = useRef(options.onSessionComplete);
  const onModeChangeRef = useRef(options.onModeChange);

  const [mode, setMode] = useState<TimerMode>("focus");
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [customConfigs, setCustomConfigs] = useState<Partial<TimerConfig>>({});

  const getDuration = useCallback(
    (m: TimerMode) => {
      if (m === "focus") return customConfigs.focusDuration ?? config.focusDuration;
      if (m === "longBreak") return customConfigs.longBreakDuration ?? config.longBreakDuration;
      return customConfigs.breakDuration ?? config.breakDuration;
    },
    [config, customConfigs]
  );

  const [secondsLeft, setSecondsLeft] = useState(() => getDuration("focus"));
  const [completedFocusSessions, setCompletedFocusSessions] = useState(0);

  const modeRef = useRef(mode);
  const statusRef = useRef(status);
  const completedRef = useRef(completedFocusSessions);
  const secondsLeftRef = useRef(secondsLeft);
  const deadlineMsRef = useRef<number | null>(null);
  const completingRef = useRef(false);
  const activeSecondsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (status !== "running") return;

    const id = window.setInterval(() => {
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

      if (left <= 0 && !completingRef.current) {
        completingRef.current = true;
        queueMicrotask(() => advancePhase(true));
      }
    }, 200);

    return () => clearInterval(id);
  }, [status, advancePhase]);

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
      haptic("tap");
      return;
    }

    armDeadline();
    setStatus("running");
    haptic("select");
  }, [armDeadline, clearDeadline, status]);

  const reset = useCallback(
    (keepMode = false) => {
      clearDeadline();
      completingRef.current = false;
      resetFocusMonitor();
      setStatus("idle");
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
    [clearDeadline, config.focusDuration, getDuration]
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
    }) => {
      completingRef.current = false;
      modeRef.current = snapshot.mode;
      statusRef.current = snapshot.status;
      secondsLeftRef.current = snapshot.secondsLeft;
      activeSecondsRef.current = snapshot.activeSeconds;

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
