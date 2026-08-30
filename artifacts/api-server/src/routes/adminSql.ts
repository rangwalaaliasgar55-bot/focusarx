/**
 * Admin SQL console (Workstream F).
 *
 * Read mode: any admin can run SELECTs at any time.
 * Write mode: typed unlock phrase → 15-minute window (stored in
 *   platform_meta, serverless — no cron), every statement logged to the
 *   insert-only admin_sql_log table. Destructive statements
 *   (DROP/TRUNCATE/ALTER, or DELETE/UPDATE without WHERE) additionally
 *   require an explicit second confirmation from the client.
 *
 * Guardrails:
 *  - admin-cookie auth (same as the rest of /admin)
 *  - per-statement 8s statement_timeout, own transaction, rollback on error
 *  - max 10 statements / 20,000 chars each per run; 200 rows returned
 *  - rate limits (unlock 5/min, query 20/min per admin)
 *  - admin_sql_log is insert-only: no UPDATE/DELETE route ever targets it
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db, pool, platformMetaTable, adminSqlLogTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { checkAdminAuth } from "../lib/adminAuth";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { sendUnauthorized } from "../lib/httpErrors";

const router = Router();

const UNLOCK_PHRASE = "FOCUSARX SQL WRITE MODE";
const UNLOCK_WINDOW_MS = 15 * 60_000; // 15 minutes
/**
 * Per-admin unlock keys — an unlock window grants write access only to the
 * admin who typed the phrase, never to every admin at once (the shared
 * `sql_console_write_unlock` key let any admin — or anyone holding their
 * cookie — ride another admin's window).
 */
export function unlockMetaKey(adminId: string): string {
  return `sql_console_write_unlock:${adminId}`;
}
const MAX_STATEMENTS = 10;
const MAX_STATEMENT_CHARS = 20_000;
const MAX_RETURN_ROWS = 200;
const STATEMENT_TIMEOUT_MS = 8_000;

const unlockLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: "Too many unlock attempts — try again in a minute" } });
const queryLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Too many SQL queries — try again in a minute" } });

async function guard(req: Request, res: Response): Promise<string | null> {
  if (!(await checkAdminAuth(req))) {
    sendUnauthorized(res);
    return null;
  }
  return extractUserId(req);
}

// ── helpers ──────────────────────────────────────────────────────────────────

interface UnlockState {
  at: number; // epoch ms
  by: string; // admin id
}

async function readUnlock(adminId: string): Promise<UnlockState | null> {
  const rows = await db.select().from(platformMetaTable).where(eq(platformMetaTable.key, unlockMetaKey(adminId)));
  const row = rows[0];
  if (!row) return null;
  try {
    const v = row.value as unknown;
    const obj = (typeof v === "string" ? JSON.parse(v) : v) as UnlockState | null;
    if (!obj || typeof obj.at !== "number" || typeof obj.by !== "string") return null;
    return obj;
  } catch {
    return null;
  }
}

export async function isWriteUnlocked(adminId: string): Promise<{ unlocked: boolean; remainingMs: number; by: string | null }> {
  const state = await readUnlock(adminId);
  if (!state) return { unlocked: false, remainingMs: 0, by: null };
  const remainingMs = state.at + UNLOCK_WINDOW_MS - Date.now();
  return { unlocked: remainingMs > 0, remainingMs: Math.max(0, remainingMs), by: state.by };
}

/**
 * Split a SQL script into statements on top-level `;`.
 * Respects single/double-quoted strings, dollar-quoted bodies, `--` and
 * `/* … *\/` comments.
 */
