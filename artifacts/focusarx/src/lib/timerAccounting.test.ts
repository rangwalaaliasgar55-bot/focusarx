import { describe, it, expect } from "vitest";
import {
  CLOCK_JUMP_THRESHOLD_MS,
  clockSkewMs,
  creditSeconds,
  elapsedMs,
  hasMonoProgress,
  isClockJump,
  monoSince,
  shiftDeadlineForClockJump,
} from "./timerAccounting";

describe("elapsedMs", () => {
  it("trusts the monotonic clock over the wall clock", () => {
    // The wall clock stepped forward 10 minutes; only 1 s of real time passed.
    expect(elapsedMs(601_000, 1_000)).toBe(1_000);
  });

  it("falls back to the wall delta when the monotonic reading is unusable", () => {
    // A frozen monotonic clock is what a suspended page looks like on some
    // platforms: the wall clock is then the only evidence of elapsed time.
    expect(elapsedMs(1_000, 0)).toBe(1_000);
    expect(elapsedMs(1_000, Number.NaN)).toBe(1_000);
    expect(elapsedMs(1_000, -5)).toBe(1_000);
    expect(elapsedMs(Number.NaN, Number.NaN)).toBe(0);
  });

  it("reports whether a monotonic interval is usable at all", () => {
    expect(hasMonoProgress(1)).toBe(true);
    expect(hasMonoProgress(0)).toBe(false);
    expect(hasMonoProgress(Number.NaN)).toBe(false);
  });

  it("has no monotonic sample to compare against without a stored one", () => {
    expect(Number.isNaN(monoSince(null))).toBe(true);
  });

  it("never returns negative time", () => {
    expect(elapsedMs(-3_000, 0)).toBe(0);
  });

  it("reports a backward wall step as negative skew", () => {
    // Clock set back five minutes while one real second passed. Ignoring this
    // leaves the timer hanging for the length of the step.
    expect(clockSkewMs(-300_000, 1_000)).toBe(-301_000);
  });
});

describe("clock skew", () => {
  it("ignores scheduling jitter", () => {
    expect(isClockJump(1_050, 1_000)).toBe(false);
    expect(isClockJump(999, 1_000)).toBe(false);
  });

  it("flags a step in either direction", () => {
    expect(isClockJump(601_000, 1_000)).toBe(true);
    expect(isClockJump(1_000, 31_000)).toBe(true); // the clock was set back
  });

  it("does not mistake a sleeping device for a clock step", () => {
    // 30 minutes of wall clock, no monotonic progress: the device slept, so the
    // countdown should keep counting rather than shift its deadline.
    expect(clockSkewMs(1_800_000, 0)).toBe(0);
    expect(isClockJump(1_800_000, 0)).toBe(false);
    expect(isClockJump(1_800_000, Number.NaN)).toBe(false);
  });
});

describe("shiftDeadlineForClockJump", () => {
  it("moves the deadline by the step, so the countdown is unchanged", () => {
    // Story: 10 minutes of a block are left at wall time 400 000. One second of
    // real time passes and the wall clock steps forward 10 minutes.
    const wallBefore = 400_000;
    const wallDelta = 600_000;
    const monoDelta = 1_000;
    const deadline = wallBefore + 600_000;

    const shifted = shiftDeadlineForClockJump(deadline, wallDelta, monoDelta)!;
    expect(shifted).toBe(deadline + (wallDelta - monoDelta));

    // The countdown is preserved: exactly the one real second was spent.
    const wallNowAfter = wallBefore + wallDelta;
    expect(shifted - wallNowAfter).toBe(600_000 - monoDelta);
  });

  it("leaves a deadline alone for ordinary jitter", () => {
    expect(shiftDeadlineForClockJump(1_000_000, 1_400, 1_000)).toBe(1_000_000);
    expect(shiftDeadlineForClockJump(1_000_000, 0, 1_500)).toBe(1_000_000);
    expect(CLOCK_JUMP_THRESHOLD_MS).toBeGreaterThan(1_500);
  });

  it("leaves the deadline alone when the device slept", () => {
    expect(shiftDeadlineForClockJump(1_000_000, 1_800_000, 0)).toBe(1_000_000);
  });

  it("handles a paused timer with no deadline", () => {
    expect(shiftDeadlineForClockJump(null, 61_000, 1_000)).toBeNull();
  });

  it("uses a caller-supplied threshold", () => {
    // skew = 5 000 - 1 000 = 4 000, which clears the 1 000 ms threshold.
    expect(shiftDeadlineForClockJump(1_000, 5_000, 1_000, 1_000)).toBe(5_000);
  });
});

describe("creditSeconds", () => {
  it("credits the tracked time when the phase was worked as planned", () => {
    expect(creditSeconds(1_500, 1_500)).toBe(1_500);
    expect(creditSeconds(1_499.8, 1_500)).toBe(1_499);
  });

  it("caps a suspended device at the phase length", () => {
    // Three hours asleep on a 25-minute block: the gap arrives as one delta.
    expect(creditSeconds(10_800, 1_500)).toBe(1_500);
  });

  it("keeps an early exit honest", () => {
    // The student stopped the phase after 4 minutes of a 25-minute block.
    expect(creditSeconds(240, 1_500)).toBe(240);
  });

  it("survives nonsense input", () => {
    expect(creditSeconds(Number.NaN, 1_500)).toBe(0);
    expect(creditSeconds(-30, 1_500)).toBe(0);
    expect(creditSeconds(600, Number.NaN)).toBe(600);
  });
});
