import { describe, expect, it } from "vitest";
import {
  MAX_VERIFIED_SESSION_SEC,
  WALL_CLOCK_GRACE_SEC,
  MIN_REWARD_DURATION_SEC,
  computeVerifiedDurationSec,
  isRewardEligible,
  nextStreakValues,
  istWeekStartDate,
} from "./sessionCompletionCore";

const base = {
  claimedDurationSec: 1_500,
  hasActiveSession: true,
  wallClockSeconds: 1_500,
};

describe("computeVerifiedDurationSec", () => {
  it("uses the claim when it is below the wall clock", () => {
    expect(computeVerifiedDurationSec({ ...base, claimedDurationSec: 300, wallClockSeconds: 1_500 })).toBe(300);
  });

  it("caps the claim at the wall clock + grace (anti clock-manipulation)", () => {
    const result = computeVerifiedDurationSec({ ...base, claimedDurationSec: 10_000, wallClockSeconds: 120 });
    expect(result).toBe(120 + WALL_CLOCK_GRACE_SEC);
  });

  it("never trusts a client claim without an active session", () => {
    // Recorded, but bounded only by the schema cap — and never reward-eligible.
    const result = computeVerifiedDurationSec({ ...base, hasActiveSession: false, claimedDurationSec: 10_000 });
    expect(result).toBe(10_000);
  });

  it("applies the 15s grace exactly once", () => {
    const result = computeVerifiedDurationSec({ ...base, claimedDurationSec: 500, wallClockSeconds: 485 });
    expect(result).toBe(500);
  });

  it("caps at 4 hours", () => {
    expect(
      computeVerifiedDurationSec({ ...base, claimedDurationSec: 86_400, wallClockSeconds: 86_400 }),
    ).toBe(MAX_VERIFIED_SESSION_SEC);
  });

  it("floors negative or fractional claims", () => {
    expect(computeVerifiedDurationSec({ ...base, claimedDurationSec: -50, wallClockSeconds: 0 })).toBe(0);
    expect(computeVerifiedDurationSec({ ...base, claimedDurationSec: 90.9, wallClockSeconds: 3_600 })).toBe(90);
  });

  it("treats a just-started session as ~grace only", () => {
    const result = computeVerifiedDurationSec({ ...base, claimedDurationSec: 1_500, wallClockSeconds: 0 });
    expect(result).toBe(WALL_CLOCK_GRACE_SEC);
  });
});

describe("isRewardEligible", () => {
  const eligible = {
    mode: "focus" as const,
    sessionStatus: "completed" as const,
    verifiedDurationSec: MIN_REWARD_DURATION_SEC,
    hasActiveSession: true,
  };

  it("accepts a genuine focus completion at the threshold", () => {
    expect(isRewardEligible(eligible)).toBe(true);
  });

  it("rejects one second below the threshold", () => {
    expect(isRewardEligible({ ...eligible, verifiedDurationSec: MIN_REWARD_DURATION_SEC - 1 })).toBe(false);
  });

  it("rejects completions with no server-side active session (anti-farming)", () => {
    expect(isRewardEligible({ ...eligible, hasActiveSession: false })).toBe(false);
    // …even for huge claimed durations
    expect(
      isRewardEligible({ ...eligible, hasActiveSession: false, verifiedDurationSec: MAX_VERIFIED_SESSION_SEC }),
    ).toBe(false);
  });

  it("rejects breaks and cancelled sessions", () => {
    expect(isRewardEligible({ ...eligible, mode: "short_break" })).toBe(false);
    expect(isRewardEligible({ ...eligible, mode: "long_break" })).toBe(false);
    expect(isRewardEligible({ ...eligible, sessionStatus: "cancelled" })).toBe(false);
  });
});

describe("nextStreakValues", () => {
  it("starts at 1 for a first-ever session", () => {
    expect(
      nextStreakValues({ lastStudyDate: null, currentStreak: 0, longestStreak: 0, today: "2026-08-28", yesterday: "2026-08-27" }),
    ).toEqual({ changed: true, currentStreak: 1, longestStreak: 1 });
  });

  it("does not double-count a second session on the same day", () => {
    expect(
      nextStreakValues({ lastStudyDate: "2026-08-28", currentStreak: 7, longestStreak: 9, today: "2026-08-28", yesterday: "2026-08-27" }),
    ).toEqual({ changed: false, currentStreak: 7, longestStreak: 9 });
  });

  it("continues a streak the next day", () => {
    expect(
      nextStreakValues({ lastStudyDate: "2026-08-27", currentStreak: 7, longestStreak: 7, today: "2026-08-28", yesterday: "2026-08-27" }),
    ).toEqual({ changed: true, currentStreak: 8, longestStreak: 8 });
  });

  it("resets after a gap day", () => {
    expect(
      nextStreakValues({ lastStudyDate: "2026-08-25", currentStreak: 7, longestStreak: 9, today: "2026-08-28", yesterday: "2026-08-27" }),
    ).toEqual({ changed: true, currentStreak: 1, longestStreak: 9 });
  });

  it("resets when the previous date is in the future (clock rollback guard)", () => {
    expect(
      nextStreakValues({ lastStudyDate: "2026-08-29", currentStreak: 5, longestStreak: 5, today: "2026-08-28", yesterday: "2026-08-27" }),
    ).toEqual({ changed: true, currentStreak: 1, longestStreak: 5 });
  });
});

describe("istWeekStartDate", () => {
  it("returns Monday 00:00 IST for a mid-week instant", () => {
    // Wed 2026-08-26 10:00 UTC == Wed 15:30 IST → week started Mon 2026-08-24 00:00 IST
    const result = istWeekStartDate(new Date("2026-08-26T10:00:00Z"));
    expect(result.toISOString()).toBe("2026-08-23T18:30:00.000Z");
  });

  it("rolls back to the previous Monday for an early-morning IST Sunday", () => {
    // Sun 2026-08-30 00:29 UTC == Sun 05:59 IST → still the week of Mon 2026-08-24
    const result = istWeekStartDate(new Date("2026-08-30T00:29:00Z"));
    expect(result.toISOString()).toBe("2026-08-23T18:30:00.000Z");
  });
});
