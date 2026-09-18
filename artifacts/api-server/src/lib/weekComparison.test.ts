import { describe, it, expect } from "vitest";
import { computeTrend } from "../lib/trend";

/**
 * `weekComparison` used to carry a fabricated `changePercent`.
 *
 * The server computed:
 *
 *     lastWeekMinutes > 0 ? round(((this - last) / last) * 100)
 *                         : thisWeekMinutes > 0 ? 100 : 0;
 *
 * That `: 100` is not a measurement. Three minutes this week against a blank
 * last week rendered as "+100%" in the analytics page, the weekly review card
 * and anywhere else reading the field. The `: 0` is the mirror problem: two
 * empty weeks rendered as "no change", which is how a dead account looks
 * steady.
 *
 * The route now also returns `trend`. These tests pin the three inputs that
 * produced the invented numbers, so a future refactor cannot quietly
 * reintroduce a hardcoded percentage in place of the trend.
 */

const trendOf = (current: number, previous: number) =>
  computeTrend({ current, previous, comparison: "last week" });

describe("weekComparison trend", () => {
  it("refuses a percentage for a first-ever week instead of inventing 100%", () => {
    const trend = trendOf(3, 0);
    expect(trend.percent).toBeNull();
    expect(trend.percent).not.toBe(100);
    // The direction is still a fact — 3 is more than 0 — so it is reported.
    expect(trend.direction).toBe("up");
    expect(trend.delta).toBe(3);
  });

  it("does not describe two empty weeks as 'no change'", () => {
    const trend = trendOf(0, 0);
    expect(trend.direction).toBe("unknown");
    expect(trend.comparable).toBe(false);
    // The old code returned 0 here, which the UI rendered as a flat "0%".
    expect(trend.percent).toBeNull();
  });

  it("reports a genuine zero-change week as flat, not unknown", () => {
    // Both weeks had activity and they match — a real, defensible measurement.
    const trend = trendOf(120, 120);
    expect(trend.direction).toBe("flat");
    expect(trend.comparable).toBe(true);
    expect(trend.percent).toBe(0);
  });

  it("does not turn a one-minute baseline into a four-digit percentage", () => {
    const trend = trendOf(60, 1);
    expect(trend.percent).toBeNull();
    expect(trend.delta).toBe(59);
    expect(trend.direction).toBe("up");
  });

  it("still reports an ordinary week-over-week change", () => {
    const trend = trendOf(240, 200);
    expect(trend.direction).toBe("up");
    expect(trend.percent).toBe(20);
  });

  it("never returns NaN or Infinity for any of these", () => {
    for (const [current, previous] of [
      [0, 0],
      [3, 0],
      [0, 30],
      [60, 1],
      [240, 200],
    ] as const) {
      const trend = trendOf(current, previous);
      expect(Number.isFinite(trend.delta), `${current}/${previous} delta`).toBe(true);
      if (trend.percent !== null) {
        expect(Number.isFinite(trend.percent), `${current}/${previous} percent`).toBe(true);
      }
    }
  });
});
