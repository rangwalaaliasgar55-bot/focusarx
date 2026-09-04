import { describe, it, expect } from "vitest";
import {
  dayKeyInZone,
  dayStartInZone,
  isValidTimeZone,
  resolveUserZone,
  shiftDayKey,
  weekStartInZone,
  LEGACY_FALLBACK_ZONE,
} from "./timezone";
import { nextStreakValues } from "./sessionCompletionCore";

describe("timezone day keys (Phase 5.3 STREAK regression)", () => {
  it("keys the same instant on different calendar days per zone", () => {
    // 2026-09-04 19:30 ET == 2026-09-05 05:00 IST (EDT, UTC-4)
    const instant = new Date("2026-09-05T00:30:00Z").getTime();
    expect(dayKeyInZone(instant, "America/New_York")).toBe("2026-09-04");
    expect(dayKeyInZone(instant, "Asia/Kolkata")).toBe("2026-09-05");
  });

  it("resolves missing/invalid zones (and the UTC default) to legacy IST", () => {
    expect(resolveUserZone(null)).toBe(LEGACY_FALLBACK_ZONE);
    expect(resolveUserZone(undefined)).toBe(LEGACY_FALLBACK_ZONE);
    expect(resolveUserZone("UTC")).toBe(LEGACY_FALLBACK_ZONE);
    expect(resolveUserZone("Not/AZone")).toBe(LEGACY_FALLBACK_ZONE);
    expect(resolveUserZone("America/New_York")).toBe("America/New_York");
  });

  it("validates IANA zones without throwing", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Pacific/Auckland")).toBe(true);
    expect(isValidTimeZone("bogus")).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("shifts day keys across month/year boundaries (DST-proof string math)", () => {
    expect(shiftDayKey("2026-03-08", -1)).toBe("2026-03-07"); // US spring-forward day
    expect(shiftDayKey("2026-11-01", -1)).toBe("2026-10-31"); // US fall-back day
    expect(shiftDayKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDayKey("2026-09-04", 1)).toBe("2026-09-05");
  });

  it("computes Monday week starts in-zone", () => {
    // Friday 2026-09-04 12:00 UTC → Monday 2026-08-31 00:00 America/New_York (EDT)
    const monday = weekStartInZone(new Date("2026-09-04T12:00:00Z"), "America/New_York");
    expect(monday.toISOString()).toBe("2026-08-31T04:00:00.000Z");
  });

  it("round-trips day starts: start-of-day formats back to the same key", () => {
    for (const zone of ["America/New_York", "Asia/Kolkata", "Pacific/Auckland", "Europe/Berlin"]) {
      const start = dayStartInZone("2026-09-04", zone);
      expect(dayKeyInZone(start.getTime(), zone)).toBe("2026-09-04");
    }
  });

  it("never silently resets on zone adoption: legacy IST yesterday continues the streak", () => {
    // Instant 2026-09-05T00:30Z → IST date 09-05, New York date 09-04.
    // The user studied on IST 09-04; in the new zone that key is neither
    // today (09-04 NY… wait: NY today IS 09-04) — so craft the adoption
    // boundary one day later: NY today 09-05, NY yesterday 09-04.
    const res = nextStreakValues({
      lastStudyDate: "2026-09-04", // earned under legacy IST
      currentStreak: 7,
      longestStreak: 7,
      today: "2026-09-05", // new zone today
      yesterday: "2026-09-04", // new zone yesterday — matches here too…
      legacyYesterday: "2026-09-04",
    });
    expect(res.changed).toBe(true);
    expect(res.currentStreak).toBe(8);
  });

  it("zone-shift gap: legacy yesterday matches when the new zone skips a key", () => {
    // Westward travel can make the new zone's yesterday differ from the
    // legacy one; the legacy match must still continue the streak.
    const res = nextStreakValues({
      lastStudyDate: "2026-09-04",
      currentStreak: 7,
      longestStreak: 7,
      today: "2026-09-06",
      yesterday: "2026-09-05",
      legacyYesterday: "2026-09-04",
    });
    expect(res.changed).toBe(true);
    expect(res.currentStreak).toBe(8);
  });

  it("still resets after a genuine missed day in both calendars", () => {
    const res = nextStreakValues({
      lastStudyDate: "2026-09-01",
      currentStreak: 7,
      longestStreak: 9,
      today: "2026-09-04",
      yesterday: "2026-09-03",
      legacyYesterday: "2026-09-03",
    });
    expect(res.currentStreak).toBe(1);
    expect(res.longestStreak).toBe(9);
  });

  it("same-day repeats still do not double-increment", () => {
    const res = nextStreakValues({
      lastStudyDate: "2026-09-04",
      currentStreak: 3,
      longestStreak: 5,
      today: "2026-09-04",
      yesterday: "2026-09-03",
    });
    expect(res.changed).toBe(false);
    expect(res.currentStreak).toBe(3);
  });
});
