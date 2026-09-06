#!/usr/bin/env node
// SQL validation against a deliberately empty, disposable PostgreSQL database.
// Never point this at production. A separate env var prevents accidental reuse
// of an operator's normal DATABASE_URL, and non-empty schemas are rejected.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { validateMigrations } from "./validate-migrations.mjs";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("Set MIGRATION_DATABASE_URL to an empty disposable PostgreSQL database.");
const validation = validateMigrations();
if (validation.errors.length) throw new Error(validation.errors.join("\n"));

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../drizzle");
const journal = JSON.parse(fs.readFileSync(path.join(dir, "meta/_journal.json"), "utf8"));
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15_000 });
try {
  await client.connect();
  const { rows } = await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'");
  if (rows[0].count !== 0) throw new Error("Refusing to replay migrations: the public schema is not empty.");
  for (const entry of journal.entries) {
    await client.query("BEGIN");
    try {
      await client.query(fs.readFileSync(path.join(dir, `${entry.tag}.sql`), "utf8"));
      await client.query("COMMIT");
      console.log(`PASS ${entry.tag}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`${entry.tag}: ${error.message}`, { cause: error });
    }
  }
  console.log(`Replayed ${journal.entries.length} migrations successfully.`);
} finally {
  await client.end();
}
