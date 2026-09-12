/**
 * Schema-drift tolerant reads.
 * ══════════════════════════════════════════════════════════════════
 * Why this exists
 * ───────────────
 * `GET /api/study-rooms` answered **500 "Could not load study rooms"** in
 * production while the tables it reads (`study_rooms`, `study_room_members`)
 * existed and the rest of the API worked. The endpoint is a chain of five
 * queries, and a drizzle `db.select()` with no field list expands to *every*
 * column of the table — so one column that exists in
 * `lib/db/src/schema/*.ts` but not yet in the deployed Neon database
 * (Postgres error 42703, `undefined_column`) fails the whole chain, and the
 * whole feature, permanently. Nothing in the response said which column, and
 * every retry failed identically.
 *
 * What it does
 * ────────────
 *   • `selectResilient(table, build)` — runs the query; on an
 *     `undefined_column` error it drops that column and retries, and remembers
 *     the drop for the life of the instance so the probe costs one failed query
 *     instead of one per request. The endpoint degrades to "rooms without that
 *     field" instead of dying.
 *   • `queryOrFallback(label, promise, fallback)` — for enrichment queries that
 *     are decoration (participant counts, message counts, wallet levels). If
 *     they fail — missing table, missing column, statement timeout — the caller
 *     gets the fallback and the primary payload still ships.
 *
 * Both log at `error` with the SQLSTATE, the object name and the request id, so
 * the drift is visible in Vercel function logs and can be fixed by applying the
 * migration. This module makes the *product* survive drift; it does not hide it.
 *
 * Fail-open is deliberate and matches the deployment-skew guard's contract:
 * a missing column must not take a page down, and a missing decoration column
 * must not take an endpoint down.
 */

import { getTableColumns, Table, type AnyColumn } from "drizzle-orm";
import { logger } from "./logger";

/** Postgres SQLSTATEs that mean "the database does not look like the schema". */
const UNDEFINED_COLUMN = "42703";
const UNDEFINED_TABLE = "42P01";

interface PgLikeError {
  code?: string;
  column?: string;
  table?: string;
  message?: string;
}

export type DriftKind = "column" | "table" | "unknown";

export interface DriftInfo {
  kind: DriftKind;
  /** The database-side name (`study_room_members.focus_minutes` → `focus_minutes`). */
  name: string | null;
  sqlstate: string | null;
}

/** Classify an error as schema drift, and name the object the database lacks. */
export function describeDrift(error: unknown): DriftInfo {
  const err = (error ?? {}) as PgLikeError;
  const sqlstate = typeof err.code === "string" ? err.code : null;
  const message = typeof err.message === "string" ? err.message : "";

  if (sqlstate === UNDEFINED_COLUMN || /column "[^"]+" does not exist/i.test(message)) {
    // node-postgres sets `column`; parse the message when it does not.
    const fromMessage = message.match(/column "([^"]+)" does not exist/i)?.[1] ?? null;
    return { kind: "column", name: err.column ?? fromMessage, sqlstate };
  }
  if (sqlstate === UNDEFINED_TABLE || /relation "[^"]+" does not exist/i.test(message)) {
    const fromMessage = message.match(/relation "([^"]+)" does not exist/i)?.[1] ?? null;
    return { kind: "table", name: err.table ?? fromMessage, sqlstate };
  }
  return { kind: "unknown", name: null, sqlstate };
}

/** True when retrying the same statement cannot possibly succeed. */
export function isDependencyFailure(error: unknown): boolean {
  const info = describeDrift(error);
  if (info.kind !== "unknown") return true;
  const message = ((error as PgLikeError)?.message ?? "").toLowerCase();
  return (
    message.includes("connect") ||
    message.includes("timeout") ||
    message.includes("terminating connection") ||
    message.includes("too many clients")
  );
}

/** Columns this instance already knows are missing, per table. */
const knownMissing = new Map<string, Set<string>>();

