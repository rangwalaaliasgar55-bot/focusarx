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
  /** Flowtime owns its own stopwatch persistence and active-session row. */
  enabled?: boolean;
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

/**
 * The last local checkpoint, if it is recent enough to still be meaningful.
 *
 * `writeLsBackup` ran on every autosave, on `visibilitychange` and on
 * `pagehide`, but nothing ever read it back: the backup was written on every
 * autosave and consulted on none, so it protected nothing. If the server row
 * cannot be reached — offline, or `/api/sessions/active` answering 5xx, which
 * `fetchActiveSession` swallows into `null` — the user was dropped onto a fresh
 * idle timer with a complete, timestamped record sitting in localStorage.
 *
 * This is the reader. It is deliberately the *fallback*, not the primary: the
 * server row stays authoritative (it carries `serverRemaining`/`serverElapsed`
 * corrections a local checkpoint cannot), and the same staleness window guards
 * the local copy so an ancient backup cannot resurrect a finished session.
 */
function readLsBackup(): (Record<string, unknown> & { _ts: number }) | null {
  try {
    const raw = localStorage.getItem(LS_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> & { _ts?: number };
    if (typeof parsed?._ts !== "number") return null;
    if (Date.now() - parsed._ts > SESSION_TTL_MS) return null;
    if (typeof parsed.timerStatus !== "string" || typeof parsed.mode !== "string") return null;
    if (parsed.timerStatus === "idle") return null;
    return parsed as Record<string, unknown> & { _ts: number };
  } catch {
    return null;
  }
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
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

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
    if (optionsRef.current.enabled === false) return false;
    const payload = buildSyncPayload();
    if (!payload) return false;
    writeLsBackup(payload);
    return syncActiveSession(payload);
  }, [buildSyncPayload]);

  const ensureActiveSession = useCallback(async () => {
    if (optionsRef.current.enabled === false) return null;
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
    if (optionsRef.current.enabled === false) return;
    await ensureActiveSession();
    void runSync();
  }, [ensureActiveSession, runSync]);

  const onPhaseCompleted = useCallback(async () => {
    dbSessionIdRef.current = null;
    clearLsBackup();
    if (optionsRef.current.enabled === false) return;
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
    if (optionsRef.current.enabled === false) {
      optionsRef.current.onRecoveryReady?.();
      return;
    }
    const fallback = window.setTimeout(() => {
      optionsRef.current.onRecoveryReady?.();
    }, 5000);
    return () => clearTimeout(fallback);
  }, [options.enabled]);

  useEffect(() => {
    if (options.enabled === false) {
      optionsRef.current.onRecoveryReady?.();
      return;
    }
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

        // No server row (or it was stale and abandoned): fall back to the last
        // local checkpoint rather than dropping the user on a fresh timer.
        // Runs outside `hasRestoredRef` deliberately — a failed server lookup
        // must not mark the session restored, so a later successful poll can
        // still take over — but it is itself idempotent.
        if (!hasRestoredRef.current) {
          const backup = readLsBackup();
          if (backup) {
            const secondsLeft = Number(backup.secondsLeft);
            const activeSeconds = Number(backup.activeSeconds);
            if (Number.isFinite(secondsLeft) && secondsLeft > 0) {
              hasRestoredRef.current = true;
              const timerStatus = (backup.timerStatus === "running"
                ? "running"
                : "paused") as TimerStatus;
              optionsRef.current.restoreTimer({
                mode: backup.mode as TimerMode,
                // A locally-backed run is restored paused. Its deadline was
                // stamped on a page that no longer exists, so letting it
                // auto-advance on a guessed wall clock would burn the user's
                // session; they resume deliberately.
                status: "paused",
                secondsLeft,
                activeSeconds: Number.isFinite(activeSeconds) ? activeSeconds : 0,
                plannedSeconds: Number(backup.plannedSeconds) || undefined,
              });
              optionsRef.current.onRecovered?.({
                monitorEnabled: backup.monitorEnabled === true,
                timerStatus,
              } as Parameters<NonNullable<typeof optionsRef.current.onRecovered>>[0]);
            }
          }
        }
      }

      if (!cancelled) optionsRef.current.onRecoveryReady?.();
    };

    void recover();
    return () => { cancelled = true; };
  }, [authStatus, options.enabled]);

  useEffect(() => {
    if (options.enabled === false) return;
    const id = window.setInterval(() => {
      if (!dbSessionIdRef.current) return;
      void runSync();
    }, AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [runSync, options.enabled]);

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
