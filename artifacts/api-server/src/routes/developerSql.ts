/**
 * Developer SQL Editor & Database Intelligence API
 *
 * Provides comprehensive database management inside Developer Mode:
 * - Schema introspection (tables, columns, indexes, FKs, constraints)
 * - SQL execution with permission levels (READ/WRITE/SCHEMA/DESTRUCTIVE)
 * - Database health monitoring
 * - Migration management
 * - Schema diff (DB vs application)
 * - Query history
 * - Export functionality
 *
 * All endpoints require admin auth via the developer route middleware.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import * as workspaceDb from "@workspace/db";
import { db, pool, adminSqlLogTable } from "@workspace/db";
import { desc, count, getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { logger } from "../lib/logger";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { requireAdmin } from "../lib/adminAuth";
import { splitStatements, classifyStatement } from "./adminSql";

const router = Router();

// All routes require admin auth
router.use("/developer/db", authMiddleware, requireAdmin);

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MAX_RETURN_ROWS = 500;
const STATEMENT_TIMEOUT_MS = 15_000;
const EXPORT_MAX_ROWS = 10_000;

/**
 * The application's tables and columns, read from the Drizzle schema itself.
 *
 * This used to be a hand-maintained list of table names. It had drifted to 96
 * entries against 111 tables in `lib/db/src/schema`, and it knew nothing about
 * columns — so the "schema diff" panel reported IN SYNC while production was
 * missing `users.deletion_requested_at`, the column that broke sign-in. The
 * schema is the only authoritative list; derive from it.
 */
type ExpectedTable = { name: string; columns: string[] };

