import { describe, expect, it } from "vitest";
import { calcStreak } from "./habits";

const today = "2026-09-06";
describe("habit streak", () => {
  it("counts consecutive days ending today", () => {
    expect(calcStreak([{ date: "2026-09-06" }, { date: "2026-09-05" }, { date: "2026-09-04" }], today)).toBe(3);
  });
  it("keeps the streak alive when today is not checked in yet", () => {
    expect(calcStreak([{ date: "2026-09-05" }, { date: "2026-09-04" }], today)).toBe(2);
  });
  it("breaks after a missed day", () => {
    expect(calcStreak([{ date: "2026-09-06" }, { date: "2026-09-04" }], today)).toBe(1);
    expect(calcStreak([{ date: "2026-09-03" }], today)).toBe(0);
  });
  it("crosses month boundaries", () => {
    expect(calcStreak([{ date: "2026-09-01" }, { date: "2026-08-31" }], "2026-09-01")).toBe(2);
  });
});
