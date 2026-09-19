import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every list the user pages through while it is changing must be keyset
 * paginated, and the tiebreak must be present.
 *
 * `LIMIT n OFFSET m` is only correct if the rows do not change underneath the
 * walk. Three lists in this app fail that condition, and each had a different
 * symptom:
 *
 *   - `/gamification/wallet/transactions` accepted `?page=` and ignored it,
 *     always returning the newest 50 and never sending the `hasMore` its client
 *     gated the "Load more…" button on. The button could not render, so the
 *     list was silently capped at 50 for every user, forever.
 *   - `/dm/:convId/messages` used offset on a conversation that gains messages
 *     while you read it, so the next page repeated rows and dropped the oldest
 *     in the window.
 *   - the discover feed compared a bare timestamp with `created_at <`, which
 *     skips every row sharing an instant with the boundary — and bots post in
 *     batches, so the boundary landed on a tie routinely.
 *
 * This is a source-level gate rather than a behavioural one because the defect
 * is a *choice of query shape*. Reproducing any of the three against a real
 * database requires control over concurrent inserts, which the integration
 * suite has no way to express — the tests skip without `DATABASE_URL` anyway.
 * What can be checked cheaply and cannot pass by accident is that the endpoint
 * uses the shared helper and sorts on the pair.
 */
const SRC = join(process.cwd(), "src");

const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/**
 * Endpoints whose rows are appended to while the user pages.
 *
 * `file` is the route module; the assertions below apply to the whole file,
 * which is deliberate — a file that paginates one of its lists correctly and
 * another by offset is one refactor away from having two broken ones.
 */
const MUTABLE_FEEDS = [
  { file: "routes/gamification.ts", route: "GET /gamification/wallet/transactions" },
  { file: "routes/dm.ts", route: "GET /dm/:convId/messages" },
  { file: "routes/posts.ts", route: "GET /posts/feed (discover)" },
];

describe("keyset pagination adoption", () => {
  it("has every mutable feed on the shared cursor helper", () => {
    const missing = MUTABLE_FEEDS.filter(({ file }) => !read(file).includes('from "../lib/cursor"')).map(
      (f) => f.route,
    );
    expect(missing, `these lists are paginated without the shared cursor helper: ${missing.join(", ")}`).toEqual([]);
  });

  it("never uses OFFSET in a mutable feed", () => {
    // The whole point. An `offset` in one of these files means a page boundary
    // that duplicates or skips, depending on which way the rows shifted.
    const offenders: string[] = [];
    for (const { file, route } of MUTABLE_FEEDS) {
      const source = read(file);
      if (/\.offset\(/.test(source)) offenders.push(route);
    }
    expect(offenders, `OFFSET is still used by: ${offenders.join(", ")}`).toEqual([]);
  });

  it("compares on the (created_at, id) pair, never the timestamp alone", () => {
    // `lt(createdAt, cursor)` without the id is the bug that hides: it looks
    // right, works on any hand-checked dataset with distinct timestamps, and
    // drops rows in production.
    const offenders: string[] = [];
    for (const { file, route } of MUTABLE_FEEDS) {
      const source = read(file);
      // `userTimelineWhere` composes `keysetBefore` internally, so accepting
      // either is correct — the requirement is a pair comparison, not a
      // particular call site.
      if (/keysetBefore\(/.test(source) || /userTimelineWhere\(/.test(source)) continue;
      offenders.push(route);
    }
    expect(offenders, `no (created_at, id) keyset comparison in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("orders by the id tiebreak as well as the timestamp", () => {
    // The predicate and the sort must agree, or the cursor resumes from a
    // position the ordering cannot represent and rows are skipped.
    const wallet = read("routes/gamification.ts");
    expect(wallet).toMatch(/orderBy\(desc\(coinTransactionsTable\.createdAt\), desc\(coinTransactionsTable\.id\)\)/);
    const dm = read("routes/dm.ts");
    expect(dm).toMatch(/orderBy\(desc\(messages\.createdAt\), desc\(messages\.id\)\)/);
  });

  it("fetches one extra row to decide hasMore, rather than counting", () => {
    // A separate COUNT runs at a different instant from the page and can
    // disagree with it — telling the client `hasMore: true` and then handing it
    // an empty page.
    for (const { file, route } of MUTABLE_FEEDS) {
      const source = read(file);
      expect(source, `${route} decides hasMore without a probe row`).toMatch(/limit\([^)]*\+\s*1\)|overfetch/);
    }
  });

  it("still parses limits through the shared clamp", () => {
    // Cursor adoption must not reintroduce the unbounded-limit bug that
    // lib/pagination.ts was written to fix.
    for (const { file } of MUTABLE_FEEDS) {
      const source = read(file);
      expect(source.includes("parseLimit(") || source.includes("parseCursorPage(")).toBe(true);
    }
  });
});
