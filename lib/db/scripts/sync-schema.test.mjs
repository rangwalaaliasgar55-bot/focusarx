import assert from "node:assert/strict";
import { test } from "node:test";
import {
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
