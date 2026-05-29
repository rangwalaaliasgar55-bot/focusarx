import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

/** Prefer direct Postgres on Vercel — pooler transaction mode breaks prepared statements. */
export function resolveDatabaseUrl(): string {
  const isVercel = Boolean(process.env.VERCEL);
  if (isVercel) {
    return (
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      process.env.POSTGRES_URL ??
      ""
    );
  }
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    ""
  );
}

const rawConnectionString = resolveDatabaseUrl();

if (!rawConnectionString) {
  throw new Error(
    "DATABASE_URL (or POSTGRES_URL) must be set. Did you forget to provision a database?",
  );
}

/**
 * Strip SSL query params from the connection string before passing it to the
 * Pool. When `sslmode=verify-full` (or similar) is present in the URL *and*
 * we also pass an explicit `ssl` object, pg emits a Node.js security warning
 * and the two settings conflict — potentially causing 500 errors. We own the
 * SSL configuration entirely through the `ssl` Pool option below.
 */
function stripSslParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const connectionString = stripSslParams(rawConnectionString);

const useSsl =
  process.env.VERCEL === "1" ||
  rawConnectionString.includes("supabase") ||
  rawConnectionString.includes("sslmode=") ||
  (!rawConnectionString.includes("localhost") && !rawConnectionString.includes("127.0.0.1"));

export const pool = new Pool({
  connectionString,
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 15_000,
  // rejectUnauthorized:false trusts Neon/Vercel/Supabase certs without needing
  // a local CA bundle — safe because the connection is already TLS-encrypted.
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
