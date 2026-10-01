import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { acquireTimerLead } from "./timerLeader";

/**
 * Leader election must never leak a Web Lock.
 *
 * `acquireTimerLead` races the real `navigator.locks.request` against an 800 ms
 * fallback so a wedged locks implementation cannot freeze the start button. The
 * race has one losing path that used to be fatal: when the fallback settles
 * first, the caller is handed an announce-only grant whose `release()` is a
 * no-op — and the lock callback then *still* ran, took the real lock, and
 * parked in a promise only that discarded grant could resolve. The lock was
 * held for the life of the tab, so every other tab saw "unavailable" forever
 * and, after four attempts, stood down with "Timer is already running in
 * another tab".
 *
 * These tests pin the losing path: the lock must be given back.
 */

type LockCallbacks = ((lock: unknown) => Promise<void> | undefined)[];

function installLockMock() {
  const callbacks: LockCallbacks = [];
  const requested: string[] = [];
  const request = vi.fn((_name: string, _opts: unknown, cb: (lock: unknown) => Promise<void> | undefined) => {
    callbacks.push(cb);
    return Promise.resolve();
  });
  Object.defineProperty(globalThis.navigator, "locks", {
    value: { request },
    configurable: true,
    writable: true,
  });
  return { callbacks, requested, request };
}

function removeLockMock() {
  Reflect.deleteProperty(globalThis.navigator as object, "locks");
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  removeLockMock();
  vi.restoreAllMocks();
});

describe("acquireTimerLead", () => {
  it("grants the lead when the lock is available", async () => {
    const { callbacks } = installLockMock();
    const pending = acquireTimerLead("tab_a");
    // Let `locks.request` run to the point where the callback is captured.
    await vi.advanceTimersByTimeAsync(0);

    // The callback returns a pending promise: that is what holds the lock.
    const hold = callbacks[0]?.({ held: true });
    expect(hold).toBeInstanceOf(Promise);

    const grant = await pending;
    expect(grant.acquired).toBe(true);
  });

  it("reports a lost race without taking the lock", async () => {
    const { callbacks } = installLockMock();
    const pending = acquireTimerLead("tab_b");
    await vi.advanceTimersByTimeAsync(0);

    callbacks[0]?.(null);

    const grant = await pending;
    expect(grant.acquired).toBe(false);
  });

  it("does not leak the lock when the fallback settles first", async () => {
    const { callbacks } = installLockMock();
    const pending = acquireTimerLead("tab_c");
    // Let the request reach the locks API…
    await vi.advanceTimersByTimeAsync(0);

    // …but the callback itself is slow to dispatch, so the 800 ms timeout
    // wins. The caller gets the announce-only grant.
    await vi.advanceTimersByTimeAsync(800);
    const grant = await pending;
    expect(grant.acquired).toBe(true); // broadcast fallback, not the real lock

    // Now the lock callback finally runs and finds the lock available. It must
    // hand it straight back rather than park on a promise nobody can resolve.
    const outcome = callbacks[0]?.({ held: true });
    // No pending promise => the lock was released immediately.
    expect(outcome).toBeUndefined();
  });

  it("degrades to announce-only when the platform has no locks API", async () => {
    removeLockMock();
    const grant = await acquireTimerLead("tab_d");
    expect(grant.acquired).toBe(true);
    expect(() => grant.release()).not.toThrow();
  });

  it("degrades to announce-only when the request throws", async () => {
    Object.defineProperty(globalThis.navigator, "locks", {
      value: {
        request: () => {
          throw new Error("not allowed");
        },
      },
      configurable: true,
      writable: true,
    });
    const grant = await acquireTimerLead("tab_e");
    expect(grant.acquired).toBe(true);
  });
});