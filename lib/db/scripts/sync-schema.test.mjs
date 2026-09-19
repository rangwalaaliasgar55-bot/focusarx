import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyPlan,
  checkColumns,
  needsBackfill,
  normaliseConstraint,
  parseSchemaSql,
  planSync,
  splitStatements,
} from "./sync-schema.mjs";

/**
 * The planner is what stands between "the schema changed" and "production got
 * the change", so its rules are pinned here: additive things are applied,
 * destructive things are never generated, and the one genuinely ambiguous
 * case (NOT NULL without a default on a populated table) is handed to a human.
 */

const SCHEMA = `CREATE TABLE "users" (
\t"id" text PRIMARY KEY NOT NULL,
\t"email" text NOT NULL,
\t"role" text DEFAULT 'user' NOT NULL,
\t"deletion_requested_at" timestamp,
\tCONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "user_wallets" (
\t"user_id" text PRIMARY KEY NOT NULL,
\t"coins" integer DEFAULT 0 NOT NULL,
\t"nickname" text NOT NULL,
\tCONSTRAINT "user_wallets_coins_non_negative" CHECK ("user_wallets"."coins" >= 0)
);

CREATE TABLE "webhook_endpoints" (
\t"id" text PRIMARY KEY NOT NULL,
\t"user_id" text NOT NULL,
\t"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "user_wallets" ADD CONSTRAINT "user_wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "users_deletion_requested_at_idx" ON "users" USING btree ("deletion_requested_at");
CREATE UNIQUE INDEX "webhook_endpoints_user_idx" ON "webhook_endpoints" USING btree ("user_id");
`;

function liveWith({ tables = {}, indexes = [], constraints = {} } = {}) {
  const map = new Map();
  for (const [name, spec] of Object.entries(tables)) {
    map.set(name, {
      columns: new Set(spec.columns),
      constraintNames: new Set((constraints[name] ?? []).map((c) => c.name)),
      rowCount: spec.rowCount ?? 0,
    });
  }
  return { tables: map, indexes: new Set(indexes), constraints: new Map(Object.entries(constraints)) };
}

test("splits the export into whole statements, keeping CREATE TABLE bodies together", () => {
  const statements = splitStatements(SCHEMA);
  assert.equal(statements.length, 7);
  assert.match(statements[0], /^CREATE TABLE "users" \(\n[\s\S]*\n\);$/);
  assert.match(statements[6], /^CREATE UNIQUE INDEX/);
});

test("parses tables, columns, inline constraints, FKs and indexes", () => {
  const parsed = parseSchemaSql(SCHEMA);
  assert.deepEqual([...parsed.tables.keys()], ["users", "user_wallets", "webhook_endpoints"]);
  assert.equal(parsed.tables.get("users").columns.get("deletion_requested_at"), "timestamp");
  assert.equal(parsed.tables.get("users").columns.get("role"), "text DEFAULT 'user' NOT NULL");
  assert.deepEqual(parsed.tables.get("users").constraints, [{ name: "users_email_unique", kind: "UNIQUE", definition: '("email")' }]);
  assert.equal(parsed.tables.get("user_wallets").constraints[0].kind, "CHECK");
  assert.equal(parsed.constraints.length, 2);
  assert.equal(parsed.constraints[1].name, "webhook_endpoints_user_id_users_id_fk");
  assert.equal(parsed.indexes.length, 2);
  assert.equal(parsed.indexes[1].unique, true);
});

test("refuses to guess at SQL it does not recognise", () => {
  assert.throws(() => parseSchemaSql('DROP TABLE "users";\n'), /unrecognised statement/);
});

test("needsBackfill: only NOT NULL without a default and not a primary key", () => {
  assert.equal(needsBackfill("text NOT NULL"), true);
  assert.equal(needsBackfill("text DEFAULT 'x' NOT NULL"), false);
  assert.equal(needsBackfill("text PRIMARY KEY NOT NULL"), false);
  assert.equal(needsBackfill("timestamp"), false);
});

