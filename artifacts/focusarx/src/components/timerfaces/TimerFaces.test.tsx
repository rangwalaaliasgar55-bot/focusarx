import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import {
  TimerFaceBars,
  TimerFaceDots,
  TimerFaceRounds,
  TimerFaceSegments,
  sessionTotal,
} from "./TimerFaces";

/**
 * The four layout faces answer "how much is left?" by drawing a picture whose
 * size depends on the session's *total* length — minutes on the segments dial,
 * bars on the minute bars, blocks on the dot grid, rounds on the pips.
 *
 * They used to recover that total by dividing the remaining seconds by
 * `progress`. `progress` is the *elapsed* fraction, so that inversion returned
 * the reciprocal: a 25-minute block was read as 15 million seconds long the
 * instant it started and as 63 seconds in its last minute. The segments dial
 * duly tried to draw about 250,000 marks; the other three quietly drew the
 * wrong picture for the whole session.
 *
 * These tests pin the arithmetic (`sessionTotal`) and then the rendered result,
 * because the unit test alone would not have caught a face still dividing by
 * the wrong quantity.
 */

afterEach(cleanup);

/** A 25-minute block at a given number of seconds remaining. */
const face = (secondsLeft: number) => ({
  secondsLeft,
  progress: 1 - secondsLeft / 1500,
  totalSeconds: 1500,
  mode: "focus" as const,
  isRunning: true,
  onEditClick: undefined,
  accent: "#fff",
  accentSoft: "#333",
});

describe("sessionTotal", () => {
  it("prefers the authoritative total over anything derived", () => {
    // progress=0 is the idle start, where the derived form is meaningless.
    expect(sessionTotal(1500, 0, 1500)).toBe(1500);
  });

  it("falls back to the elapsed-fraction inversion when no total is given", () => {
    // 1 - progress = secondsLeft/total, so total = secondsLeft/(1 - progress).
    expect(sessionTotal(750, 0.5)).toBe(1500);
    expect(sessionTotal(1200, 0.2)).toBe(1500);
    expect(sessionTotal(300, 0.8)).toBe(1500);
  });

  it("never returns a zero or negative length", () => {
    expect(sessionTotal(0, 1, 0)).toBeGreaterThanOrEqual(1);
    expect(sessionTotal(0, 1)).toBeGreaterThanOrEqual(1);
  });

  it("is stable across the whole session", () => {
    // The bug was largest at the start and inverted near the end; a correct
    // total is the same number at every tick.
    for (const secondsLeft of [1500, 1400, 1200, 900, 750, 300, 60, 1]) {
      expect(sessionTotal(secondsLeft, 1 - secondsLeft / 1500, 1500)).toBe(1500);
    }
  });
});

describe("segments face", () => {
  it("draws one segment per minute of the session, not per minute of a broken total", () => {
    const { container } = render(<TimerFaceSegments {...face(1500)} />);
    // A 25-minute block is 25 marks. The inverted total (~15,000,000s) asked
    // for ~250,000 of them and locked the tab up.
    expect(container.querySelectorAll("svg circle")).toHaveLength(25);
    expect(screen.getByText("25 of 25 minutes left")).toBeTruthy();
  });

  it("counts minutes down as the block runs", () => {
    render(<TimerFaceSegments {...face(600)} />);
    expect(screen.getByText("10 of 25 minutes left")).toBeTruthy();
  });
});

describe("bars face", () => {
  it("caps at twelve bars for a long session", () => {
    const { container } = render(
      <TimerFaceBars {...{ ...face(10800), totalSeconds: 10800, progress: 0 }} />,
    );
    expect(container.querySelectorAll(".rounded-full")).toHaveLength(12);
  });

  it("treats a 25-minute block as one bar per ~2 minutes, not thousands", () => {
    const { container } = render(<TimerFaceBars {...face(1500)} />);
    const bars = container.querySelectorAll(".rounded-full");
    expect(bars.length).toBeGreaterThanOrEqual(4);
    expect(bars.length).toBeLessThanOrEqual(12);
  });
});

describe("dots face", () => {
  it("draws one dot per five-minute block of a 25-minute session", () => {
    const { container } = render(<TimerFaceDots {...face(1500)} />);
    expect(container.querySelectorAll("span.rounded-full")).toHaveLength(5);
    expect(screen.getByText(/5 of 5 blocks left/)).toBeTruthy();
  });

  it("keeps a four-hour session a grid of at most 24 blocks", () => {
    const { container } = render(
      <TimerFaceDots {...{ ...face(14400), totalSeconds: 14400, progress: 0 }} />,
    );
    expect(container.querySelectorAll("span.rounded-full").length).toBeLessThanOrEqual(24);
  });
});

describe("rounds face", () => {
  it("treats a 25-minute block as exactly one round", () => {
    render(<TimerFaceRounds {...face(1500)} />);
    expect(screen.getByText(/round 1 of 1/)).toBeTruthy();
  });

  it("splits a 90-minute block into four 23-minute rounds", () => {
    render(<TimerFaceRounds {...{ ...face(5400), totalSeconds: 5400, progress: 0 }} />);
    // 5400s / 1500s per round = 4 rounds of ~23 minutes. The inverted
    // derivation read this block as 63 seconds and drew a single round.
    expect(screen.getByText(/round 1 of 4/)).toBeTruthy();
    expect(screen.getByText(/3 rounds after this/)).toBeTruthy();
  });

  it("caps a six-hour block at eight rounds", () => {
    render(<TimerFaceRounds {...{ ...face(21600), totalSeconds: 21600, progress: 0 }} />);
    expect(screen.getByText(/round 1 of 8/)).toBeTruthy();
  });
});