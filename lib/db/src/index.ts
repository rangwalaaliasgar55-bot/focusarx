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
  console.error(
    "[db] DATABASE_URL (or POSTGRES_URL) is not set. All database queries will fail."
  );
}

/**
 * Read the sslmode query param from the URL.
 * Returns null if the URL can't be parsed or the param isn't present.
 */
function getSslMode(url: string): string | null {
  try {
    return new URL(url).searchParams.get("sslmode");
  } catch {
    return null;
  }
}

/**
 * Strip SSL-related query params from a connection string.
 * Only called when we are taking over SSL handling via the Pool `ssl` option —
 * never called when sslmode=disable, so that instruction reaches pg intact.
 */
function stripSslParams(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of ["sslmode", "sslrootcert", "sslcert", "sslkey", "channel_binding"]) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const sslMode = getSslMode(rawConnectionString);

// sslmode=disable means the server explicitly does not support SSL — never
// override that.  For all other cases (require, verify-full, no param, or
// we're on Vercel/Supabase/a non-local host) we handle SSL ourselves via the
// Pool `ssl` option and strip the param from the URL to avoid conflicts.
const useSsl =
  sslMode !== "disable" &&
  (
    process.env.VERCEL === "1" ||
    rawConnectionString.includes("supabase") ||
    (sslMode !== null && sslMode !== "") ||
    (!rawConnectionString.includes("localhost") && !rawConnectionString.includes("127.0.0.1"))
  );

// Only strip SSL params when we're taking over SSL handling.  When useSsl is
// false (e.g. sslmode=disable or a plain localhost URL) leave the string alone.
const connectionString = (useSsl && rawConnectionString) ? stripSslParams(rawConnectionString) : rawConnectionString;

export const pool = new Pool({
  connectionString: connectionString || undefined,
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 15_000,
  // Verify the server certificate; encryption without identity verification is
  // vulnerable to an active network attacker.
  ssl: useSsl ? { rejectUnauthorized: true } : undefined,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