test("plans the production incident: adds the missing column, table, index and FK — nothing else", () => {
  const live = liveWith({
    tables: {
      users: { columns: ["id", "email", "role"] },
      user_wallets: { columns: ["user_id", "coins", "nickname"], rowCount: 12 },
    },
    indexes: ["users_email_unique", "user_wallets_pkey", "users_pkey"],
    constraints: {
      users: [{ name: "users_email_unique", kind: "UNIQUE", definition: "(email)" }],
      user_wallets: [
        { name: "user_wallets_coins_non_negative", kind: "CHECK", definition: "((coins >= 0))" },
        { name: "user_wallets_user_id_users_id_fk", kind: "FOREIGN KEY", definition: "(user_id) REFERENCES users(id) ON DELETE CASCADE" },
      ],
    },
  });
  const { statements, manual } = planSync(parseSchemaSql(SCHEMA), live);
  assert.deepEqual(manual, []);
  const kinds = statements.map((s) => `${s.kind}:${s.table}${s.name === s.table ? "" : `.${s.name}`}`);
  assert.deepEqual(kinds, [
    "add_column:users.deletion_requested_at",
    "create_table:webhook_endpoints",
    "create_index:users.users_deletion_requested_at_idx",
    "create_unique_index:webhook_endpoints.webhook_endpoints_user_idx",
    "add_constraint:webhook_endpoints.webhook_endpoints_user_id_users_id_fk",
  ]);
  assert.equal(statements[0].sql, 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp;');
  assert.match(statements[1].sql, /^CREATE TABLE IF NOT EXISTS "webhook_endpoints"/);
  assert.match(statements[2].sql, /^CREATE INDEX IF NOT EXISTS/);
  assert.match(statements[4].sql, /IF NOT EXISTS \(SELECT 1 FROM pg_constraint[\s\S]*ADD CONSTRAINT "webhook_endpoints_user_id_users_id_fk"/);
  for (const s of statements) assert.doesNotMatch(s.sql, /DROP|TRUNCATE|ALTER COLUMN|RENAME/i);
});

test("does not add a NOT NULL column without a default to a populated table", () => {
  const live = liveWith({
    tables: {
      users: { columns: ["id", "email", "role", "deletion_requested_at"] },
      user_wallets: { columns: ["user_id", "coins"], rowCount: 3 },
      webhook_endpoints: { columns: ["id", "user_id", "created_at"] },
    },
    indexes: ["users_deletion_requested_at_idx", "webhook_endpoints_user_idx"],
    constraints: {
      users: [{ name: "users_email_unique", kind: "UNIQUE", definition: "(email)" }],
      user_wallets: [
        { name: "user_wallets_coins_non_negative", kind: "CHECK", definition: "((coins >= 0))" },
        { name: "user_wallets_user_id_users_id_fk", kind: "FOREIGN KEY", definition: "(user_id) REFERENCES users(id) ON DELETE CASCADE" },
      ],
      webhook_endpoints: [{ name: "webhook_endpoints_user_id_users_id_fk", kind: "FOREIGN KEY", definition: "(user_id) REFERENCES users(id) ON DELETE CASCADE" }],
    },
  });
  const { statements, manual } = planSync(parseSchemaSql(SCHEMA), live);
  assert.deepEqual(statements, []);
  assert.equal(manual.length, 1);
  assert.match(manual[0], /user_wallets\.nickname/);

  // The same column on an EMPTY table is safe, and is added.
  live.tables.get("user_wallets").rowCount = 0;
  const again = planSync(parseSchemaSql(SCHEMA), live);
  assert.deepEqual(again.manual, []);
  assert.equal(again.statements.length, 1);
  assert.equal(again.statements[0].name, "nickname");
});

test("treats an equivalent constraint under a different name as already present", () => {
  // Migration 0012 named the FK `token_ledger_user_id_fkey`; drizzle calls it
  // `token_ledger_user_id_users_id_fk`. Same rule; adding both is pointless.
  assert.equal(
    normaliseConstraint("FOREIGN KEY", '("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action'),
    normaliseConstraint("FOREIGN KEY", "(user_id) REFERENCES users(id) ON DELETE CASCADE"),
  );
  assert.notEqual(
    normaliseConstraint("FOREIGN KEY", '("user_id") REFERENCES "public"."users"("id") ON DELETE cascade'),
    normaliseConstraint("FOREIGN KEY", "(user_id) REFERENCES users(id) ON DELETE SET NULL"),
  );
  assert.equal(
    normaliseConstraint("UNIQUE", '("idempotency_key")'),
    normaliseConstraint("UNIQUE", "(idempotency_key)"),
  );
});

test("compares CHECK constraints by the columns they govern", () => {
  assert.equal(checkColumns('("user_wallets"."coins" >= 0)'), checkColumns("((coins >= 0))"));
  assert.equal(
    checkColumns('("webhook_deliveries"."status" IN (\'pending\', \'sending\'))'),
    checkColumns("((status = ANY (ARRAY['pending'::text, 'sending'::text])))"),
  );
  assert.notEqual(checkColumns('("t"."coins" >= 0)'), checkColumns('("t"."total_xp" >= 0)'));
});

test("skips a constraint already enforced by a same-named index", () => {
  const live = liveWith({
    tables: { users: { columns: ["id", "email", "role", "deletion_requested_at"] } },
    indexes: ["users_email_unique", "users_deletion_requested_at_idx"],
    constraints: { users: [] },
  });
  const desired = parseSchemaSql(SCHEMA.split("\n\nCREATE TABLE \"user_wallets\"")[0] + "\n");
  const { statements } = planSync(desired, live);
  assert.deepEqual(statements, []);
});

// ─── Runner ──────────────────────────────────────────────────────────────────
//
// The runner decides what a failed statement means for the deploy. The rule:
// a table or column the code needs is fatal; a constraint or index the data
// does not yet satisfy is a warning, and CHECK/FK constraints are still added
// NOT VALID so new writes are enforced. Exercised with a scripted client so the
// classification is pinned without a database.

const quiet = { log() {}, warn() {}, error() {} };

/** A client whose non-transaction statements fail in the scripted order, then succeed. */
function scriptedClient(script) {
  const client = { sql: [], async query(text) {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] };
    client.sql.push(text);
    const next = script.shift();
    if (next instanceof Error) throw next;
    return { rows: [] };
  } };
  return client;
}

