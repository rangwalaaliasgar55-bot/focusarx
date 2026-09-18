import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { useNow, __clockSubscriptionCount } from "./useNow";

/**
 * The clock hook exists so that "ends at 3:45 PM" can be rendered without
 * reading `Date.now()` during render and without a `set-state-in-effect`.
 * These tests pin the two properties that make it safe:
 *
 *   1. `getSnapshot` returns the *same* value until the interval actually
 *      fires. A snapshot that changed on every read is an infinite render
 *      loop, and that failure mode is silent until React throws.
 *   2. Subscribers share one interval, and the last one to leave stops it.
 */

function Probe({ enabled = true }: { enabled?: boolean }) {
  const now = useNow(enabled);
  return <span data-testid="now">{now === null ? "unknown" : String(now)}</span>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-18T10:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useNow", () => {
  it("reports a timestamp once mounted", () => {
    const { getByTestId } = render(<Probe />);
    expect(Number(getByTestId("now").textContent)).toBe(Date.now());
  });

  it("advances on the shared interval", () => {
    const { getByTestId } = render(<Probe />);
    const first = Number(getByTestId("now").textContent);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const second = Number(getByTestId("now").textContent);
    expect(second).toBeGreaterThan(first);
    expect(second - first).toBe(1000);
  });

  it("does not resubscribe or re-render on every read", () => {
    // If `getSnapshot` returned a fresh `Date.now()`, React would see a changed
    // store on every check and loop. Rendering twice with no timers advanced
    // must produce an identical value.
    const { getByTestId, rerender } = render(<Probe />);
    const first = getByTestId("now").textContent;
    rerender(<Probe />);
    expect(getByTestId("now").textContent).toBe(first);
  });

  it("returns null when disabled, and schedules nothing", () => {
    const { getByTestId } = render(<Probe enabled={false} />);
    expect(getByTestId("now").textContent).toBe("unknown");
    expect(__clockSubscriptionCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shares one interval across subscribers and stops when the last leaves", () => {
    const a = render(<Probe />);
    const b = render(<Probe />);
    expect(__clockSubscriptionCount()).toBe(2);
    // Two components, one wake-up per second.
    expect(vi.getTimerCount()).toBe(1);

    a.unmount();
    expect(__clockSubscriptionCount()).toBe(1);
    expect(vi.getTimerCount()).toBe(1);

    b.unmount();
    expect(__clockSubscriptionCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never leaks between enabled and disabled renders", () => {
    const { rerender } = render(<Probe enabled={false} />);
    expect(__clockSubscriptionCount()).toBe(0);
    rerender(<Probe enabled />);
    expect(__clockSubscriptionCount()).toBe(1);
    rerender(<Probe enabled={false} />);
    expect(__clockSubscriptionCount()).toBe(0);
  });
});
