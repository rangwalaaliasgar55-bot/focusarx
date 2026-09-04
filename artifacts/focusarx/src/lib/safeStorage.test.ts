import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  safeGet,
  safeGetJson,
  safeSet,
  safeSetJson,
  safeRemove,
  deviceTimeZone,
  STORAGE_VERSION_KEY,
  stampSchemaVersion,
} from "./safeStorage";

describe("safeStorage (Phase 5.3 STATE regression)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips JSON values", () => {
    expect(safeSetJson("k", { a: 1 })).toBe(true);
    expect(safeGetJson("k", null)).toEqual({ a: 1 });
  });

  it("returns the fallback instead of throwing on corrupt JSON — and quarantines it", () => {
    window.localStorage.setItem("bad", "{not-json");
    expect(safeGetJson("bad", { ok: true })).toEqual({ ok: true });
    // Original key cleared, quarantine copy kept for inspection.
    expect(window.localStorage.getItem("bad")).toBeNull();
    const quarantineKeys = Object.keys(window.localStorage).filter((k) =>
      k.startsWith("bad:corrupt:"),
    );
    expect(quarantineKeys.length).toBe(1);
  });

  it("never throws when setItem throws (Safari private mode) — falls back to memory", () => {
    // jsdom exposes localStorage via an accessor; prototype-level spy
    // reliably intercepts the write path in every test DOM.
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    try {
      expect(() => safeSet("x", "1")).not.toThrow();
      expect(safeSet("x", "1")).toBe(false);
      expect(safeGet("x")).toBe("1");
    } finally {
      spy.mockRestore();
    }
    safeRemove("x");
  });

  it("stamps the schema version once and keeps it stable", () => {
    stampSchemaVersion();
    expect(safeGet(STORAGE_VERSION_KEY)).toBe("1");
    window.localStorage.setItem(STORAGE_VERSION_KEY, "99");
    stampSchemaVersion();
    expect(safeGet(STORAGE_VERSION_KEY)).toBe("99");
  });

  it("deviceTimeZone returns a non-empty string in a real browser env", () => {
    const tz = deviceTimeZone();
    expect(typeof tz === "string" && (tz as string).length > 0).toBe(true);
  });
});
