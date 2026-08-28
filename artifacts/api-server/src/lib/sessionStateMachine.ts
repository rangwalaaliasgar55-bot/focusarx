/**
 * Focus-session state machine (§4 of the production-readiness plan) —
 * server-authoritative, pure, unit-testable.
 *
 * States:
 *   idle       — a row exists but the timer never started
 *   active     — timer running (row.timerStatus = "running")
 *   paused     — timer paused
 *   completed  — terminal (focus_sessions.session_status)
 *   cancelled  — terminal (focus_sessions.session_status)
 *   expired    — terminal (server discovered the session was abandoned)
 *
 * Transitions (the ONLY allowed ones):
 *   idle → active
 *   active → paused | completed | cancelled | expired
 *   paused → active | completed | cancelled | expired
 *   completed | cancelled | expired → (terminal)
 *
 * Expiry semantics (server clock only):
 *   - "running" sessions expire once wall clock exceeds the stored
 *     secondsLeft + grace: the timer must have reached zero, so the session is
 *     auto-COMPLETED with duration = secondsLeft (evidence is server-owned).
 *   - "paused"/"idle" sessions cannot expire by timer (pause freezes time);
 *     they are archived as "expired" (no rewards) after the absolute TTL.
 */

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
  secondsLeft: number;
  activeSeconds?: number | null;
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
  const wallClockSec = Math.max(0, Math.floor((nowMs - session.startedAt.getTime()) / 1000));

  if (session.timerStatus === "running") {
    const deadlineSec = Math.max(0, session.secondsLeft) + EXPIRY_GRACE_SEC;
    if (wallClockSec <= deadlineSec) {
      return { state: "active", expired: false };
    }
    // Timer must have hit zero. Focus time is bounded by the server-stored
    // secondsLeft; wall clock can only have overrun it.
    return {
      state: "expired",
      expired: true,
      wasRunning: true,
      maxFocusSec: Math.max(0, Math.min(session.secondsLeft, wallClockSec)),
    };
  }

  // paused / idle: pause freezes time; only the absolute TTL applies.
  if (wallClockSec * 1000 <= PAUSED_SESSION_TTL_MS) {
    const state = stateFromTimerStatus(session.timerStatus);
    return { state: state === "paused" ? "paused" : "idle", expired: false };
  }
  return {
    state: "expired",
    expired: true,
    wasRunning: false,
    maxFocusSec: Math.max(0, Math.min(session.activeSeconds ?? 0, session.secondsLeft, wallClockSec)),
  };
}
