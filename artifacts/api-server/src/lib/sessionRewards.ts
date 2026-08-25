/**
 * Session reward math (Workstream H — Focus Timer v2).
 *
 * Long-session discipline: focus earns 20 XP/min for the first two hours;
 * every minute beyond 120 earns 75% (15 XP/min) so marathon sessions still
 * pay but never out-scale their cost. Coins follow the same taper.
 *
 * Pure functions — no DB, no Date — so the rule is fully unit-testable.
 */

export const XP_PER_MINUTE = 20;
export const COINS_PER_5MIN_BLOCK = 10;
export const FULL_REWARD_MINUTES = 120; // first 2h pay full
export const MARATHON_TAPER = 0.75; // 75% beyond the 2h mark
export const MAX_SESSION_MINUTES = 240; // hard product cap (180 → 240)

export interface RewardInput {
  /** Verified focus minutes (server-bounded). */
  minutes: number;
  /** User bailed before the planned duration. */
  completedEarly?: boolean;
  /** Premium subscriber multipliers (1.5x XP / 1.25x coins). */
  isPremium?: boolean;
}

export interface RewardBreakdown {
  xp: number;
  coins: number;
  /** Minutes that earned full-rate XP. */
  fullMinutes: number;
  /** Minutes that earned the 75% marathon rate. */
  taperedMinutes: number;
}

const taperRate = (base: number): number => base * MARATHON_TAPER;

/**
 * Base (non-premium) rewards for a focus session of `minutes`.
 *
 * XP:    20/min for the first 120 min, 15/min after.
 * Coins: 10 per full 5-min block — full rate inside the first 2h,
 *        75% (7/block, floored) beyond it.
 */
export function baseSessionRewards(minutes: number): RewardBreakdown {
  const m = Math.max(0, Math.floor(minutes));
  const fullMinutes = Math.min(m, FULL_REWARD_MINUTES);
  const taperedMinutes = m - fullMinutes;

  const xp =
    fullMinutes * XP_PER_MINUTE +
    Math.round(taperedMinutes * taperRate(XP_PER_MINUTE));

  const fullBlocks = Math.floor(fullMinutes / 5);
  const taperedBlocks = Math.floor(taperedMinutes / 5);
  const coins =
    fullBlocks * COINS_PER_5MIN_BLOCK +
    taperedBlocks * Math.floor(taperRate(COINS_PER_5MIN_BLOCK));

  return { xp, coins, fullMinutes, taperedMinutes };
}

/**
 * Final rewards for a focus session, including the premium multipliers,
 * the 25-min pomodoro bonus and the small "you still showed up" bonus.
 * (The Double-XP drop multiplier is applied by the caller, since it is
 * time-dependent and fetched separately.)
 */
export function computeSessionRewards(input: RewardInput): RewardBreakdown {
  const m = Math.max(0, Math.floor(input.minutes));
  if (m < 1) return { xp: 0, coins: 0, fullMinutes: 0, taperedMinutes: 0 };

  const base = baseSessionRewards(m);
  let { xp, coins } = base;

  // Full 25-min pomodoro bonus (existing behaviour, preserved).
  if (m >= 25) coins += 50;
  // Showed-up bonus (existing behaviour, preserved).
  if (input.completedEarly) coins += 10;

  if (input.isPremium) {
    xp = Math.round(xp * 1.5);
    coins = Math.round(coins * 1.25);
  }

  return { xp, coins, fullMinutes: base.fullMinutes, taperedMinutes: base.taperedMinutes };
}

/** Is this a "marathon" session (beyond the 2h mark)? Drives UI nudges/pulse. */
export function isMarathonMinutes(minutes: number): boolean {
  return Math.floor(minutes) > FULL_REWARD_MINUTES;
}

/** Client-side cap in minutes for custom durations (180 → 240). */
export const MAX_CUSTOM_MINUTES = MAX_SESSION_MINUTES;