export function splitStatements(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;
  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];
    if (inLineComment) {
      cur += ch;
      if (ch === "\n") inLineComment = false;
      i++;
      continue;
    }
    if (inBlockComment) {
      cur += ch;
      if (ch === "*" && next === "/") {
        cur += next;
        i += 2;
        inBlockComment = false;
        continue;
      }
      i++;
      continue;
    }
    if (dollarTag) {
      if (input.startsWith(dollarTag, i)) {
        cur += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (inSingle) {
      cur += ch;
      if (ch === "'" && next === "'") {
        cur += next;
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i++;
      continue;
    }
    if (inDouble) {
      cur += ch;
      if (ch === '"') inDouble = false;
      i++;
      continue;
    }
    // not inside any quoted/comment state
    if (ch === "-" && next === "-") {
      inLineComment = true;
      cur += ch;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      cur += ch + next;
      i += 2;
      continue;
    }
    if (ch === "'") inSingle = true;
    else if (ch === '"') inDouble = true;
    else if (ch === "$" && next === "$") {
      const end = input.indexOf("$$", i + 2);
      const tag = "$$";
      dollarTag = end === -1 ? null : tag;
      cur += tag;
      i += 2;
      continue;
    }
    if (ch === ";") {
      const stmt = cur.trim();
      if (stmt) out.push(stmt);
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

/** Remove string literals & comments so verb detection can't be fooled. */
function stripForDetection(stmt: string): string {
  return stmt
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:''|[^'\n])*'/g, " ''")
    .replace(/"(?:[^"]|"")*"/g, ' ""');
}

const WRITE_VERB = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|REINDEX|VACUUM|COPY|COMMENT)\b/i;
const DESTRUCTIVE_VERB = /\b(DROP|TRUNCATE|ALTER)\b/i;

export function classifyStatement(stmt: string): { isWrite: boolean; isDestructive: boolean } {
  const bare = stripForDetection(stmt);
  const isWrite = WRITE_VERB.test(bare);
  let isDestructive = DESTRUCTIVE_VERB.test(bare);
  if (!isDestructive && /\bDELETE\b/i.test(bare) && !/\bWHERE\b/i.test(bare)) isDestructive = true;
  if (!isDestructive && /\bUPDATE\b/i.test(bare) && !/\bWHERE\b/i.test(bare)) isDestructive = true;
  return { isWrite, isDestructive };
}

function cellToString(v: unknown): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

// ── routes ───────────────────────────────────────────────────────────────────

/** Current write-mode window state (drives the admin UI badge/countdown). */
router.get("/admin/sql/status", async (req, res) => {
  const adminId = await guard(req, res);
  if (!adminId) return;
  try {
    const state = await readUnlock(adminId);
    const { unlocked, remainingMs, by } = await isWriteUnlocked(adminId);
    res.json({
      enabled: process.env.ENABLE_ADMIN_SQL !== "false",
      writeUnlocked: unlocked,
      remainingMs,
      windowMs: UNLOCK_WINDOW_MS,
      unlockPhrase: UNLOCK_PHRASE, // shown in the UI as the agreement to type
      unlockedBy: by,
      hasUnlockRecord: Boolean(state),
    });
  } catch (err) {
    logger.error({ err }, "sql console status error");
    res.status(500).json({ error: "Internal error" });
  }
});

/** Type the phrase to open the 15-minute write window. */
router.post("/admin/sql/unlock", unlockLimiter, async (req, res) => {
  const adminId = await guard(req, res);
  if (!adminId) return;
  const parsed = z.object({ phrase: z.string().min(1).max(120) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "phrase is required" });
    return;
  }
  if (parsed.data.phrase.trim().toUpperCase() !== UNLOCK_PHRASE) {
    res.status(403).json({ error: "Unlock phrase incorrect" });
    return;
  }
  try {
    const at = Date.now();
    await db
      .insert(platformMetaTable)
      .values({ key: unlockMetaKey(adminId), value: { at, by: adminId } })
      .onConflictDoUpdate({ target: platformMetaTable.key, set: { value: { at, by: adminId } } });
    await db.insert(adminSqlLogTable).values({ adminId, sql: "-- write mode unlocked", kind: "write", status: "ok", rowsAffected: 0 });
    res.json({ writeUnlocked: true, remainingMs: UNLOCK_WINDOW_MS, by: adminId });
  } catch (err) {
    logger.error({ err }, "sql console unlock error");
    res.status(500).json({ error: "Internal error" });
  }
});

/** Execute a (possibly multi-statement) script. */
router.post("/admin/sql/query", queryLimiter, async (req, res) => {
  const adminId = await guard(req, res);
  if (!adminId) return;

  if (process.env.ENABLE_ADMIN_SQL === "false") {
    res.status(404).json({ error: "SQL editor is disabled on this deployment (ENABLE_ADMIN_SQL=false)." });
    return;
  }
  const parsed = z
    .object({
      query: z.string().min(1).max(100_000),
      destructiveConfirmed: z.boolean().optional(),
      branchName: z.string().max(120).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "query is required (max 100,000 chars)" });
    return;
  }
  const { query, destructiveConfirmed, branchName } = parsed.data;

  const statements = splitStatements(query);
  if (statements.length === 0) {
    res.status(400).json({ error: "No SQL statements found" });
    return;
  }
  if (statements.length > MAX_STATEMENTS) {
    res.status(400).json({ error: `Max ${MAX_STATEMENTS} statements per run` });
    return;
  }
  if (statements.some((s) => s.length > MAX_STATEMENT_CHARS)) {
    res.status(400).json({ error: `Max ${MAX_STATEMENT_CHARS.toLocaleString()} characters per statement` });
    return;
  }

  const classified = statements.map((s) => ({ stmt: s, ...classifyStatement(s) }));
  const hasWrite = classified.some((c) => c.isWrite);
  const hasDestructive = classified.some((c) => c.isDestructive);

  if (hasWrite) {
    const win = await isWriteUnlocked(adminId);
    if (!win.unlocked) {
      await db.insert(adminSqlLogTable).values({
        adminId,
        sql: query.slice(0, 4000),
        kind: "write",
        status: "blocked",
        error: "write mode not unlocked",
      });
      res.status(403).json({ error: "Write mode is locked. Type the unlock phrase to open a 15-minute write window." });
      return;
    }
  }
  if (hasDestructive && destructiveConfirmed !== true) {
    res.status(409).json({
      error: "Destructive statement detected (DROP / TRUNCATE / ALTER, or DELETE/UPDATE without WHERE). Confirm in the UI to run it.",
      destructive: classified.filter((c) => c.isDestructive).map((c) => c.stmt.slice(0, 200)),
    });
    return;
  }

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

  let stopped = false;
  for (const c of classified) {
    const started = Date.now();
    const client = await pool.connect();
    let result;
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
      result = await client.query(c.stmt);
      await client.query("COMMIT");
      const columns = (result.fields ?? []).map((f) => f.name);
      const rowsRaw: unknown[][] = Array.isArray(result.rows)
        ? result.rows.slice(0, MAX_RETURN_ROWS).map((r: Record<string, unknown>) => (columns.length ? columns.map((col) => cellToString(r[col])) : Object.values(r).map(cellToString)))
        : [];
      results.push({
        statement: c.stmt.slice(0, 4000),
        kind: c.isWrite ? "write" : "read",
        destructive: c.isDestructive,
        ok: true,
        columns,
        rows: rowsRaw,
        rowCount: typeof result.rowCount === "number" ? result.rowCount : rowsRaw.length,
        truncated: Array.isArray(result.rows) && result.rows.length > MAX_RETURN_ROWS,
        durationMs: Date.now() - started,
      });
      await db.insert(adminSqlLogTable).values({
        adminId,
        sql: c.stmt.slice(0, 4000),
        kind: c.isWrite ? "write" : "read",
        status: "ok",
        rowsAffected: typeof result.rowCount === "number" ? result.rowCount : 0,
        branchName: branchName || null,
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* connection may be broken */
      }
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        statement: c.stmt.slice(0, 4000),
        kind: c.isWrite ? "write" : "read",
        destructive: c.isDestructive,
        ok: false,
        columns: [],
        rows: [],
        rowCount: 0,
        truncated: false,
        durationMs: Date.now() - started,
        error: message.slice(0, 500),
      });
      try {
        await db.insert(adminSqlLogTable).values({
          adminId,
          sql: c.stmt.slice(0, 4000),
          kind: c.isWrite ? "write" : "read",
          status: "error",
          error: message.slice(0, 1000),
          branchName: branchName || null,
        });
      } catch {
        /* logging must never break the response */
      }
      stopped = true;
    } finally {
      client.release();
    }
    if (stopped) break;
  }

  res.json({
    statements: results,
    anyError: results.some((r) => !r.ok),
    mode: hasWrite ? "write" : "read",
    totalMs: results.reduce((n, r) => n + r.durationMs, 0),
  });
});

/** Recent console history (insert-only table, read view). */
router.get("/admin/sql/log", async (req, res) => {
  const adminId = await guard(req, res);
  if (!adminId) return;
  const limit = Math.min(Math.max(Number(req.query.limit ?? 30) || 30, 1), 100);
  try {
    const rows = await db
      .select({
        id: adminSqlLogTable.id,
        adminId: adminSqlLogTable.adminId,
        sqlText: adminSqlLogTable.sql,
        kind: adminSqlLogTable.kind,
        rowsAffected: adminSqlLogTable.rowsAffected,
        status: adminSqlLogTable.status,
        error: adminSqlLogTable.error,
        branchName: adminSqlLogTable.branchName,
        createdAt: adminSqlLogTable.createdAt,
      })
      .from(adminSqlLogTable)
      .orderBy(desc(adminSqlLogTable.createdAt))
      .limit(limit);
    res.json({
      entries: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        sql: r.sqlText.slice(0, 300),
        rowsAffected: r.rowsAffected,
        status: r.status,
        error: r.error,
        branchName: r.branchName,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "sql console log error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as adminSqlRouter };
export default router;