function pgError(code, message = code) {
  return Object.assign(new Error(message), { code });
}

function constraintPlanFor(table, name, kind, definition) {
  const desired = parseSchemaSql(`CREATE TABLE "${table}" (\n\t"id" text PRIMARY KEY NOT NULL,\n\t"user_id" text NOT NULL,\n\t"coins" integer DEFAULT 0 NOT NULL,\n\tCONSTRAINT "${name}" ${kind} ${definition}\n);\n`);
  const live = liveWith({ tables: { [table]: { columns: ["id", "user_id", "coins"] } }, constraints: { [table]: [] } });
  return planSync(desired, live).statements;
}

test("plans a NOT VALID variant for CHECK and FOREIGN KEY constraints, never for UNIQUE", () => {
  const [check] = constraintPlanFor("user_wallets", "user_wallets_coins_non_negative", "CHECK", '("user_wallets"."coins" >= 0)');
  assert.match(check.sql, /ADD CONSTRAINT "user_wallets_coins_non_negative" CHECK \("user_wallets"."coins" >= 0\);/);
  assert.match(check.notValidSql, /CHECK \("user_wallets"."coins" >= 0\) NOT VALID;/);

  const [unique] = constraintPlanFor("user_emotes", "user_emotes_user_emote_unique", "UNIQUE", '("user_id","coins")');
  assert.equal(unique.notValidSql, undefined);

  const desired = parseSchemaSql(SCHEMA);
  const live = liveWith({
    tables: {
      users: { columns: ["id", "email", "role", "deletion_requested_at"] },
      user_wallets: { columns: ["user_id", "coins", "nickname"] },
      webhook_endpoints: { columns: ["id", "user_id", "created_at"] },
    },
    indexes: ["users_email_unique", "user_wallets_coins_non_negative", "users_deletion_requested_at_idx", "webhook_endpoints_user_idx"],
  });
  const fks = planSync(desired, live).statements.filter((s) => s.kind === "add_constraint");
  assert.equal(fks.length, 2);
  for (const fk of fks) assert.match(fk.notValidSql, /REFERENCES "public"."users"\("id"\) ON DELETE cascade ON UPDATE no action NOT VALID;/);
});

