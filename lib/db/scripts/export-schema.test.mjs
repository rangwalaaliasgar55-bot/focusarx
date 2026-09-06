import assert from "node:assert/strict";
import { test } from "node:test";
import { makeIdempotentSql } from "./export-schema.mjs";

test("makes table and index creation repeatable without dropping data", () => {
  const sql = 'CREATE TABLE "items" ("id" text);\nCREATE INDEX "item_idx" ON "items" ("id");\nCREATE UNIQUE INDEX "item_unique" ON "items" ("id");\n';
  const result = makeIdempotentSql(sql);
  assert.match(result, /CREATE TABLE IF NOT EXISTS "items"/);
  assert.match(result, /CREATE INDEX IF NOT EXISTS "item_idx"/);
  assert.match(result, /CREATE UNIQUE INDEX IF NOT EXISTS "item_unique"/);
  assert.doesNotMatch(result, /DROP|DELETE|TRUNCATE/);
});

test("guards foreign keys by both table and constraint name and preserves statement order", () => {
  const sql = 'CREATE TABLE "parents" ("id" text);\nALTER TABLE "children" ADD CONSTRAINT "child_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade;\n';
  const result = makeIdempotentSql(sql);
  assert.match(result, /conrelid = '"public"\."children"'::regclass AND conname = 'child_parent_fk'/);
  assert.ok(result.indexOf('CREATE TABLE') < result.indexOf('ADD CONSTRAINT'));
  assert.match(result, /ON DELETE cascade;/);
});
