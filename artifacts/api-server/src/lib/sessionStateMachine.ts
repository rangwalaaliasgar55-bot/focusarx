/**
 * Focus-session lifecycle — server-authoritative and pure.
 *
 * A database row can span pauses.  Its `updatedAt` timestamp is therefore the
 * last status/clock checkpoint, while `startedAt` is only the row's creation
 * time.  Running expiry is calculated from that checkpoint, never from total
 * row lifetime, so resuming after a pause cannot consume the paused interval.
 */

import {
  deriveActiveSessionTiming,
  secondsSinceActiveSessionCheckpoint,
} from "./activeSessionTiming";

export type SessionState =
  | "idle"
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "expired";

export const SESSION_STATES = [
  "idle",
  "active",
  "paused",
  "completed",
  "cancelled",
  "expired",
] as const;

export const ALLOWED_TRANSITIONS: Readonly<Record<SessionState, readonly SessionState[]>> = {
  idle: ["active"],
  active: ["paused", "completed", "cancelled", "expired"],
  paused: ["active", "completed", "cancelled", "expired"],
  completed: [],
  cancelled: [],
  expired: [],
};

export function canTransition(from: SessionState, to: SessionState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Map an active_sessions row's timerStatus to a state-machine state. */
export function stateFromTimerStatus(timerStatus: string): SessionState {
  if (timerStatus === "running") return "active";
  if (timerStatus === "paused") return "paused";
  return "idle";
}

/** Grace for completion requests already in flight when the deadline passes. */
export const EXPIRY_GRACE_SEC = 30;
/** Absolute TTL for paused/idle active rows — matches the client's 2h LS backup TTL. */
export const PAUSED_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export interface ActiveSessionShape {
  timerStatus: string;
  startedAt: Date;
  updatedAt?: Date | null;
  secondsLeft: number;
  activeSeconds?: number | null;
  plannedDurationSec?: number | null;
}

export type SessionEvaluation =
  | { state: "active" | "paused" | "idle"; expired: false }
  | {
      state: "expired";
      expired: true;
      /** true when it was running past its deadline → auto-complete is legitimate. */
      wasRunning: boolean;
      /** Max server-verifiable focus seconds for the archived session. */
      maxFocusSec: number;
    };

/**
 * Evaluate an active session against the server clock.
 * Pure — no DB, no Date.now() — so every expiry edge case is unit-testable.
 */
export function evaluateActiveSession(
  session: ActiveSessionShape,
  nowMs: number,
): SessionEvaluation {
  const timing = deriveActiveSessionTiming(session, nowMs);

  if (session.timerStatus === "running") {
    const runningSinceCheckpoint = secondsSinceActiveSessionCheckpoint(session, nowMs);
    const deadlineSec = timing.checkpointRemainingSeconds + EXPIRY_GRACE_SEC;
    if (runningSinceCheckpoint <= deadlineSec) {
      return { state: "active", expired: false };
    }
    return {
      state: "expired",
      expired: true,
      wasRunning: true,
      maxFocusSec: timing.plannedDurationSeconds,
    };
  }

  // Paused/idle: the countdown freezes. A recently-paused long session must
  // not expire merely because `startedAt` predates the pause by two hours.
  const idleForMs = Math.max(0, nowMs - timing.checkpointAtMs);
  if (idleForMs <= PAUSED_SESSION_TTL_MS) {
    const state = stateFromTimerStatus(session.timerStatus);
    return { state: state === "paused" ? "paused" : "idle", expired: false };
  }

  const wallClockSec = Math.max(0, Math.floor((nowMs - timing.checkpointAtMs) / 1000));
  return {
    state: "expired",
    expired: true,
    wasRunning: false,
    maxFocusSec: Math.max(0, Math.min(session.activeSeconds ?? 0, session.secondsLeft, wallClockSec)),
  };
}
