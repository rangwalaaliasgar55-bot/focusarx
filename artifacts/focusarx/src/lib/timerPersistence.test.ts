import { describe, it, expect } from "vitest";
import {
  buildSnapshot,
  readSnapshot,
  GUEST_SNAPSHOT_TTL_MS,
} from "./timerPersistence";

describe("timerPersistence (Phase 5.3 TIMER regression)", () => {
  const base = {
    mode: "focus" as const,
    activeSeconds: 120,
    deadlineMs: 1_000_000 + 1_500_000,
  };

  it("builds a running snapshot carrying the deadline (resume-after-close)", () => {
    const s = buildSnapshot({
      ...base,
      status: "running",
      secondsLeft: 1500,
      now: 1_000_000,
    });
    expect(s).not.toBeNull();
    expect(s!.deadlineMs).toBe(2_500_000);
    expect(s!.status).toBe("running");
  });

  it("does not persist idle status", () => {
    expect(
      buildSnapshot({ ...base, status: "idle", secondsLeft: 1500 }),
    ).toBeNull();
  });

  it("rejects NaN/negative/zero slices (never display NaN)", () => {
    expect(buildSnapshot({ ...base, status: "running", secondsLeft: NaN })).toBeNull();
    expect(buildSnapshot({ ...base, status: "running", secondsLeft: -5 })).toBeNull();
    expect(buildSnapshot({ ...base, status: "paused", secondsLeft: 0 })).toBeNull();
  });

  it("restores a running snapshot by recomputing remaining from the deadline (sleep-safe)", () => {
    const saved = buildSnapshot({ ...base, status: "running", secondsLeft: 1500, now: 1_000_000 })!;
    // 600 s of sleep/close elapse; remaining must shrink by wall clock.
    const restored = readSnapshot(saved, 1_000_000 + 600_000);
    expect(restored).not.toBeNull();
    expect(restored!.secondsLeft).toBe(900);
    expect(restored!.status).toBe("running");
  });

  it("drops a running snapshot whose deadline passed while away (nothing to resume)", () => {
    const saved = buildSnapshot({ ...base, status: "running", secondsLeft: 60, now: 1_000_000 })!;
    saved.deadlineMs = 1_000_000 + 60_000;
    expect(readSnapshot(saved, 1_000_000 + 61_000)).toBeNull();
  });

  it("restores a paused snapshot verbatim (no wall-clock decay while paused)", () => {
    const saved = buildSnapshot({ ...base, status: "paused", secondsLeft: 300, now: 1_000_000 })!;
    const restored = readSnapshot(saved, 1_000_000 + 3_600_000 - 1);
    expect(restored).not.toBeNull();
    expect(restored!.secondsLeft).toBe(300);
    expect(restored!.status).toBe("paused");
  });

  it("drops stale snapshots beyond the TTL", () => {
    const saved = buildSnapshot({ ...base, status: "paused", secondsLeft: 300, now: 1_000_000 })!;
    expect(readSnapshot(saved, 1_000_000 + GUEST_SNAPSHOT_TTL_MS + 1)).toBeNull();
  });

  it("drops corrupt/legacy payloads instead of throwing", () => {
    expect(readSnapshot(null)).toBeNull();
    expect(readSnapshot("{oops")).toBeNull();
    expect(readSnapshot({ v: 999, mode: "focus", status: "paused", secondsLeft: 5, savedAt: 1 })).toBeNull();
    expect(readSnapshot({ v: 1, mode: "nonsense", status: "paused", secondsLeft: 5, savedAt: 1 })).toBeNull();
  });
});
