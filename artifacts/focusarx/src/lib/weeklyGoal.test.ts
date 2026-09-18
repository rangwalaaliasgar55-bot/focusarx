import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_WEEKLY_GOAL_MIN,
  MAX_WEEKLY_GOAL_MIN,
  MIN_WEEKLY_GOAL_MIN,
  WEEKLY_GOAL_KEY,
  isWeeklyGoalMin,
  saveWeeklyGoal,
  weeklyGoalMin,
  weeklyGoalProgress,
  weeklyGoalSentence,
} from "./weeklyGoal";
import { safeRemove } from "./safeStorage";

/**
 * The weekly target's contract.
 *
 * The card that renders this is one row of one dashboard; the assertions that
 * matter are about numbers a user reads — "62% of your target", "38 to go" —
 * and about what happens when the stored target is junk or the browser refuses
 * to write. Both of those used to be invisible.
 */

beforeEach(() => {
  safeRemove(WEEKLY_GOAL_KEY);
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("weeklyGoalMin", () => {
  it("falls back to the default when nothing is stored", () => {
    expect(weeklyGoalMin()).toBe(DEFAULT_WEEKLY_GOAL_MIN);
  });

  it("reads a stored target back", () => {
    window.localStorage.setItem(WEEKLY_GOAL_KEY, "450");
    expect(weeklyGoalMin()).toBe(450);
  });

  it.each([
    ["not a number", "twelve hundred"],
    ["below the floor", String(MIN_WEEKLY_GOAL_MIN - 1)],
    ["above the ceiling", String(MAX_WEEKLY_GOAL_MIN + 1)],
    ["empty", ""],
  ])("treats a %s stored value as absent", (_label, stored) => {
    window.localStorage.setItem(WEEKLY_GOAL_KEY, stored);
    expect(weeklyGoalMin()).toBe(DEFAULT_WEEKLY_GOAL_MIN);
  });

  it("accepts the bounds themselves", () => {
    expect(isWeeklyGoalMin(MIN_WEEKLY_GOAL_MIN)).toBe(true);
    expect(isWeeklyGoalMin(MAX_WEEKLY_GOAL_MIN)).toBe(true);
  });
});

describe("saveWeeklyGoal", () => {
  it("persists a valid target and reports it as persisted", () => {
    expect(saveWeeklyGoal(600)).toBe(true);
    expect(window.localStorage.getItem(WEEKLY_GOAL_KEY)).toBe("600");
    expect(weeklyGoalMin()).toBe(600);
  });

  it("refuses an out-of-range target instead of storing it", () => {
    window.localStorage.setItem(WEEKLY_GOAL_KEY, "300");
    expect(saveWeeklyGoal(0)).toBe(false);
    expect(saveWeeklyGoal(MAX_WEEKLY_GOAL_MIN + 1)).toBe(false);
    // The previous target survives a rejected edit.
    expect(weeklyGoalMin()).toBe(300);
  });

  it("reports false when the browser refuses the write, and keeps the value for the visit", () => {
    // Private mode / quota: localStorage throws, safeStorage holds it in memory.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(saveWeeklyGoal(420)).toBe(false);
    // The caller can still read what it wrote — the target is real, it just is
    // not durable. That distinction is exactly what the UI now states.
    expect(weeklyGoalMin()).toBe(420);
  });
});

describe("weeklyGoalProgress", () => {
  it("counts down towards the target", () => {
    expect(weeklyGoalProgress(150, 300)).toEqual({
      goal: 300,
      minutes: 150,
      percent: 50,
      remaining: 150,
      surplus: 0,
      done: false,
    });
  });

  it("caps the bar at 100% and reports the surplus separately", () => {
    const progress = weeklyGoalProgress(450, 300);
    expect(progress.percent).toBe(100);
    expect(progress.surplus).toBe(150);
    expect(progress.remaining).toBe(0);
    expect(progress.done).toBe(true);
  });

  it("is not done one minute short", () => {
    expect(weeklyGoalProgress(299, 300).done).toBe(false);
    expect(weeklyGoalProgress(300, 300).done).toBe(true);
  });

  it("never renders NaN when the week's total is unknown", () => {
    // A missing server total arrives as undefined; `Math.max(undefined - 300, 0)`
    // would put "NaN to go" on the card.
    const progress = weeklyGoalProgress(undefined as unknown as number, 300);
    expect(progress.minutes).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.remaining).toBe(300);
    expect(Number.isFinite(progress.remaining)).toBe(true);
  });

  it("falls back to the default target when the stored goal is unusable", () => {
    expect(weeklyGoalProgress(60, Number.NaN).goal).toBe(DEFAULT_WEEKLY_GOAL_MIN);
    expect(weeklyGoalProgress(60, 0).goal).toBe(DEFAULT_WEEKLY_GOAL_MIN);
  });
});

describe("weeklyGoalSentence", () => {
  it("states the shortfall before the target is met", () => {
    expect(weeklyGoalSentence(weeklyGoalProgress(238, 300))).toBe("238 of 300 min protected — 62 to go.");
  });

  it("says target hit without inventing a shortfall", () => {
    expect(weeklyGoalSentence(weeklyGoalProgress(300, 300))).toBe("Target hit — 300 of 300 min protected.");
  });

  it("names the margin when there is one", () => {
    expect(weeklyGoalSentence(weeklyGoalProgress(412, 300))).toBe(
      "Target hit — 412 of 300 min protected, 112 past it.",
    );
  });
});
