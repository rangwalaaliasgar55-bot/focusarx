/**
 * Shared, defensive pagination parsing.
 *
 * Why this exists: several routes did `parseInt(req.query.limit)` directly and
 * handed the result to Drizzle's `.limit()/.offset()`. That meant:
 *   - `?limit=100000` was honoured verbatim (unbounded scan, 30s timeout, OOM)
 *   - `?offset=abc` produced `NaN`, which Postgres rejects → HTTP 500
 *   - `?limit=-5` produced a negative LIMIT
 *
 * Every value returned here is a finite, clamped, non-negative integer, so the
 * caller can pass it straight into a query with no further validation.
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;
export const MAX_PAGE_OFFSET = 1_000_000;

/** Parse an integer query param, falling back to `fallback` on any garbage. */
export function parseIntParam(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Clamp a `limit` into [min, max], defaulting to `fallback`. */
export function parseLimit(
  value: unknown,
  opts: { fallback?: number; min?: number; max?: number } = {},
): number {
  const fallback = opts.fallback ?? DEFAULT_PAGE_LIMIT;
  const min = Math.max(1, opts.min ?? 1);
  const max = Math.max(min, Math.min(opts.max ?? MAX_PAGE_LIMIT, MAX_PAGE_LIMIT));
  const n = parseIntParam(value, fallback);
  return Math.min(max, Math.max(min, n));
}

/** Clamp an `offset` into [0, MAX_PAGE_OFFSET], never returning NaN. */
export function parseOffset(value: unknown): number {
  const n = parseIntParam(value, 0);
  return Math.min(MAX_PAGE_OFFSET, Math.max(0, n));
}

export interface Page {
  limit: number;
  offset: number;
  page: number;
}

/** Parse a `page`+`limit` pair into a safe `{limit, offset, page}` triple. */
export function parsePageParams(
  query: Record<string, unknown>,
  opts: { fallback?: number; max?: number } = {},
): Page {
  const limit = parseLimit(query.limit, opts);
  const page = Math.max(1, parseIntParam(query.page, 1));
  const offset = query.offset !== undefined ? parseOffset(query.offset) : (page - 1) * limit;
  return { limit, offset, page };
}
