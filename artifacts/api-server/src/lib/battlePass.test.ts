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
