// Deletes orphaned rows that block `drizzle-kit push` from applying schema
// changes (e.g. adding ON DELETE CASCADE to user_quest_progress.user_id).
// Idempotent and safe: only rows whose referenced user no longer exists
// are removed. Mirrors the connection-URL preference of drizzle.config.ts.
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

const client = new Client({ connectionString: connectionUrl });

try {
  await client.connect();

  const cleanup = await client.query(`
    DELETE FROM public.user_quest_progress up
    WHERE NOT EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = up.user_id
    )
  `);

  console.log(
    `cleanup-orphans: removed ${cleanup.rowCount ?? 0} orphaned user_quest_progress row(s)`,
  );
} finally {
  await client.end().catch(() => {});
}
