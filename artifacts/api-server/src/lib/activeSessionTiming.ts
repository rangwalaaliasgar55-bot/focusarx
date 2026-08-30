/**
 * Server-owned active-session timing.
 *
 * `startedAt` is the lifetime of the database row, not a running stopwatch:
 * a user can pause, return later, and resume the same row. The only safe
 * running interval that has not been checkpointed into `activeSeconds` is the
 * interval after the most recent server update while that checkpoint says the
 * timer is running. Keeping that rule in one pure module prevents recovery,
 * expiry, sync, and completion from drifting apart.
 */

export const MAX_ACTIVE_SESSION_SECONDS = 14_400;

export type ActiveSessionTimingShape = {
  timerStatus: string;
  startedAt: Date;
  updatedAt?: Date | null;
  activeSeconds?: number | null;
  secondsLeft: number;
  /** New rows store their original phase duration; old rows may omit it. */
  plannedDurationSec?: number | null;
};

export type ActiveSessionSyncUpdate = {
  activeSeconds?: number;
  secondsLeft?: number;
  timerStatus?: "running" | "paused" | "idle";
};

export type ActiveSessionTiming = {
  /** Timestamp of the server checkpoint used for the running interval. */
  checkpointAtMs: number;
  /** Values stored at that checkpoint, after defensive bounds checks. */
  checkpointActiveSeconds: number;
  checkpointRemainingSeconds: number;
  /** Running time since that checkpoint; zero for paused/idle snapshots. */
  uncheckpointedRunningSeconds: number;
  /** Cumulative server-derived active time at `nowMs`. */
  activeSeconds: number;
  /** Server-derived remaining countdown time at `nowMs`. */
  remainingSeconds: number;
  /** The maximum duration represented by the current checkpoint. */
  plannedDurationSeconds: number;
};

function boundedInteger(value: unknown, maximum = MAX_ACTIVE_SESSION_SECONDS): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.floor(value)));
}

function validTimestamp(value: Date | null | undefined): number | null {
  if (!(value instanceof Date)) return null;
  const milliseconds = value.getTime();
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

/**
 * `updatedAt` is the last accepted status/clock checkpoint. Very old rows
 * created before that column existed fall back to `startedAt`; future dates
 * deliberately produce zero elapsed time instead of granting time from a
 * device/server clock anomaly.
 */
export function activeSessionCheckpointAt(session: ActiveSessionTimingShape, nowMs = Date.now()): number {
  const candidate = validTimestamp(session.updatedAt) ?? validTimestamp(session.startedAt) ?? nowMs;
  return Math.min(nowMs, candidate);
}

/** Raw wall time after the checkpoint; callers use this for expiry grace. */
export function secondsSinceActiveSessionCheckpoint(
  session: ActiveSessionTimingShape,
  nowMs = Date.now(),
): number {
  return Math.max(0, Math.floor((nowMs - activeSessionCheckpointAt(session, nowMs)) / 1_000));
}

export function deriveActiveSessionTiming(
  session: ActiveSessionTimingShape,
  nowMs = Date.now(),
): ActiveSessionTiming {
  const rawActive = boundedInteger(session.activeSeconds);
  const rawRemaining = boundedInteger(session.secondsLeft);
  // A valid timer never exceeds four hours. New rows retain their original
  // plan; old rows fall back to their checkpoint sum for backwards
  // compatibility until migration 0014 has run.
  const configuredPlan = boundedInteger(session.plannedDurationSec);
  const plannedDurationSeconds = configuredPlan > 0
    ? configuredPlan
    : Math.min(MAX_ACTIVE_SESSION_SECONDS, rawActive + rawRemaining);
  const storedActive = Math.min(rawActive, plannedDurationSeconds);
  const storedRemaining = Math.min(rawRemaining, Math.max(0, plannedDurationSeconds - storedActive));
  const checkpointAtMs = activeSessionCheckpointAt(session, nowMs);
  const elapsedSinceCheckpoint = secondsSinceActiveSessionCheckpoint(session, nowMs);
  const uncheckpointedRunningSeconds = session.timerStatus === "running"
    ? Math.min(elapsedSinceCheckpoint, storedRemaining)
    : 0;

  return {
    checkpointAtMs,
    checkpointActiveSeconds: storedActive,
    checkpointRemainingSeconds: storedRemaining,
    uncheckpointedRunningSeconds,
    activeSeconds: Math.min(plannedDurationSeconds, storedActive + uncheckpointedRunningSeconds),
    remainingSeconds: Math.max(0, storedRemaining - uncheckpointedRunningSeconds),
    plannedDurationSeconds,
  };
}

/**
 * Reconcile a client sync into a new server checkpoint without letting the
 * client add time. A running checkpoint advances only on the server clock.
 * On a running → paused transition, a lower client-active value is allowed so
 * request latency after the tap does not charge paused wall time. The client
 * can only reduce a session, never extend it or increase verified focus.
 */
export type ReconciledActiveSessionCheckpoint = {
  activeSeconds: number;
  secondsLeft: number;
  timerStatus: "running" | "paused" | "idle";
};

export function reconcileActiveSessionSync(
  session: ActiveSessionTimingShape,
  update: ActiveSessionSyncUpdate,
  nowMs = Date.now(),
): ReconciledActiveSessionCheckpoint {
  const timing = deriveActiveSessionTiming(session, nowMs);
  const storedActive = timing.checkpointActiveSeconds;
  const storedRemaining = timing.checkpointRemainingSeconds;
  const nextStatus: "running" | "paused" | "idle" = update.timerStatus ?? (
    session.timerStatus === "running" || session.timerStatus === "paused" ? session.timerStatus : "idle"
  );

  // Once a row was running, the server owns its advancing clock. A pause is
  // special: the request may arrive after the user pressed pause, so accept a
  // lower (but never lower than the last checkpoint) active counter and derive
  // the matching remaining value from the original plan.
  if (session.timerStatus === "running" && nextStatus !== "running") {
    const reportedActive = update.activeSeconds === undefined
      ? timing.activeSeconds
      : boundedInteger(update.activeSeconds, timing.activeSeconds);
    const nextActive = Math.max(storedActive, Math.min(reportedActive, timing.activeSeconds));
    const maximumRemainingForPlan = Math.max(0, timing.plannedDurationSeconds - nextActive);
    const reportedRemaining = update.secondsLeft === undefined
      ? maximumRemainingForPlan
      : boundedInteger(update.secondsLeft, maximumRemainingForPlan);
    return {
      activeSeconds: nextActive,
      secondsLeft: Math.min(maximumRemainingForPlan, reportedRemaining),
      timerStatus: nextStatus,
    };
  }

  if (session.timerStatus === "running") {
    return {
      activeSeconds: timing.activeSeconds,
      secondsLeft: timing.remainingSeconds,
      timerStatus: nextStatus,
    };
  }

  // A paused/idle row has no server-evidenced running interval. A request
  // changing it to running establishes a new checkpoint *now*; claims made
  // while the server knew it was paused cannot be converted into rewards.
  return {
    activeSeconds: storedActive,
    secondsLeft: storedRemaining,
    timerStatus: nextStatus,
  };
}
