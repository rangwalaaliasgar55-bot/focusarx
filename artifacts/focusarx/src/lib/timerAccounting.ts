/**
 * Timer accounting — the arithmetic that decides how accurate the countdown is.
 *
 * The countdown reads a deadline rather than subtracting a fixed second, which
 * already survives late ticks (a throttled background tab, a locked phone).
 * Two accuracy holes remained, and both are about *which* clock to trust:
 *
 *   1. **The wall clock can move on its own.** `Date.now()` steps when the
 *      device syncs its time (a minute of NTP correction is normal), and a
 *      student can change it. A timer that trusts it either ends early or hangs
 *      for the size of the step. The monotonic clock (`performance.now()`)
 *      cannot jump. So: count real elapsed time from the monotonic clock, and
 *      when the two disagree by more than a plausible tick, move the persisted
 *      wall-clock deadline by exactly that step so the *remaining* time is
 *      preserved. `timerPersistence` still stores a wall-clock deadline, which
 *      is what makes resume-after-reload work.
 *   2. **A suspended device credited more than the block was worth.** Ticks
 *      stop while the OS sleeps the process, so the first tick after a resume
 *      carries the whole gap as one delta. A 25-minute block that finished
 *      three hours ago was credited — and paid — as three hours of focus. A
 *      phase can never credit more than its own length.
 *
 * Pure functions, so the arithmetic is testable without a timer or a browser.
 */

/** A step larger than this between the two clocks is a clock jump, not jitter. */
export const CLOCK_JUMP_THRESHOLD_MS = 2_000;

/** A monotonic sample, or null where the platform has none (SSR, old engines). */
export function monoNow(): number | null {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : null;
}

/**
 * Monotonic milliseconds since `last`, or `NaN` when the interval cannot be
 * measured that way (no sample, no clock, or a clock that did not advance —
 * which is what a suspended page looks like on platforms that freeze
 * `performance.now()`).
 */
export function monoSince(last: number | null): number {
  const now = monoNow();
  if (now == null || last == null) return Number.NaN;
  return now - last;
}

/** True when the monotonic interval is real, positive evidence of elapsed time. */
export function hasMonoProgress(monoDeltaMs: number): boolean {
  return Number.isFinite(monoDeltaMs) && monoDeltaMs > 0;
}

/**
 * Real elapsed milliseconds between two samples.
 *
 * The monotonic delta is the truth whenever it is usable. When it is not — no
 * clock, no sample, or a frozen reading — the wall delta is the only estimate
 * left, and it is the right one for a device that slept through the interval.
 */
export function elapsedMs(wallDeltaMs: number, monoDeltaMs: number): number {
  if (hasMonoProgress(monoDeltaMs)) return monoDeltaMs;
  return Number.isFinite(wallDeltaMs) ? Math.max(0, wallDeltaMs) : 0;
}

/**
 * How far the wall clock moved relative to real time, or `0` when the interval
 * cannot be judged (see `hasMonoProgress` — a frozen monotonic clock means
 * "the device slept", not "the wall clock lied").
 *
 * A *negative* wall delta is included on purpose: that is the clock being set
 * back, and a timer that ignores it hangs for the length of the step.
 */
export function clockSkewMs(wallDeltaMs: number, monoDeltaMs: number): number {
  if (!hasMonoProgress(monoDeltaMs) || !Number.isFinite(wallDeltaMs)) return 0;
  return wallDeltaMs - monoDeltaMs;
}

/**
 * The deadline, corrected for a clock step.
 *
 * Moving the deadline by the step is what preserves the countdown: if the wall
 * clock jumped forward 60 s, the deadline (also wall-clock) must jump forward
 * 60 s or the timer would lose that minute. Below the threshold the deadline is
 * returned untouched, so ordinary jitter cannot accumulate into drift.
 */
export function shiftDeadlineForClockJump(
  deadlineMs: number | null,
  wallDeltaMs: number,
  monoDeltaMs: number,
  thresholdMs: number = CLOCK_JUMP_THRESHOLD_MS,
): number | null {
  if (deadlineMs == null || !isClockJump(wallDeltaMs, monoDeltaMs, thresholdMs)) return deadlineMs;
  return deadlineMs + clockSkewMs(wallDeltaMs, monoDeltaMs);
}

/**
 * True when the two clocks disagree by more than a plausible tick *and* the
 * monotonic clock moved — i.e. a real step of the wall clock, not a device that
 * was asleep.
 */
export function isClockJump(
  wallDeltaMs: number,
  monoDeltaMs: number,
  thresholdMs: number = CLOCK_JUMP_THRESHOLD_MS,
): boolean {
  const skew = clockSkewMs(wallDeltaMs, monoDeltaMs);
  return skew !== 0 && Math.abs(skew) >= thresholdMs;
}

/**
 * Seconds a phase may credit.
 *
 * `floor` keeps the ledger honest at sub-second granularity, and the cap keeps a
 * suspended device from minting time it did not work: the maximum a phase can
 * credit is its own planned length. A phase shortened by the student (an early
 * exit) credits only what was actually tracked, which is the smaller number.
 */
export function creditSeconds(activeSeconds: number, nominalSeconds: number): number {
  const tracked = Number.isFinite(activeSeconds) ? Math.floor(Math.max(0, activeSeconds)) : 0;
  const nominal = Number.isFinite(nominalSeconds) ? Math.floor(Math.max(1, nominalSeconds)) : 0;
  if (nominal === 0) return tracked;
  return Math.min(tracked, nominal);
}
