import { describe, expect, it } from "vitest";
import {
  parseLimit,
  parseOffset,
  parseIntParam,
  parsePageParams,
  MAX_PAGE_LIMIT,
  MAX_PAGE_OFFSET,
} from "./pagination";

/**
 * Regression guard for the feed/DM pagination bug.
 *
 * `routes/posts.ts` and `routes/dm.ts` passed `parseInt(req.query.limit)`
 * straight into Drizzle's `.limit()/.offset()`. That meant:
 *   - `?limit=100000` ran an unbounded scan (30s serverless timeout)
 *   - `?offset=abc` produced NaN, which Postgres rejects → HTTP 500
 *   - `?limit=-5` produced a negative LIMIT
 * Every case below is a request that used to 500 or hang.
 */
describe("parseLimit", () => {
  it("clamps absurd limits to the max", () => {
    expect(parseLimit("100000")).toBe(MAX_PAGE_LIMIT);
    expect(parseLimit("999999999")).toBe(MAX_PAGE_LIMIT);
  });

  it("clamps zero and negative limits to the minimum", () => {
    expect(parseLimit("0")).toBe(1);
    expect(parseLimit("-5")).toBe(1);
    expect(parseLimit("-100000")).toBe(1);
  });

  it("falls back on garbage instead of returning NaN", () => {
    expect(parseLimit("abc")).toBe(20);
    expect(parseLimit("")).toBe(20);
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit(null)).toBe(20);
    expect(parseLimit([])).toBe(20);
  });

  it("honours a custom fallback and bounds", () => {
    expect(parseLimit(undefined, { fallback: 50 })).toBe(50);
    expect(parseLimit("10", { min: 5 })).toBe(10);
    expect(parseLimit("1", { min: 5 })).toBe(5);
    expect(parseLimit("500", { max: 100 })).toBe(MAX_PAGE_LIMIT);
  });

  it("never returns NaN, whatever the input", () => {
    const nasty = ["abc", "", "  ", "NaN", "Infinity", "1e999", "0x10", "12abc", "--5"];
    for (const v of nasty) {
      expect(Number.isNaN(parseLimit(v))).toBe(false);
      expect(Number.isFinite(parseLimit(v))).toBe(true);
    }
  });

  it("ignores trailing garbage the way parseInt would, but stays clamped", () => {
    expect(parseLimit("30abc")).toBe(30);
  });
});

describe("parseOffset", () => {
  it("clamps negative offsets to zero", () => {
    expect(parseOffset("-1")).toBe(0);
    expect(parseOffset("-99999")).toBe(0);
  });

  it("returns 0 for garbage instead of NaN", () => {
    expect(parseOffset("abc")).toBe(0);
    expect(parseOffset("")).toBe(0);
    expect(parseOffset(undefined)).toBe(0);
  });

  it("caps offset so a deep-paging client cannot force a full scan", () => {
    expect(parseOffset("999999999999")).toBe(MAX_PAGE_OFFSET);
  });

  it("passes through valid offsets", () => {
    expect(parseOffset("0")).toBe(0);
    expect(parseOffset("20")).toBe(20);
    expect(parseOffset("1000")).toBe(1000);
  });
});

describe("parseIntParam", () => {
  it("handles numbers, numeric strings and garbage", () => {
    expect(parseIntParam(42, 0)).toBe(42);
    expect(parseIntParam("42", 0)).toBe(42);
    expect(parseIntParam(42.9, 0)).toBe(42);
    expect(parseIntParam("abc", 7)).toBe(7);
    expect(parseIntParam(Infinity, 7)).toBe(7);
    expect(parseIntParam(NaN, 7)).toBe(7);
  });
});

describe("parsePageParams", () => {
  it("derives offset from page when offset is absent", () => {
    expect(parsePageParams({ page: "3", limit: "10" })).toEqual({
      limit: 10,
      offset: 20,
      page: 3,
    });
  });

  it("prefers an explicit offset", () => {
    expect(parsePageParams({ page: "3", limit: "10", offset: "5" })).toEqual({
      limit: 10,
      offset: 5,
      page: 3,
    });
  });

  it("clamps page to >= 1", () => {
    expect(parsePageParams({ page: "0" }).page).toBe(1);
    expect(parsePageParams({ page: "-3" }).page).toBe(1);
    expect(parsePageParams({ page: "abc" }).page).toBe(1);
  });
});
