/**
 * Session-completion decision core — pure, dependency-free, unit-testable.
 *
 * Trust model (server-authoritative):
 *  - The only server-owned evidence of a focus session is the `active_sessions`
 *    row created when the user started the timer: its `startedAt` (server
 *    clock) bounds how long the session can physically have been.
 *  - Client fields (`durationSec`, synced `activeSeconds`) are *claims*. They
 *    may lower the verified duration, never raise it above wall-clock.
 *  - A completion with no matching active-session evidence is still recorded
 *    (history/offline recovery), but it is never reward-eligible. This closes
 *    the farming vector where `POST /api/sessions` could be scripted with
 *    arbitrarily large `durationSec` values and fresh nonces.
 */

export const MAX_VERIFIED_SESSION_SEC = 14_400;
/** Small grace for a final tick/network delay between checkpoint and request. */
export const ACTIVE_CHECKPOINT_GRACE_SEC = 15;
/** @deprecated Alias retained for existing callers/tests that used the old export name. */
export const WALL_CLOCK_GRACE_SEC = ACTIVE_CHECKPOINT_GRACE_SEC;
/** Focus sessions shorter than this never pay rewards. */
export const MIN_REWARD_DURATION_SEC = 60;

export type SessionMode = "focus" | "short_break" | "long_break";
export type SessionStatus = "completed" | "completed_early" | "cancelled";

export interface VerifiedDurationInput {
  /** Client-claimed focus seconds (already schema-validated 0..86400). */
  claimedDurationSec: number;
  /** Whether a matching server-side active_sessions row existed. */
  hasActiveSession: boolean;
  /** Legacy wall-clock value retained for older callers. */
  wallClockSeconds?: number;
  /** Server-derived active time from the latest checkpoint. */
  serverActiveSeconds?: number;
}

/**
 * Verified duration for a completion request.
 *
 * With an active session: min(claim, wall clock + grace, cap) — the wall clock
 * is the real bound; the claim can only reduce it (pauses legitimately reduce
 * focused time).
 * Without one: the claim is stored but capped; the completion is not
 * reward-eligible (see {@link isRewardEligible}).
 */
export function computeVerifiedDurationSec(input: VerifiedDurationInput): number {
  const claimed = Math.min(
    MAX_VERIFIED_SESSION_SEC,
    Math.max(0, Math.floor(input.claimedDurationSec)),
  );
  if (!input.hasActiveSession) return claimed;

  const serverActiveSeconds = Math.min(
    MAX_VERIFIED_SESSION_SEC,
    Math.max(0, Math.floor(input.serverActiveSeconds ?? input.wallClockSeconds ?? 0)),
  );
  const verifiedActiveWindow = Math.min(
    MAX_VERIFIED_SESSION_SEC,
    serverActiveSeconds + ACTIVE_CHECKPOINT_GRACE_SEC,
  );
  return Math.min(claimed, verifiedActiveWindow);
}

export interface RewardEligibilityInput {
  mode: SessionMode;
  sessionStatus: SessionStatus;
  verifiedDurationSec: number;
  /** Reward-eligible completions require server-side active-session evidence. */
  hasActiveSession: boolean;
}

/**
 * Only genuine, server-evidenced focus sessions earn XP/coins.
 * Breaks are informational; cancelled sessions earn nothing; sub-minute
 * sessions earn nothing; claimed-but-unevidenced sessions earn nothing.
 */
export function isRewardEligible(input: RewardEligibilityInput): boolean {
  return (
    input.mode === "focus" &&
    input.sessionStatus !== "cancelled" &&
    input.hasActiveSession &&
    input.verifiedDurationSec >= MIN_REWARD_DURATION_SEC
  );
}

export interface StreakInput {
  lastStudyDate: string | null; // YYYY-MM-DD (IST day key)
  currentStreak: number;
  longestStreak: number;
  today: string;
  yesterday: string;
}

export interface StreakResult {
  /** False when a session was already counted for `today` (repeat completion). */
  changed: boolean;
  currentStreak: number;
  longestStreak: number;
}

/** Pure streak progression on calendar-day keys. */
export function nextStreakValues(input: StreakInput): StreakResult {
  if (input.lastStudyDate === input.today) {
    return {
      changed: false,
      currentStreak: input.currentStreak,
      longestStreak: input.longestStreak,
    };
  }
  const current = input.lastStudyDate === input.yesterday ? input.currentStreak + 1 : 1;
  return {
    changed: true,
    currentStreak: current,
    longestStreak: Math.max(input.longestStreak, current),
  };
}

/**
 * Weekly-XP window start: Monday 00:00 IST, as a Date (UTC instant).
 * Matches the product's IST-first day semantics (see lib/istDate.ts) — the
 * previous server-local boundary made the reset time deployment-zone-dependent.
 */
export function istWeekStartDate(now: Date = new Date()): Date {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istDay = istNow.getUTCDay(); // 0=Sun..6=Sat (evaluated in the shifted day)
  const daysSinceMonday = (istDay + 6) % 7;
  const istMonday = new Date(istNow.getTime() - daysSinceMonday * 86_400_000);
  istMonday.setUTCHours(0, 0, 0, 0);
  return new Date(istMonday.getTime() - IST_OFFSET_MS);
}
