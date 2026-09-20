import { db, lootBoxTypesTable, type LootBoxReward } from "@workspace/db";

/**
 * The CMS has a larger catalogue, but session drops need these four canonical
 * tiers to exist on a brand-new database before an administrator has opened
 * the seed screen. Inserts are idempotent and never overwrite an admin edit.
 */
const DEFAULT_LOOT_BOX_TYPES: Array<{
  id: string;
  name: string;
  description: string;
  rarity: string;
  coinCost: number;
  sessionsRequired: number;
  premiumOnly: boolean;
  icon: string;
  glowColor: string;
  possibleRewards: LootBoxReward[];
}> = [
  {
    id: "lb-c-1",
    name: "Study Starter Box",
    description: "Every journey begins somewhere",
    rarity: "common",
    coinCost: 100,
    sessionsRequired: 0,
    premiumOnly: false,
    icon: "📦",
    glowColor: "#6B7280",
    possibleRewards: [
      { type: "coins", value: 50, weight: 40 },
      { type: "xp", value: 100, weight: 40 },
      { type: "streak_shield", value: 1, weight: 20 },
    ],
  },
  {
    id: "lb-u-1",
    name: "Scholar's Cache",
    description: "For the dedicated student",
    rarity: "uncommon",
    coinCost: 200,
    sessionsRequired: 0,
    premiumOnly: false,
    icon: "🎒",
    glowColor: "#10B981",
    possibleRewards: [
      { type: "coins", value: 150, weight: 35 },
      { type: "xp", value: 300, weight: 35 },
      { type: "xp_boost", value: 1, weight: 20 },
      { type: "streak_shield", value: 2, weight: 10 },
    ],
  },
  {
    id: "lb-r-1",
    name: "Scholar Box",
    description: "Rare rewards for dedicated scholars",
    rarity: "rare",
    coinCost: 500,
    sessionsRequired: 0,
    premiumOnly: false,
    icon: "🎓",
    glowColor: "#3B82F6",
    possibleRewards: [
      { type: "coins", value: 400, weight: 30 },
      { type: "xp", value: 800, weight: 30 },
      { type: "xp_boost", value: 2, weight: 25 },
      { type: "streak_shield", value: 3, weight: 15 },
    ],
  },
  {
    id: "lb-e-1",
    name: "Epic Focus Box",
    description: "Epic focus rewards",
    rarity: "epic",
    coinCost: 1200,
    sessionsRequired: 0,
    premiumOnly: false,
    icon: "🌟",
    glowColor: "#8B5CF6",
    possibleRewards: [
      { type: "coins", value: 1000, weight: 25 },
      { type: "xp", value: 2000, weight: 25 },
      { type: "marketplace_item", value: "rare", rarity: "rare", weight: 25 },
      { type: "xp_boost", value: 3, weight: 15 },
      { type: "battle_pass_tiers", value: 2, weight: 10 },
    ],
  },
];

export async function ensureDefaultLootBoxTypes(): Promise<void> {
  for (const box of DEFAULT_LOOT_BOX_TYPES) {
    await db.insert(lootBoxTypesTable).values(box).onConflictDoNothing();
  }
}

export { DEFAULT_LOOT_BOX_TYPES };
