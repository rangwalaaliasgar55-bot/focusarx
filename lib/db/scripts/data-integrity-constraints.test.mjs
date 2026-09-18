#!/usr/bin/env node
/**
 * The 0018 invariants must exist in all four places, or they do not exist.
 *
 * Same rule as the wallet test, generalised over tables: a constraint is only a
 * guarantee if every path that creates the database agrees on it.
 *
 *   1. the canonical Drizzle schema — what `drizzle-kit push` applies, and what
 *      `database/full_schema.sql` is generated from;
 *   2. the numbered migration — what a migrations-only database applies;
 *   3. the journal — without an entry, the replay job never runs it;
 *   4. the rollback — an unrestorable constraint change is a deploy you cannot
 *      undo.
 *
 * Deliberately written with string operations rather than regular expressions.
 * Every constraint here is identified by a literal name, so a regex buys
 * nothing and costs a layer of escaping that is genuinely hard to get right:
 * the first version of this file asserted a pattern containing a doubled
 * backslash, which matched nothing, and the check passed by failing to look.
 * `includes()` on a line that provably contains the declaration cannot do that.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(DB_DIR, rel), "utf8");

const MIGRATION = "drizzle/0018_data_integrity_checks.sql";
const ROLLBACK = "drizzle/rollback/0018_data_integrity_checks.down.sql";

/**
 * table → constraint name → { prop, column, op }.
 *
 * `prop` is the TypeScript property the Drizzle schema interpolates
 * (`t.durationSec`); `column` is the SQL name the snapshot writes
 * (`"focus_sessions"."duration_sec"`). They differ, and the first version of
 * this file checked the SQL name against the TypeScript source — an assertion
 * that could never have matched anything.
 *
 * `op` is the literal comparison text, taken verbatim from the expression.
 */
const TABLES = {
  focus_sessions: {
    focus_sessions_duration_non_negative: { prop: "t.durationSec", column: "duration_sec", op: ">= 0" },
    focus_sessions_planned_duration_non_negative: { prop: "t.plannedDurationSec", column: "planned_duration_sec", op: "IS NULL" },
    focus_sessions_completion_percentage_range: { prop: "t.completionPercentage", column: "completion_percentage", op: "<= 100" },
  },
  active_sessions: {
    active_sessions_seconds_left_non_negative: { prop: "t.secondsLeft", column: "seconds_left", op: ">= 0" },
    active_sessions_active_seconds_non_negative: { prop: "t.activeSeconds", column: "active_seconds", op: ">= 0" },
  },
  flashcards: {
    flashcards_box_at_least_one: { prop: "t.box", column: "box", op: ">= 1" },
    flashcards_counters_non_negative: { prop: "t.correctCount", column: "correct_count", op: ">= 0" },
    flashcards_fsrs_params_non_negative: { prop: "t.fsrsStability", column: "fsrs_stability", op: ">= 0" },
  },
  flashcard_reviews: {
    flashcard_reviews_grade_in_range: { prop: "t.grade", column: "grade", op: "BETWEEN 1 AND 4" },
  },
  analytics_sessions: {
    analytics_sessions_counters_non_negative: { prop: "t.pageViews", column: "page_views", op: ">= 0" },
  },
  focus_cities: {
    focus_cities_counters_non_negative: { prop: "t.population", column: "population", op: ">= 0" },
  },
};

const ALL = Object.entries(TABLES).flatMap(([table, constraints]) =>
  Object.entries(constraints).map(([name, spec]) => ({ table, name, ...spec })),
);

/** Schema sources, keyed by file, with the double-quoted form city.ts avoids. */
function schemaSources() {
  const dir = path.join(DB_DIR, "src/schema");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((file) => ({ file, source: fs.readFileSync(path.join(dir, file), "utf8") }));
}

/** `check("name"` or `check('name'` — city.ts uses single quotes. */
const declares = (source, name) =>
  source.includes('check("' + name + '"') || source.includes("check('" + name + "'");

