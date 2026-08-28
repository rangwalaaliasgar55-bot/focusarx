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
export const MAX_TIER = 30;

export type TierRewardLike = { requiredXp: number } | undefined;

/** XP required to unlock `tier` — DB reward threshold when present, `tier * 500` otherwise. */
export function requiredXpForTier(reward: TierRewardLike, tier: number): number {
  if (reward && Number.isFinite(reward.requiredXp) && reward.requiredXp > 0) {
    return reward.requiredXp;
  }
  return tier * FALLBACK_TIER_XP;
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
