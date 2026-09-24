/**
 * Battle pass seasons: the tier table, and how a reward row becomes a payout.
 *
 * Two problems this file fixes, both of them the reason the battle pass felt
 * empty:
 *
 *  1. **The route read columns that do not exist.** `/battle-pass/current`
 *     mapped `r.freeRewardType`, `r.premiumRewardCoins` and friends off
 *     `battle_pass_rewards` — a table whose real columns are `tier`, `type`,
 *     `value` (jsonb), `required_xp` and `is_premium`. Every read returned
 *     `undefined`, so every tier rendered "0 coins" no matter what an admin had
 *     configured: `freeReward`/`premiumReward` were phantoms. The tracks are
 *     reconstructed here from the columns that exist.
 *  2. **Claims ignored what the tier promised.** Claiming paid a hardcoded
 *     `25 + tier * 2` tokens for free and `50 + tier * 5` for premium, whatever
 *     the season said. A tier advertising a cosmetic paid tokens instead. The
 *     payout is now derived from the reward row (`rewardPayout`), and the two
 *     numbers are kept as a *floor* so an old row with no payload still pays
 *     something rather than nothing.
 *
 * `buildSeasonTiers` is what makes "admin can introduce a battle pass" real: one
 * call produces a balanced, deterministic season — 30 tiers, a free track that
 * pays coins and XP, a premium track that pays tokens and cosmetics, milestone
 * tiers every five levels on both. It is pure, so the admin preview shows
 * exactly what publishing will write.
 */

export interface SeasonTierSpec {
  tier: number;
  requiredXp: number;
  free: RewardValue;
  premium: RewardValue;
}

/** The `value` jsonb payload of a reward row. All fields optional. */
export interface RewardValue {
  coins?: number;
  xp?: number;
  tokens?: number;
  cosmeticId?: string;
  petId?: string;
  lootbox?: string;
  label?: string;
}

export const MIN_TIERS = 10;
export const MAX_TIERS = 50;
export const DEFAULT_TIERS = 30;

/** Tiers are 500 XP apart, with a bigger step at every milestone. */
export function requiredXpForTierIndex(tier: number): number {
  return tier * 500 + Math.floor(tier / 5) * 250;
}

/**
 * Cosmetics the premium track can hand out, in order. They are *ids*, not names:
 * the client resolves them against the cosmetic catalogue, so a season can name
 * something that does not exist yet without crashing the page.
 */
export const PREMIUM_TRACK_COSMETICS = [
  "frame-obsidian",
  "theme-midnight-gold",
  "badge-season-veteran",
  "frame-aurora",
  "theme-crimson-desk",
] as const;

/**
 * Build a whole season's tier table.
 *
 * Deliberately deterministic — the same `seed` produces the same pass, so the
 * admin preview, the published rows and the test fixture cannot disagree. The
 * shape is a curve rather than a constant: free rewards grow with the tier, and
 * premium rewards are worth roughly 3× the free reward of the same tier so the
 * paid track reads as a genuine upgrade instead of a recolour.
 */
