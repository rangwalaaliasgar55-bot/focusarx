/**
 * The learner's weekly minutes target.
 *
 * The number belongs to the person, not the account, so it lives in
 * localStorage: it exists before the first request lands and a failed fetch
 * cannot lose it. The arithmetic lives here rather than inside the card that
 * renders it, because "62% of your target" is a claim about a number and claims
 * get asserted in tests.
 *
 * Bounds are enforced on read *and* write. A stored value that drifted out of
 * range — hand-edited storage, an aborted write, a future schema — is treated
 * as absent rather than rendered as a target the user never chose.
 */

import { safeGet, safeSet } from "@/lib/safeStorage";

export const WEEKLY_GOAL_KEY = "focusarx-weekly-goal-min";

/** 300 min ≈ 12 pomodoros: a week that is reachable without being a treadmill. */
export const DEFAULT_WEEKLY_GOAL_MIN = 300;
export const MIN_WEEKLY_GOAL_MIN = 30;
export const MAX_WEEKLY_GOAL_MIN = 6000;

export function isWeeklyGoalMin(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_WEEKLY_GOAL_MIN && value <= MAX_WEEKLY_GOAL_MIN;
}

/** The stored target, or the default when nothing usable is stored. */
export function weeklyGoalMin(): number {
  const raw = Number.parseInt(safeGet(WEEKLY_GOAL_KEY) ?? "", 10);
  return isWeeklyGoalMin(raw) ? raw : DEFAULT_WEEKLY_GOAL_MIN;
}

/**
 * Persist a target.
 *
 * Returns `true` only when the value reached localStorage. `false` means the
 * browser refused (private mode, quota) and the value is being held in memory
 * for this visit only — the caller has to say so rather than claim success.
 */
export function saveWeeklyGoal(value: number): boolean {
  if (!isWeeklyGoalMin(value)) return false;
  return safeSet(WEEKLY_GOAL_KEY, String(value));
}

export type WeeklyGoalProgress = {
  goal: number;
  minutes: number;
  /** 0–100, clamped for the bar. */
  percent: number;
  /** Whole minutes still owed; 0 once the target is met. */
  remaining: number;
  /** Whole minutes past the target; 0 until it is met. */
  surplus: number;
  done: boolean;
};

/**
 * Progress towards a target.
 *
 * Every input is defended: a missing weekly total arrives as `undefined`, and
 * `Math.max(undefined - goal, 0)` would render "NaN minutes to go". An unknown
 * total counts as zero minutes rather than an unknown, because the chart and
 * the sentence have to agree on a number.
 */
export function weeklyGoalProgress(minutes: number, goal: number): WeeklyGoalProgress {
  const target = isWeeklyGoalMin(goal) ? goal : DEFAULT_WEEKLY_GOAL_MIN;
  const done = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  const percent = target > 0 ? Math.min(100, Math.max(0, Math.round((done / target) * 100))) : 0;
  return {
    goal: target,
    minutes: done,
    percent,
    remaining: Math.max(0, Math.ceil(target - done)),
    surplus: Math.max(0, Math.floor(done - target)),
    done: done >= target,
  };
}

/** One sentence for the card: what is protected, and how far the target is. */
export function weeklyGoalSentence(progress: WeeklyGoalProgress): string {
  const minutes = `${progress.minutes.toLocaleString()} of ${progress.goal.toLocaleString()} min protected`;
  if (progress.done) {
    return progress.surplus > 0
      ? `Target hit — ${minutes}, ${progress.surplus.toLocaleString()} past it.`
      : `Target hit — ${minutes}.`;
  }
  return `${minutes} — ${progress.remaining.toLocaleString()} to go.`;
}
