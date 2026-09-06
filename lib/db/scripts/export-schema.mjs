#!/usr/bin/env node
// Keep the SQL bootstrap snapshot derived from the canonical TypeScript schema.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function makeIdempotentSql(sql) {
  return sql
    .replace(/^CREATE TABLE /gm, "CREATE TABLE IF NOT EXISTS ")
    .replace(/^CREATE (UNIQUE )?INDEX /gm, (_match, unique = "") => `CREATE ${unique}INDEX IF NOT EXISTS `)
    .replace(/^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" .+;$/gm, (statement, table, constraint) => {
      const relation = `"public"."${table}"`.replaceAll("'", "''");
      const name = constraint.replaceAll("'", "''");
      return `DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = '${relation}'::regclass AND conname = '${name}') THEN\n    ${statement}\n  END IF;\nEND $$;`;
    });
}

export function exportSchema() {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const require = createRequire(import.meta.url);
  const cli = path.join(path.dirname(require.resolve("drizzle-kit")), "bin.cjs");
  // Export reads schema definitions only: no DATABASE_URL or database access.
  const sql = execFileSync(process.execPath, [cli, "export", "--dialect", "postgresql", "--schema", "./src/schema/*.ts"], {
    cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 10 * 1024 * 1024,
  });
  if (!sql.trimStart().startsWith("CREATE TABLE ")) throw new Error("Unexpected drizzle-kit SQL export output.");
  return `-- FocusArx public schema snapshot, generated from lib/db/src/schema/.\n-- Regenerate: pnpm --filter @workspace/db run schema:export\n-- Check drift: pnpm --filter @workspace/db run schema:check\n-- Creates missing objects without dropping data. IF NOT EXISTS does NOT upgrade\n-- columns in existing tables: use reviewed migrations or db:push for upgrades.\n-- Tables are created before foreign keys so a fresh database can bootstrap.\n\n${makeIdempotentSql(sql)}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = fileURLToPath(new URL("../../../database/full_schema.sql", import.meta.url));
  const sql = exportSchema();
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== sql) {
      console.error("SQL snapshot is out of date. Run pnpm --filter @workspace/db run schema:export.");
      process.exitCode = 1;
    } else console.log("SQL snapshot matches the canonical Drizzle schema.");
  } else {
    fs.writeFileSync(target, sql);
    console.log("Updated database/full_schema.sql.");
  }
}