test("falls back to NOT VALID when existing rows violate a CHECK or FK, and reports it", async () => {
  const [check] = constraintPlanFor("user_wallets", "user_wallets_coins_non_negative", "CHECK", '("user_wallets"."coins" >= 0)');
  const client = scriptedClient([pgError("23514", "check constraint is violated by some row")]);
  const result = await applyPlan(client, [check], { log: quiet });
  assert.equal(client.sql.length, 2);
  assert.equal(client.sql[0], check.sql);
  assert.equal(client.sql[1], check.notValidSql);
  assert.deepEqual({ applied: result.applied, failures: result.failures, warnings: result.warnings }, { applied: 1, failures: [], warnings: [] });
  assert.equal(result.notValid.length, 1);
  assert.equal(result.notValid[0].name, "user_wallets_coins_non_negative");
});

test("a UNIQUE constraint the data violates is a warning, not a failed deploy", async () => {
  const [unique] = constraintPlanFor("user_emotes", "user_emotes_user_emote_unique", "UNIQUE", '("user_id","coins")');
  const client = scriptedClient([pgError("23505", "could not create unique index")]);
  const result = await applyPlan(client, [unique], { log: quiet });
  assert.equal(client.sql.length, 1);
  assert.equal(result.applied, 0);
  assert.deepEqual(result.failures, []);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].code, "23505");
});

test("a table or column that cannot be created is a failure", async () => {
  const desired = parseSchemaSql(SCHEMA);
  const live = liveWith({
    tables: { users: { columns: ["id", "email", "role"] }, user_wallets: { columns: ["user_id", "coins", "nickname"] } },
    indexes: ["users_email_unique", "user_wallets_coins_non_negative", "user_wallets_user_id_users_id_fk"],
  });
  const { statements } = planSync(desired, live);
  const structural = statements.filter((s) => s.kind === "add_column" || s.kind === "create_table");
  assert.equal(structural.length, 2);

  const client = scriptedClient([pgError("42501", "must be owner of table users"), pgError("42501", "permission denied for schema public")]);
  const result = await applyPlan(client, structural, { log: quiet });
  assert.equal(result.failures.length, 2);
  assert.deepEqual(result.failures.map((f) => f.kind).sort(), ["add_column", "create_table"]);
  assert.deepEqual(result.warnings, []);

  // An index that cannot be built, on the other hand, is only a warning.
  const index = statements.find((s) => s.kind === "create_index");
  const again = scriptedClient([pgError("42501", "must be owner of table users")]);
  const indexResult = await applyPlan(again, [index], { log: quiet });
  assert.deepEqual(indexResult.failures, []);
  assert.equal(indexResult.warnings.length, 1);
});

test("retries a statement that lost a lock race before giving up", async () => {
  const [check] = constraintPlanFor("user_wallets", "user_wallets_coins_non_negative", "CHECK", '("user_wallets"."coins" >= 0)');
  const client = scriptedClient([pgError("55P03", "lock timeout"), pgError("55P03", "lock timeout")]);
  const result = await applyPlan(client, [check], { log: quiet, retryDelayMs: 0 });
  assert.equal(client.sql.length, 3);
  assert.equal(result.applied, 1);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.warnings, []);
});

test("dry-run touches nothing", async () => {
  const [check] = constraintPlanFor("user_wallets", "user_wallets_coins_non_negative", "CHECK", '("user_wallets"."coins" >= 0)');
  const client = scriptedClient([]);
  const result = await applyPlan(client, [check], { dryRun: true, log: quiet });
  assert.deepEqual(client.sql, []);
  assert.deepEqual(result, { applied: 0, failures: [], warnings: [], notValid: [] });
});