/**
 * drizzle stores the SQL table name under `Table.Symbol.Name` at runtime. The
 * public type surface only declares the phantom `_` brand (which is a type, not
 * a property — reading `table._.name` returns undefined), so the symbol is read
 * through a cast with the phantom as a fallback for older drizzle releases.
 */
const TABLE_NAME_SYMBOL: symbol | undefined = (Table as unknown as { Symbol?: Record<string, symbol> }).Symbol?.Name;

function tableKey(table: Table): string {
  if (TABLE_NAME_SYMBOL) {
    const fromSymbol = (table as unknown as Record<symbol, unknown>)[TABLE_NAME_SYMBOL];
    if (typeof fromSymbol === "string" && fromSymbol !== "") return fromSymbol;
  }
  const legacy = (table as unknown as { _?: { name?: string } })._?.name;
  return typeof legacy === "string" && legacy !== "" ? legacy : "unknown-table";
}

function missingFor(table: Table): Set<string> {
  const key = tableKey(table);
  let set = knownMissing.get(key);
  if (!set) {
    set = new Set<string>();
    knownMissing.set(key, set);
  }
  return set;
}

/** The field object for `db.select(fields)` minus anything known to be missing. */
export function selectableColumns(table: Table): Record<string, AnyColumn> {
  const columns = getTableColumns(table) as Record<string, AnyColumn>;
  const missing = missingFor(table);
  if (missing.size === 0) return columns;
  const out: Record<string, AnyColumn> = {};
  for (const [key, column] of Object.entries(columns)) {
    if (!missing.has(column.name)) out[key] = column;
  }
  return out;
}

/** How many columns we are willing to drop before giving up and rethrowing. */
const MAX_DRIFT_RETRIES = 4;

/**
 * `db.select()` over every column the deployed database actually has.
 *
 * `build` receives the field object and must return the query builder, so the
 * caller keeps full control of `where` / `orderBy` / `limit`:
 *
 *     const rooms = await selectResilient(studyRoomsTable, (fields) =>
 *       db.select(fields).from(studyRoomsTable).where(…).limit(40));
 *
 * Throws the original error when the failure is not a missing column (or when
 * dropping columns cannot fix it) — a caller that can degrade further wraps
 * this in `queryOrFallback`.
 */
export async function selectResilient<T>(
  table: Table,
  build: (fields: Record<string, AnyColumn>) => PromiseLike<unknown>,
  context: Record<string, unknown> = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      // The field object is built at runtime, so its static type cannot be the
      // caller's `$inferSelect`; the cast is the price of a selection that
      // adapts to the deployed database. Keys are the schema's own property
      // names, so the shape still matches T.
      return (await build(selectableColumns(table))) as T;
    } catch (error) {
      const drift = describeDrift(error);
      if (drift.kind !== "column" || !drift.name || attempt >= MAX_DRIFT_RETRIES) throw error;

      const missing = missingFor(table);
      if (missing.has(drift.name)) throw error; // already dropped and still failing
      missing.add(drift.name);

      logger.error(
        { ...context, table: tableKey(table), column: drift.name, sqlstate: drift.sqlstate },
        "schema drift: column missing in the deployed database — dropping it from the read and retrying. Apply the migration to restore the field.",
      );
    }
  }
}

/**
 * Run a decorative query and fall back instead of failing the request.
 *
 * Only for data the caller can live without: counts, levels, presence. Never
 * for the primary payload — that must fail loudly (or degrade via
 * `selectResilient`) rather than silently return an empty page.
 */
export async function queryOrFallback<T>(
  label: string,
  query: PromiseLike<T>,
  fallback: T,
  context: Record<string, unknown> = {},
): Promise<T> {
  try {
    return await query;
  } catch (error) {
    const drift = describeDrift(error);
    logger.error(
      { ...context, query: label, drift: drift.kind, object: drift.name, sqlstate: drift.sqlstate, err: error },
      "query failed — continuing with a degraded payload",
    );
    return fallback;
  }
}

/** Test hook: forget everything learned about the deployed schema. */
export function __resetDriftCache(): void {
  knownMissing.clear();
}
