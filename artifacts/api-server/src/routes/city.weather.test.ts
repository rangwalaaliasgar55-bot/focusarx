import { describe, expect, it } from "vitest";
import { deriveCityWeather, taxSnapshot } from "./city";

const today = "2026-09-06";
const yesterday = "2026-09-05";

describe("Focus City weather reflects behaviour", () => {
  it("rains over a city that has never studied", () => {
    expect(deriveCityWeather({ lastStudyDate: null, currentStreak: 0, today, yesterday })).toBe("rain");
  });
  it("clears when the user studied today", () => {
    expect(deriveCityWeather({ lastStudyDate: today, currentStreak: 3, today, yesterday })).toBe("clear");
  });
  it("shows a rainbow for a week-long streak studied today", () => {
    expect(deriveCityWeather({ lastStudyDate: today, currentStreak: 7, today, yesterday })).toBe("rainbow");
  });
  it("is windy when yesterday was the last session (streak still alive)", () => {
    expect(deriveCityWeather({ lastStudyDate: yesterday, currentStreak: 4, today, yesterday })).toBe("wind");
  });
  it("clouds over after two or three quiet days", () => {
    expect(deriveCityWeather({ lastStudyDate: "2026-09-04", currentStreak: 0, today, yesterday })).toBe("cloudy");
    expect(deriveCityWeather({ lastStudyDate: "2026-09-03", currentStreak: 0, today, yesterday })).toBe("cloudy");
  });
  it("rains after four or more quiet days", () => {
    expect(deriveCityWeather({ lastStudyDate: "2026-09-02", currentStreak: 0, today, yesterday })).toBe("rain");
    expect(deriveCityWeather({ lastStudyDate: "2026-07-01", currentStreak: 0, today, yesterday })).toBe("rain");
  });
});

describe("Focus City citizen tax", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");

  it("scales revenue with citizens and properties", () => {
    const tax = taxSnapshot({ population: 100, totalBuildings: 3, lastTaxAt: new Date("2026-09-20T10:00:00.000Z") }, now);
    expect(tax.ratePerHour).toBe(16);
    expect(tax.available).toBe(32);
  });

  it("caps unattended revenue at 24 hours", () => {
    const tax = taxSnapshot({ population: 50, totalBuildings: 0, lastTaxAt: new Date("2026-09-01T00:00:00.000Z") }, now);
    expect(tax.available).toBe(120);
    expect(tax.storageHours).toBe(24);
  });
});
