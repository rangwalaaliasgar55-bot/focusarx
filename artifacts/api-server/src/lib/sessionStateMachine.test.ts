import { describe, expect, it } from "vitest";
import {
  ALLOWED_TRANSITIONS,
  EXPIRY_GRACE_SEC,
  PAUSED_SESSION_TTL_MS,
  SESSION_STATES,
  canTransition,
  evaluateActiveSession,
  stateFromTimerStatus,
} from "./sessionStateMachine";

const START = 1_700_000_000_000;
const running = (secondsLeft = 1_500, timerStatus = "running") => ({
  timerStatus,
  startedAt: new Date(START),
  secondsLeft,
  activeSeconds: 0,
});

describe("transition table", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("idle", "active")).toBe(true);
    expect(canTransition("active", "paused")).toBe(true);
    expect(canTransition("active", "completed")).toBe(true);
    expect(canTransition("active", "cancelled")).toBe(true);
    expect(canTransition("active", "expired")).toBe(true);
    expect(canTransition("paused", "active")).toBe(true);
    expect(canTransition("paused", "completed")).toBe(true);
    expect(canTransition("paused", "cancelled")).toBe(true);
    expect(canTransition("paused", "expired")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("idle", "completed")).toBe(false);
    expect(canTransition("idle", "paused")).toBe(false);
    expect(canTransition("active", "idle")).toBe(false);
    expect(canTransition("paused", "idle")).toBe(false);
    expect(canTransition("completed", "active")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "completed")).toBe(false);
    expect(canTransition("expired", "active")).toBe(false);
    expect(canTransition("expired", "completed")).toBe(false);
  });

  it("has terminal states with no outgoing transitions", () => {
    for (const terminal of ["completed", "cancelled", "expired"] as const) {
      expect(ALLOWED_TRANSITIONS[terminal]).toEqual([]);
    }
  });

  it("covers every state in the table", () => {
    for (const state of SESSION_STATES) {
      expect(Array.isArray(ALLOWED_TRANSITIONS[state])).toBe(true);
    }
  });
});

describe("stateFromTimerStatus", () => {
  it("maps row statuses", () => {
    expect(stateFromTimerStatus("running")).toBe("active");
    expect(stateFromTimerStatus("paused")).toBe("paused");
    expect(stateFromTimerStatus("idle")).toBe("idle");
    expect(stateFromTimerStatus("anything-else")).toBe("idle");
  });
});

describe("evaluateActiveSession — running", () => {
  it("is active before the deadline", () => {
    expect(evaluateActiveSession(running(), START + 1_499_000)).toEqual({ state: "active", expired: false });
  });

  it("is active within the grace window past the deadline", () => {
    expect(evaluateActiveSession(running(), START + (1_500 + EXPIRY_GRACE_SEC) * 1000)).toEqual({
      state: "active",
      expired: false,
    });
  });

  it("expires with auto-complete semantics just past grace", () => {
    const result = evaluateActiveSession(running(), START + (1_500 + EXPIRY_GRACE_SEC + 1) * 1000);
    expect(result).toEqual({ state: "expired", expired: true, wasRunning: true, maxFocusSec: 1_500 });
  });

  it("caps auto-complete focus at secondsLeft even if abandoned for hours", () => {
    const result = evaluateActiveSession(running(600), START + 10 * 3600_000);
    expect(result.expired).toBe(true);
    if (result.expired) expect(result.maxFocusSec).toBe(600);
  });

  it("never reports negative focus for a zero-duration session", () => {
    const result = evaluateActiveSession(running(0), START + 60_000);
    expect(result).toEqual({ state: "expired", expired: true, wasRunning: true, maxFocusSec: 0 });
  });
});

describe("evaluateActiveSession — paused/idle", () => {
  it("does not expire by timer (pause freezes time)", () => {
    // Far past secondsLeft, but well inside the absolute TTL.
    const result = evaluateActiveSession(running(60, "paused"), START + 30 * 60_000);
    expect(result).toEqual({ state: "paused", expired: false });
  });

  it("idle maps through and stays alive inside the TTL", () => {
    const result = evaluateActiveSession(running(1_500, "idle"), START + 60_000);
    expect(result).toEqual({ state: "idle", expired: false });
  });

  it("expires after the absolute TTL with clamped, reward-free focus", () => {
    const session = { ...running(1_500, "paused"), activeSeconds: 900 };
    const result = evaluateActiveSession(session, START + PAUSED_SESSION_TTL_MS + 1_000);
    expect(result).toEqual({
      state: "expired",
      expired: true,
      wasRunning: false,
      maxFocusSec: 900,
    });
  });

  it("clamps paused expiry focus to secondsLeft and wall clock", () => {
    const session = { ...running(300, "idle"), activeSeconds: 5_000 };
    const result = evaluateActiveSession(session, START + PAUSED_SESSION_TTL_MS + 1_000);
    if (result.expired) expect(result.maxFocusSec).toBe(300);
  });
});
