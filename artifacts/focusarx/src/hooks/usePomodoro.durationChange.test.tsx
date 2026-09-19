import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { usePomodoro } from "./usePomodoro";

/**
 * Changing a session's length used to be possible only before pressing
 * start — once a block was running or paused, the clock was locked and the
 * only escape was abandoning the session. The contract now:
 *
 *   idle    → setCustomDuration pre-arms the clock (existing behaviour),
 *   paused  → setCustomDuration re-arms the block at the new length,
 *   running → the live clock is never rewritten mid-tick.
 */
describe("usePomodoro duration changes (pause → re-arm)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  const render = () =>
    renderHook(() =>
      usePomodoro({ persistKey: "duration-test", enableLeader: false, config: { focusDuration: 1500 } }),
    );

  it("pre-arms the idle clock (existing behaviour)", () => {
    const hook = render();
    expect(hook.result.current.secondsLeft).toBe(1500);
    act(() => {
      hook.result.current.setCustomDuration("focus", 3000);
    });
    expect(hook.result.current.secondsLeft).toBe(3000);
    hook.unmount();
  });

  it("never rewrites the clock while running", () => {
    const hook = render();
    act(() => {
      hook.result.current.toggle(); // idle → running
    });
    expect(hook.result.current.status).toBe("running");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const live = hook.result.current.secondsLeft;
    act(() => {
      hook.result.current.setCustomDuration("focus", 60);
    });
    // The config change must not teleport a ticking session.
    expect(hook.result.current.secondsLeft).toBe(live);
    expect(hook.result.current.status).toBe("running");
    hook.unmount();
  });

  it("re-arms the block at the new length while paused", () => {
    const hook = render();
    act(() => {
      hook.result.current.toggle(); // running
    });
    act(() => {
      vi.advanceTimersByTime(30_000); // 30 s into the 25-minute block
    });
    act(() => {
      hook.result.current.toggle(); // paused
    });
    expect(hook.result.current.status).toBe("paused");
    expect(hook.result.current.secondsLeft).toBe(1500 - 30);

    act(() => {
      hook.result.current.setCustomDuration("focus", 50 * 60);
    });
    expect(hook.result.current.secondsLeft).toBe(3000);
    // Still paused — the user resumes into the fresh block.
    expect(hook.result.current.status).toBe("paused");

    act(() => {
      hook.result.current.toggle(); // resume
    });
    expect(hook.result.current.status).toBe("running");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    // Deadline math can land ±1 s either side of the exact second.
    expect(hook.result.current.secondsLeft).toBeGreaterThanOrEqual(2989);
    expect(hook.result.current.secondsLeft).toBeLessThanOrEqual(2991);
    hook.unmount();
  });
});