function expectedSchema(): ExpectedTable[] {
  // The module namespace mixes tables with `db`, `pool` and helpers; `is()`
  // picks out the PgTable instances at runtime.
  const tables = (Object.values(workspaceDb) as unknown[]).filter((value): value is PgTable => is(value, PgTable));
  return tables
    .map((table) => ({
      name: getTableName(table),
      columns: Object.values(getTableColumns(table)).map((column) => column.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── DATABASE HEALTH ──────────────────────────────────────────────────────────

router.get("/developer/db/health", async (_req: AuthRequest, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Basic connectivity
    await pool.query("SELECT 1");
    const latencyMs = Date.now() - startTime;

    // PostgreSQL version
    const { rows: versionRows } = await pool.query("SELECT version()");
    const pgVersion = versionRows[0]?.version || "unknown";

    // Database size
    const { rows: sizeRows } = await pool.query(
      "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
    );
    const dbSize = sizeRows[0]?.size || "unknown";

    // Table count
    const { rows: tableCountRows } = await pool.query(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    const tableCount = Number(tableCountRows[0]?.count || 0);

    // Index count
    const { rows: indexCountRows } = await pool.query(
      "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'"
    );
    const indexCount = Number(indexCountRows[0]?.count || 0);

    // Connection info (safe - no credentials)
    const { rows: connRows } = await pool.query(
      "SELECT current_database(), current_user, inet_server_addr()::text as server_ip, inet_server_port() as server_port"
    );
    const connInfo = connRows[0] || {};

    res.json({
      connected: true,
      latencyMs,
      pgVersion: pgVersion.split(" ")[1] || pgVersion,
      dbSize,
      tableCount,
      indexCount,
      database: connInfo.current_database,
      user: connInfo.current_user,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "db health check error");
    res.json({
      connected: false,
      error: "Database connection failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── SCHEMA INTROSPECTION ─────────────────────────────────────────────────────

router.get("/developer/db/schema", async (_req: AuthRequest, res: Response) => {
  try {
    // Get all tables with row counts
    const { rows: tables } = await pool.query(`
      SELECT 
        t.table_name,
        COALESCE(s.n_live_tup, 0) as approximate_row_count,
        (SELECT count(*) FROM information_schema.columns c 
         WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);

    // Get all foreign keys
    const { rows: foreignKeys } = await pool.query(`
      SELECT
        tc.table_name as from_table,
        kcu.column_name as from_column,
        ccu.table_name as to_table,
        ccu.column_name as to_column,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name
    `);

    // Get all indexes
    const { rows: indexes } = await pool.query(`
      SELECT 
        tablename as table_name,
        indexname,
        indexdef as definition
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    // Get all constraints
    const { rows: constraints } = await pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
      GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
      ORDER BY tc.table_name, tc.constraint_type
    `);

    res.json({
      tables: tables.map((t) => ({
        name: t.table_name,
        rowCount: Number(t.approximate_row_count),
        columnCount: Number(t.column_count),
      })),
      foreignKeys: foreignKeys.map((fk) => ({
        fromTable: fk.from_table,
        fromColumn: fk.from_column,
        toTable: fk.to_table,
        toColumn: fk.to_column,
        constraintName: fk.constraint_name,
      })),
      indexes: indexes.map((idx) => ({
        tableName: idx.table_name,
        name: idx.indexname,
        definition: idx.definition,
      })),
      constraints: constraints.map((c) => ({
        tableName: c.table_name,
        name: c.constraint_name,
        type: c.constraint_type,
        columns: c.columns,
      })),
    });
  } catch (err) {
    logger.error({ err }, "schema introspection error");
    res.status(500).json({ error: "Failed to introspect schema" });
  }
});

// ─── TABLE DETAIL ─────────────────────────────────────────────────────────────

router.get("/developer/db/schema/:tableName", async (req: AuthRequest, res: Response) => {
  const tableName = String(req.params.tableName);
  
  // Validate table name
  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
    res.status(400).json({ error: "Invalid table name" });
    return;
  }

  try {
    // Check table exists
    const { rows: existsRows } = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public')",
      [tableName]
    );
    if (!existsRows[0]?.exists) {
      res.status(404).json({ error: "Table not found" });
      return;
    }

    // Get columns with full detail
    const { rows: columns } = await pool.query(`
      SELECT 
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable = 'YES' as nullable,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.ordinal_position,
        EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = c.table_name AND kcu.column_name = c.column_name
          AND tc.constraint_type = 'PRIMARY KEY'
        ) as is_primary_key,
        EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = c.table_name AND kcu.column_name = c.column_name
          AND tc.constraint_type = 'FOREIGN KEY'
        ) as is_foreign_key
      FROM information_schema.columns c
      WHERE c.table_name = $1 AND c.table_schema = 'public'
      ORDER BY c.ordinal_position
    `, [tableName]);

    // Get indexes for this table
    const { rows: indexes } = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = $1 AND schemaname = 'public'
      ORDER BY indexname
    `, [tableName]);

    // Get foreign key details
    const { rows: fks } = await pool.query(`
      SELECT
        kcu.column_name as column_name,
        ccu.table_name as referenced_table,
        ccu.column_name as referenced_column,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = $1 AND tc.table_schema = 'public'
    `, [tableName]);

    // Get constraints
    const { rows: constraints } = await pool.query(`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = $1 AND tc.table_schema = 'public'
      GROUP BY tc.constraint_name, tc.constraint_type
    `, [tableName]);

    // Get approximate row count
    const { rows: countRows } = await pool.query(
      "SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = $1",
      [tableName]
    );

    res.json({
      tableName,
      rowCount: Number(countRows[0]?.n_live_tup || 0),
      columns: columns.map((c) => ({
        name: c.column_name,
        type: c.udt_name || c.data_type,
        fullType: c.data_type,
        nullable: c.nullable,
        defaultValue: c.column_default,
        maxLength: c.character_maximum_length,
        numericPrecision: c.numeric_precision,
        isPrimaryKey: c.is_primary_key,
        isForeignKey: c.is_foreign_key,
        position: c.ordinal_position,
      })),
      indexes: indexes.map((i) => ({
        name: i.indexname,
        definition: i.indexdef,
      })),
      foreignKeys: fks.map((fk) => ({
        column: fk.column_name,
        referencedTable: fk.referenced_table,
        referencedColumn: fk.referenced_column,
        onUpdate: fk.update_rule,
        onDelete: fk.delete_rule,
      })),
      constraints: constraints.map((c) => ({
        name: c.constraint_name,
        type: c.constraint_type,
        columns: c.columns,
      })),
    });
  } catch (err) {
    logger.error({ err, tableName }, "table detail error");
    res.status(500).json({ error: "Failed to get table details" });
  }
});

// ─── SQL EXECUTION ────────────────────────────────────────────────────────────

const executeSchema = z.object({
  query: z.string().min(1).max(100_000),
  destructiveConfirmed: z.boolean().optional(),
  limit: z.number().int().min(1).max(MAX_RETURN_ROWS).optional(),
});

function cellToString(v: unknown): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

router.post("/developer/db/execute", async (req: AuthRequest, res: Response) => {
  const parsed = executeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request: " + parsed.error.issues[0]?.message });
    return;
  }

  const { query, destructiveConfirmed, limit = 200 } = parsed.data;
  const adminId = req.userId;

  const statements = splitStatements(query);
  if (statements.length === 0) {
    res.status(400).json({ error: "No SQL statements found" });
    return;
  }
  if (statements.length > 10) {
    res.status(400).json({ error: "Maximum 10 statements per execution" });
    return;
  }

  // Classify each statement
  const classified = statements.map((stmt) => ({
    statement: stmt,
    ...classifyStatement(stmt),
  }));

  const hasWrite = classified.some((c) => c.isWrite);
  const hasDestructive = classified.some((c) => c.isDestructive);

  // Check if write mode is unlocked (reuse adminSql unlock mechanism)
  if (hasWrite) {
    const { isWriteUnlocked } = await import("./adminSql");
    const unlockState = await isWriteUnlocked(adminId);
    if (!unlockState.unlocked) {
      await db.insert(adminSqlLogTable).values({
        adminId,
        sql: query.slice(0, 4000),
        kind: "write",
        status: "blocked",
        error: "write mode not unlocked",
      });
      res.status(403).json({ 
        error: "Write mode is locked. Unlock it from the SQL Console tab first.",
        locked: true,
      });
      return;
    }
  }

  // Destructive confirmation required
  if (hasDestructive && !destructiveConfirmed) {
    res.status(409).json({
      error: "Destructive statement detected. Confirm to proceed.",
      destructive: classified.filter((c) => c.isDestructive).map((c) => c.statement.slice(0, 200)),
      requiresConfirmation: true,
    });
    return;
  }

  // Execute statements
  const results: Array<{
    statement: string;
    kind: "read" | "write";
    destructive: boolean;
    ok: boolean;
    columns: string[];
    rows: unknown[][];
    rowCount: number;
    truncated: boolean;
    durationMs: number;
    error?: string;
  }> = [];

  for (const c of classified) {
    const startTime = Date.now();
    const client = await pool.connect();
    
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
      
      const result = await client.query(c.statement);
      await client.query("COMMIT");

      const columns = (result.fields ?? []).map((f) => f.name);
      const maxRows = Math.min(limit, MAX_RETURN_ROWS);
      const rowsRaw: unknown[][] = Array.isArray(result.rows)
        ? result.rows.slice(0, maxRows).map((r: Record<string, unknown>) =>
            columns.length ? columns.map((col) => cellToString(r[col])) : Object.values(r).map(cellToString)
          )
        : [];

      results.push({
        statement: c.statement.slice(0, 4000),
        kind: c.isWrite ? "write" : "read",
        destructive: c.isDestructive,
        ok: true,
        columns,
        rows: rowsRaw,
        rowCount: typeof result.rowCount === "number" ? result.rowCount : rowsRaw.length,
        truncated: Array.isArray(result.rows) && result.rows.length > maxRows,
        durationMs: Date.now() - startTime,
      });

      // Log to audit
      await db.insert(adminSqlLogTable).values({
        adminId,
        sql: c.statement.slice(0, 4000),
        kind: c.isWrite ? "write" : "read",
        status: "ok",
        rowsAffected: typeof result.rowCount === "number" ? result.rowCount : 0,
      });
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch {}
      
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout = message.includes("statement timeout") || message.includes("cancel");
      
      results.push({
        statement: c.statement.slice(0, 4000),
        kind: c.isWrite ? "write" : "read",
        destructive: c.isDestructive,
        ok: false,
        columns: [],
        rows: [],
        rowCount: 0,
        truncated: false,
        durationMs: Date.now() - startTime,
        error: isTimeout ? "QUERY TIMEOUT: Statement exceeded time limit" : message.slice(0, 500),
      });

      await db.insert(adminSqlLogTable).values({
        adminId,
        sql: c.statement.slice(0, 4000),
        kind: c.isWrite ? "write" : "read",
        status: "error",
        error: message.slice(0, 1000),
      }).catch(() => {}); // Don't fail on log failure

      break; // Stop on first error
    } finally {
      client.release();
    }
  }

  res.json({
    statements: results,
    anyError: results.some((r) => !r.ok),
    mode: hasWrite ? "write" : "read",
    totalMs: results.reduce((n, r) => n + r.durationMs, 0),
    statementCount: results.length,
  });
});

// ─── QUERY HISTORY ────────────────────────────────────────────────────────────

router.get("/developer/db/history", async (req: AuthRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const entries = await db
      .select({
        id: adminSqlLogTable.id,
        adminId: adminSqlLogTable.adminId,
        sql: adminSqlLogTable.sql,
        kind: adminSqlLogTable.kind,
        rowsAffected: adminSqlLogTable.rowsAffected,
        status: adminSqlLogTable.status,
        error: adminSqlLogTable.error,
        createdAt: adminSqlLogTable.createdAt,
      })
      .from(adminSqlLogTable)
      .orderBy(desc(adminSqlLogTable.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(adminSqlLogTable);

    res.json({
      entries: entries.map((e) => ({
        id: e.id,
        adminId: e.adminId,
        sql: e.sql,
        kind: e.kind,
        rowsAffected: e.rowsAffected,
        status: e.status,
        error: e.error,
        createdAt: e.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    });
  } catch (err) {
    logger.error({ err }, "query history error");
    res.status(500).json({ error: "Failed to load history" });
  }
});

// ─── MIGRATIONS ───────────────────────────────────────────────────────────────

router.get("/developer/db/migrations", async (_req: AuthRequest, res: Response) => {
  try {
    // Read migration journal from disk
    const fs = await import("fs");
    const path = await import("path");
    
    // The API runs from artifacts/api-server in development and from the repo
    // root in other layouts; look in both. (The serverless bundle ships neither,
    // so on Vercel the journal is simply absent — reported below as such.)
    const journalCandidates = [
      path.join(process.cwd(), "..", "lib", "db", "drizzle", "meta", "_journal.json"),
      path.join(process.cwd(), "lib", "db", "drizzle", "meta", "_journal.json"),
    ];
    let migrations: Array<{ idx: number; tag: string; when: number }> = [];
    let journalFound = false;
    for (const journalPath of journalCandidates) {
      try {
        const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
        migrations = journal.entries || [];
        journalFound = true;
        break;
      } catch {
        // try the next location
      }
    }

    // Applied migrations, if the drizzle migrator has ever run here. The
    // migrator records them in `drizzle.__drizzle_migrations` (its default
    // schema), not in `public` — the old query looked in the wrong place and
    // always reported zero. Note that production is kept in sync by the
    // additive `sync-schema` tool rather than the journal, so an empty table
    // here is expected and is not drift; the schema diff below is the signal.
    let appliedMigrations: Array<{ hash: string; createdAt: number }> = [];
    let journalTracked = false;
    try {
      const { rows } = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = '__drizzle_migrations' AND table_schema IN ('drizzle', 'public')
        ) AS exists
      `);
      if (rows[0]?.exists) {
        journalTracked = true;
        const { rows: applied } = await pool.query(`
          SELECT hash, created_at FROM (
            SELECT hash, created_at FROM drizzle.__drizzle_migrations
          ) AS m ORDER BY created_at
        `).catch(() => pool.query("SELECT hash, created_at FROM public.__drizzle_migrations ORDER BY created_at"));
        appliedMigrations = applied.map((r) => ({ hash: String(r.hash), createdAt: Number(r.created_at) }));
      }
    } catch {
      // No migrator table anywhere: the database was provisioned by push/sync.
    }

    // drizzle's migrator marks a migration applied when its folderMillis is at
    // or before the newest recorded `created_at`, so compare on the timestamp.
    const newestApplied = appliedMigrations.reduce((max, m) => Math.max(max, m.createdAt), 0);
    const list = migrations.map((m) => ({
      index: m.idx,
      name: m.tag,
      timestamp: new Date(m.when).toISOString(),
      applied: journalTracked && m.when <= newestApplied,
    }));
    const appliedCount = list.filter((m) => m.applied).length;

    res.json({
      migrations: list,
      total: migrations.length,
      appliedCount,
      pendingCount: journalTracked ? Math.max(0, migrations.length - appliedCount) : 0,
      journalTracked,
      note: journalTracked
        ? null
        : `This database is kept in sync by lib/db/scripts/sync-schema.mjs (additive schema sync), not by the migration journal${journalFound ? "" : " (journal file not available in this deployment)"}. Use the schema diff below to check for drift.`,
    });
  } catch (err) {
    logger.error({ err }, "migrations list error");
    res.status(500).json({ error: "Failed to list migrations" });
  }
});

// ─── SCHEMA DIFF ──────────────────────────────────────────────────────────────

router.get("/developer/db/diff", async (_req: AuthRequest, res: Response) => {
  try {
    const expected = expectedSchema();
    const expectedByName = new Map(expected.map((t) => [t.name, t]));

    // Every column of every public table in one round trip.
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(`
      SELECT t.table_name, c.column_name
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c
        ON c.table_schema = t.table_schema AND c.table_name = t.table_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name, c.ordinal_position
    `);
    const actual = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
      if (row.column_name) actual.get(row.table_name)!.add(row.column_name);
    }

    const missingInDb = expected.filter((t) => !actual.has(t.name)).map((t) => t.name);
    const extraInDb = [...actual.keys()].filter((name) => !expectedByName.has(name)).sort();

    // Column-level drift for tables present on both sides. Missing columns are
    // exactly what took sign-in down; extra columns are harmless leftovers but
    // worth knowing about.
    const columnDiffs: Array<{ table: string; missingColumns: string[]; extraColumns: string[] }> = [];
    for (const table of expected) {
      const live = actual.get(table.name);
      if (!live) continue;
      const missingColumns = table.columns.filter((c) => !live.has(c));
      const extraColumns = [...live].filter((c) => !table.columns.includes(c)).sort();
      if (missingColumns.length || extraColumns.length) {
        columnDiffs.push({ table: table.name, missingColumns, extraColumns });
      }
    }

    const tablesWithMissingColumns = columnDiffs.filter((d) => d.missingColumns.length > 0).length;
    const inSync = expected.length - missingInDb.length - tablesWithMissingColumns;
    // Extra tables/columns never break the application; missing ones do.
    const hasDrift = missingInDb.length > 0 || tablesWithMissingColumns > 0;

    res.json({
      hasDrift,
      summary: {
        expectedTables: expected.length,
        actualTables: actual.size,
        inSync,
        missingInDb: missingInDb.length,
        extraInDb: extraInDb.length,
        tablesWithMissingColumns,
      },
      missingInDb,
      extraInDb,
      columnDiffs,
      recommendation: hasDrift
        ? "The database is behind lib/db/src/schema. Run `pnpm --filter @workspace/db run sync` (additive, safe on production) — it is also run automatically by every production deploy."
        : extraInDb.length > 0 || columnDiffs.length > 0
          ? "Every table and column the application needs is present. The extras listed are not used by the application and can be left alone."
          : "Database schema is in sync with the application.",
    });
  } catch (err) {
    logger.error({ err }, "schema diff error");
    res.status(500).json({ error: "Failed to compute schema diff" });
  }
});

// ─── EXPORT ───────────────────────────────────────────────────────────────────

const exportSchema = z.object({
  table: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  format: z.enum(["json", "csv"]).default("json"),
  limit: z.number().int().min(1).max(EXPORT_MAX_ROWS).default(1000),
  columns: z.array(z.string().regex(/^[a-z_][a-z0-9_]*$/)).optional(),
});

router.post("/developer/db/export", async (req: AuthRequest, res: Response) => {
  const parsed = exportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid export request" });
    return;
  }

  const { table, format, limit, columns } = parsed.data;

  try {
    // Verify table exists
    const { rows: exists } = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)",
      [table]
    );
    if (!exists[0]?.exists) {
      res.status(404).json({ error: "Table not found" });
      return;
    }

    const selectCols = columns?.length ? columns.map((c) => `"${c}"`).join(", ") : "*";
    const { rows } = await pool.query(`SELECT ${selectCols} FROM "${table}" LIMIT ${limit}`);

    if (format === "csv") {
      if (rows.length === 0) {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${table}.csv"`);
        res.send("");
        return;
      }

      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(","),
        ...rows.map((row) =>
          headers.map((h) => {
            const val = row[h];
            if (val === null) return "";
            if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
            return String(val);
          }).join(",")
        ),
      ];

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${table}.csv"`);
      res.send(csvLines.join("\n"));
    } else {
      res.json({
        table,
        rowCount: rows.length,
        exportedAt: new Date().toISOString(),
        data: rows,
      });
    }
  } catch (err) {
    logger.error({ err, table }, "export error");
    res.status(500).json({ error: "Export failed" });
  }
});

// ─── TABLE SAMPLE ─────────────────────────────────────────────────────────────

router.get("/developer/db/tables/:tableName/sample", async (req: AuthRequest, res: Response) => {
  const tableName = String(req.params.tableName);
  const limit = Math.min(Number(req.query.limit) || 10, 100);

  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
    res.status(400).json({ error: "Invalid table name" });
    return;
  }

  try {
    const { rows: exists } = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)",
      [tableName]
    );
    if (!exists[0]?.exists) {
      res.status(404).json({ error: "Table not found" });
      return;
    }

    const { rows } = await pool.query(`SELECT * FROM "${tableName}" LIMIT ${limit}`);
    res.json({
      table: tableName,
      rowCount: rows.length,
      data: rows,
    });
  } catch (err) {
    logger.error({ err, tableName }, "sample error");
    res.status(500).json({ error: "Failed to get sample data" });
  }
});

export { router as developerSqlRouter };
