/**
 * Database health and migration status endpoints.
 *
 * GET /api/healthz/migrations — returns the current migration state.
 * GET /api/healthz/tables — returns a summary of database tables (schema metadata only).
 *
 * These endpoints are used by:
 * - Monitoring systems (Datadog, Grafana, etc.)
 * - CI/CD pipelines (post-deployment verification)
 * - The Developer page (schema explorer)
 *
 * Security: these endpoints never expose data, credentials, or connection strings.
 * Only metadata (table names, column names, row counts) is returned.
 */

import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Migration status — checks if the _migration_lock table exists and its state.
 */
router.get("/healthz/migrations", async (_req, res) => {
  try {
    // Check if migration lock table exists
    const { rows: lockTable } = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_migration_lock')"
    );
    const hasLockTable = lockTable[0]?.exists ?? false;

    let lockStatus = "no_lock_table";
    let lockedBy: string | null = null;
    let lockedAt: string | null = null;

    if (hasLockTable) {
      const { rows: lock } = await pool.query("SELECT locked_at, locked_by FROM _migration_lock LIMIT 1");
      if (lock.length > 0) {
        lockedAt = lock[0].locked_at?.toISOString() ?? null;
        lockedBy = lock[0].locked_by ?? null;
        lockStatus = lockedAt ? "locked" : "unlocked";
      }
    }

    // Count migration files (from the drizzle folder)
    res.set("Cache-Control", "no-store");
    res.json({
      status: "ok",
      lockStatus,
      lockedBy,
      lockedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "migration status check failed");
    res.status(503).json({
      status: "error",
      message: "Unable to check migration status",
    });
  }
});

/**
 * Database tables summary — safe metadata only.
 * Used by the Developer page schema explorer.
 * Requires authentication to prevent unauthenticated schema reconnaissance.
 */
router.get("/healthz/tables", async (req, res) => {
  // Auth gate: schema metadata is not secret, but we don't want
  // unauthenticated crawlers enumerating our database structure.
  const { extractUserId } = await import("./auth");
  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    return;
  }
  try {
    const { rows: tables } = await pool.query(`
      SELECT
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count,
        (SELECT COUNT(*) FROM information_schema.table_constraints tc WHERE tc.table_name = t.table_name AND tc.constraint_type = 'PRIMARY KEY') as has_pk,
        (SELECT COUNT(*) FROM information_schema.key_column_usage kcu JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name WHERE kcu.table_name = t.table_name AND tc.constraint_type = 'FOREIGN KEY') as fk_count,
        (SELECT COUNT(*) FROM pg_indexes i WHERE i.tablename = t.table_name) as index_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);

    res.set("Cache-Control", "no-store");
    res.json({
      status: "ok",
      tableCount: tables.length,
      tables: tables.map((t) => ({
        name: t.table_name,
        columnCount: Number(t.column_count),
        hasPrimaryKey: Number(t.has_pk) > 0,
        foreignKeyCount: Number(t.fk_count),
        indexCount: Number(t.index_count),
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "table summary failed");
    res.status(503).json({
      status: "error",
      message: "Unable to retrieve table summary",
    });
  }
});

/**
 * Table columns detail view — for the Developer page schema explorer.
 * Returns column metadata without exposing any data.
 * Requires authentication to prevent unauthenticated schema reconnaissance.
 */
router.get("/healthz/tables/:tableName", async (req, res) => {
  // Auth gate: schema details are metadata-only but we don't want
  // unauthenticated visitors enumerating our table structure.
  const { extractUserId } = await import("./auth");
  const userId = extractUserId(req);
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } });
    return;
  }

  const tableName = req.params.tableName;

  // Validate table name to prevent SQL injection
  if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) {
    res.status(400).json({ error: { code: "INVALID_TABLE_NAME", message: "Invalid table name" } });
    return;
  }

  try {
    // Verify table exists
    const { rows: exists } = await pool.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public')",
      [tableName]
    );
    if (!exists[0]?.exists) {
      res.status(404).json({ error: { code: "TABLE_NOT_FOUND", message: `Table ${tableName} not found` } });
      return;
    }

    const { rows: columns } = await pool.query(`
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        (SELECT COUNT(*) > 0 FROM information_schema.key_column_usage kcu
         JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
         WHERE kcu.table_name = c.table_name AND kcu.column_name = c.column_name
         AND tc.constraint_type = 'PRIMARY KEY') as is_pk,
        (SELECT COUNT(*) > 0 FROM information_schema.key_column_usage kcu
         JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
         WHERE kcu.table_name = c.table_name AND kcu.column_name = c.column_name
         AND tc.constraint_type = 'FOREIGN KEY') as is_fk
      FROM information_schema.columns c
      WHERE c.table_name = $1 AND c.table_schema = 'public'
      ORDER BY c.ordinal_position
    `, [tableName]);

    const { rows: indexes } = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = $1
      ORDER BY indexname
    `, [tableName]);

    res.set("Cache-Control", "no-store");
    res.json({
      tableName,
      columns: columns.map((c) => ({
        name: c.column_name,
        dataType: c.data_type,
        nullable: c.is_nullable === "YES",
        defaultValue: c.column_default,
        maxLength: c.character_maximum_length,
        isPrimaryKey: c.is_pk,
        isForeignKey: c.is_fk,
      })),
      indexes: indexes.map((i) => ({
        name: i.indexname,
        definition: i.indexdef,
      })),
    });
  } catch (err) {
    logger.error({ err, tableName }, "table detail failed");
    res.status(503).json({
      status: "error",
      message: "Unable to retrieve table details",
    });
  }
});

export { router as dbHealthRouter };
