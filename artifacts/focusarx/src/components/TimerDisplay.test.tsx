import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, screen, act } from "@testing-library/react";
import { TimerDisplay } from "./TimerDisplay";

/**
 * The timer face answers three questions, and the third is the one that was
 * missing:
 *
 *   • "how much is left?"  → the ring
 *   • "how long exactly?"  → the digits
 *   • "when can I stop?"   → the finish time
 *
 * The third is what decides whether a session gets started at all, and it is
 * the one that time-blind users cannot derive themselves from a countdown.
 * These tests pin its behaviour: it appears only while running, it is the same
 * instant on every tick (a second moving number would be worse than none), and
 * it is exposed to assistive tech, not just drawn on screen.
 */

function base(overrides: Partial<React.ComponentProps<typeof TimerDisplay>> = {}) {
  return {
    secondsLeft: 300,
    progress: 0.5,
    mode: "focus" as const,
    isRunning: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-18T10:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TimerDisplay finish time", () => {
  it("shows no finish time while idle", () => {
    render(<TimerDisplay {...base({ isRunning: false })} />);
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.queryByText(/ends/i)).toBeNull();
  });

  it("shows the wall-clock instant the block finishes once running", () => {
    // 5 minutes left at 10:00 → 10:05.
    render(<TimerDisplay {...base({ isRunning: true, secondsLeft: 300 })} />);
    const expected = new Date(Date.now() + 300_000).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    expect(screen.getByText(new RegExp(`ends ${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"))).toBeTruthy();
  });

  it("holds the finish time steady as the countdown ticks", () => {
    // The whole value of the label is that it does not move. `now` advances and
    // `secondsLeft` falls by the same amount, so the instant must be identical
    // one second later — if it drifted, it would be just another countdown.
    const { rerender } = render(<TimerDisplay {...base({ isRunning: true, secondsLeft: 300 })} />);
    const first = screen.getByText(/ends/i).textContent;

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(<TimerDisplay {...base({ isRunning: true, secondsLeft: 299 })} />);

    expect(screen.getByText(/ends/i).textContent).toBe(first);
  });

  it("announces the finish time to assistive tech", () => {
    // The visible line is a sibling of the digit button, so a screen-reader
    // user focused on the time would otherwise miss it entirely.
    render(<TimerDisplay {...base({ isRunning: true, secondsLeft: 300 })} />);
    const digits = screen.getByRole("button");
    // Not "05 minutes 00 seconds" — the zero padding is visual, and reading it
    // out loud is how an accessible name ends up worse than no name.
    expect(digits.getAttribute("aria-label")).toMatch(/^5 minutes remaining\./);
    expect(digits.getAttribute("aria-label")).toMatch(/Finishes at /);
  });

  it("speaks the remaining time without zero padding or empty units", () => {
    const { unmount } = render(<TimerDisplay {...base({ secondsLeft: 65, isRunning: true })} />);
    expect(screen.getByRole("button").getAttribute("aria-label")).toMatch(/^1 minute 5 seconds remaining/);
    unmount();

    render(<TimerDisplay {...base({ secondsLeft: 30, isRunning: true })} />);
    // "0 minutes 30 seconds" would be read out in full.
    expect(screen.getByRole("button").getAttribute("aria-label")).toMatch(/^30 seconds remaining/);
  });

  it("omits the finish time from the accessible name when idle", () => {
    render(<TimerDisplay {...base({ isRunning: false })} />);
    expect(screen.getByRole("button").getAttribute("aria-label")).not.toMatch(/Finishes at/);
  });

  /**
   * The face was flattened to a single flat stroke in the v5 swing toward
   * quiet surfaces, and the countdown — the one thing on the page that is
   * supposed to hold attention — became the least interesting object in the
   * product. A gradient arc is the default now; Zen is the deliberate
   * exception (a line and a number, nothing else).
   */
  it("classic (default) draws the 14px ring painted with the mode gradient", () => {
    const { container } = render(<TimerDisplay {...base()} />);
    const circles = container.querySelectorAll("circle[stroke-dasharray]");
    expect(circles.length).toBeGreaterThan(0);
    expect(circles[0].getAttribute("stroke-width")).toBe("14");
    expect(circles[0].getAttribute("stroke")).toMatch(/^url\(#/);
    expect(container.querySelector("linearGradient")).toBeTruthy();
  });

  it("zen is the one face that is a line and a number — thin, ungraded, no head node", () => {
    const { container } = render(<TimerDisplay {...base({ theme: "zen", isRunning: true, progress: 0.4 })} />);
    const circle = container.querySelector("circle[stroke-dasharray]");
    expect(circle?.getAttribute("stroke-width")).toBe("8");
    expect(container.querySelector("linearGradient")).toBeNull();
    expect(circle?.getAttribute("stroke")).not.toMatch(/^url\(#/);
  });

  it("draws a head node on the arc so progress is visible without reading digits", () => {
    const { container } = render(<TimerDisplay {...base({ isRunning: true, progress: 0.35 })} />);
    // The node is a filled circle with no dash pattern, unlike the arc/track.
    const node = Array.from(container.querySelectorAll("circle")).find(
      (c) => !c.getAttribute("stroke-dasharray") && c.getAttribute("r") === "9.5",
    );
    expect(node, "the arc head should be drawn while a session is in progress").toBeTruthy();
  });

  it("hides the head node when the block is untouched", () => {
    const { container } = render(<TimerDisplay {...base({ isRunning: true, progress: 0 })} />);
    expect(
      Array.from(container.querySelectorAll("circle")).some(
        (c) => !c.getAttribute("stroke-dasharray") && c.getAttribute("r") === "9.5",
      ),
    ).toBe(false);
  });

  it("neon paints a gradient ring on focus", () => {
    const { container } = render(<TimerDisplay {...base({ theme: "neon" })} />);
    expect(container.querySelector("linearGradient")).toBeTruthy();
    const circle = container.querySelector("circle[stroke-dasharray]");
    expect(circle?.getAttribute("stroke")).toMatch(/^url\(#/);
  });

  it("keeps rest in the rest palette — a break never wears the focus gradient", () => {
    for (const mode of ["break", "longBreak"] as const) {
      const { container } = render(<TimerDisplay {...base({ theme: "neon", mode })} />);
      const stops = Array.from(container.querySelectorAll("linearGradient stop")).map((s) =>
        s.getAttribute("stop-color"),
      );
      expect(stops.length).toBeGreaterThan(0);
      expect(stops.join(" ")).not.toMatch(/brand/);
      cleanup();
    }
  });

  it("a paid membership skin wins over a chosen theme", () => {
    // pro skin is a gradient; even with zen picked the skin's stroke stands.
    const { container } = render(<TimerDisplay {...base({ theme: "zen", tier: "pro" })} />);
    const circle = container.querySelector("circle[stroke-dasharray]");
    expect(circle?.getAttribute("stroke-width")).toBe("14");
  });
});
