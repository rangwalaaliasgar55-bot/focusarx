#!/usr/bin/env node
/**
 * Additive schema sync — the non-interactive half of `drizzle-kit push`.
 *
 * Why this exists
 * ───────────────
 * Production is deployed by Vercel, whose build step cannot answer prompts, and
 * `drizzle-kit push` prompts. So `push:vercel` only ever ran
 * `cleanup-orphans.mjs`, a hand-maintained list of `ADD COLUMN IF NOT EXISTS`
 * patches. Every schema change that nobody remembered to copy into that list
 * silently never reached production. PR #85 added `users.deletion_requested_at`
 * and read it in `GET /api/auth/session`; the column never shipped; every
 * sign-in ended in "FocusArx confirmed your sign-in but could not load your
 * session". Migrations 0016, 0018 and 0019 were missing the same way.
 *
 * What it does
 * ────────────
 * Diffs the canonical Drizzle schema (via `drizzle-kit export`, which reads the
 * TypeScript only) against the live database catalog, and applies ONLY the
 * additive, prompt-free subset:
 *
 *   • CREATE TABLE for tables that do not exist (with their inline constraints)
 *   • ALTER TABLE … ADD COLUMN for columns that do not exist
 *   • CREATE [UNIQUE] INDEX for indexes that do not exist
 *   • ALTER TABLE … ADD CONSTRAINT for missing FOREIGN KEY / UNIQUE / CHECK
 *     constraints (skipped when an equivalent one already exists under the
 *     migration's name — 0012 and drizzle disagree on names, and two identical
 *     constraints buy nothing)
 *
 * It never drops, renames, retypes or truncates anything, and it never touches
 * a NOT NULL column without a default on a populated table. Anything outside
 * that envelope is reported as `manual` and left for a reviewed migration —
 * the sync exits 0 with a warning, because a column that needs human judgement
 * must not block the deploy of the columns that do not.
 *
 * Every statement is idempotent and guarded, so running it twice is a no-op,
 * and running it against an empty database bootstraps the whole schema. Each
 * statement runs in its own transaction: one failure is reported and the rest
 * still apply.
 *
 * What fails the run and what does not (exit code)
 * ────────────────────────────────────────────────
 * A table or column the code reads cannot be missing, so a CREATE TABLE or
 * ADD COLUMN that fails is fatal: exit 1, the deploy stops, the old code stays
 * live. Constraints and indexes are integrity and performance, not what the
 * code needs to run, and a production database that was hand-patched for
 * months will have rows that violate a constraint the schema now declares.
 * Those never block a deploy:
 *   - a CHECK or FOREIGN KEY that existing rows violate is added `NOT VALID`,
 *     so every new write is protected today and the offending rows are listed
 *     for cleanup (then `ALTER TABLE … VALIDATE CONSTRAINT …`);
 *   - a UNIQUE that duplicates violate (Postgres has no NOT VALID for those)
 *     is reported and skipped.
 * Both are printed as WARN and counted in the summary line.
 *
 * Locks: `lock_timeout` is set so a sync waiting behind a long transaction
 * fails fast (retried a few times) instead of hanging the build.
 *
 * Usage
 * ─────
 *   node ./scripts/sync-schema.mjs            # apply
 *   node ./scripts/sync-schema.mjs --dry-run  # print the plan, change nothing
 *   node ./scripts/sync-schema.mjs --strict   # exit 1 if anything is `manual`
 *   node ./scripts/sync-schema.mjs --check    # dry run; exit 1 unless the
 *                                             # database already matches (CI)
 */
import pg from "pg";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ─── SQL parsing ─────────────────────────────────────────────────────────────

/**
 * Split `drizzle-kit export` output into statements. The export writes one
 * statement per line except CREATE TABLE, whose body spans lines until `);`.
 * Nothing in the schema contains a literal `;` inside a string or comment, and
 * `parseSchemaSql` asserts that assumption by refusing anything it does not
 * recognise rather than guessing.
 */
export function splitStatements(sql) {
  const statements = [];
  let buffer = "";
  for (const line of sql.split("\n")) {
    if (line.trim() === "" && buffer === "") continue;
    buffer += (buffer ? "\n" : "") + line;
    if (line.trimEnd().endsWith(";")) {
      statements.push(buffer.trim());
      buffer = "";
    }
  }
  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}

