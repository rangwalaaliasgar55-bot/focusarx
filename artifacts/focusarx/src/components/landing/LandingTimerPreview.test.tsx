import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LandingTimerPreview, formatLandingTimer } from "./LandingTimerPreview";

/**
 * The landing timer preview is the product, running on the marketing page.
 * These tests pin the promises it makes to a visitor:
 *   - it is a real countdown (start, tick, pause, reset);
 *   - finishing a block is celebrated with a handoff, not fake rewards;
 *   - "continue" hands the *same* duration to /focus over the deep-link
 *     contract (`duration` in minutes + `src` attribution);
 *   - the tab title carries the live countdown only while running, and the
 *     page title always comes back.
 */

const PAGE_TITLE = "FocusArx — AI Pomodoro Timer & Deep Work Tracker";

beforeEach(() => {
  vi.useFakeTimers();
  document.title = PAGE_TITLE;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LandingTimerPreview", () => {
  it("renders the three session modes with Pomodoro armed", () => {
    render(<LandingTimerPreview />);
    expect(screen.getByRole("button", { name: "Pomodoro" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Deep work" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Break" })).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toBe("25:00");
  });

  it("counts down while running and pauses on demand", () => {
    render(<LandingTimerPreview />);
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("timer").textContent).toBe("24:57");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("timer").textContent).toBe("24:57");
  });

  it("switching a mode re-arms that mode's full duration", () => {
    render(<LandingTimerPreview />);
    fireEvent.click(screen.getByRole("button", { name: "Break" }));
    expect(screen.getByRole("timer").textContent).toBe("05:00");
    fireEvent.click(screen.getByRole("button", { name: "Start break" }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("timer").textContent).toBe("04:59");
  });

  it("puts the live countdown in the tab title only while running", () => {
    render(<LandingTimerPreview />);
    expect(document.title).toBe(PAGE_TITLE);

    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(document.title).toBe(`${formatLandingTimer(24 * 60 + 58)} · Pomodoro — FocusArx`);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(document.title).toBe(PAGE_TITLE);
  });

  it("completes naturally and offers the same block in the real timer", () => {
    render(<LandingTimerPreview />);
    fireEvent.click(screen.getByRole("button", { name: "Break" }));
    fireEvent.click(screen.getByRole("button", { name: "Start break" }));
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });

    expect(screen.getByText("Block complete")).toBeTruthy();
    expect(screen.getByText(/one full block, done/i)).toBeTruthy();
    expect(document.title).toBe(PAGE_TITLE);

    const continueLink = screen.getByRole("link", { name: /continue with this break/i }) as HTMLAnchorElement;
    expect(continueLink.getAttribute("href")).toBe("/focus?duration=5&src=landing");
  });

  it("restores the page title when it unmounts mid-run", () => {
    const { unmount } = render(<LandingTimerPreview />);
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.title).not.toBe(PAGE_TITLE);
    unmount();
    expect(document.title).toBe(PAGE_TITLE);
  });

  it("links the full timer with the armed duration and landing attribution", () => {
    render(<LandingTimerPreview />);
    const fullTimer = screen.getByRole("link", { name: "Open the full focus timer" }) as HTMLAnchorElement;
    expect(fullTimer.getAttribute("href")).toBe("/focus?duration=25&src=landing");
  });
});
