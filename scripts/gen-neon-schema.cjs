/**
 * Generates the final deliverable: ONE complete, idempotent SQL script for
 * the Neon SQL editor, introspected live from the local Postgres 18 via node
 * (no psql/pg_dump).
 */
const { createRequire } = require("module");
const req = createRequire("/home/user/focusarx/node_modules/.pnpm/pg@8.20.0/node_modules/pg/");
const { Client } = req("pg");

const QUOTED = (name) => '"' + name.replace(/"/g, '""') + '"';
const sqlStr = (v) => "'" + String(v).replace(/'/g, "''") + "'";

async function main() {
  const c = new Client({ connectionString: "postgresql://focusarx:focusarx@127.0.0.1:54330/focusarx?sslmode=disable" });
  await c.connect();
  try {
    const tablesRes = await c.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );
    const tables = tablesRes.rows.map((r) => r.table_name);

    const tableSql = new Map();
    const alterTableSql = new Map();
    const fkDeps = new Map();

    for (const t of tables) {
      const cols = await c.query(
        `SELECT c.column_name,
                format_type(a.atttypid, a.atttypmod) AS type,
                c.is_nullable,
                c.column_default
         FROM information_schema.columns c
         JOIN pg_attribute a
           ON a.attrelid = format('%I.%I', 'public', $1::text)::regclass
          AND a.attname = c.column_name
         WHERE c.table_schema = 'public' AND c.table_name = $1::text
           AND a.attnum > 0
         ORDER BY c.ordinal_position`,
        [t]
      );
      const colDefs = cols.rows.map((col) => {
        let def = "    " + QUOTED(col.column_name) + " " + col.type;
        if (col.column_default !== null) def += " DEFAULT " + col.column_default;
        if (col.is_nullable === "NO") def += " NOT NULL";
        return def;
      });
      tableSql.set(t, "CREATE TABLE IF NOT EXISTS public." + QUOTED(t) + " (\n" + colDefs.join(",\n") + "\n);");

      // Column reconciliation: heals databases that already have the table
      // but are missing columns added by later schema changes (the silent
      // drift that turns selects into 500s). No-op when the column exists.
      const alterSql = cols.rows.map((col) => {
        let def = QUOTED(col.column_name) + " " + col.type;
        if (col.column_default !== null) def += " DEFAULT " + col.column_default;
        if (col.is_nullable === "NO") def += " NOT NULL";
        return "ALTER TABLE public." + QUOTED(t) + " ADD COLUMN IF NOT EXISTS " + def + ";";
      });
      alterTableSql.set(t, alterSql);


      const fks = await c.query(
        `SELECT ct.relname AS ref_table
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = rel.relnamespace
         JOIN pg_class ct ON ct.oid = con.confrelid
         WHERE n.nspname = 'public' AND rel.relname = $1::text AND con.contype = 'f'`,
        [t]
      );
      const deps = new Set(fks.rows.filter((r) => r.ref_table !== t).map((r) => r.ref_table));
      fkDeps.set(t, deps);
    }

    // topological sort (FK targets first), alphabetical tie-break
    const ordered = [];
    const placed = new Set();
    const visit = (name, stack) => {
      if (placed.has(name)) return;
      if (stack.has(name)) return; // cycle — place as-is
      stack.add(name);
      for (const dep of [...(fkDeps.get(name) ?? [])].sort()) {
        if (fkDeps.has(dep)) visit(dep, stack);
      }
      stack.delete(name);
      placed.add(name);
      ordered.push(name);
    };
    for (const t of [...tables].sort()) visit(t, new Set());

    const postTableBlocks = new Map();
    for (const t of tables) {
      const blocks = [];
      const cons = await c.query(
        `SELECT conname, contype, pg_get_constraintdef(con.oid) AS def
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = rel.relnamespace
         WHERE n.nspname = 'public' AND rel.relname = $1::text
           AND con.contype IN ('p', 'u', 'f')
         ORDER BY CASE con.contype WHEN 'p' THEN 0 WHEN 'u' THEN 1 ELSE 2 END, conname`,
        [t]
      );
      for (const con of cons.rows) {
        blocks.push(
          "DO $$\nBEGIN\n" +
          "  IF NOT EXISTS (\n" +
          "    SELECT 1 FROM pg_constraint\n" +
          "    WHERE conname = " + sqlStr(con.conname) + " AND conrelid = format('%I.%I', 'public', " + sqlStr(t) + ")::regclass\n" +
          "  ) THEN\n" +
          "    ALTER TABLE public." + QUOTED(t) + " ADD CONSTRAINT " + QUOTED(con.conname) + " " + con.def + ";\n" +
          "  END IF;\nEND $$;"
        );
      }
      const idx = await c.query(
        `SELECT i.relname AS indexname,
                pg_get_indexdef(ix.indexrelid) AS indexdef,
                (d.objid IS NOT NULL) AS constraint_backed
         FROM pg_index ix
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN pg_class t ON t.oid = ix.indrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         LEFT JOIN pg_depend d
           ON d.objid = ix.indexrelid AND d.classid = 'pg_class'::regclass
          AND d.refclassid = 'pg_constraint'::regclass
         WHERE n.nspname = 'public' AND t.relname = $1::text
         ORDER BY i.relname`,
        [t]
      );
      for (const row of idx.rows) {
        if (row.constraint_backed) continue;
        const def = row.indexdef.replace(/^(CREATE\s+(UNIQUE\s+)?INDEX)\s+/i, "$1 IF NOT EXISTS ");
        blocks.push(def.endsWith(";") ? def : def + ";");
      }
      if (blocks.length) postTableBlocks.set(t, blocks.join("\n\n"));
    }

    const out = [];
    out.push("-- FocusArx — COMPLETE website SQL for the Neon SQL editor");
    out.push("-- ======================================================");
    out.push("-- HOW TO RUN: Neon Console -> your project -> SQL Editor -> paste THIS");
    out.push("-- ENTIRE file -> Run. That's it. Nothing else is needed.");
    out.push("--");
    out.push("-- SKIP-IF-EXISTS: every statement is idempotent —");
    out.push("--   * tables:    CREATE TABLE IF NOT EXISTS");
    out.push("--   * columns:   ADD COLUMN IF NOT EXISTS");
    out.push("--   * indexes:   CREATE INDEX IF NOT EXISTS");
    out.push("--   * constraints: DO-block guards that check pg_constraint first");
    out.push("-- Anything that already exists is SKIPPED, never dropped, never");
    out.push("-- altered destructively, and NO DATA is touched. Run it as many");
    out.push("-- times as you like — on an empty database it creates everything,");
    out.push("-- on a drifted one it fills in what is missing.");
    out.push("--");
    out.push("-- Generated: " + new Date().toISOString());
    out.push("-- Source: live Postgres catalog introspection (node, no psql)");
    out.push("-- Tables: " + tables.length + " - all CREATEs are IF NOT EXISTS; constraints and indexes");
    out.push("-- are guarded / IF NOT EXISTS. Safe to run repeatedly. No data is modified.");
    out.push("-- Every column also has an ADD COLUMN IF NOT EXISTS reconciliation line, so");
    out.push("-- existing databases that drifted behind the schema are healed in place.");
    out.push("-- FK tables are ordered before their dependents.");
    out.push("");
    out.push("SET search_path TO public;");
    out.push("");

    for (const t of ordered) {
      out.push(tableSql.get(t));
      const alters = alterTableSql.get(t);
      if (alters && alters.length) {
        out.push("");
        out.push("-- Heal columns added after this table was first created (no-op if present).");
        out.push(alters.join("\n"));
      }
      const post = postTableBlocks.get(t);
      if (post) out.push("", post);
      out.push("");
    }

    out.push("-- VERIFICATION: after running, this should return " + tables.length + " (one row per table is fine to eyeball too).");
    out.push("SELECT count(*) AS table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';");
    out.push("");

    const fs = require("fs");
    const dest = "/home/user/focusarx/neon-schema.sql";
    fs.writeFileSync(dest, out.join("\n"));
    console.log("wrote " + dest + " (" + out.length + " lines, " + tables.length + " tables)");
  } finally {
    await c.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
