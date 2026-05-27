"use client";
import { useAuth } from "@/lib/auth";


import { useCallback, useEffect, useRef } from "react";
import { getFocusQuality } from "@/lib/focusScoreEngine";
import {
  abandonActiveSession,
  createActiveSession,
  fetchActiveSession,
  syncActiveSession,
} from "@/lib/session-persistence-api";
import {
  getFocusStateLabel,
  getLiveFocusScore,
  getMonitorPersistenceSnapshot,
  restoreStudyMonitorFromPersistence,
} from "@/store/studyMonitorStore";
import type { PersistedActiveSession } from "@/types/session-persistence";
import type { TimerMode, TimerStatus } from "@/types/timer";

const AUTOSAVE_MS = 10_000;

export type PomodoroSnapshot = {
  mode: TimerMode;
  status: TimerStatus;
  secondsLeft: number;
  activeSeconds: number;
};

type UseSessionPersistenceOptions = {
  getTimerSnapshot: () => PomodoroSnapshot;
  restoreTimer: (snapshot: PomodoroSnapshot) => void;
  isMonitorEnabled: () => boolean;
  onRecovered?: (session: PersistedActiveSession) => void;
  onRecoveryReady?: () => void;
};

export function useSessionPersistence(options: UseSessionPersistenceOptions) {
  const { status: authStatus } = useAuth();
  const dbSessionIdRef = useRef<string | null>(null);
  const hasRestoredRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const getDbSessionId = useCallback(() => dbSessionIdRef.current, []);

  const buildSyncPayload = useCallback(() => {
    const sessionId = dbSessionIdRef.current;
    if (!sessionId) return null;

    const timer = optionsRef.current.getTimerSnapshot();
    const monitorEnabled = optionsRef.current.isMonitorEnabled();
    const monitor = getMonitorPersistenceSnapshot(monitorEnabled);
    const focusScore = getLiveFocusScore();
    const focusQuality =
      focusScore !== null ? getFocusQuality(focusScore) : null;

    return {
      sessionId,
      activeSeconds: Math.floor(timer.activeSeconds),
      secondsLeft: timer.secondsLeft,
      timerStatus: timer.status,
      mode: timer.mode,
      focusScore,
      focusQuality,
      focusState: getFocusStateLabel(),
      distractionCount: monitor.distractionCount,
      lastSeenFaceAt: monitor.lastSeenFaceAt,
      focusTimeline: monitor.focusTimeline,
      monitorEnabled,
    };
  }, []);

  const runSync = useCallback(async () => {
    const payload = buildSyncPayload();
    if (!payload) return false;
    return syncActiveSession(payload);
  }, [buildSyncPayload]);

  const ensureActiveSession = useCallback(async () => {
    if (dbSessionIdRef.current) return dbSessionIdRef.current;

    const timer = optionsRef.current.getTimerSnapshot();
    const row = await createActiveSession({
      mode: timer.mode,
      secondsLeft: timer.secondsLeft,
      timerStatus: timer.status,
      monitorEnabled: optionsRef.current.isMonitorEnabled(),
    });
    if (row) {
      dbSessionIdRef.current = row.id;
    }
    return dbSessionIdRef.current;
  }, []);

  const onTimerStarted = useCallback(async () => {
    await ensureActiveSession();
    void runSync();
  }, [ensureActiveSession, runSync]);

  const onPhaseCompleted = useCallback(async () => {
    dbSessionIdRef.current = null;
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const timer = optionsRef.current.getTimerSnapshot();
    if (timer.status === "running") {
      const row = await createActiveSession({
        mode: timer.mode,
        secondsLeft: timer.secondsLeft,
        timerStatus: timer.status,
        monitorEnabled: optionsRef.current.isMonitorEnabled(),
      });
      if (row) dbSessionIdRef.current = row.id;
    }
  }, []);

  const clearDbSession = useCallback(() => {
    dbSessionIdRef.current = null;
    void abandonActiveSession();
  }, []);

  useEffect(() => {
    const fallback = window.setTimeout(() => {
      optionsRef.current.onRecoveryReady?.();
    }, 5000);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (authStatus === "loading" || authStatus !== "authenticated") return;

    let cancelled = false;

    const recover = async () => {
      if (!hasRestoredRef.current) {
        const row = await fetchActiveSession();
        if (cancelled) return;

        if (row) {
          hasRestoredRef.current = true;
          dbSessionIdRef.current = row.id;
          const timerStatus = (row.timerStatus ?? "paused") as TimerStatus;
          const secondsLeft =
            row.secondsLeft ?? optionsRef.current.getTimerSnapshot().secondsLeft;

          optionsRef.current.restoreTimer({
            mode: row.mode as TimerMode,
            status: timerStatus,
            secondsLeft,
            activeSeconds: row.activeSeconds,
          });

          restoreStudyMonitorFromPersistence({
            activeSeconds: row.activeSeconds,
            distractionCount: row.distractionCount,
            lastSeenFaceAt: row.lastSeenFaceAt,
            focusTimeline: row.focusTimeline,
            monitorEnabled: row.monitorEnabled,
            scoringActive:
              row.focusTimeline.length > 0 || row.focusState === "focus",
          });

          optionsRef.current.onRecovered?.(row);
        }
      }

      if (!cancelled) optionsRef.current.onRecoveryReady?.();
    };

    void recover();
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!dbSessionIdRef.current) return;
      void runSync();
    }, AUTOSAVE_MS);

    return () => clearInterval(id);
  }, [runSync]);

  useEffect(() => {
    const flush = () => {
      if (!dbSessionIdRef.current) return;
      const payload = buildSyncPayload();
      if (!payload) return;
      const body = JSON.stringify(payload);
      void fetch("/api/sessions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(localStorage.getItem("focusarx-auth-token") ? { Authorization: `Bearer ${localStorage.getItem("focusarx-auth-token")}` } : {}) },
        body,
        keepalive: true,
      });
    };

    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [buildSyncPayload]);

  return {
    getDbSessionId,
    ensureActiveSession,
    onTimerStarted,
    onPhaseCompleted,
    clearDbSession,
    runSync,
  };
}
