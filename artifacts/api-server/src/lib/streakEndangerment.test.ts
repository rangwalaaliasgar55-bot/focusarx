import { describe, expect, it } from "vitest";
import { endangermentDue } from "./streakEndangerment";

describe("endangermentDue (user-local evening nudge)", () => {
  it("stays silent for 1-day streaks", () => {
    const { due } = endangermentDue({
      now: new Date("2026-09-06T20:30:00Z"),
      zone: "America/New_York",
      currentStreak: 1,
      lastStudyDate: "2026-09-05",
    });
    expect(due).toBe(false);
  });

  it("stays silent when the user already focused today (user-local)", () => {
    const { due, today } = endangermentDue({
      now: new Date("2026-09-06T20:30:00Z"), // Sun 16:30 EDT
      zone: "America/New_York",
      currentStreak: 5,
      lastStudyDate: "2026-09-06",
    });
    expect(today).toBe("2026-09-06");
    expect(due).toBe(false);
  });

  it("stays silent before 16:00 user-local", () => {
    const { due } = endangermentDue({
      now: new Date("2026-09-06T19:00:00Z"), // Sun 15:00 EDT
      zone: "America/New_York",
      currentStreak: 5,
      lastStudyDate: "2026-09-05",
    });
    expect(due).toBe(false);
  });

  it("fires after 16:00 user-local when today is missing", () => {
    const { due, today } = endangermentDue({
      now: new Date("2026-09-06T20:30:00Z"), // Sun 16:30 EDT
      zone: "America/New_York",
      currentStreak: 5,
      lastStudyDate: "2026-09-05",
    });
    expect(today).toBe("2026-09-06");
    expect(due).toBe(true);
  });

  it("splits by zone: the same instant is evening in one zone, night in another", () => {
    const now = new Date("2026-09-06T20:30:00Z"); // Sun 16:30 EDT, Mon 02:00 IST
    expect(
      endangermentDue({ now, zone: "America/New_York", currentStreak: 5, lastStudyDate: "2026-09-05" }).due,
    ).toBe(true);
    expect(
      endangermentDue({ now, zone: "Asia/Kolkata", currentStreak: 5, lastStudyDate: "2026-09-06" }).due,
    ).toBe(false);
  });

  it("behaves on the spring-forward day (23-hour Sunday)", () => {
    // 2026-03-08 17:00 EDT == 21:00 UTC (clocks jumped 02:00 → 03:00 EST→EDT).
    const { due, today } = endangermentDue({
      now: new Date("2026-03-08T21:00:00Z"),
      zone: "America/New_York",
      currentStreak: 3,
      lastStudyDate: "2026-03-07",
    });
    expect(today).toBe("2026-03-08");
    expect(due).toBe(true);
  });
});
