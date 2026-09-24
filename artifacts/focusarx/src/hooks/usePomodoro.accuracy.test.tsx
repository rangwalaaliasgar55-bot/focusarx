import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { usePomodoro } from "./usePomodoro";

/**
 * Timer accuracy.
 *
 * Two ways a countdown can be wrong that no amount of "recompute from the
 * deadline" fixes, because the deadline itself is drawn on a clock the student's
 * device controls:
 *
 *   1. **The wall clock steps.** `Date.now()` moves when the device syncs its
 *      time or the user changes it. A block that trusts it ends early or hangs
 *      for the size of the step. The countdown now counts real elapsed time
 *      from the monotonic clock and moves the deadline by the size of any step,
 *      so the time left is preserved.
 *   2. **A sleeping device credited more than the block was worth.** Ticks stop
 *      while the OS suspends the process, so the first tick after a resume
 *      carries the whole gap. Three hours asleep on a 25-minute block used to be
 *      credited — and paid — as three hours of focus. A phase can no longer
 *      credit more than its own length.
 *
 * `lib/timerAccounting.ts` covers the arithmetic; these tests cover the two
 * integrations, with `performance.now()` mocked separately from `Date.now()` so
 * a clock step can be simulated at all.
 */
describe("usePomodoro accuracy", () => {
  const BASE = 1_700_000_000_000;
  let mono = 0;

  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
    mono = 0;
    vi.spyOn(performance, "now").mockImplementation(() => mono);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  const render = (onSessionComplete?: (s: unknown) => void) =>
    renderHook(() =>
      usePomodoro({
        persistKey: "accuracy-test",
        enableLeader: false,
        config: { focusDuration: 1500, breakDuration: 300, longBreakDuration: 900 },
        onSessionComplete,
      }),
    );

  it("keeps the countdown steady when the device clock steps forward", () => {
    const hook = render();
    act(() => {
      hook.result.current.toggle(); // idle → running, 25:00 on the clock
    });
    expect(hook.result.current.secondsLeft).toBe(1500);

    // Ten seconds of real time, and a tick to absorb them.
    act(() => {
      mono = 10_000;
      vi.setSystemTime(BASE + 10_000);
      vi.advanceTimersByTime(200);
    });
    expect(hook.result.current.secondsLeft).toBe(1490);

    // The device syncs its clock: +10 minutes on the wall clock, one real
    // second of work.
    act(() => {
      mono = 11_000;
      vi.setSystemTime(BASE + 611_000);
      vi.advanceTimersByTime(200);
    });

    // One second came off the clock, not ten minutes.
    expect(hook.result.current.secondsLeft).toBe(1489);
    hook.unmount();
  });

  it("keeps the countdown steady when the device clock steps backward", () => {
    const hook = render();
    act(() => {
      hook.result.current.toggle();
    });
    act(() => {
      mono = 30_000;
      vi.setSystemTime(BASE + 30_000);
      vi.advanceTimersByTime(200);
    });
    expect(hook.result.current.secondsLeft).toBe(1470);

    // Clock set back five minutes.
    act(() => {
      mono = 31_000;
      vi.setSystemTime(BASE + 30_000 - 300_000);
      vi.advanceTimersByTime(200);
    });
    expect(hook.result.current.secondsLeft).toBe(1469);
    hook.unmount();
  });

  it("does not pay for the time a suspended device was asleep", async () => {
    const completed: Array<{ mode: string; durationSeconds: number }> = [];
    const hook = render((s) => completed.push(s as { mode: string; durationSeconds: number }));
    act(() => {
      hook.result.current.toggle();
    });

    // The device sleeps 30 minutes through a 25-minute block. No ticks fire at
    // all, and `performance.now()` is frozen, which is what a suspended page
    // looks like on platforms that pause the monotonic clock.
    act(() => {
      vi.setSystemTime(BASE + 1_800_000);
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(completed).toHaveLength(1);
    expect(completed[0]!.mode).toBe("focus");
    // The block was worked, so the full 25 minutes are credited…
    expect(completed[0]!.durationSeconds).toBe(1500);
    // …and no more. The 30-minute gap does not become 30 minutes of focus.
    expect(completed[0]!.durationSeconds).toBeLessThanOrEqual(1500);
    hook.unmount();
  });

  it("credits a stopped-early phase only for the time actually worked", () => {
    const completed: Array<{ durationSeconds: number }> = [];
    const hook = render((s) => completed.push(s as { durationSeconds: number }));
    act(() => {
      hook.result.current.toggle();
    });

    // Four minutes of real work, then the student ends the phase.
    act(() => {
      mono = 240_000;
      vi.setSystemTime(BASE + 240_000);
      vi.advanceTimersByTime(200);
    });
    act(() => {
      hook.result.current.reset();
    });

    const session = completed.at(-1);
    if (session) {
      expect(session.durationSeconds).toBeLessThanOrEqual(240);
      expect(session.durationSeconds).toBeGreaterThanOrEqual(239);
    }
    hook.unmount();
  });
});