export function buildSeasonTiers(options: { tierCount?: number; seed?: string } = {}): SeasonTierSpec[] {
  const tierCount = Math.min(MAX_TIERS, Math.max(MIN_TIERS, Math.floor(options.tierCount ?? DEFAULT_TIERS)));
  const seed = options.seed ?? "focusarx";
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 1_000_003;

  const tiers: SeasonTierSpec[] = [];
  for (let tier = 1; tier <= tierCount; tier += 1) {
    const milestone = tier % 5 === 0;
    const freeCoins = 50 + tier * 10 + (milestone ? 100 : 0);
    const freeXp = 100 + tier * 20;
    const premiumTokens = 25 + tier * 5 + (milestone ? 75 : 0);
    const premiumCoins = freeCoins * 2;

    const free: RewardValue = { coins: freeCoins, xp: freeXp, label: `${freeCoins} coins + ${freeXp} XP` };
    const premium: RewardValue = {
      tokens: premiumTokens,
      coins: premiumCoins,
      label: `${premiumTokens} tokens + ${premiumCoins} coins`,
    };

    if (milestone) {
      // A milestone on the premium track hands out something you cannot buy
      // with coins — this is the answer to "premium users get bored": there is
      // always a named thing waiting a few tiers up.
      const cosmetic = PREMIUM_TRACK_COSMETICS[(tier / 5 - 1) % PREMIUM_TRACK_COSMETICS.length];
      premium.cosmeticId = cosmetic;
      premium.label = `${premiumTokens} tokens + cosmetic: ${cosmetic}`;
    }
    if (tier === tierCount) {
      premium.tokens = (premium.tokens ?? 0) + 200;
      premium.lootbox = "season-finale";
      premium.label = `Season finale: ${premium.tokens} tokens + finale crate`;
    }

    tiers.push({ tier, requiredXp: requiredXpForTierIndex(tier), free, premium });
  }
  return tiers;
}

/** Rows as the client renders them (both tracks, per tier). */
export interface RewardRow {
  tier: number;
  requiredXp: number;
  isPremium: boolean;
  value: RewardValue;
}

export interface TierView {
  tier: number;
  xpRequired: number;
  freeReward: RewardValue;
  premiumReward: RewardValue;
  freeType: string;
  premiumType: string;
}

/**
 * Group reward rows into the free/premium pair per tier.
 *
 * When a tier has only one row on a track, that row is used; when a track is
 * missing entirely the reward is an empty object and the client renders "—"
 * rather than a bogus zero. A season is allowed to be premium-only on a given
 * tier, and the UI should say so instead of inventing a free reward.
 */
export function groupTierRewards(rows: RewardRow[]): TierView[] {
  const byTier = new Map<number, TierView>();
  for (const row of rows) {
    const existing = byTier.get(row.tier) ?? {
      tier: row.tier,
      xpRequired: row.requiredXp,
      freeReward: {},
      premiumReward: {},
      freeType: "",
      premiumType: "",
    };
    // Rows can carry the requirement slightly differently; the higher wins so a
    // tier is never easier to reach than one of its own rows says.
    existing.xpRequired = Math.max(existing.xpRequired, row.requiredXp);
    if (row.isPremium) {
      existing.premiumReward = row.value ?? {};
      existing.premiumType = row.value?.cosmeticId ? "cosmetic" : row.value?.tokens ? "tokens" : row.value?.coins ? "coins" : "reward";
    } else {
      existing.freeReward = row.value ?? {};
      existing.freeType = row.value?.coins ? "coins" : row.value?.xp ? "xp" : "reward";
    }
    byTier.set(row.tier, existing);
  }
  return [...byTier.values()].sort((a, b) => a.tier - b.tier);
}

/** What a claim should pay, from the row that was promised. */
export function rewardPayout(value: RewardValue | null | undefined, isPremium: boolean, tier: number): RewardValue {
  const floor: RewardValue = { tokens: isPremium ? 50 + tier * 5 : 25 + tier * 2 };
  if (!value || typeof value !== "object") return floor;
  return {
    ...value,
    // A row with no token component still pays the floor, so early seasons that
    // only configured coins do not become worthless overnight.
    tokens: typeof value.tokens === "number" && value.tokens > 0 ? value.tokens : floor.tokens,
  };
}

/** A one-line description used in the admin list and the season preview. */
export function describeReward(value: RewardValue): string {
  if (value.label) return value.label;
  const parts: string[] = [];
  if (value.tokens) parts.push(`${value.tokens} tokens`);
  if (value.coins) parts.push(`${value.coins} coins`);
  if (value.xp) parts.push(`${value.xp} XP`);
  if (value.cosmeticId) parts.push(`cosmetic ${value.cosmeticId}`);
  if (value.petId) parts.push(`pet ${value.petId}`);
  if (value.lootbox) parts.push(`crate ${value.lootbox}`);
  return parts.join(" · ") || "reward";
}
