import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { TrendPill, formatAbsChange, formatPercentChange } from "./trend-pill";
import type { Trend } from "@/types/trend";

/**
 * The trend pill is where the API's "I cannot honestly compute a percentage"
 * case becomes visible to a human. These tests exist to make sure the three
 * different shapes of trend — percentage, absolute delta, and refusal — stay
 * visually and textually distinct, and that a metric going the wrong way is
 * never painted in the success colour.
 */

afterEach(cleanup);

function trend(overrides: Partial<Trend> = {}): Trend {
  return {
    direction: "up",
    delta: 12,
    percent: 12,
    comparison: "yesterday",
    comparable: true,
    ...overrides,
  };
}

describe("formatPercentChange", () => {
  it("renders null for a missing percentage rather than 0%", () => {
    // The whole point: `percent: null` means "no honest percentage exists".
    // Coercing it to 0% would describe a first-ever session as "no change".
    expect(formatPercentChange(null)).toBeNull();
    expect(formatPercentChange(undefined)).toBeNull();
    expect(formatPercentChange(Number.NaN)).toBeNull();
    expect(formatPercentChange(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("uses U+2212 MINUS SIGN so the glyph aligns with +", () => {
    expect(formatPercentChange(-36)).toBe("\u221236%");
    expect(formatPercentChange(-36)).not.toContain("-");
    expect(formatPercentChange(12.4)).toBe("+12%");
    expect(formatPercentChange(0.2)).toBe("0%");
  });
});

describe("formatAbsChange", () => {
  it("signs the delta and never emits NaN", () => {
    expect(formatAbsChange(8)).toBe("+8");
    expect(formatAbsChange(-3)).toBe("\u22123");
    expect(formatAbsChange(0)).toBe("0");
    expect(formatAbsChange(Number.NaN)).toBe("0");
  });
});

describe("TrendPill", () => {
  it("distinguishes 'no data' from 'steady' in words, not just colour", () => {
    // A dead account and a perfectly consistent one must not look alike. The
    // old dashboard had no direction at all; the naive fix (treat 0/0 as 0%)
    // would have made them identical.
    const { unmount } = render(<TrendPill trend={trend({ direction: "unknown", delta: 0, percent: null, comparable: false })} />);
    expect(screen.getByText(/no comparison yet/i)).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
    unmount();

    render(<TrendPill trend={trend({ direction: "flat", delta: 0, percent: 0 })} />);
    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.queryByText(/no comparison yet/i)).toBeNull();
  });

  it("falls back to the absolute delta when a percentage would mislead", () => {
    // 1 → 9 minutes. `comparable: true` (a direction is defensible) but
    // `percent: null` (a baseline of 1 cannot support a percentage — the naive
    // figure would be +800%). The delta in minutes is the honest signal.
    render(
      <TrendPill
        trend={trend({ direction: "up", delta: 8, percent: null, comparable: true })}
        unit="m"
      />,
    );
    expect(screen.getByText("+8m")).toBeTruthy();
  });

  it("shows nothing numeric when there is no defensible direction", () => {
    render(<TrendPill trend={trend({ direction: "unknown", delta: 5, percent: null, comparable: false })} unit="m" />);
    // Even though `delta` is non-zero, `comparable: false` means do not claim it.
    expect(screen.queryByText(/^\+5m$/)).toBeNull();
    expect(screen.getByText(/no comparison yet/i)).toBeTruthy();
  });

  it("treats a missing trend exactly like an unknown one", () => {
    render(<TrendPill trend={null} />);
    expect(screen.getByText(/no comparison yet/i)).toBeTruthy();
  });

  it("paints a fall to the good colour when less is better", () => {
    // Time-to-complete: down is the win. Colour must follow `goodDirection`,
    // not the raw arrow, or the card congratulates a regression.
    render(<TrendPill trend={trend({ direction: "down", delta: -4, percent: -20 })} goodDirection="down" />);
    const pill = screen.getByText("\u221220%").parentElement as HTMLElement;
    expect(pill.className).toContain("var(--success)");
    cleanup();

    render(<TrendPill trend={trend({ direction: "down", delta: -4, percent: -20 })} />);
    const defaultPill = screen.getByText("\u221220%").parentElement as HTMLElement;
    expect(defaultPill.className).toContain("var(--danger)");
  });

  it("does not paint 'flat' as success", () => {
    render(<TrendPill trend={trend({ direction: "flat", delta: 0, percent: 0 })} />);
    const pill = screen.getByText("0%").parentElement as HTMLElement;
    expect(pill.className).not.toContain("var(--success)");
    expect(pill.className).toContain("var(--foreground-muted)");
  });

  it("carries the direction in text for screen readers, since the arrow is decorative", () => {
    render(<TrendPill trend={trend({ direction: "up", delta: 12, percent: 12, comparison: "your 7-day average" })} />);
    expect(screen.getByText("+12% up vs your 7-day average")).toBeTruthy();
  });

  it("exposes the state as a data attribute so styling and tests share one source of truth", () => {
    const { container } = render(<TrendPill trend={trend({ direction: "down", delta: -2, percent: -10 })} />);
    expect(container.querySelector('[data-trend="down"]')).toBeTruthy();
  });

  it("prefers the caller's wording over the server's baseline label", () => {
    render(<TrendPill trend={trend({ comparison: "yesterday" })} comparisonLabel="last Monday" />);
    expect(screen.getByText("vs last Monday")).toBeTruthy();
    expect(screen.queryByText("vs yesterday")).toBeNull();
  });
});
