#!/usr/bin/env node
/**
 * The wallet invariants must exist in all four places, or they do not exist.
 *
 * `coins >= 0` is only a guarantee if every path that creates the database
 * agrees on it:
 *
 *   1. the canonical Drizzle schema — what `drizzle-kit push` applies, and
 *      what `database/full_schema.sql` is generated from;
 *   2. the numbered migration — what a migrations-only database (and CI's
 *      replay job) applies;
 *   3. the journal — without an entry, `replay-migrations.mjs` never runs it;
 *   4. the rollback — §1.9 asks for one per migration, and an unrestorable
 *      constraint change is a deploy you cannot undo.
 *
 * The failure this guards against is quiet and one-directional: someone edits
 * the schema, `schema:export` regenerates the snapshot, `schema:check` passes,
 * and the migration that would have upgraded existing databases is never
 * written. Fresh databases get the constraint; production silently does not.
 * Nothing else in the gate suite cross-checks those two files against each
 * other.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(DB_DIR, rel), "utf8");

/** The invariants, as declared. Adding one means adding it in all four places. */
const CONSTRAINTS = [
  // The generated snapshot quotes the column and qualifies the table
  // (`"user_wallets"."coins" >= 0`), while the Drizzle source writes it bare
  // (`sql`${t.coins} >= 0``), so the quote is optional in every pattern.
  { name: "user_wallets_coins_non_negative", expression: /coins"?\s*>=\s*0/ },
  { name: "user_wallets_total_xp_non_negative", expression: /total_xp"?\s*>=\s*0/ },
  { name: "user_wallets_weekly_xp_non_negative", expression: /weekly_xp"?\s*>=\s*0/ },
  { name: "user_wallets_level_at_least_one", expression: /level"?\s*>=\s*1/ },
  { name: "user_wallets_prestige_non_negative", expression: /prestige"?\s*>=\s*0/ },
];

const MIGRATION = "drizzle/0016_wallet_balance_checks.sql";
const ROLLBACK = "drizzle/rollback/0016_wallet_balance_checks.down.sql";

test("the Drizzle schema declares every wallet invariant as a check()", () => {
  const schema = read("src/schema/focusarx.ts");
  for (const { name } of CONSTRAINTS) {
    assert.match(
      schema,
      new RegExp(`check\\("${name}"`),
      `${name} is missing from src/schema/focusarx.ts — drizzle-kit push and the SQL snapshot would not create it`,
    );
  }
});

test("the generated SQL snapshot carries every invariant", () => {
  // full_schema.sql is generated, so this also proves `schema:export` was run
  // after the schema changed rather than left stale.
  const snapshot = read("../../database/full_schema.sql");
  for (const { name, expression } of CONSTRAINTS) {
    assert.match(snapshot, new RegExp(`CONSTRAINT "${name}"`), `${name} absent from database/full_schema.sql`);
    const line = snapshot.split("\n").find((l) => l.includes(`"${name}"`)) ?? "";
    assert.match(line, expression, `${name} in the snapshot does not state its expression`);
  }
});

test("the migration adds every invariant, guarded so a re-run is a no-op", () => {
  const sql = read(MIGRATION);
  assert.ok(sql.length > 0, `${MIGRATION} is empty`);

  for (const { name } of CONSTRAINTS) {
    // The ADD must be wrapped in an existence check, otherwise the second run
    // — or any database created by `push` — errors with "already exists".
    const guarded = new RegExp(
      `IF NOT EXISTS \\(SELECT 1 FROM pg_constraint WHERE conrelid = 'public\\.user_wallets'::regclass AND conname = '${name}'\\) THEN\\s*ALTER TABLE public\\.user_wallets ADD CONSTRAINT ${name}`,
    );
    assert.match(sql, guarded, `${name} is added without a pg_constraint guard — the migration is not idempotent`);
  }

  // A negative balance cannot exist once the constraint is added, so any
  // pre-existing row has to be repaired first or the ALTER fails and blocks
  // every deploy behind it.
  for (const column of ["coins", "total_xp", "weekly_xp", "prestige"]) {
    assert.match(
      sql,
      new RegExp(`UPDATE public\\.user_wallets SET ${column} = 0[^;]*WHERE ${column} < 0`),
      `the migration does not repair negative ${column} before constraining it`,
    );
  }
  assert.match(sql, /SET level = 1[^;]*WHERE level < 1/, "the migration does not repair level < 1");

  // The repair must be reported, not silent.
  assert.match(sql, /RAISE WARNING/, "repaired rows are not reported — the cause would be invisible");
});

test("the migration is journaled, so the replay job actually runs it", () => {
  const journal = JSON.parse(read("drizzle/meta/_journal.json"));
  const entry = journal.entries.find((e) => e.tag === "0016_wallet_balance_checks");
  assert.ok(entry, "0016_wallet_balance_checks is not in drizzle/meta/_journal.json — replay would skip it");
  assert.equal(entry.idx, 16);
  // Tags are ordered by idx; replay runs them in journal order.
  const idxs = journal.entries.map((e) => e.idx);
  assert.deepEqual(idxs, [...idxs].sort((a, b) => a - b), "journal idx values are out of order");
  assert.equal(new Set(journal.entries.map((e) => e.tag)).size, journal.entries.length, "duplicate migration tags");
});

test("the rollback drops exactly the constraints the migration adds", () => {
  const down = read(ROLLBACK);
  for (const { name } of CONSTRAINTS) {
    assert.match(
      down,
      new RegExp(`DROP CONSTRAINT ${name}`),
      `${name} is not dropped by the rollback — the migration cannot be undone in one step`,
    );
  }
  // Symmetry: the rollback must not touch a constraint this migration did not add.
  const dropped = [...down.matchAll(/DROP CONSTRAINT (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(
    [...dropped].sort(),
    CONSTRAINTS.map((c) => c.name).sort(),
    "the rollback drops a different set of constraints than the migration adds",
  );
  assert.match(down, /RAISE NOTICE/, "the rollback is not guarded — running it twice would error");
});

test("no other schema file quietly redeclares these constraints", () => {
  // Two declarations of one constraint name across files produce a migration
  // that fails with "constraint already exists" on a database where the other
  // definition won.
  const dir = path.join(DB_DIR, "src/schema");
  const offenders = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".ts")) continue;
    const source = fs.readFileSync(path.join(dir, file), "utf8");
    for (const { name } of CONSTRAINTS) {
      if (file !== "focusarx.ts" && source.includes(`"${name}"`)) offenders.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(offenders, [], `wallet constraints declared outside focusarx.ts: ${offenders.join(", ")}`);
});
