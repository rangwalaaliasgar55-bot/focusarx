import { computeSessionRewards } from "@/lib/sessionRewards";

/**
 * "N to go" is a number, not a plan.
 *
 * Every progress surface in the app told the student how far away the next thing
 * was in the *unit the server counts* — "37 totalMinutes to go", "850 coins".
 * Neither answers the only question that matters at a wall: what do I actually
 * do next? These helpers translate a gap into sessions of work, and sessions are
 * the unit a student thinks in.
 *
 * The conversion is the real one (`lib/sessionRewards`, drift-tested against the
 * server), not a marketing estimate: a 25-minute block pays 500 XP and 100
 * coins, so "wants 900 coins" honestly reads "about 9 blocks away".
 */

export const NOMINAL_SESSION_MINUTES = 25;

/** Rewards for one standard 25-minute block. */
export function perSessionRewards(isPremium = false) {
  return computeSessionRewards({ minutes: NOMINAL_SESSION_MINUTES, isPremium });
}

/** How many 25-minute blocks a coin gap is worth. */
export function sessionsForCoins(coins: number, isPremium = false): number {
  const per = perSessionRewards(isPremium).coins;
  return Math.max(1, Math.ceil(Math.max(0, coins) / Math.max(1, per)));
}

/** How many 25-minute blocks a focus-minutes gap is worth. */
export function sessionsForMinutes(minutes: number): number {
  return Math.max(1, Math.ceil(Math.max(0, minutes) / NOMINAL_SESSION_MINUTES));
}

/**
 * A badge gap, said the way a student would say it.
 *
 * `unit` is the badge definition's own counter (`totalMinutes`, `streak`,
 * `completedTasks`, `maxSessionMinutes`), so this stays correct when the badge
 * catalogue changes — no per-badge copy to keep in sync.
 */
export function describeBadgeGap(badge: { unit: string; threshold: number; progress: number }): string {
  const gap = Math.max(0, badge.threshold - badge.progress);
  switch (badge.unit) {
    case "totalMinutes": {
      const sessions = sessionsForMinutes(gap);
      return sessions === 1 ? "1 block of 25 minutes away" : `${sessions} blocks of 25 minutes away`;
    }
    case "streak":
      return gap === 1 ? "one more day showing up" : `${gap} more days showing up`;
    case "completedTasks":
      return gap === 1 ? "one task away" : `${gap} tasks away`;
    case "maxSessionMinutes":
      return `one ${badge.threshold}-minute block away`;
    default:
      return `${gap} to go`;
  }
}

/** A plain-language "you are here" line for a wallet at a given balance. */
export function describeCoinGap(coins: number, isPremium = false): string {
  const sessions = sessionsForCoins(coins, isPremium);
  return sessions === 1 ? "about one 25-minute block away" : `about ${sessions} blocks of 25 minutes away`;
}
