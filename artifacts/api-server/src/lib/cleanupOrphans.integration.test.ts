import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe.runIf(Boolean(process.env.DATABASE_URL))("cleanup-orphans housekeeping", () => {
  it("prunes expired data without comparing text day keys to timestamps", async () => {
    const { pool } = await import("@workspace/db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Temporary tables keep this regression isolated from application data.
      await client.query(`
        CREATE TEMP TABLE password_reset_tokens (id text, used_at timestamp, expires_at timestamp, created_at timestamp) ON COMMIT DROP;
        CREATE TEMP TABLE ai_call_log (id text, created_at timestamp) ON COMMIT DROP;
        CREATE TEMP TABLE ai_budget_state (id text, day text) ON COMMIT DROP;
        INSERT INTO password_reset_tokens VALUES
          ('old', now() - interval '10 days', now() - interval '9 days', now() - interval '11 days'),
          ('new', NULL, now() + interval '1 day', now());
        INSERT INTO ai_call_log VALUES ('old', now() - interval '91 days'), ('new', now());
        INSERT INTO ai_budget_state VALUES
          ('old', to_char(now() - interval '31 days', 'YYYY-MM-DD')),
          ('new', to_char(now(), 'YYYY-MM-DD'));
      `);
      const source = readFileSync(new URL("../../../../lib/db/scripts/cleanup-orphans.mjs", import.meta.url), "utf8");
      const block = source.match(/const STALE_ROWS_PURGE_SQL = `([\s\S]*?)`;/)?.[1];
      expect(block).toBeTruthy();
      await client.query(block!.replaceAll("public.", "pg_temp."));
      for (const table of ["password_reset_tokens", "ai_call_log", "ai_budget_state"]) {
        const { rows } = await client.query(`SELECT id FROM pg_temp.${table}`);
        expect(rows).toEqual([{ id: "new" }]);
      }
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
