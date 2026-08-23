export const BATTLE_PASS_CURRENT_SEASON = 1;

export type BattlePassReward = {
  type: "coins" | "xp" | "bundle";
  value: number;
  icon: string;
  name: string;
  label: string;
  coins: number;
  xp: number;
};

function reward(coins: number, xp: number, label: string): BattlePassReward {
  const type = coins > 0 && xp > 0 ? "bundle" : coins > 0 ? "coins" : "xp";
  return {
    type,
    value: type === "coins" ? coins : type === "xp" ? xp : coins + xp,
    icon: type === "coins" ? "🪙" : type === "xp" ? "⚡" : "🎁",
    name: label,
    label,
    coins,
    xp,
  };
}

/** Canonical battle-pass progression used by API rewards and session advancement. */
export const BATTLE_PASS_TIERS = [
  { tier: 1, xpRequired: 0,    freeReward: reward(50, 0, "50 coins"), premiumReward: reward(100, 200, "100 coins + 200 XP") },
  { tier: 2, xpRequired: 500,  freeReward: reward(75, 0, "75 coins"), premiumReward: reward(150, 300, "150 coins + 300 XP") },
  { tier: 3, xpRequired: 1200, freeReward: reward(100, 0, "100 coins"), premiumReward: reward(200, 500, "200 coins + 500 XP") },
  { tier: 4, xpRequired: 2000, freeReward: reward(0, 500, "500 XP"), premiumReward: reward(300, 800, "300 coins + 800 XP") },
  { tier: 5, xpRequired: 3000, freeReward: reward(150, 0, "150 coins"), premiumReward: reward(500, 1000, "500 coins + 1000 XP") },
  { tier: 6, xpRequired: 4500, freeReward: reward(0, 750, "750 XP"), premiumReward: reward(400, 1200, "400 coins + 1200 XP") },
  { tier: 7, xpRequired: 6000, freeReward: reward(200, 0, "200 coins"), premiumReward: reward(600, 1500, "600 coins + 1500 XP") },
  { tier: 8, xpRequired: 8000, freeReward: reward(250, 500, "250 coins + 500 XP"), premiumReward: reward(1000, 2000, "1000 coins + 2000 XP") },
] as const;

export function calculateBattlePassTier(seasonXp: number): number {
  const safeXp = Number.isFinite(seasonXp) ? Math.max(0, Math.floor(seasonXp)) : 0;
  return BATTLE_PASS_TIERS.reduce(
    (tier, definition) => safeXp >= definition.xpRequired ? definition.tier : tier,
    0,
  );
}

export function nextBattlePassThreshold(currentTier: number): number | null {
  return BATTLE_PASS_TIERS.find((definition) => definition.tier > currentTier)?.xpRequired ?? null;
}

/** Premium claim IDs share one integer[] column without colliding with free claims. */
export function battlePassClaimId(tier: number, track: "free" | "premium"): number {
  return track === "premium" ? tier + 100 : tier;
}
