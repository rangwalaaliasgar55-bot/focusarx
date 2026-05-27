import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type Db = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;
let dbInstance: Db | undefined;

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. In Vercel: Project Settings → Environment Variables → add your Postgres connection string.",
    );
  }
  return url;
}

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl() });
  }
  return pool;
}

function getDbInstance(): Db {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = getDbInstance();
    const value = Reflect.get(instance as object, prop, instance);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});

export { getPool as pool };

export * from "./schema";
