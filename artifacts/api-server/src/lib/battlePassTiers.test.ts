import { describe, it, expect } from "vitest";
import {
  FALLBACK_TIER_XP,
  MAX_TIER,
  requiredXpForTier,
  eligibleTiersForXp,
  currentTierForXp,
} from "./battlePassTiers";

describe("requiredXpForTier", () => {
  it("uses the DB reward threshold when present", () => {
    expect(requiredXpForTier({ requiredXp: 1200 }, 3)).toBe(1200);
  });

  it("falls back to tier * 500 when no reward row exists", () => {
    expect(requiredXpForTier(undefined, 3)).toBe(1500);
    expect(requiredXpForTier(undefined, 1)).toBe(FALLBACK_TIER_XP);
  });

  it("treats non-positive or non-finite thresholds as missing", () => {
    expect(requiredXpForTier({ requiredXp: 0 }, 2)).toBe(1000);
    expect(requiredXpForTier({ requiredXp: -5 }, 2)).toBe(1000);
    expect(requiredXpForTier({ requiredXp: Number.NaN }, 2)).toBe(1000);
  });
});

describe("eligibleTiersForXp", () => {
  it("returns ascending tiers whose requirement is met", () => {
    const req = (t: number) => t * 500; // 500, 1000, 1500...
    expect(eligibleTiersForXp(0, req)).toEqual([]);
    expect(eligibleTiersForXp(499, req)).toEqual([]);
    expect(eligibleTiersForXp(500, req)).toEqual([1]);
    expect(eligibleTiersForXp(1250, req)).toEqual([1, 2]);
  });

  it("is capped at MAX_TIER even with huge XP", () => {
    expect(eligibleTiersForXp(Number.MAX_SAFE_INTEGER, () => 1)).toHaveLength(MAX_TIER);
  });

  it("handles non-monotonic requirement curves without early exit", () => {
    // eligibleTiersForXp must not break on gaps (unlike currentTierForXp)
    const req = (t: number) => (t === 2 ? 10_000 : t * 500);
    expect(eligibleTiersForXp(1500, req)).toEqual([1, 3]);
  });
});

describe("currentTierForXp", () => {
  it("returns 0 when no tier is unlocked", () => {
    expect(currentTierForXp(0, (t) => t * 500)).toBe(0);
  });

  it("stops at the first unmet tier (monotonic curves)", () => {
    const req = (t: number) => t * 500;
    expect(currentTierForXp(999, req)).toBe(1);
    expect(currentTierForXp(1500, req)).toBe(3);
  });
});
