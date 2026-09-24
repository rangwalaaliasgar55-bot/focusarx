import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { usePomodoro } from "./usePomodoro";

/**
 * The wake-up resync.
 *
 * A locked phone freezes JavaScript, and a background tab is throttled to
 * roughly one tick a minute — in both cases the countdown the user comes back
 * to is wrong by the whole time they were away, and a block that finished
 * while they were gone has not been recorded.
 *
 * These tests simulate that by moving the system clock *without* running any
 * timers (which is exactly what the device did), then firing the event a real
 * browser fires when the page becomes visible again.
 */
describe("usePomodoro wake-up resync", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  const render = (onSessionComplete?: (s: unknown) => void) =>
    renderHook(() =>
      usePomodoro({
        persistKey: "resync-test",
        enableLeader: false,
        config: { focusDuration: 1500, breakDuration: 300, longBreakDuration: 900 },
        onSessionComplete,
      }),
    );

  it("corrects the remaining time the moment the page is visible again", () => {
    const hook = render();
    act(() => {
      hook.result.current.toggle(); // idle → running
    });
    expect(hook.result.current.secondsLeft).toBe(1500);

    // Ten minutes pass while the tab is frozen: no ticks at all.
    act(() => {
      vi.setSystemTime(1_000_000 + 600_000);
    });
    expect(hook.result.current.secondsLeft).toBe(1500); // still stale

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(hook.result.current.secondsLeft).toBe(900);
    hook.unmount();
  });

  it("records a block that finished while the device was asleep", async () => {
    const completed: unknown[] = [];
    const hook = render((s) => completed.push(s));
    act(() => {
      hook.result.current.toggle();
    });

    // 30 minutes asleep on a 25-minute block.
    act(() => {
      vi.setSystemTime(1_000_000 + 1800_000);
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      // Completion is queued as a microtask by the tick.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(completed).toHaveLength(1);
    const session = completed[0] as { mode: string; durationSeconds: number };
    expect(session.mode).toBe("focus");
    // The full planned block was worked: the clock ran to its deadline.
    expect(session.durationSeconds).toBeGreaterThanOrEqual(1499);
    // …and the timer moved on to the break rather than sitting on 00:00.
    expect(hook.result.current.mode).toBe("break");
    expect(hook.result.current.status).toBe("running");
    hook.unmount();
  });

  it("does not resync while the page is hidden", () => {
    const hook = render();
    act(() => {
      hook.result.current.toggle();
    });
    act(() => {
      vi.setSystemTime(1_000_000 + 600_000);
    });

    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    hidden.mockRestore();

    // Still the frozen value — nothing updates until the page is actually back.
    expect(hook.result.current.secondsLeft).toBe(1500);
    hook.unmount();
  });

  it("schedules nothing while idle", () => {
    const hook = render();
    expect(hook.result.current.status).toBe("idle");
    act(() => {
      vi.setSystemTime(1_000_000 + 600_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(hook.result.current.secondsLeft).toBe(1500);
    hook.unmount();
  });
});
