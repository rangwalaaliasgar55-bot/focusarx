import { useAuth } from "@/lib/auth";
import { deviceTimeZone } from "@/lib/safeStorage";

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
const LS_BACKUP_KEY = "focusarx-active-session-backup";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export type PomodoroSnapshot = {
  mode: TimerMode;
  status: TimerStatus;
  secondsLeft: number;
  activeSeconds: number;
  /** Original phase length; lets the UI rebuild progress after a restore. */
  plannedSeconds?: number;
};

type UseSessionPersistenceOptions = {
  getTimerSnapshot: () => PomodoroSnapshot;
  restoreTimer: (snapshot: PomodoroSnapshot) => void;
  isMonitorEnabled: () => boolean;
  onRecovered?: (session: PersistedActiveSession) => void;
  onRecoveryReady?: () => void;
};

function writeLsBackup(payload: object) {
  try {
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify({ ...payload, _ts: Date.now() }));
  } catch {}
}

function clearLsBackup() {
  try { localStorage.removeItem(LS_BACKUP_KEY); } catch {}
}

function isSessionStale(updatedAt?: string | null): boolean {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() > SESSION_TTL_MS;
}

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
    // Keeps the server-side calendar zone fresh while travelling.
    const tz = deviceTimeZone();

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
      ...(tz ? { timezone: tz } : {}),
    };
  }, []);

  const runSync = useCallback(async () => {
    const payload = buildSyncPayload();
    if (!payload) return false;
    writeLsBackup(payload);
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
    clearLsBackup();
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
    clearLsBackup();
    void abandonActiveSession();
  }, []);

  useEffect(() => {
    const fallback = window.setTimeout(() => {
      optionsRef.current.onRecoveryReady?.();
    }, 5000);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus !== "authenticated") {
      // Guests have no server row: nothing to recover, so do not hold the
      // timer behind the 5 s fallback skeleton.
      optionsRef.current.onRecoveryReady?.();
      return;
    }

    let cancelled = false;

    const recover = async () => {
      if (!hasRestoredRef.current) {
        const row = await fetchActiveSession();
        if (cancelled) return;

        if (row) {
          const rowWithTs = row as typeof row & { updatedAt?: string };
          if (isSessionStale(rowWithTs.updatedAt)) {
            void abandonActiveSession();
          } else {
            hasRestoredRef.current = true;
            dbSessionIdRef.current = row.id;
            const timerStatus = (row.timerStatus ?? "paused") as TimerStatus;
            // Prefer the server's pause-aware numbers: `secondsLeft` is only
            // the last checkpoint, so a running session restored after a
            // phone lock would otherwise regain the time that already passed.
            const secondsLeft =
              row.serverRemaining ??
              row.secondsLeft ??
              optionsRef.current.getTimerSnapshot().secondsLeft;
            const activeSeconds = row.serverElapsed ?? row.activeSeconds;
            const plannedSeconds =
              row.serverPlannedSeconds ?? Math.max(secondsLeft, activeSeconds + secondsLeft);

            if (secondsLeft <= 0 && timerStatus === "running") {
              // Finished while we were away — nothing sensible to resume.
              void abandonActiveSession();
            } else {
              optionsRef.current.restoreTimer({
                mode: row.mode as TimerMode,
                status: timerStatus,
                secondsLeft,
                activeSeconds,
                plannedSeconds,
              });
            }

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
      }

      if (!cancelled) optionsRef.current.onRecoveryReady?.();
    };

    void recover();
    return () => { cancelled = true; };
  }, [authStatus]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!dbSessionIdRef.current) return;
      void runSync();
    }, AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [runSync]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && dbSessionIdRef.current) {
        void runSync();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [runSync]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const snapshot = optionsRef.current.getTimerSnapshot();
      if (snapshot.status === "running" && snapshot.activeSeconds > 30) {
        e.preventDefault();
        e.returnValue = "You have a focus session in progress. Your progress will be saved.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    const flush = () => {
      if (!dbSessionIdRef.current) return;
      const payload = buildSyncPayload();
      if (!payload) return;
      writeLsBackup(payload);
      const body = JSON.stringify(payload);
      const token = localStorage.getItem("focusarx-auth-token");
      void fetch("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
