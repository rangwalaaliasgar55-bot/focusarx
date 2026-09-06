import { describe, expect, it } from "vitest";
import { applyBondXp, PET_MAX_LEVEL } from "./petBond";

describe("pet bond curve", () => {
  it("levels when the per-level threshold is met and carries the remainder", () => {
    expect(applyBondXp(1, 90, 25)).toEqual({ level: 2, bondXp: 15, unlocks: [2] });
  });
  it("can skip several levels in one grant", () => {
    // 100 + 200 + 300 = 600 to reach level 4 from 1
    expect(applyBondXp(1, 0, 650)).toEqual({ level: 4, bondXp: 50, unlocks: [2, 3, 4] });
  });
  it("caps at the max level with zero residual XP", () => {
    const r = applyBondXp(19, 0, 5000);
    expect(r.level).toBe(PET_MAX_LEVEL);
    expect(r.bondXp).toBe(0);
  });
  it("ignores non-positive gains", () => {
    expect(applyBondXp(3, 40, -50)).toEqual({ level: 3, bondXp: 40, unlocks: [] });
  });
});
