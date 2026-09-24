import { describe, expect, it } from "vitest";
import {
  BATTLE_PASS_TIERS,
  battlePassClaimId,
  calculateBattlePassTier,
  currentBattlePassSeason,
  battlePassSeasonEndsAt,
  nextBattlePassThreshold,
} from "./battlePass";
import { istToday } from "./istDate";
import { requiredXpForTierIndex } from "./battlePassSeasons";
import { currentTierForXp, requiredXpForTier } from "./battlePassTiers";

describe("canonical battle-pass progression", () => {
  // One 25-minute session is 500 XP (20 XP/min), which is exactly tier 1 — a
  // new account starts at tier 0 with something achievable on day one. The
  // ladder is `tier * 500 + 250` per milestone tier, the same one the page and
  // the admin builder render. It used to be a flat `tier * 500` with tier 1 at
  // 0 XP, which only agreed with the page for the first five tiers.
  it.each([
    [0, 0],
    [499, 0],
    [500, 1],
    [1_199, 2],
    [1_200, 2],
    [1_500, 3],
    [8_000, 14],
    [Number.POSITIVE_INFINITY, 50],
    [-1, 0],
  ])("maps %s XP to tier %s", (xp, expected) => {
    expect(calculateBattlePassTier(xp)).toBe(expected);
  });

  it("returns the next threshold from the same ladder the page draws", () => {
    expect(nextBattlePassThreshold(0)).toBe(500);
    expect(nextBattlePassThreshold(1)).toBe(1_000);
    expect(nextBattlePassThreshold(7)).toBe(4_250); // tier 8 — a milestone step adds 250
    expect(nextBattlePassThreshold(BATTLE_PASS_TIERS.length)).toBeNull();
  });

  it("is the same function the page and the claim gate use", () => {
    // Regression: the page drew `Tier 8 — claimable` at 4,400 season XP while
    // the claim gate computed tier 5 from the same number and answered
    // "Tier not yet unlocked". Both now read this ladder.
    for (const xp of [0, 500, 1_000, 1_500, 2_400, 4_400, 8_000, 14_000, 29_999, 30_000]) {
      const pageTier = currentTierForXp(xp, (tier) => requiredXpForTier({ requiredXp: requiredXpForTierIndex(tier) }, tier));
      expect(pageTier, `tier disagreement at ${xp} XP`).toBe(calculateBattlePassTier(xp));
    }
  });

  it("lets a loot box skip tiers all the way to the end of the season", () => {
    // The table used to stop at tier 8, so `BATTLE_PASS_TIERS.length` capped
    // every tier-skip reward eight levels into a thirty-level season.
    expect(BATTLE_PASS_TIERS).toHaveLength(50);
    expect(BATTLE_PASS_TIERS.at(-1)!.tier).toBe(50);
    expect(calculateBattlePassTier(BATTLE_PASS_TIERS.at(-1)!.xpRequired)).toBe(50);
  });

  it("keeps free and premium claim IDs distinct", () => {
    expect(battlePassClaimId(3, "free")).toBe(3);
    expect(battlePassClaimId(3, "premium")).toBe(103);
  });

  it("provides both display and ledger values for every reward", () => {
    for (const tier of BATTLE_PASS_TIERS) {
      for (const reward of [tier.freeReward, tier.premiumReward]) {
        expect(reward.name).toBeTruthy();
        expect(reward.value).toBeGreaterThanOrEqual(0);
        expect(reward.coins + reward.xp).toBeGreaterThan(0);
      }
    }
  });
});

describe("weekly battle-pass seasons (WS K)", () => {
  it("maps a Tuesday to its ISO week", () => {
    // 2026-08-25 is a Tuesday in ISO week 35 of 2026.
    expect(currentBattlePassSeason(new Date("2026-08-25T10:00:00Z"))).toBe(202635);
  });

  it("keeps a whole week on one season and rolls on Monday", () => {
    expect(currentBattlePassSeason(new Date("2026-08-24T00:00:00Z"))).toBe(202635); // Monday
    expect(currentBattlePassSeason(new Date("2026-08-29T23:59:59Z"))).toBe(202635); // Sunday
    expect(currentBattlePassSeason(new Date("2026-08-31T00:00:00Z"))).toBe(202636); // next Monday
  });

  it("ends at the next Monday 00:00 UTC", () => {
    expect(battlePassSeasonEndsAt(new Date("2026-08-25T10:00:00Z")).toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(battlePassSeasonEndsAt(new Date("2026-08-31T05:00:00Z")).toISOString()).toBe("2026-09-07T00:00:00.000Z");
  });
});

describe("IST day boundary (streak endangerment, WS K)", () => {
  it("uses the Asia/Kolkata calendar day", () => {
    expect(istToday(new Date("2026-08-25T09:29:00Z"))).toBe("2026-08-25"); // 14:59 IST
    expect(istToday(new Date("2026-08-25T18:30:01Z"))).toBe("2026-08-26"); // 00:00 IST
    expect(istToday(new Date("2026-08-24T18:29:59Z"))).toBe("2026-08-24"); // 23:59 IST
  });
});