const IDENT = '"([^"]+)"';
const CREATE_TABLE_RE = new RegExp(`^CREATE TABLE ${IDENT} \\(\\n([\\s\\S]*)\\n\\);$`);
const COLUMN_LINE_RE = new RegExp(`^${IDENT} (.+?),?$`);
const CONSTRAINT_LINE_RE = new RegExp(`^CONSTRAINT ${IDENT} (UNIQUE|CHECK|PRIMARY KEY|FOREIGN KEY)\\s*([\\s\\S]*?),?$`);
const CREATE_INDEX_RE = new RegExp(`^CREATE (UNIQUE )?INDEX ${IDENT} ON ${IDENT} (.+);$`);
const ADD_CONSTRAINT_RE = new RegExp(`^ALTER TABLE ${IDENT} ADD CONSTRAINT ${IDENT} (FOREIGN KEY|UNIQUE|CHECK) ([\\s\\S]+);$`);

/**
 * Parse the export into a structured, dialect-free description.
 *
 * Returns `{ tables: Map<name, { columns: Map<name, def>, constraints: [] }>,
 * indexes: [], constraints: [] }`. Column `def` is the SQL fragment after the
 * name (`text DEFAULT 'x' NOT NULL`), kept verbatim so ADD COLUMN reuses the
 * exact expression drizzle-kit would have emitted.
 */
export function parseSchemaSql(sql) {
  const tables = new Map();
  const indexes = [];
  const constraints = [];

  for (const statement of splitStatements(sql)) {
    let match;
    if ((match = statement.match(CREATE_TABLE_RE))) {
      const [, table, body] = match;
      const columns = new Map();
      const inline = [];
      for (const rawLine of body.split("\n")) {
        const line = rawLine.trim();
        if (!line) continue;
        const constraint = line.match(CONSTRAINT_LINE_RE);
        if (constraint) {
          const [, name, kind, definition] = constraint;
          inline.push({ name, kind, definition: definition.trim() });
          continue;
        }
        const column = line.match(COLUMN_LINE_RE);
        if (!column) throw new Error(`sync-schema: cannot parse column line in ${table}: ${line}`);
        columns.set(column[1], column[2]);
      }
      tables.set(table, { columns, constraints: inline, ddl: statement });
      continue;
    }
    if ((match = statement.match(CREATE_INDEX_RE))) {
      const [, unique, name, table, rest] = match;
      indexes.push({ name, table, unique: Boolean(unique), ddl: statement, definition: rest });
      continue;
    }
    if ((match = statement.match(ADD_CONSTRAINT_RE))) {
      const [, table, name, kind, definition] = match;
      constraints.push({ table, name, kind, definition, ddl: statement });
      continue;
    }
    throw new Error(`sync-schema: unrecognised statement in schema export:\n${statement.slice(0, 200)}`);
  }
  return { tables, indexes, constraints };
}

// ─── Column definitions ──────────────────────────────────────────────────────

/** `NOT NULL` with no `DEFAULT` and no `PRIMARY KEY`: unsafe to add to rows. */
export function needsBackfill(columnDef) {
  return /\bNOT NULL\b/.test(columnDef) && !/\bDEFAULT\b/.test(columnDef) && !/\bPRIMARY KEY\b/.test(columnDef);
}

// ─── Planning ────────────────────────────────────────────────────────────────

/**
 * Normalise a constraint definition enough to detect "the same thing under
 * another name": strip quotes, schema prefixes, whitespace and case. Drizzle
 * writes `("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON
 * UPDATE no action`; pg_get_constraintdef returns `FOREIGN KEY (user_id)
 * REFERENCES users(id) ON DELETE CASCADE`. Both must compare equal.
 */
export function normaliseConstraint(kind, definition) {
  let text = `${kind} ${definition}`;
  text = text.replace(/"public"\./g, "").replace(/"/g, "");
  text = text.replace(/\bON UPDATE NO ACTION\b/gi, "").replace(/\bON DELETE NO ACTION\b/gi, "");
  text = text.replace(/\s+/g, " ").replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")").replace(/\s*,\s*/g, ",");
  return text.trim().toUpperCase();
}

/**
 * A CHECK expression as Postgres re-renders it (`(coins >= 0)`, `ANY
 * (ARRAY['a'::text, ...])`) never matches the source text exactly. For CHECKs
 * we therefore compare by the columns they mention: two checks on the same
 * table over the same column set are treated as the same invariant.
 */
