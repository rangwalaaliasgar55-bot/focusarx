import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { StatCard } from "./stat-card";
import type { Trend } from "@/types/trend";

/**
 * StatCard's contract: a headline number never ships without its meaning.
 *
 * `AnimatedCounter` reads `prefers-reduced-motion` and, under reduced motion,
 * renders the final value on the first paint. jsdom's `matchMedia` stub returns
 * `matches: false`, and the IntersectionObserver stub never fires, so without
 * this the counter would sit at `0` forever and every assertion below would be
 * about the animation rather than the card. Forcing reduced motion is the
 * honest way to test the settled state.
 */

const realMatchMedia = window.matchMedia;

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
  vi.restoreAllMocks();
});

const upTrend: Trend = { direction: "up", delta: 12, percent: 25, comparison: "yesterday", comparable: true };

describe("StatCard", () => {
  it("renders the number, its unit and its label", () => {
    render(<StatCard label="Minutes focused" value={42} unit="min" trend={upTrend} detail="protected today" />);
    expect(screen.getByText("Minutes focused")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("min")).toBeTruthy();
    expect(screen.getByText("protected today")).toBeTruthy();
  });

  it("always pairs the value with a direction", () => {
    // "A metric without direction is incomplete." There is no prop combination
    // that produces a bare number: omitting `trend` renders the unknown state,
    // which is a claim ("we have nothing to compare") rather than an omission.
    render(<StatCard label="Focus score" value={80} />);
    expect(screen.getByText(/no comparison yet/i)).toBeTruthy();
  });

  it("passes the absolute-delta fallback through with the metric's own unit", () => {
    render(
      <StatCard
        label="Minutes focused"
        value={9}
        unit="min"
        trend={{ direction: "up", delta: 8, percent: null, comparison: "yesterday", comparable: true }}
      />,
    );
    expect(screen.getByText("+8min")).toBeTruthy();
  });

  it("uses a distinct unit for the trend when the value's unit would mislead", () => {
    // The value is a score out of 100; the change is in points, not in "pts"
    // of the same scale. Callers can say so.
    render(
      <StatCard
        label="Focus score"
        value={80}
        trend={{ direction: "down", delta: -6, percent: null, comparison: "last week", comparable: true }}
        trendUnit=" pts"
      />,
    );
    expect(screen.getByText("\u22126 pts")).toBeTruthy();
  });

  it("wraps in a focusable link when given a destination", () => {
    render(<StatCard label="Streak" value={14} href="/stats" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/stats");
    // Fitts's Law: the whole card is the target, not a small chevron.
    expect(link.className).toContain("focus-visible:ring-2");
  });

  it("does not render a link when there is nowhere to go", () => {
    render(<StatCard label="Streak" value={14} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("accepts a preformatted string value without animating it", () => {
    render(<StatCard label="Level" value="Gold III" />);
    expect(screen.getByText("Gold III")).toBeTruthy();
  });

  it("draws a sparkline only when a shape can actually be drawn", () => {
    // Scoped to `[data-sparkline]`: the trend pill also renders an <svg> icon,
    // so a bare `querySelector("svg")` would assert against the wrong element.
    const { container, unmount } = render(<StatCard label="M" value={5} sparkline={[1, 2, 3]} />);
    expect(container.querySelector("[data-sparkline] path")).toBeTruthy();
    unmount();

    // One point is a dot, not a trend; zero points is nothing.
    const { container: one } = render(<StatCard label="M" value={5} sparkline={[1]} />);
    expect(one.querySelector("[data-sparkline]")).toBeNull();
  });

  it("does not emit NaN coordinates for a perfectly flat series", () => {
    // max - min is 0 here, and the naive `(v - min) / (max - min)` divides by
    // zero. An SVG path full of NaN silently renders nothing, so this would
    // look like "no data" instead of "steady".
    const { container } = render(<StatCard label="M" value={5} sparkline={[3, 3, 3, 3]} />);
    const d = container.querySelector("[data-sparkline] path")?.getAttribute("d") ?? "";
    expect(d).not.toContain("NaN");
    expect(d).toContain("L");
  });

  it("lets a badge replace the trend row when the context is not a time comparison", () => {
    // A streak's meaningful context is its personal record, not last week.
    // Forcing `computeTrend` on it would either invent a baseline or render
    // "no comparison yet" on a card that has something real to say.
    render(<StatCard label="Current streak" value={14} badge={<span>Personal best</span>} trend={null} />);
    expect(screen.getByText("Personal best")).toBeTruthy();
    expect(screen.queryByText(/no comparison yet/i)).toBeNull();
  });

  it("marks the primary KPI visually without changing the data contract", () => {
    const { container } = render(<StatCard label="Minutes" value={42} emphasis="primary" trend={upTrend} />);
    // The primary card is larger; hierarchy is expressed in scale, not in a
    // different component or a different data shape.
    expect(container.querySelector(".text-5xl")).toBeTruthy();
  });
});
