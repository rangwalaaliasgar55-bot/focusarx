import { describe, expect, it } from "vitest";
import { tierFromDurationDays, tierFromPlanSlug } from "./premiumPlans";

describe("membership tier mapping", () => {
  it("maps the three seeded plans", () => {
    expect(tierFromPlanSlug("premium_30")).toBe("plus");
    expect(tierFromPlanSlug("premium_90")).toBe("pro");
    expect(tierFromPlanSlug("premium_365")).toBe("elite");
    expect(tierFromPlanSlug("something_else")).toBeNull();
    expect(tierFromPlanSlug(null)).toBeNull();
  });

  it("maps admin grants by duration", () => {
    expect(tierFromDurationDays(0)).toBe("free");
    expect(tierFromDurationDays(7)).toBe("plus");
    expect(tierFromDurationDays(59.9)).toBe("plus");
    expect(tierFromDurationDays(60)).toBe("pro");
    expect(tierFromDurationDays(179)).toBe("pro");
    expect(tierFromDurationDays(180)).toBe("elite");
    expect(tierFromDurationDays(400)).toBe("elite");
    expect(tierFromDurationDays(Number.NaN)).toBe("free");
  });
});
