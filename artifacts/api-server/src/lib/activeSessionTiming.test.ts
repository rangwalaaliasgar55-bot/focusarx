import { describe, expect, it } from "vitest";
import {
  deriveActiveSessionTiming,
  reconcileActiveSessionSync,
} from "./activeSessionTiming";
import { evaluateActiveSession } from "./sessionStateMachine";
import { computeVerifiedDurationSec } from "./sessionCompletionCore";

const START = 1_700_000_000_000;

/** A 25-minute block that has already run for five minutes and is paused. */
const pausedAfterFiveMinutes = {
  startedAt: new Date(START),
  updatedAt: new Date(START + 300_000),
  timerStatus: "paused",
  activeSeconds: 300,
  secondsLeft: 1_200,
  plannedDurationSec: 1_500,
};

describe("active session checkpoint timing", () => {
  it("does not charge paused wall time after a long-lived row", () => {
    const now = START + 7_200_000; // two hours after initial start
    expect(deriveActiveSessionTiming(pausedAfterFiveMinutes, now)).toMatchObject({
      activeSeconds: 300,
      remainingSeconds: 1_200,
      uncheckpointedRunningSeconds: 0,
    });
    // `updatedAt`, not the two-hour-old `startedAt`, governs paused expiry.
    expect(evaluateActiveSession(pausedAfterFiveMinutes, now)).toEqual({ state: "paused", expired: false });
  });

  it("starts a fresh server checkpoint on resume, then counts only resumed time", () => {
    const resumedAt = START + 7_200_000;
    const resumeCheckpoint = reconcileActiveSessionSync(
      pausedAfterFiveMinutes,
      { timerStatus: "running", activeSeconds: 7_500, secondsLeft: 0 },
      resumedAt,
    );

    // Claims accumulated while the server knew this row was paused cannot be
    // turned into verified activity; resume starts at the saved checkpoint.
    expect(resumeCheckpoint).toEqual({
      timerStatus: "running",
      activeSeconds: 300,
      secondsLeft: 1_200,
    });

    const afterTwoMinutes = {
      ...pausedAfterFiveMinutes,
      ...resumeCheckpoint,
      updatedAt: new Date(resumedAt),
    };
    expect(deriveActiveSessionTiming(afterTwoMinutes, resumedAt + 120_000)).toMatchObject({
      activeSeconds: 420,
      remainingSeconds: 1_080,
      uncheckpointedRunningSeconds: 120,
    });
  });

  it("uses checkpoint-derived active time for completion verification", () => {
    const resumedAt = START + 7_200_000;
    const running = {
      ...pausedAfterFiveMinutes,
      timerStatus: "running",
      updatedAt: new Date(resumedAt),
    };
    const timing = deriveActiveSessionTiming(running, resumedAt + 120_000);

    // A claim based on the two-hour row lifetime cannot earn two hours: it is
    // capped to the five-minute checkpoint plus the two resumed minutes.
    expect(computeVerifiedDurationSec({
      claimedDurationSec: 7_200,
      hasActiveSession: true,
      serverActiveSeconds: timing.activeSeconds,
    })).toBe(435); // 420 checkpoint seconds + 15-second final transport grace
  });

  it("expires a resumed running row from its new checkpoint, not original start", () => {
    const resumedAt = START + 7_200_000;
    const running = {
      ...pausedAfterFiveMinutes,
      timerStatus: "running",
      updatedAt: new Date(resumedAt),
    };
    expect(evaluateActiveSession(running, resumedAt + 1_229_000)).toEqual({ state: "active", expired: false });
    const result = evaluateActiveSession(running, resumedAt + 1_231_000);
    expect(result).toEqual({
      state: "expired",
      expired: true,
      wasRunning: true,
      maxFocusSec: 1_500,
    });
  });
});
