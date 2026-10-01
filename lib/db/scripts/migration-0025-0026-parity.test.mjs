#!/usr/bin/env node
/**
 * Parity tests for migrations 0025 (2FA columns) and 0026 (ledger/pet checks).
 *
 * Same rule as the 0018 and wallet tests, generalised: a schema change is
 * only real if every path that creates the database agrees on it —
 *
 *   1. the canonical Drizzle schema (what `drizzle-kit push` applies),
 *   2. the numbered migration,
 *   3. the journal (otherwise the replay job never runs it),
 *   4. the rollback (otherwise the deploy cannot be undone),
 *   5. the generated snapshot (`database/full_schema.sql`).
 *
 * String operations, not regexes: every assertion names a literal that must
 * appear on a line, so a mismatch reads as "this line is missing" rather than
 * "some pattern failed somewhere".
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(DB_DIR, "..", "..");
const read = (p) => fs.readFileSync(p, "utf8");
const readDb = (rel) => fs.readFileSync(path.join(DB_DIR, rel), "utf8");

const JOURNAL = "drizzle/meta/_journal.json";
const SNAPSHOT = path.join(ROOT, "database", "full_schema.sql");

// ── 0025 — the four TOTP columns ─────────────────────────────────────────────

const TWO_FACTOR_COLUMNS = [
  { prop: "twoFactorEnabled", column: "two_factor_enabled" },
  { prop: "twoFactorSecretEnc", column: "two_factor_secret_enc" },
  { prop: "twoFactorPendingSecretEnc", column: "two_factor_pending_secret_enc" },
  { prop: "twoFactorBackupCodesHash", column: "two_factor_backup_codes_hash" },
];

describe("0025 two-factor columns", () => {
  test("every column is declared in the Drizzle users schema", () => {
    const source = readDb("src/schema/focusarx.ts");
    for (const { prop, column } of TWO_FACTOR_COLUMNS) {
      const line = source.split("\n").find((l) => l.includes(column)) ?? "";
      assert.ok(line.length > 0, `users.${prop} (${column}) is missing from the Drizzle schema`);
      assert.ok(line.includes(prop), `${column} is not bound to the ${prop} property`);
    }
  });

  test("the migration adds every column behind IF NOT EXISTS", () => {
    const sql = readDb("drizzle/0025_two_factor_auth.sql");
    for (const { column } of TWO_FACTOR_COLUMNS) {
      assert.ok(
        sql.includes(`ADD COLUMN IF NOT EXISTS "${column}"`),
        `0025 does not idempotently add ${column}`,
      );
    }
  });

  test("the migration is journaled and the rollback drops the columns", () => {
    const journal = JSON.parse(readDb(JOURNAL));
    assert.ok(
      journal.entries.some((e) => e.tag === "0025_two_factor_auth"),
      "0025_two_factor_auth is not in the journal — the replay job would skip it",
    );
    const down = readDb("drizzle/rollback/0025_two_factor_auth.down.sql");
    for (const { column } of TWO_FACTOR_COLUMNS) {
      assert.ok(down.includes(`DROP COLUMN IF EXISTS "${column}"`), `rollback does not drop ${column}`);
    }
  });

  test("the generated snapshot carries the columns", () => {
    const snapshot = read(SNAPSHOT);
    for (const { column } of TWO_FACTOR_COLUMNS) {
      assert.ok(snapshot.includes(`"${column}"`), `${column} absent from database/full_schema.sql`);
    }
  });

  test("an enabled factor cannot exist without an encrypted secret", () => {
    const sql = readDb("drizzle/0025_two_factor_auth.sql");
    assert.ok(
      sql.includes("users_two_factor_enabled_needs_secret"),
      "0025 is missing the enabled-needs-secret guard",
    );
  });
});

// ── 0026 — ledger and pet arithmetic invariants ──────────────────────────────

const CHECKS_0026 = [
  { table: "token_ledger", name: "token_ledger_balance_after_non_negative", prop: "t.balanceAfter", column: "balance_after", op: ">= 0" },
  { table: "user_pet_inventory", name: "user_pet_inventory_level_range", prop: "t.level", column: "level", op: "<= 20" },
  { table: "user_pet_inventory", name: "user_pet_inventory_bond_xp_non_negative", prop: "t.bondXp", column: "bond_xp", op: ">= 0" },
  { table: "user_pet_inventory", name: "user_pet_inventory_mood_known", prop: "t.mood", column: "mood", op: "IN ('happy', 'excited', 'sleepy')" },
];

describe("0026 ledger and pet checks", () => {
  test("every invariant is declared as a check() in the Drizzle schema", () => {
    const dir = path.join(DB_DIR, "src/schema");
    for (const { name, prop } of CHECKS_0026) {
      const sources = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".ts"))
        .map((file) => ({ file, source: fs.readFileSync(path.join(dir, file), "utf8") }));
      const found = sources.filter((f) => f.source.includes('check("' + name + '"'));
      assert.equal(found.length, 1, `${name} is declared in ${found.length} schema files, expected exactly 1`);
      const line = found[0].source.split("\n").find((l) => l.includes(name)) ?? "";
      assert.ok(line.includes(prop), `${name} in ${found[0].file} does not constrain ${prop}`);
    }
  });

  test("the migration guards, repairs, then adds every constraint", () => {
    const sql = readDb("drizzle/0026_ledger_and_pet_checks.sql");
    for (const { table, name, column, op } of CHECKS_0026) {
      const guard = "conname = '" + name + "'";
      assert.ok(sql.includes(guard), `${name} has no pg_constraint guard — not idempotent`);
      const add = 'ADD CONSTRAINT "' + name + '"';
      assert.ok(sql.includes(add), `${name} is never added`);
      assert.ok(sql.indexOf(guard) < sql.indexOf(add), `${name} is added before its guard is evaluated`);
      assert.ok(sql.includes("'" + table + "'::regclass"), `${name}'s guard does not name table ${table}`);
      // The UPDATE before the DO block is what makes the ALTER safe on data
      // written before the invariant existed.
      assert.ok(sql.includes(`UPDATE "${table}"`), `${name} has no repair for existing rows`);
      const constraintLine = sql.split("\n").find((l) => l.includes(`CHECK ("${column}"`)) ?? "";
      assert.ok(constraintLine.includes(op), `${name} is missing its ${op} comparison`);
    }
  });

  test("the migration is journaled and the rollback drops every constraint", () => {
    const journal = JSON.parse(readDb(JOURNAL));
    assert.ok(
      journal.entries.some((e) => e.tag === "0026_ledger_and_pet_checks"),
      "0026_ledger_and_pet_checks is not in the journal",
    );
    const down = readDb("drizzle/rollback/0026_ledger_and_pet_checks.down.sql");
    for (const { name } of CHECKS_0026) {
      assert.ok(down.includes(`DROP CONSTRAINT "${name}"`), `rollback does not drop ${name}`);
    }
  });

  test("the generated snapshot carries every invariant", () => {
    const snapshot = read(SNAPSHOT);
    for (const { name, column, op } of CHECKS_0026) {
      assert.ok(snapshot.includes(`CONSTRAINT "${name}"`), `${name} absent from database/full_schema.sql`);
      const line = snapshot.split("\n").find((l) => l.includes(`"${name}"`)) ?? "";
      assert.ok(line.includes(`"${column}"`), `${name} in the snapshot does not mention ${column}`);
      assert.ok(line.includes(op), `${name} in the snapshot is missing its ${op} comparison`);
    }
  });
});
