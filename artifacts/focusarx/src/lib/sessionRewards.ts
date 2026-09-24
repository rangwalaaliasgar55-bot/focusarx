/**
 * Session reward maths, mirrored on the client.
 *
 * This exists because the timer face used to *invent* its own formula:
 *
 *     const xpEarned = Math.floor(activeSecondsEarned / 60) * 20;
 *     const coinsEarned = Math.floor(activeSecondsEarned / 300) * 10;
 *
 * Twenty XP a minute, ten coins a block, forever. The server does not pay that.
 * `artifacts/api-server/src/lib/sessionRewards.ts` pays full rate only for the
 * first 120 minutes, then 75% (15 XP/min, 7 coins/block), adds a 50-coin bonus at
 * 25 full minutes, and applies 1.5× XP / 1.25× coins for Premium. So the "+20 XP"
 * that ticked up on the ring during a 3-hour marathon was **wrong by more than a
 * third of the total** — the number the user watches climb is not the number that
 * lands in their wallet, which is exactly the "fake logic" a timer like this
 * cannot afford: the whole product is a promise that the minutes count.
 *
 * The fix is not to invent a better estimate; it is to run the server's own
 * arithmetic in the browser. `src/lib/sessionRewards.test.ts` reads the server
 * file and fails if these constants or the taper diverge, so this copy cannot
 * quietly drift from the thing that actually pays out.
 *
 * Keep it pure — no DB, no React, no `Date` — so it stays trivially testable.
 */

export const XP_PER_MINUTE = 20;
export const COINS_PER_5MIN_BLOCK = 10;
/** First two hours pay full rate. */
export const FULL_REWARD_MINUTES = 120;
/** 75% beyond the two-hour mark. */
export const MARATHON_TAPER = 0.75;
/** Hard product cap on a single session. */
export const MAX_SESSION_MINUTES = 240;

export interface RewardBreakdown {
  xp: number;
  coins: number;
  /** Minutes that earned full-rate XP. */
  fullMinutes: number;
  /** Minutes that earned the 75% marathon rate. */
  taperedMinutes: number;
}

const taperRate = (base: number): number => base * MARATHON_TAPER;

/** Base (non-premium) rewards for `minutes` of focus. Mirrors the server. */
export function baseSessionRewards(minutes: number): RewardBreakdown {
  const m = Math.max(0, Math.floor(minutes));
  const fullMinutes = Math.min(m, FULL_REWARD_MINUTES);
  const taperedMinutes = m - fullMinutes;

  const xp = fullMinutes * XP_PER_MINUTE + Math.round(taperedMinutes * taperRate(XP_PER_MINUTE));
  const coins =
    Math.floor(fullMinutes / 5) * COINS_PER_5MIN_BLOCK +
    Math.floor(taperedMinutes / 5) * Math.floor(taperRate(COINS_PER_5MIN_BLOCK));

  return { xp, coins, fullMinutes, taperedMinutes };
}

export interface RewardInput {
  /** Focus minutes so far (or planned). Fractions are floored, as on the server. */
  minutes: number;
  /** Bailed before the planned duration — earns the small showed-up bonus. */
  completedEarly?: boolean;
  isPremium?: boolean;
}

/**
 * Rewards a session of this length will actually pay.
 *
 * The timer face shows this while the clock runs, so what it displays now is the
 * same figure the API returns when the session is submitted. The Double-XP drop
 * multiplier is deliberately *not* modelled: it is time-dependent and fetched
 * separately, and guessing it would put us back where we started.
 */
export function computeSessionRewards(input: RewardInput): RewardBreakdown {
  const m = Math.max(0, Math.floor(input.minutes));
  if (m < 1) return { xp: 0, coins: 0, fullMinutes: 0, taperedMinutes: 0 };

  const base = baseSessionRewards(m);
  let { xp, coins } = base;

  // Full 25-minute pomodoro bonus, then the showed-up bonus for early exits.
  if (m >= 25) coins += 50;
  if (input.completedEarly) coins += 10;

  if (input.isPremium) {
    xp = Math.round(xp * 1.5);
    coins = Math.round(coins * 1.25);
  }

  return { xp, coins, fullMinutes: base.fullMinutes, taperedMinutes: base.taperedMinutes };
}

/** Beyond the two-hour mark — drives the marathon nudge and the 75% warning. */
export function isMarathonMinutes(minutes: number): boolean {
  return Math.floor(minutes) > FULL_REWARD_MINUTES;
}
