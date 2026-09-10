import { describe, expect, it } from "vitest";
import { dayKeyInZone } from "../lib/timezone";
import { isConsecutiveRewardDay, rewardDayKeys } from "./dailyReward";

describe("dailyReward user-local days (P0 streak-calendar regression)", () => {
  it("keys the same instant on different days per zone", () => {
    // 2026-09-04 20:30 ET == 2026-09-05 06:00 IST (EDT, UTC-4)
    const instant = new Date("2026-09-05T00:30:00Z").getTime();
    expect(rewardDayKeys(instant, "America/New_York").today).toBe("2026-09-04");
    expect(rewardDayKeys(instant, "Asia/Kolkata").today).toBe("2026-09-05");
  });

  it("computes yesterday with DST-safe string math, not -24 h", () => {
    // 2026-03-09 00:30 EDT (UTC-4) — the morning after US spring-forward.
    const now = Date.UTC(2026, 2, 9, 4, 30);
    const { today, yesterday } = rewardDayKeys(now, "America/New_York");
    expect(today).toBe("2026-03-09");
    expect(yesterday).toBe("2026-03-08");
    // The old `now - 86_400_000` math lands on Mar 7 here (the 23-hour day),
    // which would have wrongly reset the claim streak.
    expect(dayKeyInZone(now - 86_400_000, "America/New_York")).toBe("2026-03-07");
  });

  it("detects consecutive claims across month boundaries", () => {
    expect(isConsecutiveRewardDay("2026-09-05", "2026-09-06")).toBe(true);
    expect(isConsecutiveRewardDay("2026-08-31", "2026-09-01")).toBe(true);
    expect(isConsecutiveRewardDay("2025-12-31", "2026-01-01")).toBe(true);
  });

  it("resets the streak after a missed day", () => {
    expect(isConsecutiveRewardDay("2026-09-06", "2026-09-06")).toBe(false);
    expect(isConsecutiveRewardDay("2026-09-04", "2026-09-06")).toBe(false);
    expect(isConsecutiveRewardDay(null, "2026-09-06")).toBe(false);
  });
});
