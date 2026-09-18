import { describe, expect, it } from "vitest";
import { computeTrend, computeTrendVsAverage, formatDelta, formatPercent } from "./trend";

/**
 * The whole point of this module is the three inputs where `(a-b)/b*100` lies.
 * These tests pin those cases first, because they are the ones that ship as
 * `Infinity%` or a confident fabricated number.
 */
describe("computeTrend", () => {
  it("rises and falls with a signed delta and percent", () => {
    const up = computeTrend({ current: 50, previous: 25, comparison: "yesterday" });
    expect(up).toMatchObject({ direction: "up", delta: 25, percent: 100, comparable: true });

    const down = computeTrend({ current: 20, previous: 50, comparison: "yesterday" });
    expect(down).toMatchObject({ direction: "down", delta: -30, percent: -60, comparable: true });
  });

  it("refuses to claim a trend when both periods are empty", () => {
    // Not "flat": flat describes steady effort. This is no data, and rendering
    // it as flat is how an abandoned account looks healthy.
    const trend = computeTrend({ current: 0, previous: 0, comparison: "yesterday" });
    expect(trend.direction).toBe("unknown");
    expect(trend.percent).toBeNull();
    expect(trend.comparable).toBe(false);
  });

  it("never divides by a zero baseline", () => {
    // The naive implementation ships Infinity% here, or a fabricated +2500%
    // from a `previous || 1` guard. Both are inventions.
    const first = computeTrend({ current: 25, previous: 0, comparison: "yesterday" });
    expect(first.percent).toBeNull();
    expect(first.direction).toBe("up");
    expect(first.delta).toBe(25);

    expect(first.comparable).toBe(true);
  });

  it("reports an absolute delta rather than a wild percentage off a tiny base", () => {
    // 1 → 10 minutes is genuinely +900%. It is also noise, so the percentage
    // is suppressed and the delta carries the meaning.
    const trend = computeTrend({ current: 10, previous: 1, comparison: "yesterday" });
    expect(trend.percent).toBeNull();
    expect(trend.delta).toBe(9);
    expect(trend.direction).toBe("up");
  });

  it("switches to a percentage once the base supports one", () => {
    const trend = computeTrend({ current: 20, previous: 10, comparison: "yesterday", minPercentBase: 5 });
    expect(trend.percent).toBe(100);
    expect(trend.comparable).toBe(true);
  });

  it("treats sub-threshold movement as flat instead of a trend", () => {
    const trend = computeTrend({ current: 10.2, previous: 10, comparison: "yesterday" });
    expect(trend.direction).toBe("flat");
    expect(trend.delta).toBeCloseTo(0.2);
  });

  it("separates 'no data' from 'flat', and keeps the two ideas independent", () => {
    const noData = computeTrend({ current: 0, previous: 0, comparison: "yesterday" });
    expect(noData.direction).toBe("unknown");
    expect(noData.comparable).toBe(false);

    // Unchanged and non-zero is a real flat reading, and it IS comparable --
    // even though the small baseline means no percentage is reported.
    const unchanged = computeTrend({ current: 3, previous: 3, comparison: "yesterday" });
    expect(unchanged.direction).toBe("flat");
    expect(unchanged.comparable).toBe(true);
    expect(unchanged.percent).toBeNull();
  });

  it("cannot return NaN or Infinity in any numeric field, whatever it is fed", () => {
    const nasty = [
      { current: NaN, previous: 10 },
      { current: 10, previous: NaN },
      { current: Infinity, previous: 10 },
      { current: 10, previous: Infinity },
      { current: -5, previous: 10 },
      { current: 1e308, previous: 1 },
    ];
    for (const input of nasty) {
      const trend = computeTrend({ ...input, comparison: "yesterday" });
      expect(Number.isFinite(trend.delta)).toBe(true);
      if (trend.percent !== null) expect(Number.isFinite(trend.percent)).toBe(true);
      expect(["up", "down", "flat", "unknown"]).toContain(trend.direction);
    }
  });

  it("keeps the comparison label it was given, so the UI can say what it compared", () => {
    expect(computeTrend({ current: 5, previous: 10, comparison: "your 7-day average" }).comparison).toBe(
      "your 7-day average",
    );
  });
});

describe("computeTrendVsAverage", () => {
  it("compares against the mean of the window", () => {
    // Mean of [10,20,30] is 20; current 40 is +100%.
    const trend = computeTrendVsAverage(40, [10, 20, 30], "your 7-day average");
    expect(trend.percent).toBe(100);
    expect(trend.direction).toBe("up");
  });

  it("does not produce NaN from an empty window", () => {
    // mean of [] is NaN, which would poison every downstream comparison.
    const trend = computeTrendVsAverage(20, [], "your 7-day average");
    expect(Number.isFinite(trend.delta)).toBe(true);
    expect(trend.percent).toBeNull();
    expect(trend.direction).toBe("up");
  });

  it("ignores non-finite entries rather than letting one poison the mean", () => {
    const trend = computeTrendVsAverage(20, [10, NaN, 30], "your 7-day average");
    // Mean of the finite [10, 30] is 20, so 20 is flat.
    expect(trend.direction).toBe("flat");
    expect(Number.isFinite(trend.percent ?? 0)).toBe(true);
  });
});

describe("formatting", () => {
  it("signs deltas and uses a real minus sign", () => {
    expect(formatDelta(42)).toBe("+42");
    // U+2212, not a hyphen: it aligns in tabular figures and reads as a minus.
    expect(formatDelta(-3)).toBe("\u22123");
    expect(formatDelta(0)).toBe("0");
  });

  it("never renders a percentage it does not have", () => {
    expect(formatPercent(null)).toBeNull();
    expect(formatPercent(Number.NaN)).toBeNull();
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("signs percentages and rounds to whole numbers", () => {
    expect(formatPercent(12.4)).toBe("+12%");
    expect(formatPercent(-60)).toBe("\u221260%");
    expect(formatPercent(0.2)).toBe("0%");
  });

  it("collapses a sub-1% delta to 0% rather than showing +0%", () => {
    // "+0%" reads as an increase that did not happen.
    expect(formatPercent(0.4)).toBe("0%");
    expect(formatDelta(0.4)).toBe("0");
  });
});
