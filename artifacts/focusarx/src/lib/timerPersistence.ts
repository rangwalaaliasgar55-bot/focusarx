/**
 * Guest-local timer persistence (Phase 5.3 TIMER fix).
 *
 * Authenticated sessions are recovered from the server
 * (`useSessionPersistence` → `GET /sessions/active`). Guests have no server
 * row, so a refresh, back-swipe, or browser close used to nuke the running
 * session — fatal for the Instagram funnel, which is ~100% first-session
 * guests on phones.
 *
 * This module is the guest counterpart: tiny, pure, unit-testable snapshot
 * helpers. The hook (`usePomodoro` with `persistKey`) writes a snapshot on
 * every meaningful transition; on mount it restores one when still valid.
 *
 * The snapshot stores the *deadline* (`deadlineMs`, wall-clock ms), not just
 * `secondsLeft`, so resume-after-close and resume-after-sleep both compute
 * the correct remaining time instead of restarting the slice.
 *
 * A snapshot never overwrites server state: server recovery (when authed)
 * arrives after mount and calls `restoreTimer` again, which wins.
 */

import type { TimerMode, TimerStatus } from "@/types/timer";

export const GUEST_SNAPSHOT_TTL_MS = 2 * 60 * 60 * 1000; // same as server SESSION_TTL_MS
const SNAPSHOT_VERSION = 1;

export interface TimerSnapshotV1 {
  v: 1;
  mode: TimerMode;
  /** Only `running` and `paused` are ever persisted; `idle` clears the snapshot. */
  status: Extract<TimerStatus, "running" | "paused">;
  secondsLeft: number;
  activeSeconds: number;
  /** Wall-clock deadline for `running` snapshots; null for `paused`. */
  deadlineMs: number | null;
  savedAt: number;
}

const VALID_MODES: ReadonlySet<string> = new Set(["focus", "break", "longBreak"]);

export function buildSnapshot(input: {
  mode: TimerMode;
  status: TimerStatus;
  secondsLeft: number;
  activeSeconds: number;
  deadlineMs: number | null;
  now?: number;
}): TimerSnapshotV1 | null {
  if (input.status !== "running" && input.status !== "paused") return null;
  if (!VALID_MODES.has(input.mode)) return null;
  const secondsLeft = Math.max(0, Math.floor(input.secondsLeft));
  if (!Number.isFinite(secondsLeft) || secondsLeft <= 0) return null;
  return {
    v: 1,
    mode: input.mode,
    status: input.status,
    secondsLeft,
    activeSeconds: Math.max(0, Math.floor(input.activeSeconds)),
    deadlineMs: input.status === "running" ? input.deadlineMs : null,
    savedAt: input.now ?? Date.now(),
  };
}

/** Validate + revive a raw snapshot. Returns null when missing, corrupt, stale, or expired. */
export function readSnapshot(raw: unknown, now: number = Date.now()): TimerSnapshotV1 | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Partial<TimerSnapshotV1>;
  if (s.v !== SNAPSHOT_VERSION) return null;
  if (!VALID_MODES.has(String(s.mode))) return null;
  if (s.status !== "running" && s.status !== "paused") return null;
  if (typeof s.savedAt !== "number" || !Number.isFinite(s.savedAt)) return null;
  if (now - s.savedAt > GUEST_SNAPSHOT_TTL_MS) return null;

  const secondsLeft = Math.floor(Number(s.secondsLeft));
  if (!Number.isFinite(secondsLeft) || secondsLeft <= 0) return null;
  const activeSeconds = Math.max(0, Math.floor(Number(s.activeSeconds) || 0));

  if (s.status === "running") {
    // Deadline missing (older writer) → fall back to saved slice; still valid.
    const deadlineMs =
      typeof s.deadlineMs === "number" && Number.isFinite(s.deadlineMs)
        ? s.deadlineMs
        : s.savedAt + secondsLeft * 1000;
    const remaining = Math.ceil((deadlineMs - now) / 1000);
    // The session ended while we were away: nothing to resume.
    if (remaining <= 0) return null;
    return {
      v: 1,
      mode: s.mode as TimerMode,
      status: "running",
      secondsLeft: remaining,
      activeSeconds,
      deadlineMs,
      savedAt: s.savedAt,
    };
  }

  return {
    v: 1,
    mode: s.mode as TimerMode,
    status: "paused",
    secondsLeft,
    activeSeconds,
    deadlineMs: null,
    savedAt: s.savedAt,
  };
}
