// Deletes orphaned rows that block `drizzle-kit push` from applying schema
// changes (e.g. adding ON DELETE CASCADE to user_quest_progress.user_id).
// Idempotent and safe: only rows that already violate an existing foreign
// key are removed — unreachable garbage data, nothing else.
//
// Instead of targeting a single table, this sweeps EVERY single-column
// foreign key in the public schema, so the next orphaned table cannot
// fail the push either. Verified against PostgreSQL 18.
//
// Mirrors the connection-URL preference of drizzle.config.ts.
import pg from "pg";

const { Client } = pg;

const connectionUrl = process.env.VERCEL
  ? (process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL)
  : (process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING);

if (!connectionUrl) {
  console.error(
    "DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING must be set",
  );
  process.exit(1);
}

const ORPHAN_SWEEP_SQL = `
DO $$
DECLARE
  fk record;
  deleted_count bigint;
BEGIN
  FOR fk IN
    SELECT
      cns.nspname  AS child_schema,
      cls.relname  AS child_table,
      att.attname  AS child_column,
      pns.nspname  AS parent_schema,
      pcls.relname AS parent_table,
      patt.attname AS parent_column,
      con.conname  AS constraint_name
    FROM pg_constraint con
    JOIN pg_class     cls  ON cls.oid  = con.conrelid
    JOIN pg_namespace cns  ON cns.oid  = cls.relnamespace
    JOIN pg_class     pcls ON pcls.oid = con.confrelid
    JOIN pg_namespace pns  ON pns.oid  = pcls.relnamespace
    JOIN pg_attribute att  ON att.attrelid  = con.conrelid
                           AND att.attnum   = con.conkey[1]
    JOIN pg_attribute patt ON patt.attrelid = con.confrelid
                           AND patt.attnum  = con.confkey[1]
    WHERE con.contype = 'f'
      AND cns.nspname = 'public'
      AND array_length(con.conkey, 1) = 1
      AND array_length(con.confkey, 1) = 1
  LOOP
    EXECUTE format(
      'DELETE FROM %I.%I t
       WHERE t.%I IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM %I.%I p WHERE p.%I = t.%I)',
      fk.child_schema, fk.child_table, fk.child_column,
      fk.parent_schema, fk.parent_table, fk.parent_column, fk.child_column
    );
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    IF deleted_count > 0 THEN
      RAISE NOTICE 'cleanup-orphans: deleted % orphaned row(s) from %.% (constraint %)',
        deleted_count, fk.child_schema, fk.child_table, fk.constraint_name;
    END IF;
  END LOOP;
END $$;
`;

const client = new Client({ connectionString: connectionUrl });

client.on("notice", (msg) => console.log(msg.message));

try {
  await client.connect();
  await client.query(ORPHAN_SWEEP_SQL);
  console.log("cleanup-orphans: sweep complete, no orphaned rows remain");
} catch (err) {
  console.error("cleanup-orphans: failed to clean orphaned rows:", err);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
