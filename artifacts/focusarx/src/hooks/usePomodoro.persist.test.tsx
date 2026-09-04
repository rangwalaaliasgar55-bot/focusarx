import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { usePomodoro } from "./usePomodoro";

const KEY = "test-guest-timer";

describe("usePomodoro guest persistence + leader (Phase 5.3 regression)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("restores a running session after unmount/remount with wall-clock remaining", () => {
    const first = renderHook(() =>
      usePomodoro({ persistKey: KEY, enableLeader: false, config: { focusDuration: 1500 } }),
    );
    act(() => {
      first.result.current.toggle(); // idle → running, deadline = now + 1500 s
    });
    expect(first.result.current.status).toBe("running");

    // A few seconds of "ticks" pass; the throttled guest save fires.
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    first.unmount();

    // Ten wall-clock minutes later a fresh mount resumes, not restarts.
    vi.setSystemTime(1_000_000 + 600_000);
    const second = renderHook(() =>
      usePomodoro({ persistKey: KEY, enableLeader: false, config: { focusDuration: 1500 } }),
    );
    expect(second.result.current.status).toBe("running");
    // 1500 s slice minus 600 s elapsed ≈ 900 s left (deadline preserved).
    expect(second.result.current.secondsLeft).toBeLessThanOrEqual(900);
    expect(second.result.current.secondsLeft).toBeGreaterThan(890);
    second.unmount();
  });

  it("restores a paused session verbatim (no decay while paused)", () => {
    const first = renderHook(() =>
      usePomodoro({ persistKey: KEY, enableLeader: false, config: { focusDuration: 1500 } }),
    );
    act(() => {
      first.result.current.toggle(); // running
    });
    act(() => {
      first.result.current.toggle(); // paused (separate tick: fresh state)
    });
    expect(first.result.current.status).toBe("paused");
    const left = first.result.current.secondsLeft;
    first.unmount();

    vi.setSystemTime(1_000_000 + 3_600_000);
    const second = renderHook(() =>
      usePomodoro({ persistKey: KEY, enableLeader: false, config: { focusDuration: 1500 } }),
    );
    expect(second.result.current.status).toBe("paused");
    expect(second.result.current.secondsLeft).toBe(left);
    second.unmount();
  });

  it("clears the snapshot on reset (no stale resume)", () => {
    const first = renderHook(() =>
      usePomodoro({ persistKey: KEY, enableLeader: false, config: { focusDuration: 1500 } }),
    );
    act(() => {
      first.result.current.toggle();
    });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    act(() => {
      first.result.current.reset();
    });
    first.unmount();

    const second = renderHook(() =>
      usePomodoro({ persistKey: KEY, enableLeader: false, config: { focusDuration: 1500 } }),
    );
    expect(second.result.current.status).toBe("idle");
    expect(second.result.current.secondsLeft).toBe(1500);
    second.unmount();
  });

  it("without persistKey there is nothing to restore (server path owns it)", () => {
    const first = renderHook(() =>
      usePomodoro({ enableLeader: false, config: { focusDuration: 1500 } }),
    );
    act(() => {
      first.result.current.toggle();
    });
    first.unmount();
    const second = renderHook(() =>
      usePomodoro({ enableLeader: false, config: { focusDuration: 1500 } }),
    );
    expect(second.result.current.status).toBe("idle");
    second.unmount();
  });
});
