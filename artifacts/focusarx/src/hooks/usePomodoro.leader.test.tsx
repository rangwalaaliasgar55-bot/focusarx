import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { usePomodoro } from "./usePomodoro";

/**
 * Two-tab single-timer contract (P0.3): with a shared `navigator.locks`
 * mock (first holder wins, like the real browser-wide lock), the second
 * tab stands down to paused + `leaderBlocked`, and only the leader ever
 * records a completion — even across the follower's own deadline.
 */
function installMockLocks() {
  let held = false;
  const request = vi.fn(
    (
      _name: string,
      _opts: unknown,
      callback: (lock: unknown) => unknown,
    ): Promise<unknown> => {
      if (held) {
        callback(null);
        return Promise.resolve(undefined);
      }
      held = true;
      return Promise.resolve()
        .then(() => callback({ name: "focusarx-timer-leader" }))
        .then((inner) => {
          // The leader holds the lock until its grant is released (the
          // inner promise from timerLeader resolves on release).
          if (inner && typeof (inner as Promise<void>).then === "function") {
            return (inner as Promise<void>).then(() => {
              held = false;
            });
          }
          held = false;
          return undefined;
        });
    },
  );
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
  return () => {
    Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
  };
}

describe("usePomodoro cross-tab leader (P0.3)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("second tab stands down; only the leader records the session", async () => {
    const restoreLocks = installMockLocks();
    try {
      const onCompleteLeader = vi.fn();
      const onCompleteFollower = vi.fn();

      const leader = renderHook(() =>
        usePomodoro({ onSessionComplete: onCompleteLeader, config: { focusDuration: 5 } }),
      );
      const follower = renderHook(() =>
        usePomodoro({ onSessionComplete: onCompleteFollower, config: { focusDuration: 5 } }),
      );

      act(() => {
        leader.result.current.start();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(leader.result.current.status).toBe("running");

      // Second tab starts the same slice while the leader holds the lock.
      act(() => {
        follower.result.current.start();
      });
      // Election retries (~150 ms × 4) then stands down.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(follower.result.current.status).toBe("paused");
      expect(follower.result.current.leaderBlocked).toBe(true);
      // Follower mirrors the leader's live heartbeat instead of its own clock.
      expect(follower.result.current.mirror).toMatchObject({ mode: "focus", status: "running" });
      expect(leader.result.current.status).toBe("running");
      expect(leader.result.current.leaderBlocked).toBe(false);

      // Both deadlines pass (both slices were 5 s from the same frozen start).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });

      expect(onCompleteLeader).toHaveBeenCalledTimes(1);
      expect(onCompleteLeader.mock.calls[0]?.[0]).toMatchObject({ mode: "focus" });
      expect(onCompleteFollower).not.toHaveBeenCalled();

      leader.unmount();
      follower.unmount();
    } finally {
      restoreLocks();
    }
  });

  it("the follower can take the lead once the leader releases", async () => {
    const restoreLocks = installMockLocks();
    try {
      const first = renderHook(() => usePomodoro({ config: { focusDuration: 1500 } }));
      const second = renderHook(() => usePomodoro({ config: { focusDuration: 1500 } }));

      act(() => {
        first.result.current.start();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      act(() => {
        second.result.current.start();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(second.result.current.leaderBlocked).toBe(true);

      // Leader pauses → grant released → follower retries and wins.
      act(() => {
        first.result.current.pause();
      });
      act(() => {
        second.result.current.toggle(); // paused → running, re-races the election
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(second.result.current.status).toBe("running");
      expect(second.result.current.leaderBlocked).toBe(false);

      first.unmount();
      second.unmount();
    } finally {
      restoreLocks();
    }
  });
});
