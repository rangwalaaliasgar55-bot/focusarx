import { describe, expect, it } from "vitest";
import {
  BATTLE_PASS_TIERS,
  battlePassClaimId,
  calculateBattlePassTier,
  nextBattlePassThreshold,
} from "./battlePass";

describe("canonical battle-pass progression", () => {
  it.each([
    [0, 1],
    [499, 1],
    [500, 2],
    [1_199, 2],
    [1_200, 3],
    [8_000, 8],
    [Number.POSITIVE_INFINITY, 1],
    [-1, 1],
  ])("maps %s XP to tier %s", (xp, expected) => {
    expect(calculateBattlePassTier(xp)).toBe(expected);
  });

  it("returns the next threshold from the same canonical definitions", () => {
    expect(nextBattlePassThreshold(1)).toBe(500);
    expect(nextBattlePassThreshold(7)).toBe(8_000);
    expect(nextBattlePassThreshold(BATTLE_PASS_TIERS.length)).toBeNull();
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
