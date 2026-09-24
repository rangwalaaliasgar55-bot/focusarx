import { describe, it, expect } from "vitest";
import {
  PREMIUM_CHALLENGES,
  challengeProgress,
  isoWeekKey,
  premiumChallengeClaimKey,
  premiumChallengeForWeek,
  weekWindow,
} from "./premiumChallenge";

/**
 * Premium's engagement problem is novelty, so the important properties are:
 * the challenge *changes* week to week, it is the same for everyone reading at
 * the same moment, and a week can only be paid once.
 */
describe("premium weekly challenge rotation", () => {
  it("changes from week to week", () => {
    const weeks = ["2026-W35", "2026-W36", "2026-W37", "2026-W38", "2026-W39", "2026-W40"];
    const picked = weeks.map((week) => premiumChallengeForWeek(week).id);
    expect(new Set(picked).size).toBeGreaterThan(3);
  });

  it("is stable for a given week, whoever asks", () => {
    expect(premiumChallengeForWeek("2026-W39")).toEqual(premiumChallengeForWeek("2026-W39"));
  });

  it("only ever returns a real challenge from the pool", () => {
    for (let week = 1; week <= 53; week += 1) {
      const challenge = premiumChallengeForWeek(`2026-W${String(week).padStart(2, "0")}`);
      expect(PREMIUM_CHALLENGES).toContain(challenge);
    }
  });

  it("always pays something worth having", () => {
    for (const challenge of PREMIUM_CHALLENGES) {
      expect(challenge.tokenReward).toBeGreaterThanOrEqual(200);
      expect(challenge.coinReward).toBeGreaterThan(0);
      expect(challenge.target).toBeGreaterThan(0);
    }
  });

  it("keys the week to the ISO calendar", () => {
    // Monday 2026-09-21 and Sunday 2026-09-27 are the same week; the next Monday
    // starts a new one.
    expect(isoWeekKey(new Date("2026-09-21T00:00:00Z"))).toBe("2026-W39");
    expect(isoWeekKey(new Date("2026-09-27T23:59:59Z"))).toBe("2026-W39");
    expect(isoWeekKey(new Date("2026-09-28T00:00:00Z"))).toBe("2026-W40");
  });

  it("runs the window Monday to Monday", () => {
    const { start, end } = weekWindow(new Date("2026-09-24T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-09-21T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });
});

describe("challenge progress", () => {
  const stats = { minutes: 300, sessions: 6, days: 4, quality: 3, tasks: 7 };

  it("reads the metric the challenge is about", () => {
    const minutes = challengeProgress(PREMIUM_CHALLENGES.find((c) => c.metric === "minutes")!, stats, "2026-W39");
    expect(minutes.current).toBe(300);
    const days = challengeProgress(PREMIUM_CHALLENGES.find((c) => c.metric === "days")!, stats, "2026-W39");
    expect(days.current).toBe(4);
  });

  it("completes exactly at the target and not before", () => {
    const def = { id: "t", title: "t", description: "t", metric: "sessions" as const, target: 5, tokenReward: 1, coinReward: 1, xpReward: 1 };
    expect(challengeProgress(def, { ...stats, sessions: 4 }, "w").complete).toBe(false);
    expect(challengeProgress(def, { ...stats, sessions: 5 }, "w").complete).toBe(true);
    expect(challengeProgress(def, { ...stats, sessions: 9 }, "w").percent).toBe(100);
  });

  it("never reports more than 100% or less than 0", () => {
    const def = { id: "t", title: "t", description: "t", metric: "minutes" as const, target: 60, tokenReward: 1, coinReward: 1, xpReward: 1 };
    expect(challengeProgress(def, { minutes: 600, sessions: 0, days: 0, quality: 0, tasks: 0 }, "w").percent).toBe(100);
    expect(challengeProgress(def, { minutes: -30, sessions: 0, days: 0, quality: 0, tasks: 0 }, "w").percent).toBe(0);
  });

  it("survives missing stats rather than crashing the page", () => {
    const def = PREMIUM_CHALLENGES[0]!;
    expect(challengeProgress(def, undefined as never, "w").current).toBe(0);
    expect(challengeProgress(def, { minutes: Number.NaN, sessions: 0, days: 0, quality: 0, tasks: 0 }, "w").current).toBe(0);
  });
});

describe("claim key", () => {
  it("is one per user per week", () => {
    expect(premiumChallengeClaimKey("u1", "2026-W39")).toBe("premium_challenge_2026-W39_u1");
    expect(premiumChallengeClaimKey("u1", "2026-W40")).not.toBe(premiumChallengeClaimKey("u1", "2026-W39"));
    expect(premiumChallengeClaimKey("u2", "2026-W39")).not.toBe(premiumChallengeClaimKey("u1", "2026-W39"));
  });
});