describe("0018 data integrity constraints", () => {
  test("every invariant is declared as a check() in the Drizzle schema", () => {
    for (const { name, prop } of ALL) {
      const found = schemaSources().filter((f) => declares(f.source, name));
      assert.equal(found.length, 1, `${name} is declared in ${found.length} schema files, expected exactly 1`);
      const { file, source } = found[0];
      // The declaration must be on one line *and* name the property, so the
      // constraint cannot be an empty check that passes for every row.
      const line = source.split("\n").find((l) => declares(l, name)) ?? "";
      assert.ok(line.length > 0, `${name} spans multiple lines in ${file} — this check cannot verify it`);
      assert.ok(line.includes(prop), `${name} in ${file} does not constrain ${prop}: ${line.trim()}`);
    }
  });

  test("the generated SQL snapshot carries every invariant", () => {
    // Reading the snapshot also proves `schema:export` ran after the schema
    // changed rather than being left stale.
    const snapshot = read("../../database/full_schema.sql");
    for (const { name, column, op } of ALL) {
      assert.ok(snapshot.includes('CONSTRAINT "' + name + '"'), `${name} absent from database/full_schema.sql`);
      const line = snapshot.split("\n").find((l) => l.includes('"' + name + '"')) ?? "";
      assert.ok(line.length > 0, `${name} spans multiple lines in the snapshot — this check cannot verify it`);
      assert.ok(line.includes('"' + column + '"'), `${name} in the snapshot does not mention ${column}`);
      assert.ok(line.includes(op), `${name} in the snapshot is missing its ${op} comparison`);
    }
  });

  test("the migration adds every constraint behind a pg_constraint guard", () => {
    const sql = read(MIGRATION);
    assert.ok(sql.length > 0, `${MIGRATION} is empty`);
    for (const { table, name } of ALL) {
      const guard = "conname = '" + name + "'";
      assert.ok(sql.includes(guard), `${name} has no pg_constraint guard — the migration is not idempotent`);
      const add = "ADD CONSTRAINT " + name;
      assert.ok(sql.includes(add), `${name} is never actually added`);
      assert.ok(
        sql.indexOf(guard) < sql.indexOf(add),
        `${name} is added before its guard is evaluated — the second run would error`,
      );
      assert.ok(sql.includes("'" + table + "'::regclass"), `${name}'s guard does not name table ${table}`);
    }
  });

  test("the migration repairs before it constrains, and says what it repaired", () => {
    const sql = read(MIGRATION);
    // A row that already violates the new constraint makes the ALTER fail and
    // blocks every deploy behind one bad record, so the repair has to come
    // first — the ordering assertion below is the point of the test.
    for (const { column } of ALL) {
      assert.ok(sql.includes(column + " = "), `the migration does not repair ${column}`);
    }
    // The columns named only inside a multi-column UPDATE, not by a constraint.
    for (const column of ["incorrect_count", "fsrs_reps", "fsrs_lapses", "fsrs_interval", "fsrs_stability", "fsrs_difficulty", "total_buildings", "total_sessions", "ai_features_used"]) {
      assert.ok(sql.includes(column + " = "), `the migration does not repair ${column}`);
    }
    assert.ok(sql.includes("RAISE NOTICE"), "repaired rows are not reported — the cause would be invisible");
    const firstRepair = sql.indexOf("RAISE NOTICE");
    const firstAdd = sql.indexOf("ADD CONSTRAINT");
    assert.ok(firstAdd > 0 && firstRepair < firstAdd, "the repair block runs after the constraints — the ALTER would fail first");
  });

  test("the migration is journaled, so the replay job actually runs it", () => {
    const journal = JSON.parse(read("drizzle/meta/_journal.json"));
    const entry = journal.entries.find((e) => e.tag === "0018_data_integrity_checks");
    assert.ok(entry, "0018_data_integrity_checks is not in drizzle/meta/_journal.json — replay would skip it");
    assert.equal(entry.idx, 18);
    const idxs = journal.entries.map((e) => e.idx);
    assert.deepEqual(idxs, [...idxs].sort((a, b) => a - b), "journal idx values are out of order");
    assert.equal(new Set(journal.entries.map((e) => e.tag)).size, journal.entries.length, "duplicate migration tags");
  });

  test("the rollback drops exactly the constraints the migration adds", () => {
    const down = read(ROLLBACK);
    const dropped = [...down.matchAll(/DROP CONSTRAINT(?: IF EXISTS)? (\w+)/g)].map((m) => m[1]);
    assert.deepEqual(
      [...dropped].sort(),
      ALL.map((c) => c.name).sort(),
      "the rollback drops a different set of constraints than the migration adds",
    );
    // `IF EXISTS` is the guard here. 0016 wraps its drops in a DO block and
    // reports with RAISE NOTICE, which says the same thing more noisily; both
    // are guarded, and an unguarded DROP fails on the second run.
    assert.equal(
      (down.match(/DROP CONSTRAINT IF EXISTS/g) ?? []).length,
      dropped.length,
      "an unguarded DROP CONSTRAINT makes the rollback fail on a second run",
    );
  });

  test("no constraint name is declared twice across schema files", () => {
    // Two declarations of one name produce a migration that fails with
    // "constraint already exists" on whichever database lost the race.
    const found = new Map();
    for (const { file, source } of schemaSources()) {
      for (const { name } of ALL) {
        if (!declares(source, name)) continue;
        assert.ok(!found.has(name), `${name} declared in both ${found.get(name)} and ${file}`);
        found.set(name, file);
      }
    }
    assert.equal(found.size, ALL.length, "some invariants are declared in no schema file at all");
  });
});
