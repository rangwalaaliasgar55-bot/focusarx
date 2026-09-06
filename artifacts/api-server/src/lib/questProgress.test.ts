import { describe, expect, it } from "vitest";
import { nextQuestValue, questDailyPeriod, questWeeklyPeriod } from "./questProgress";

describe("quest progression rule", () => {
  it("accumulates cumulative metrics", () => {
    expect(nextQuestValue("focus_minutes", 20, 25)).toBe(45);
    expect(nextQuestValue("session_count", 2, 1)).toBe(3);
    expect(nextQuestValue("coins_earned", 0, 60)).toBe(60);
    expect(nextQuestValue("xp_earned", 500, 500)).toBe(1000);
  });

  it("treats streak_days as a level, never a sum", () => {
    expect(nextQuestValue("streak_days", 0, 4)).toBe(4);
    expect(nextQuestValue("streak_days", 4, 5)).toBe(5);
    // A re-report of the same streak must not double it.
    expect(nextQuestValue("streak_days", 5, 5)).toBe(5);
    // A lower report (e.g. a stale caller) cannot regress progress.
    expect(nextQuestValue("streak_days", 5, 2)).toBe(5);
  });
});

describe("quest period keys follow the user's calendar", () => {
  // 2026-09-06T20:30:00Z is 02:00 on the 7th in Kolkata but still the 6th in LA.
  const instant = Date.UTC(2026, 8, 6, 20, 30);

  it("daily key is the user-local date", () => {
    expect(questDailyPeriod(instant, "Asia/Kolkata")).toBe("2026-09-07");
    expect(questDailyPeriod(instant, "America/Los_Angeles")).toBe("2026-09-06");
  });

  it("weekly key is the user-local Monday", () => {
    // 2026-09-07 is a Monday, so Kolkata is already in the new week.
    expect(questWeeklyPeriod(instant, "Asia/Kolkata")).toBe("week-2026-09-07");
    // LA is still Sunday the 6th → the week that began Monday the 31st.
    expect(questWeeklyPeriod(instant, "America/Los_Angeles")).toBe("week-2026-08-31");
  });
});
