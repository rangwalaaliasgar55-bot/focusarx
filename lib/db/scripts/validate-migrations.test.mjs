import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { validateMigrations } from "./validate-migrations.mjs";

const fixtures = [];
afterEach(() => { for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "focusarx-migrations-"));
  fixtures.push(root);
  const drizzleDir = path.join(root, "drizzle");
  const migrationsDir = path.join(root, "migrations");
  mkdirSync(path.join(drizzleDir, "meta"), { recursive: true });
  mkdirSync(migrationsDir);
  const entries = [{ idx: 0, tag: "0000_initial", when: 100, version: "7", breakpoints: true }];
  const journal = () => writeFileSync(path.join(drizzleDir, "meta/_journal.json"), JSON.stringify({ version: "7", dialect: "postgresql", entries }));
  const sql = (file, contents = "SELECT 1;") => writeFileSync(path.join(drizzleDir, file), contents);
  sql("0000_initial.sql");
  journal();
  return { drizzleDir, migrationsDir, entries, journal, sql };
}

test("accepts consistent migrations and unnumbered maintenance helpers", () => {
  const f = fixture();
  f.sql("cleanup.sql");
  assert.deepEqual(validateMigrations(f).errors, []);
});

test("rejects a numbered file omitted from the journal", () => {
  const f = fixture();
  f.sql("0001_missing.sql");
  assert.match(validateMigrations(f).errors.join("\n"), /Unjournaled migration: 0001_missing.sql/);
});

test("detects duplicate versions with descriptive filenames", () => {
  const f = fixture();
  f.sql("0000_duplicate.sql");
  assert.match(validateMigrations(f).errors.join("\n"), /duplicate migration version 0000/);
});

test("detects missing SQL, invalid indexes and backwards journal timestamps", () => {
  const f = fixture();
  f.entries.push({ idx: 7, tag: "0001_missing", when: 99 });
  f.journal();
  const errors = validateMigrations(f).errors.join("\n");
  assert.match(errors, /idx must be 1/);
  assert.match(errors, /missing migration 0001_missing.sql/);
  assert.match(errors, /timestamps must increase/);
});

test("rejects a missing or malformed journal", () => {
  const f = fixture();
  writeFileSync(path.join(f.drizzleDir, "meta/_journal.json"), "not JSON");
  assert.match(validateMigrations(f).errors.join("\n"), /Cannot read migration journal/);
});

test("warns about destructive SQL, or fails in strict mode, but ignores comments", () => {
  const f = fixture();
  f.sql("0000_initial.sql", "-- DROP TABLE example;\n/*\nTRUNCATE example;\n*/\nDROP INDEX example;");
  const normal = validateMigrations(f);
  assert.equal(normal.errors.length, 0);
  assert.equal(normal.warnings.length, 1);
  const strict = validateMigrations({ ...f, strict: true });
  assert.equal(strict.errors.length, 1);
  assert.equal(strict.warnings.length, 0);
});

test("rejects an empty migration directory", () => {
  const f = fixture();
  rmSync(f.drizzleDir, { recursive: true });
  assert.match(validateMigrations(f).errors.join("\n"), /No numbered Drizzle migrations/);
});
