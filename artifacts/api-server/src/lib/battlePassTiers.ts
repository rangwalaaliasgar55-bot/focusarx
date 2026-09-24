import { MAX_TIERS, requiredXpForTierIndex } from "./battlePassSeasons";

/**
 * Pure tier-math helpers for the enhanced battle-pass routes
 * (`/api/battle-pass/*`). Kept side-effect-free so the claim-gating logic can
 * be unit-tested without a database.
 *
 * Background: these routes previously read season XP from the never-written
 * `user_battle_pass_progress` table, so progress always rendered as 0 and
 * tier claims were impossible. They now read `battle_pass_progress.season_xp`
 * — the live column that session completion credits (see
 * `routes/sessions.ts`). XP resets on the ISO-week season boundary used by
 * the canonical battle pass (`lib/battlePass.ts`); claims already granted are
 * recorded in `battle_pass_claims` and survive the reset.
 */

export const FALLBACK_TIER_XP = 500;
export const MAX_TIER = MAX_TIERS;

export type TierRewardLike = { requiredXp: number } | undefined;

/**
 * XP required to unlock `tier` — the DB reward threshold when present, otherwise
 * the season ladder.
 *
 * The fallback used to be a flat `tier * 500`, which disagreed with the season
 * table the battle-pass page renders (`tier * 500 + 250` at every milestone
 * tier). A student's tier therefore depended on which endpoint you asked:
 * at 4,400 season XP the page drew "Tier 8 — claimable" while the claim gate
 * computed tier 5 from the same number and answered "Tier not yet unlocked".
 * Both paths now call `requiredXpForTierIndex`, so there is one ladder.
 */
export function requiredXpForTier(reward: TierRewardLike, tier: number): number {
  if (reward && Number.isFinite(reward.requiredXp) && reward.requiredXp > 0) {
    return reward.requiredXp;
  }
  return requiredXpForTierIndex(tier);
}

/** Tiers whose requirement is met by `seasonXp`, ascending, capped at MAX_TIER. */
export function eligibleTiersForXp(
  seasonXp: number,
  requirementFor: (tier: number) => number,
  maxTier: number = MAX_TIER,
): number[] {
  const out: number[] = [];
  for (let tier = 1; tier <= maxTier; tier++) {
    if (seasonXp >= requirementFor(tier)) out.push(tier);
  }
  return out;
}

/** Highest tier fully unlocked by `seasonXp` (0 when none). */
export function currentTierForXp(
  seasonXp: number,
  requirementFor: (tier: number) => number,
  maxTier: number = MAX_TIER,
): number {
  let current = 0;
  for (let tier = 1; tier <= maxTier; tier++) {
    if (seasonXp >= requirementFor(tier)) current = tier;
    else break;
  }
  return current;
}
