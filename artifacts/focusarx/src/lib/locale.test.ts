import { describe, it, expect, beforeEach } from "vitest";
import { fmtDate, fmtInt, getLocale, setLocale } from "./locale";

describe("locale foundations", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("falls back to en-US without a stored preference only if navigator is exotic", () => {
    const locale = getLocale();
    expect(typeof locale).toBe("string");
    expect(locale.length).toBeGreaterThan(1);
  });

  it("stores canonical locales and rejects garbage", () => {
    expect(setLocale("en-GB")).toBe(true);
    expect(getLocale()).toBe("en-GB");
    expect(setLocale("not-a-locale!!")).toBe(false);
    expect(getLocale()).toBe("en-GB");
  });

  it("formats dates and integers without throwing", () => {
    expect(fmtDate("2026-09-05", "en-GB")).toContain("2026");
    expect(fmtDate("garbage")).toBe("garbage");
    expect(fmtInt(1234567, "en-US")).toBe("1,234,567");
    expect(fmtInt(NaN)).toBe("0");
  });
});
