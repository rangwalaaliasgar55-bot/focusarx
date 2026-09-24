import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionWorth } from "./SessionWorth";
import { computeSessionRewards } from "@/lib/sessionRewards";

describe("SessionWorth", () => {
  it("states the exact payout the server will make for the configured block", () => {
    const expected = computeSessionRewards({ minutes: 25, isPremium: false });
    render(<SessionWorth minutes={25} />);
    expect(screen.getByText(new RegExp(`${expected.xp.toLocaleString()} XP`))).toBeTruthy();
    expect(screen.getByText(new RegExp(`${expected.coins.toLocaleString()} coins`))).toBeTruthy();
  });

  it("names the 25-minute bonus when the block earns it", () => {
    render(<SessionWorth minutes={45} />);
    expect(screen.getByText(/\+50 coin bonus for a full 25 minutes/i)).toBeTruthy();
  });

  it("says how far a short block is from the bonus, in minutes", () => {
    render(<SessionWorth minutes={15} />);
    expect(screen.getByText(/10 more minutes to reach the 25-minute bonus/i)).toBeTruthy();
    expect(screen.getByText(/50 extra coins/i)).toBeTruthy();
  });

  it("warns about the marathon taper before it applies", () => {
    const { unmount } = render(<SessionWorth minutes={180} />);
    expect(screen.getByText(/past 2 hours pays 75% per minute/i)).toBeTruthy();
    unmount();
    // A 45-minute block must not carry the marathon copy.
    render(<SessionWorth minutes={45} />);
    expect(screen.queryByText(/past 2 hours/i)).toBeNull();
  });

  it("counts what is banked while running, and what finishing adds", () => {
    // 10 minutes in on a 25-minute block: the banked figure is the 10-minute
    // payout, and the difference is the honest "finish it" number.
    const banked = computeSessionRewards({ minutes: 10, isPremium: false });
    const total = computeSessionRewards({ minutes: 25, isPremium: false });
    render(<SessionWorth minutes={25} activeSeconds={600} running />);
    expect(screen.getByText(new RegExp(`${banked.xp.toLocaleString()} XP`))).toBeTruthy();
    expect(
      screen.getByText(
        new RegExp(`finishing adds ${(total.xp - banked.xp).toLocaleString()} XP`)
      )
    ).toBeTruthy();
  });

  it("applies the premium multiplier visibly rather than silently", () => {
    render(<SessionWorth minutes={50} isPremium />);
    expect(screen.getByText(/premium rate/i)).toBeTruthy();
  });

  it("never contradicts the shared reward maths for any preset length", () => {
    // The whole point of this component is that the number on the timer equals
    // the number the server pays. This walks the preset lengths so a future
    // copy tweak cannot quietly introduce a second formula.
    for (const minutes of [5, 15, 25, 45, 50, 90, 120, 180, 240]) {
      const { unmount } = render(<SessionWorth minutes={minutes} />);
      const expected = computeSessionRewards({ minutes, isPremium: false });
      expect(screen.getByText(new RegExp(`${expected.coins.toLocaleString()} coins`))).toBeTruthy();
      unmount();
    }
  });
});
