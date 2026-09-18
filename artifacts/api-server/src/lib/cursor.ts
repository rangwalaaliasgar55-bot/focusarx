/**
 * Keyset ("cursor") pagination.
 *
 * ## Why offset pagination is wrong for every list in this app
 *
 * `LIMIT n OFFSET m` is only correct if the underlying rows do not change while
 * the user pages. Every list we paginate fails that condition:
 *
 *   - the wallet transaction list gains a row every time the user earns coins;
 *   - a DM thread gains a row every time the other person types;
 *   - the social feed gains rows continuously.
 *
 * When a row is inserted at the *top* of a `created_at DESC` ordering, every
 * subsequent page shifts down by one. The user's next page then re-serves the
 * last row they already saw, and — because the page has a fixed size — the row
 * that occupied the final slot is pushed past the window and never shown. So
 * offset pagination duplicates *and* silently drops records. The deletion case
 * is the mirror image: rows shift up, and records are skipped entirely.
 *
 * Keyset pagination removes the failure mode by construction: the cursor names
 * a *position in the ordering*, not a count of rows before it. Inserting a row
 * above the cursor cannot change what comes after it.
 *
 * ## Why the cursor is a pair, not a timestamp
 *
 * This is the subtle part, and getting it wrong reintroduces the bug in a form
 * that is much harder to notice. `WHERE created_at < :cursor` is wrong whenever
 * two rows share a timestamp, because `<` is strict: rows created in the same
 * instant as the boundary are skipped rather than continued from.
 *
 * Shared timestamps are not a rare edge case here. A single statement inserting
 * several rows gives them all the same `now()` — which is exactly what
 * `purgeExpiredDeletions`, mission rewards and bulk grants do. The original
 * 50-row wallet page can therefore span a batch, and the *first* page boundary
 * lands on a tie with high probability.
 *
 * So the cursor carries `(created, id)` and the predicate is
 * `(created_at, id) < (:created, :id)` — a row-wise comparison, which
 * Postgres executes as an index scan. `id` is a random UUID, so it is an
 * arbitrary but *stable, unique* tiebreaker: arbitrary is fine, because all we
 * need is a total order to resume from.
 *
 * ## The opaque token
 *
 * The token is base64url of `JSON.stringify([createdISO, id])`. It is signed
 * with nothing and encrypted with nothing, deliberately: it contains a
 * timestamp and a row id the client already holds, both of which it could
 * assemble itself. The goal is that callers treat it as opaque and stop
 * hand-rolling `?page=2`, not that it protect anything. Anyone who wants to
 * forge one can only produce a cursor pointing at a row they can already see.
 */

import { and, eq, lt, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { parseLimit } from "./pagination";

export interface CursorPage {
  limit: number;
  /** Decoded position, or null for the first page. */
  cursor: { created: Date; id: string } | null;
  /** Whatever the client sent, echoed back verbatim if it was unusable. */
  rawCursor: string | null;
  /** True when a cursor was supplied but could not be decoded. */
  cursorMalformed: boolean;
}

/**
 * Encode a row's position. `created` may be a Date or an ISO string; a null or
 * unparseable value falls back to the epoch, which degrades to "start from the
 * beginning" rather than throwing.
 */
export function encodeCursor(created: Date | string | null | undefined, id: string): string {
  const date = created instanceof Date ? created : new Date(created ?? 0);
  const iso = Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
  return Buffer.from(JSON.stringify([iso, id]), "utf8").toString("base64url");
}

/**
 * Decode a cursor token.
 *
 * Returns null for anything malformed — a truncated token, a forged one, a
 * `?cursor=` left over from a different endpoint. Callers must treat null as
 * "no cursor" and serve the first page. Throwing here would turn a bad URL into
 * a 500, and there is no user input so invalid that returning page one is
 * harmful.
 */
export function decodeCursor(token: unknown): { created: Date; id: string } | null {
  if (typeof token !== "string" || token.length === 0 || token.length > 512) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) return null;
  const [iso, id] = parsed;
  if (typeof iso !== "string" || typeof id !== "string" || id.length === 0 || id.length > 128) return null;
  const created = new Date(iso);
  if (!Number.isFinite(created.getTime())) return null;
  return { created, id };
}

/** Parse `?limit=` and `?cursor=` together. */
export function parseCursorPage(
  query: Record<string, unknown>,
  opts: { fallback?: number; min?: number; max?: number } = {},
): CursorPage {
  const limit = parseLimit(query.limit, opts);
  const raw = typeof query.cursor === "string" ? query.cursor : null;
  if (raw === null) return { limit, cursor: null, rawCursor: null, cursorMalformed: false };
  const cursor = decodeCursor(raw);
  return { limit, cursor, rawCursor: raw, cursorMalformed: cursor === null };
}

/**
 * The `WHERE` clause for "after this cursor", in `created DESC, id DESC` order.
 *
 * Deliberately a row-wise comparison — `(a, b) < (c, d)` — rather than the
 * expanded `a < c OR (a = c AND b < d)`. Postgres plans the row-wise form as a
 * single index scan on `(created_at, id)`; the expanded form is frequently
 * planned as a bitmap OR, which is measurably worse at the sizes where
 * pagination matters. They are semantically identical, so the only reason to
 * prefer one is the plan.
 */
export function keysetBefore(
  createdColumn: PgColumn,
  idColumn: PgColumn,
  cursor: { created: Date; id: string },
): SQL {
  return sql`(${createdColumn}, ${idColumn}) < (${cursor.created}, ${cursor.id})`;
}

/**
 * Fetch `limit + 1` rows and report whether there is another page.
 *
 * The `+1` trick avoids a second `COUNT(*)` query, which would be both slower
 * and — more importantly — wrong: a count taken at a different instant than the
 * page can disagree with it, so the client could be told `hasMore: true` and
 * then receive an empty page. Deciding from an actual extra row cannot lie.
 *
 * Returns the trimmed rows and a `nextCursor` derived from the *last returned*
 * row, so the next page resumes exactly where this one stopped.
 */
export function paginate<T extends { id: string; createdAt: Date | null }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null; hasMore: boolean } {
  if (rows.length <= limit) {
    return { items: rows, nextCursor: null, hasMore: false };
  }
  const items = rows.slice(0, limit);
  const last = items[items.length - 1]!;
  return { items, nextCursor: encodeCursor(last.createdAt, last.id), hasMore: true };
}

/**
 * Build the full `WHERE` for a user-scoped, newest-first keyset list.
 *
 * Composed here rather than in each route so the two subtleties above — the
 * pair comparison and the ownership predicate — cannot be applied in one route
 * and forgotten in another.
 */
export function userTimelineWhere(
  ownerColumn: PgColumn,
  ownerId: string,
  createdColumn: PgColumn,
  idColumn: PgColumn,
  page: CursorPage,
): SQL | undefined {
  const clauses = [eq(ownerColumn, ownerId)];
  if (page.cursor) clauses.push(keysetBefore(createdColumn, idColumn, page.cursor));
  return and(...clauses);
}

/** Kept close to the query helper so the two orderings cannot drift apart. */
export function newerFirst<T extends { createdAt: PgColumn; id: PgColumn }>(t: T) {
  return { created: t.createdAt, id: t.id };
}

/** Re-exported so a caller can express a tiebreak explicitly if it must. */
export { or, lt };
