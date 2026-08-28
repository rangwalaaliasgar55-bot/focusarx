import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  max: 1,
  connectionTimeoutMillis: 15_000,
});

try {
  const r = await pool.query("select 1 as ok");
  console.log("connect:", r.rows[0]?.ok === 1 ? "ok" : "fail");
  const tables = await pool.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename limit 20",
  );
  console.log("tables:", tables.rows.map((x) => x.tablename).join(", ") || "(none)");
} catch (err) {
  console.error("error:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await pool.end();
}
