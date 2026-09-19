import { describe, it, expect } from "vitest";
import { decodeCursor, encodeCursor, paginate, parseCursorPage } from "./cursor";

/**
 * The failure this module exists to prevent is silent: a keyset query that uses
 * `created_at < :cursor` without the id tiebreaker looks correct, passes a
 * hand-check against rows with distinct timestamps, and then drops records in
 * production whenever two rows share one.
 *
 * Shared timestamps are the common case, not the edge case. A single INSERT of
 * several rows gives them all the same `now()`; a batch grant does exactly
 * that. So the tests below lead with the tie, because that is the case a naive
 * implementation gets wrong.
 */

const row = (id: string, iso: string) => ({ id, createdAt: new Date(iso) });

describe("cursor encoding", () => {
  it("round-trips a position", () => {
    const token = encodeCursor(new Date("2026-05-01T10:00:00.000Z"), "abc-123");
    const decoded = decodeCursor(token);
    expect(decoded?.id).toBe("abc-123");
    expect(decoded?.created.toISOString()).toBe("2026-05-01T10:00:00.000Z");
  });

  it("is URL-safe, so it survives a query string without escaping", () => {
    const token = encodeCursor(new Date("2026-05-01T10:00:00.000Z"), "a/b+c=d");
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeURIComponent(encodeURIComponent(token))).toBe(token);
  });

  it("accepts an ISO string as well as a Date", () => {
    expect(decodeCursor(encodeCursor("2026-05-01T10:00:00.000Z", "x"))?.id).toBe("x");
  });

  it("returns null for every malformed shape instead of throwing", () => {
    // A 500 on a bad URL is a worse outcome than serving page one, and there is
    // no cursor so wrong that returning the first page is harmful.
    for (const bad of [
      "",
      "not-base64!!",
      Buffer.from("{}").toString("base64url"),
      Buffer.from("[1,2,3]").toString("base64url"),
      Buffer.from('["2026-05-01T10:00:00.000Z"]').toString("base64url"),
      Buffer.from('["not-a-date","id"]').toString("base64url"),
      Buffer.from('["2026-05-01T10:00:00.000Z",123]').toString("base64url"),
      Buffer.from('["2026-05-01T10:00:00.000Z",""]').toString("base64url"),
      "a".repeat(600), // length guard: unbounded input is not decoded
    ]) {
      expect(decodeCursor(bad), JSON.stringify(bad).slice(0, 40)).toBeNull();
    }
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor(42)).toBeNull();
  });

  it("does not report a malformed cursor as a valid one", () => {
    // `cursorMalformed` exists so a route can decide to 400 instead of quietly
    // serving page one — the client may have a real bug, and silently resetting
    // to the top of a feed is how "it keeps showing me the same posts" happens.
    const page = parseCursorPage({ cursor: "garbage", limit: "20" });
    expect(page.cursor).toBeNull();
    expect(page.cursorMalformed).toBe(true);
    expect(page.rawCursor).toBe("garbage");

    const clean = parseCursorPage({ limit: "20" });
    expect(clean.cursorMalformed).toBe(false);
    expect(clean.cursor).toBeNull();
  });

  it("clamps the limit through the shared parser", () => {
    expect(parseCursorPage({ limit: "100000" }).limit).toBeLessThanOrEqual(50);
    expect(parseCursorPage({ limit: "-5" }).limit).toBeGreaterThanOrEqual(1);
    expect(parseCursorPage({ limit: "abc" }).limit).toBe(20);
  });
});

describe("paginate", () => {
  const t = (n: number, iso: string) =>
    Array.from({ length: n }, (_, i) => row(`id-${i}`, iso));

  it("reports no further page when the rows fit", () => {
    const result = paginate(t(3, "2026-05-01T10:00:00.000Z"), 5);
    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });

  it("uses the +1 row to decide hasMore, not a count", () => {
    // 6 rows for a limit of 5: the sixth proves there is more and is withheld.
    const result = paginate(t(6, "2026-05-01T10:00:00.000Z"), 5);
    expect(result.items).toHaveLength(5);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
  });

  it("resumes from the last returned row, not the overfetched one", () => {
    // The bug this prevents: deriving nextCursor from rows[limit] (the probe
    // row) skips it, so the next page starts one row too late and that record
    // is never seen.
    const rows = [
      row("a", "2026-05-01T10:00:00.000Z"),
      row("b", "2026-05-01T09:00:00.000Z"),
      row("c", "2026-05-01T08:00:00.000Z"),
    ];
    const result = paginate(rows, 2);
    expect(result.nextCursor).toBe(encodeCursor(new Date("2026-05-01T09:00:00.000Z"), "b"));
    const decoded = decodeCursor(result.nextCursor!)!;
    expect(decoded.id).toBe("b");
  });

  it("keeps records that share a timestamp reachable across a page boundary", () => {
    // Four rows in one batch, all with the same instant, paged two at a time.
    // With a bare `created_at < cursor` the second page comes back empty; the
    // id tiebreaker is what makes it work.
    //
    // The ordering is `created DESC, id DESC`, so at equal timestamps the ids
    // run *downwards*: w, x, y, z reads z, y, x, w. Getting this backwards in
    // the test is exactly the mistake the test is here to catch in the query.
    const batch = ["w", "x", "y", "z"]
      .map((id) => row(id, "2026-05-01T10:00:00.000Z"))
      .sort((a, b) => b.id.localeCompare(a.id));
    expect(batch.map((r) => r.id)).toEqual(["z", "y", "x", "w"]);
    const first = paginate(batch, 2);
    expect(first.items.map((r) => r.id)).toEqual(["z", "y"]);

    const cursor = decodeCursor(first.nextCursor!)!;
    const remaining = batch.filter(
      (r) =>
        r.createdAt.getTime() < cursor.created.getTime() ||
        (r.createdAt.getTime() === cursor.created.getTime() && r.id < cursor.id),
    );
    expect(remaining.map((r) => r.id)).toEqual(["x", "w"]);
  });

  it("never duplicates or drops a row across a full walk", () => {
    // The property that offset pagination cannot offer. Simulated against the
    // same row-wise comparison the SQL uses.
    const all = ["m", "n", "o", "p", "q", "r", "s"]
      .map((id) => row(id, "2026-05-01T10:00:00.000Z"))
      .sort((a, b) => b.id.localeCompare(a.id));
    const seen: string[] = [];
    let cursor: ReturnType<typeof decodeCursor> = null;
    for (let guard = 0; guard < 10; guard += 1) {
      const window = all.filter(
        (r) =>
          !cursor ||
          r.createdAt.getTime() < cursor.created.getTime() ||
          (r.createdAt.getTime() === cursor.created.getTime() && r.id < cursor.id),
      );
      const page = paginate(window, 2);
      seen.push(...page.items.map((r) => r.id));
      if (!page.hasMore) break;
      cursor = decodeCursor(page.nextCursor!)!;
    }
    expect(seen).toEqual(["s", "r", "q", "p", "o", "n", "m"]);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
