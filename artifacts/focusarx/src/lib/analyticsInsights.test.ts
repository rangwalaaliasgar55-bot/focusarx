import { describe, it, expect } from "vitest";
import { bestWindow, buildInsights, consistency, formatHours, strongestWeekday } from "./analyticsInsights";

/**
 * The read-back has one rule: never assert something the data does not show.
 * A wrong conclusion ("your best hours are the morning" from four minutes at
 * 07:00) is worse than no conclusion, because a student will rearrange their
 * week around it.
 */
describe("formatHours", () => {
  it("formats without losing minutes", () => {
    expect(formatHours(0)).toBe("0m");
    expect(formatHours(45)).toBe("45m");
    expect(formatHours(60)).toBe("1h");
    expect(formatHours(320)).toBe("5h 20m");
    expect(formatHours(Number.NaN)).toBe("0m");
  });
});

describe("bestWindow", () => {
  const hours = (spec: Record<number, number>) => Object.entries(spec).map(([hour, minutes]) => ({ hour: Number(hour), minutes }));

  it("returns null when there is no focus time", () => {
    expect(bestWindow([])).toBeNull();
    expect(bestWindow(hours({ 9: 0, 20: 0 }))).toBeNull();
  });

  it("finds the dominant band", () => {
    const window = bestWindow(hours({ 21: 60, 22: 30, 9: 20 }))!;
    expect(window.label).toBe("nights (21–24)");
    expect(window.minutes).toBe(90);
    expect(Math.round(window.share * 100)).toBe(82);
  });

  it("stays quiet when the time is spread across the day", () => {
    // Every band holds a quarter or less: nothing to single out.
    expect(bestWindow(hours({ 8: 20, 13: 20, 18: 20, 22: 20 }))).toBeNull();
  });

  it("includes the band's boundary hours, not the next band's", () => {
    const window = bestWindow(hours({ 17: 200, 21: 10 }))!;
    expect(window.label).toBe("evenings (17–21)"); // 21:00 belongs to nights
    expect(window.minutes).toBe(200);
  });
});

describe("consistency", () => {
  it("counts focused days and the longest run", () => {
    const chart = [0, 25, 25, 0, 30, 30, 30, 0, 0, 15].map((minutes) => ({ minutes }));
    expect(consistency(chart)).toEqual({ activeDays: 6, window: 10, bestRun: 3 });
  });

  it("returns null for an empty window rather than inventing a streak", () => {
    expect(consistency([])).toBeNull();
    expect(consistency([0, 0, 0].map((minutes) => ({ minutes })))).toBeNull();
  });

  it("treats missing minutes as a missed day", () => {
    const chart = [{ minutes: 10 }, {} as { minutes: number }, { minutes: 10 }];
    expect(consistency(chart)).toEqual({ activeDays: 2, window: 3, bestRun: 1 });
  });
});

describe("strongestWeekday", () => {
  it("needs a real spread of days before naming a strongest one", () => {
    expect(strongestWeekday([{ day: 3, minutes: 120 }])).toBeNull();
    expect(strongestWeekday(undefined)).toBeNull();
  });

  it("sums the hours within each weekday and ignores days that are close", () => {
    const rows = [
      { day: 1, minutes: 50 },
      { day: 2, minutes: 40 }, { day: 3, minutes: 40 }, { day: 4, minutes: 40 },
    ];
    expect(strongestWeekday(rows)).toBeNull(); // Monday leads by 25% — right at the line
    const clear = [
      { day: 1, minutes: 60 }, { day: 1, minutes: 60 },
      { day: 2, minutes: 20 }, { day: 3, minutes: 20 }, { day: 4, minutes: 20 },
    ];
    expect(strongestWeekday(clear)).toEqual({ day: 1, minutes: 120 });
  });
});

describe("buildInsights", () => {
  const full = {
    chart14: [25, 0, 50, 50, 0, 25, 25, 25, 0, 0, 50, 25, 25, 40].map((minutes) => ({ minutes })),
    hourDist: [
      { hour: 20, minutes: 120 }, { hour: 21, minutes: 90 }, { hour: 22, minutes: 60 },
      { hour: 9, minutes: 25 },
    ],
    timeDayHeatmap: [
      { day: 3, hour: 20, minutes: 150, sessions: 3 },
      { day: 1, hour: 9, minutes: 20, sessions: 1 },
      { day: 2, hour: 20, minutes: 20, sessions: 1 },
      { day: 5, hour: 20, minutes: 20, sessions: 1 },
    ],
    weekComparison: { thisWeekMinutes: 320, lastWeekMinutes: 240 },
    personalBests: { longestSessionMinutes: 95, totalSessions: 12, totalMinutes: 300, bestDayMinutes: 90, longestStreak: 4 },
  };

  it("says something useful when there is data", () => {
    const insights = buildInsights(full);
    expect(insights.length).toBeGreaterThanOrEqual(3);
    expect(insights.map((i) => i.id)).toContain("window");
    expect(insights.find((i) => i.id === "window")!.title).toContain("nights");
    expect(insights.find((i) => i.id === "trend")!.title).toContain("33%");
    expect(insights.find((i) => i.id === "trend")!.tone).toBe("up");
    expect(insights.find((i) => i.id === "consistency")!.detail).toContain("4 days in a row");
  });

  it("emits nothing at all for a brand-new account", () => {
    expect(buildInsights({ chart14: [], hourDist: [] })).toEqual([]);
  });

  it("never exceeds the cap", () => {
    expect(buildInsights(full, 2)).toHaveLength(2);
    expect(buildInsights(full).length).toBeLessThanOrEqual(4);
  });

  it("frames a decline as one block of work, not a failure", () => {
    const insights = buildInsights({ ...full, weekComparison: { thisWeekMinutes: 120, lastWeekMinutes: 300 } });
    const trend = insights.find((i) => i.id === "trend")!;
    expect(trend.tone).toBe("down");
    expect(trend.title).toContain("60%");
    expect(trend.detail).toContain("25-minute block");
  });

  it("handles a first week with no previous week", () => {
    const insights = buildInsights({ chart14: [{ minutes: 25 }], hourDist: [], weekComparison: { thisWeekMinutes: 25, lastWeekMinutes: 0 } });
    const trend = insights.find((i) => i.id === "trend")!;
    expect(trend.title).not.toContain("%"); // no percentage against nothing
    expect(trend.detail).toContain("25m");
  });

  it("only claims headroom when a longer block really exists", () => {
    const flat = { ...full, personalBests: { ...full.personalBests, longestSessionMinutes: 30, totalSessions: 10, totalMinutes: 250 } };
    expect(buildInsights(flat).find((i) => i.id === "headroom")).toBeUndefined();
    expect(buildInsights(full).find((i) => i.id === "headroom")).toBeDefined();
  });
});
