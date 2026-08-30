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
import { db, pool, adminSqlLogTable } from "@workspace/db";
import { desc, eq, sql, count } from "drizzle-orm";
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

// Known Drizzle schema tables (application authoritative list)
const APPLICATION_TABLES = [
  "users", "password_reset_tokens", "refresh_tokens",
  "focus_sessions", "active_sessions", "session_ghosts",
  "study_streaks", "freeze_tokens",
  "tasks", "goals", "habits", "habit_completions",
  "user_wallets", "user_badges", "coin_transactions", "login_rewards",
  "missions", "user_mission_progress", "battle_pass_progress",
  "friendships", "follows", "buddy_requests",
  "social_posts", "post_reactions", "post_comments", "post_saves",
  "user_emotes",
  "study_groups", "group_members",
  "study_rooms", "study_room_members",
  "conversations", "conversation_participants", "messages", "message_reactions",
  "productivity_logs", "readiness_logs", "distraction_logs",
  "focus_profiles", "focus_dna",
  "break_free_streaks", "break_free_moods", "break_free_pledges",
  "consequence_contracts",
  "roadmaps", "user_dreams",
  "notifications", "push_subscriptions", "email_logs",
  "focus_cities", "city_building_definitions",
  "user_pets", "marketplace_items", "user_inventory",
  "loot_box_types", "user_loot_boxes",
  "quest_definitions", "user_quest_progress",
  "seasonal_events", "user_seasonal_progress",
  "flashcard_decks", "flashcards",
  "token_ledger", "premium_subscriptions", "premium_plans", "premium_entitlements",
  "pet_catalog", "user_pet_inventory",
  "battle_pass_claims", "feature_flags", "cosmetic_inventory",
  "token_earning_rules", "asset_catalog",
  "user_profile_extras", "wrapped_snapshots", "app_feedback",
  "site_settings", "platform_meta",
  "visitors", "analytics_sessions", "page_views", "analytics_events",
  "bot_pending_replies", "admin_drops", "admin_drop_claims", "admin_sql_log",
  "ai_call_log", "ai_budget_state", "ai_ideas", "ai_briefings", "ai_action_audit",
  "battle_passes", "battle_pass_rewards", "user_battle_pass_progress",
  "study_buddies", "shared_goals", "leaderboard_snapshots",
  "group_invitations", "group_audit_logs", "group_challenges", "group_challenge_progress",
  "audit_logs", "posts", "post_likes", "quest_progress",
];

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
    
    const journalPath = path.join(process.cwd(), "..", "lib", "db", "drizzle", "meta", "_journal.json");
    let migrations: Array<{ idx: number; tag: string; when: number }> = [];
    
    try {
      const journalContent = fs.readFileSync(journalPath, "utf-8");
      const journal = JSON.parse(journalContent);
      migrations = journal.entries || [];
    } catch {
      // Journal not found
    }

    // Get applied migrations from database (check __drizzle_migrations table if exists)
    let appliedMigrations: string[] = [];
    try {
      const { rows } = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = '__drizzle_migrations' AND table_schema = 'public'
        ) as exists
      `);
      
      if (rows[0]?.exists) {
        const { rows: applied } = await pool.query(`
          SELECT hash FROM __drizzle_migrations ORDER BY created_at
        `);
        appliedMigrations = applied.map((r) => r.hash);
      }
    } catch {
      // Table doesn't exist
    }

    res.json({
      migrations: migrations.map((m) => ({
        index: m.idx,
        name: m.tag,
        timestamp: new Date(m.when).toISOString(),
        applied: appliedMigrations.length > 0,
      })),
      total: migrations.length,
      appliedCount: appliedMigrations.length,
      pendingCount: Math.max(0, migrations.length - appliedMigrations.length),
    });
  } catch (err) {
    logger.error({ err }, "migrations list error");
    res.status(500).json({ error: "Failed to list migrations" });
  }
});

// ─── SCHEMA DIFF ──────────────────────────────────────────────────────────────

router.get("/developer/db/diff", async (_req: AuthRequest, res: Response) => {
  try {
    // Get actual DB tables
    const { rows: dbTables } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const actualTables = new Set(dbTables.map((r) => r.table_name));
    const expectedTables = new Set(APPLICATION_TABLES);

    // Find differences
    const missingInDb = APPLICATION_TABLES.filter((t) => !actualTables.has(t));
    const extraInDb = [...actualTables].filter((t) => !expectedTables.has(t));
    const inSync = APPLICATION_TABLES.filter((t) => actualTables.has(t));

    // Check column-level diffs for tables that exist in both
    const columnDiffs: Array<{
      table: string;
      missingColumns: string[];
      extraColumns: string[];
    }> = [];

    for (const tableName of inSync.slice(0, 20)) { // Limit to avoid timeout
      try {
        const { rows: dbColumns } = await pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
        `, [tableName]);
        const actualColumns = new Set(dbColumns.map((r) => r.column_name));
        
        // We don't have a complete expected column list here, so just report table-level
        // A full column diff would require parsing the Drizzle schema at runtime
        if (actualColumns.size === 0) {
          columnDiffs.push({
            table: tableName,
            missingColumns: ["(table exists but has no columns)"],
            extraColumns: [],
          });
        }
      } catch {
        // Skip on error
      }
    }

    const hasDrift = missingInDb.length > 0 || extraInDb.length > 0 || columnDiffs.length > 0;

    res.json({
      hasDrift,
      summary: {
        expectedTables: APPLICATION_TABLES.length,
        actualTables: actualTables.size,
        inSync: inSync.length,
        missingInDb: missingInDb.length,
        extraInDb: extraInDb.length,
      },
      missingInDb,
      extraInDb,
      columnDiffs,
      recommendation: hasDrift
        ? "Run `pnpm db:push` to synchronize the database schema with the application."
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