export function checkColumns(definition) {
  const cols = new Set();
  for (const m of definition.matchAll(/(?:"[^"]+"\.)?"([a-z_][a-z0-9_]*)"|\b([a-z_][a-z0-9_]*)\b(?=\s*(?:>=|<=|<>|=|>|<|IS\b|IN\b|BETWEEN\b|@>|~))/gi)) {
    const name = (m[1] ?? m[2] ?? "").toLowerCase();
    if (name && !["and", "or", "not", "null", "is", "in", "any", "array", "text", "true", "false"].includes(name)) cols.add(name);
  }
  return [...cols].sort().join(",");
}

/**
 * Compute the additive plan.
 *
 * `live` describes the database: `{ tables: Map<name, { columns: Set<name> }>,
 * indexes: Set<name>, constraints: Map<table, Array<{ name, kind, definition }>> }`.
 *
 * Returns `{ statements: Array<{ kind, table, name, sql }>, manual: string[] }`.
 * `statements` are safe to run unattended; `manual` are the differences the
 * sync refuses to make (destructive, or needing a backfill decision).
 */
export function planSync(desired, live) {
  const statements = [];
  const manual = [];
  const creating = new Set();

  for (const [table, def] of desired.tables) {
    const current = live.tables.get(table);
    if (!current) {
      creating.add(table);
      statements.push({ kind: "create_table", table, name: table, sql: def.ddl.replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ") });
      continue;
    }
    for (const [column, columnDef] of def.columns) {
      if (current.columns.has(column)) continue;
      if (needsBackfill(columnDef) && current.rowCount !== 0) {
        manual.push(`${table}.${column}: NOT NULL without a default cannot be added to a populated table (${columnDef}). Ship a migration that backfills first.`);
        continue;
      }
      statements.push({
        kind: "add_column",
        table,
        name: column,
        sql: `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${columnDef};`,
      });
    }
    for (const constraint of def.constraints) {
      if (constraint.kind === "PRIMARY KEY") continue; // never touched after creation
      planConstraint(statements, manual, live, table, constraint);
    }
  }

  for (const index of desired.indexes) {
    if (live.indexes.has(index.name)) continue;
    // A UNIQUE constraint creates an index of the same name; `pg_indexes`
    // lists it, so this branch only fires for genuinely missing indexes.
    if (live.tables.get(index.table)?.constraintNames?.has(index.name)) continue;
    statements.push({
      kind: index.unique ? "create_unique_index" : "create_index",
      table: index.table,
      name: index.name,
      sql: index.ddl.replace(/^CREATE (UNIQUE )?INDEX /, (_m, u = "") => `CREATE ${u}INDEX IF NOT EXISTS `),
    });
  }

  for (const constraint of desired.constraints) {
    if (creating.has(constraint.table)) {
      // The table is new, so no row can violate the FK: add it verbatim.
      statements.push({ kind: "add_constraint", table: constraint.table, name: constraint.name, sql: guardConstraint(constraint.table, constraint.name, constraint.ddl) });
      continue;
    }
    planConstraint(statements, manual, live, constraint.table, constraint);
  }

  return { statements, manual };
}

function guardConstraint(table, name, ddl) {
  return `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '"public"."${table}"'::regclass AND conname = '${name}') THEN
    ${ddl}
  END IF;
END $$;`;
}

/** Postgres accepts NOT VALID for CHECK and FOREIGN KEY, not for UNIQUE. */
const NOT_VALID_KINDS = new Set(["CHECK", "FOREIGN KEY"]);

function constraintStatement(table, constraint) {
  const ddl = `ALTER TABLE "${table}" ADD CONSTRAINT "${constraint.name}" ${constraint.kind} ${constraint.definition};`;
  const statement = { kind: "add_constraint", table, name: constraint.name, sql: guardConstraint(table, constraint.name, ddl) };
  if (NOT_VALID_KINDS.has(constraint.kind)) {
    statement.notValidSql = guardConstraint(table, constraint.name, ddl.replace(/;$/, " NOT VALID;"));
  }
  return statement;
}

function planConstraint(statements, manual, live, table, constraint) {
  const existing = live.constraints.get(table) ?? [];
  if (existing.some((c) => c.name === constraint.name)) return;
  if (live.indexes.has(constraint.name)) return; // a same-named index already enforces it (0005/0007 style)

  const wanted = normaliseConstraint(constraint.kind, constraint.definition);
  const equivalent = existing.find((c) => {
    if (c.kind !== constraint.kind) return false;
    if (constraint.kind === "CHECK") return checkColumns(c.definition) === checkColumns(constraint.definition);
    return normaliseConstraint(c.kind, c.definition) === wanted;
  });
  if (equivalent) return; // same rule, different name (0012's `_idempotency_unique` vs drizzle's `_idempotency_key_unique`)

  statements.push(constraintStatement(table, constraint));
}

// ─── Live catalog ────────────────────────────────────────────────────────────

export async function introspect(client) {
  const tables = new Map();
  const { rows: columns } = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`,
  );
  const { rows: tableRows } = await client.query(
    `SELECT c.relname AS table_name, c.reltuples::bigint AS estimate
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
  );
  for (const row of tableRows) {
    tables.set(row.table_name, { columns: new Set(), constraintNames: new Set(), rowCount: null });
  }
  for (const row of columns) tables.get(row.table_name)?.columns.add(row.column_name);

  const { rows: constraintRows } = await client.query(
    `SELECT conrelid::regclass::text AS table_name, conname AS name, contype, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint WHERE connamespace = 'public'::regnamespace`,
  );
  const kinds = { f: "FOREIGN KEY", u: "UNIQUE", c: "CHECK", p: "PRIMARY KEY", x: "EXCLUDE" };
  const constraints = new Map();
  for (const row of constraintRows) {
    const table = row.table_name.replace(/^"|"$/g, "").replace(/^public\./, "");
    const kind = kinds[row.contype] ?? row.contype;
    const definition = row.definition.replace(/^(FOREIGN KEY|UNIQUE|CHECK|PRIMARY KEY)\s*/, "");
    if (!constraints.has(table)) constraints.set(table, []);
    constraints.get(table).push({ name: row.name, kind, definition });
    tables.get(table)?.constraintNames.add(row.name);
  }

  const { rows: indexRows } = await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`);
  const indexes = new Set(indexRows.map((r) => r.indexname));

  return { tables, indexes, constraints };
}

/** Exact row count, only for tables where a NOT NULL add is in question. */
async function fillRowCounts(client, live, desired) {
  for (const [table, def] of desired.tables) {
    const current = live.tables.get(table);
    if (!current) continue;
    const risky = [...def.columns].some(([column, columnDef]) => !current.columns.has(column) && needsBackfill(columnDef));
    if (!risky) continue;
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${table}"`);
    current.rowCount = rows[0].n;
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────────

/** Statement kinds the application cannot run without. Anything else is integrity/performance. */
const STRUCTURAL_KINDS = new Set(["create_table", "add_column"]);
/** SQLSTATEs meaning "existing rows violate the constraint you are adding". */
const INTEGRITY_VIOLATION = new Set(["23503", "23505", "23514"]);
const LOCK_NOT_AVAILABLE = "55P03";
const LOCK_RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function inTransaction(client, sql) {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

/**
 * Run `fn`, retrying when Postgres cancels it for a lock timeout (55P03): a
 * long transaction, or an ALTER queued behind one, blocks even the catalog
 * reads. Anything else propagates unchanged.
 */
async function withLockRetry(label, fn, { log = console, retryDelayMs = 2000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.code !== LOCK_NOT_AVAILABLE || attempt >= LOCK_RETRIES) throw err;
      log.warn(`sync-schema: ${label} is waiting on a lock — retrying (${attempt + 1}/${LOCK_RETRIES})`);
      await sleep(retryDelayMs * (attempt + 1));
    }
  }
}

/**
 * Apply a plan, one statement per transaction.
 *
 * Returns `{ applied, failures, warnings, notValid }`:
 *   - `failures`  structural statements that could not be applied — fatal;
 *   - `warnings`  constraint/index statements that could not be applied — reported, not fatal;
 *   - `notValid`  CHECK/FK constraints added NOT VALID because existing rows violate them.
 */
export async function applyPlan(client, statements, { dryRun = false, log = console, retryDelayMs = 2000 } = {}) {
  let applied = 0;
  const failures = [];
  const warnings = [];
  const notValid = [];

  for (const statement of statements) {
    const label = `${statement.kind} ${statement.table}${statement.name !== statement.table ? `.${statement.name}` : ""}`;
    if (dryRun) {
      log.log(`sync-schema: would apply ${label}`);
      continue;
    }

    let error = null;
    try {
      await withLockRetry(label, () => inTransaction(client, statement.sql), { log, retryDelayMs });
    } catch (err) {
      error = err;
    }

    if (!error) {
      applied++;
      log.log(`sync-schema: applied ${label}`);
      continue;
    }

    // Legacy rows violate a CHECK/FK the schema now declares: enforce it for
    // every new write today, leave the old rows for a reviewed cleanup.
    if (statement.notValidSql && INTEGRITY_VIOLATION.has(error.code)) {
      try {
        await withLockRetry(label, () => inTransaction(client, statement.notValidSql), { log, retryDelayMs });
        applied++;
        notValid.push({ label, table: statement.table, name: statement.name, message: error.message });
        log.warn(`sync-schema: WARN    ${label} added NOT VALID — existing rows violate it (${error.message}). New writes are checked; clean up the rows, then run: ALTER TABLE "${statement.table}" VALIDATE CONSTRAINT "${statement.name}";`);
        continue;
      } catch (err) {
        error = err;
      }
    }

    const entry = { label, kind: statement.kind, code: error.code, message: error.message };
    if (STRUCTURAL_KINDS.has(statement.kind)) {
      failures.push(entry);
      log.error(`sync-schema: FAILED  ${label}: ${error.code ?? ""} ${error.message}`);
    } else {
      warnings.push(entry);
      log.warn(`sync-schema: WARN    ${label} not applied: ${error.code ?? ""} ${error.message}${INTEGRITY_VIOLATION.has(error.code) ? " — existing rows violate it; the application runs without this constraint, but the data should be cleaned up." : ""}`);
    }
  }

  return { applied, failures, warnings, notValid };
}

export async function syncSchema({ connectionString, dryRun = false, strict = false, check = false, log = console, retryDelayMs = 2000 } = {}) {
  // `--check` is a dry run that also demands a clean bill: nothing to apply,
  // nothing manual. CI runs it right after the schema has been applied to prove
  // the sync tool and the schema agree (and that the tool is idempotent).
  if (check) { dryRun = true; strict = true; }

  const { exportRawSchemaSql } = await import("./export-schema.mjs");
  const desired = parseSchemaSql(exportRawSchemaSql());

  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 20_000 });
  await client.connect();
  try {
    // Fail fast behind a long transaction rather than hanging the build; give
    // a genuinely large index build room to finish.
    await client.query("SET lock_timeout = '15s'");
    await client.query("SET statement_timeout = '10min'");

    const live = await withLockRetry("reading the catalog", async () => {
      const snapshot = await introspect(client);
      await fillRowCounts(client, snapshot, desired);
      return snapshot;
    }, { log, retryDelayMs });
    const { statements, manual } = planSync(desired, live);

    log.log(`sync-schema: ${live.tables.size} tables in database, ${desired.tables.size} in schema; ${statements.length} additive change(s) to apply, ${manual.length} need review.`);
    for (const item of manual) log.warn(`sync-schema: MANUAL  ${item}`);

    const { applied, failures, warnings, notValid } = await applyPlan(client, statements, { dryRun, log, retryDelayMs });

    let ok = failures.length === 0 && (!strict || manual.length === 0);
    if (check && statements.length > 0) {
      ok = false;
      log.error(`sync-schema: CHECK FAILED — the database is ${statements.length} additive change(s) behind lib/db/src/schema.`);
    }
    if (!dryRun) {
      log.log(`sync-schema: done — ${applied} applied (${notValid.length} NOT VALID), ${failures.length} failed, ${warnings.length} warning(s), ${manual.length} left for review.`);
      if (failures.length) log.error("sync-schema: a table or column the application needs could not be created — refusing to call the schema in sync.");
    } else if (check && ok) {
      log.log("sync-schema: check passed — the database already matches the schema.");
    }
    return { ok, applied, failures, warnings, notValid, manual, planned: statements.length };
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const connectionString = process.env.VERCEL
    ? (process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL)
    : (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_URL_NON_POOLING);
  if (!connectionString) {
    console.error("sync-schema: DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING must be set");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  const strict = process.argv.includes("--strict");
  const check = process.argv.includes("--check");
  try {
    const result = await syncSchema({ connectionString, dryRun, strict, check });
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    console.error("sync-schema: FATAL —", err.message);
    if (err.code === "55P03") console.error("sync-schema: a long-running transaction is holding a table lock; the schema could not even be read. Let it finish (or end it), then run the deploy again.");
    process.exit(1);
  }
}
