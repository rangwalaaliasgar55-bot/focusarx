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

const connectionString = resolveDatabaseUrl();

if (!connectionString) {
  throw new Error(
    "DATABASE_URL (or POSTGRES_URL) must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString,
  max: process.env.VERCEL ? 1 : 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 15_000,
  ssl: connectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
