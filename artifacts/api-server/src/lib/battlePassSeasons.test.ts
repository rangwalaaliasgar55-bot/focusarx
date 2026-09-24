/**
 * The battle pass generator and the payout mapping.
 *
 * Two bugs made the pass feel dead, and both are pinned here:
 *   • `/battle-pass/current` read `freeRewardCoins`-style columns that do not
 *     exist on `battle_pass_rewards`, so every tier rendered as zero no matter
 *     what had been configured;
 *   • claiming paid a fixed `25 + tier * 2` tokens and ignored the reward row,
 *     so a milestone advertising a cosmetic paid tokens instead.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TIERS,
  MAX_TIERS,
  MIN_TIERS,
  PREMIUM_TRACK_COSMETICS,
  buildSeasonTiers,
  describeReward,
  groupTierRewards,
  requiredXpForTierIndex,
  rewardPayout,
} from "./battlePassSeasons";

const here = path.dirname(fileURLToPath(import.meta.url));
const routeRaw = readFileSync(path.join(here, "../routes/battlePassEnhanced.ts"), "utf8");
/**
 * Comments stripped before the source assertions below.
 *
 * The fix for this bug *describes* the bug ("the previous implementation read
 * `freeRewardCoins`-style fields"), so a naive `includes` check on the file
 * fails on its own documentation. Assert on code, never on prose.
 */
const routeSource = routeRaw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

describe("buildSeasonTiers", () => {
  it("builds a full season on both tracks", () => {
    const tiers = buildSeasonTiers({ tierCount: 30, seed: "2026-09" });
    expect(tiers).toHaveLength(30);
    for (const tier of tiers) {
      expect(tier.free.coins ?? 0).toBeGreaterThan(0);
      expect(tier.premium.tokens ?? 0).toBeGreaterThan(0);
      // The paid track has to be worth more than the free one, per tier.
      expect(tier.premium.tokens!).toBeGreaterThan(0);
      expect((tier.premium.coins ?? 0)).toBeGreaterThan(tier.free.coins ?? 0);
    }
  });

  it("is deterministic — a preview cannot differ from what gets published", () => {
    const a = buildSeasonTiers({ tierCount: 20, seed: "season-x" });
    const b = buildSeasonTiers({ tierCount: 20, seed: "season-x" });
    expect(a).toEqual(b);
  });

  it("clamps the tier count to what the product supports", () => {
    expect(buildSeasonTiers({ tierCount: 2 })).toHaveLength(MIN_TIERS);
    expect(buildSeasonTiers({ tierCount: 500 })).toHaveLength(MAX_TIERS);
    expect(buildSeasonTiers()).toHaveLength(DEFAULT_TIERS);
  });

  it("gives the premium track something you cannot buy on milestone tiers", () => {
    const tiers = buildSeasonTiers({ tierCount: 25, seed: "s" });
    const milestones = tiers.filter((tier) => tier.tier % 5 === 0);
    expect(milestones.length).toBe(5);
    for (const tier of milestones) {
      expect(tier.premium.cosmeticId, `tier ${tier.tier} has no cosmetic`).toBeTruthy();
      expect(PREMIUM_TRACK_COSMETICS).toContain(tier.premium.cosmeticId);
    }
    // And the finale carries a crate, so the last tiers are not anticlimactic.
    expect(tiers.at(-1)!.premium.lootbox).toBe("season-finale");
  });

  it("escalates the XP requirement so later tiers mean something", () => {
    for (let tier = 2; tier <= 30; tier += 1) {
      expect(requiredXpForTierIndex(tier)).toBeGreaterThan(requiredXpForTierIndex(tier - 1));
    }
    // A milestone step is bigger than a normal one.
    const normal = requiredXpForTierIndex(4) - requiredXpForTierIndex(3);
    const milestone = requiredXpForTierIndex(5) - requiredXpForTierIndex(4);
    expect(milestone).toBeGreaterThan(normal);
  });
});

describe("groupTierRewards", () => {
  it("reconstructs both tracks from the columns the table actually has", () => {
    const views = groupTierRewards([
      { tier: 1, requiredXp: 500, isPremium: false, value: { coins: 60, xp: 120 } },
      { tier: 1, requiredXp: 500, isPremium: true, value: { tokens: 30, coins: 120 } },
      { tier: 2, requiredXp: 1000, isPremium: false, value: { coins: 70 } },
    ]);
    expect(views).toHaveLength(2);
    expect(views[0]!.freeReward.coins).toBe(60);
    expect(views[0]!.premiumReward.tokens).toBe(30);
    // A tier with no premium row keeps an empty premium reward rather than a
    // fabricated one — the page renders that as unavailable.
    expect(views[1]!.premiumReward).toEqual({});
  });

  it("never lowers a tier's requirement when rows disagree", () => {
    const views = groupTierRewards([
      { tier: 3, requiredXp: 1500, isPremium: false, value: { coins: 1 } },
      { tier: 3, requiredXp: 2000, isPremium: true, value: { tokens: 1 } },
    ]);
    expect(views[0]!.xpRequired).toBe(2000);
  });

  it("returns tiers in order regardless of row order", () => {
    const views = groupTierRewards([
      { tier: 5, requiredXp: 3000, isPremium: false, value: {} },
      { tier: 2, requiredXp: 1000, isPremium: false, value: {} },
      { tier: 9, requiredXp: 5000, isPremium: false, value: {} },
    ]);
    expect(views.map((view) => view.tier)).toEqual([2, 5, 9]);
  });
});

describe("rewardPayout", () => {
  it("pays exactly what the reward row promised", () => {
    expect(rewardPayout({ tokens: 200, coins: 4000, cosmeticId: "frame-aurora" }, true, 30)).toMatchObject({
      tokens: 200,
      coins: 4000,
      cosmeticId: "frame-aurora",
    });
  });

  it("keeps the historical token floor for rows with no payload", () => {
    // Seasons created before the builder existed have coin-only payloads; they
    // must still pay tokens rather than becoming worthless.
    expect(rewardPayout({ coins: 100 }, false, 4).tokens).toBe(25 + 4 * 2);
    expect(rewardPayout(null, true, 10).tokens).toBe(50 + 10 * 5);
  });
});

describe("describeReward", () => {
  it("prefers the written label, and otherwise builds one from the parts", () => {
    expect(describeReward({ label: "Season finale", tokens: 1 })).toBe("Season finale");
    expect(describeReward({ tokens: 30, coins: 120 })).toBe("30 tokens · 120 coins");
    expect(describeReward({ cosmeticId: "frame-obsidian" })).toBe("cosmetic frame-obsidian");
    expect(describeReward({})).toBe("reward");
  });
});

describe("the season route reads real columns", () => {
  it("does not reference the phantom free/premium reward columns", () => {
    // These names never existed on `battle_pass_rewards`; their presence is the
    // signature of the bug that rendered every tier as "0 coins".
    for (const phantom of [
      "freeRewardType",
      "freeRewardCoins",
      "premiumRewardType",
      "premiumRewardCoins",
      "premiumRewardLabel",
    ]) {
      expect(routeSource.includes(phantom), `${phantom} is back in battlePassEnhanced.ts`).toBe(false);
    }
  });

  it("pays claims from the reward row, with the floor as a fallback", () => {
    expect(routeSource).toContain("rewardPayout(");
    expect(routeSource.includes("const tokenReward = isPremiumReward ? 50 + tier * 5 : 25 + tier * 2;")).toBe(false);
  });
});
