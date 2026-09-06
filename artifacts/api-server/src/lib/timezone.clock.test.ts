import { describe, expect, it } from "vitest";
import { clockInZone, weekdayOfDayKey } from "./timezone";

describe("clockInZone", () => {
  // 2026-09-06 (Sunday) 20:30 UTC
  const at = Date.UTC(2026, 8, 6, 20, 30);
  it("reports the user-local hour and weekday", () => {
    expect(clockInZone(at, "Asia/Kolkata")).toEqual({ hour: 2, weekday: 1 }); // Mon 02:00 IST
    expect(clockInZone(at, "America/Los_Angeles")).toEqual({ hour: 13, weekday: 0 }); // Sun 13:30 PDT
    expect(clockInZone(at, "UTC")).toEqual({ hour: 20, weekday: 0 });
  });
  it("uses h23 so midnight is 0, not 24", () => {
    expect(clockInZone(Date.UTC(2026, 8, 6, 18, 30), "Asia/Kolkata").hour).toBe(0);
  });
});

describe("weekdayOfDayKey", () => {
  it("maps calendar keys to Sun..Sat indices", () => {
    expect(weekdayOfDayKey("2026-09-06")).toBe(0);
    expect(weekdayOfDayKey("2026-09-07")).toBe(1);
  });
});
