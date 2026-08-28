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
 * Convert a Neon pooler URL to the direct (non-pooler) endpoint.
 *
 * Neon's `-pooler` hostnames use transaction-mode connection pooling, which
 * does NOT support PostgreSQL prepared statements.  Drizzle ORM (and the
 * `pg` driver's automatic statement preparation) rely on prepared statements,
 * so every query fails on the pooler endpoint.
 *
 * The direct endpoint uses session-mode pooling which supports prepared
 * statements normally.  We detect the `-pooler` hostname and strip the suffix
 * so the pool connects to the right endpoint.
 */
function toNeonDirectUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Neon pooler hostnames look like: ep-<name>-pooler.c-<shard>.<region>.aws.neon.tech
    // Direct hostnames look like:     ep-<name>.<region>.aws.neon.tech
    if (parsed.hostname.includes("-pooler.")) {
      // Strip "-pooler" from the hostname, and remove the shard segment (.c-N)
      // e.g. ep-foo-pooler.c-1.us-east-1.aws.neon.tech → ep-foo.us-east-1.aws.neon.tech
      const direct = parsed.hostname
        .replace("-pooler", "")
        .replace(/\.c-\d+\./, ".");
      parsed.hostname = direct;
      console.log(`[db] Converted Neon pooler URL to direct endpoint: ${direct}`);
      return parsed.toString();
    }
  } catch {
    // Not a URL or can't parse — return as-is
  }
  return url;
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

// Auto-convert pooler → direct before resolving SSL.
const directConnectionString = toNeonDirectUrl(rawConnectionString);

const sslMode = getSslMode(directConnectionString);

// sslmode=disable means the server explicitly does not support SSL — never
// override that.  For all other cases (require, verify-full, no param, or
// we're on Vercel/Supabase/a non-local host) we handle SSL ourselves via the
// Pool `ssl` option and strip the param from the URL to avoid conflicts.
const useSsl =
  sslMode !== "disable" &&
  (
    process.env.VERCEL === "1" ||
    directConnectionString.includes("supabase") ||
    (sslMode !== null && sslMode !== "") ||
    (!directConnectionString.includes("localhost") && !directConnectionString.includes("127.0.0.1"))
  );

// Only strip SSL params when we're taking over SSL handling.  When useSsl is
// false (e.g. sslmode=disable or a plain localhost URL) leave the string alone.
const connectionString = (useSsl && directConnectionString) ? stripSslParams(directConnectionString) : directConnectionString;

export const pool = new Pool({
  connectionString: connectionString || undefined,
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 15_000,
  // Verify the server certificate; encryption without identity verification is
  // vulnerable to an active network attacker.
  ssl: useSsl ? { rejectUnauthorized: true } : undefined,
} as pg.PoolConfig);

export const db = drizzle(pool, { schema });

export * from "./schema";
