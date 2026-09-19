// Vercel build wrapper for database schema sync.
//
// Production deploys must have a database URL and must bring the schema up to
// date BEFORE the new code goes live. Preview deployments can run without
// database env vars (Vercel often does not expose production Neon secrets to
// PR previews); in that case we skip only the DB step so the static/frontend
// build can still be validated.
//
// History, because this file has been wrong before and the failure is silent:
//
//   1. It ran `drizzle-kit push`. That prompts on UNIQUE/truncate decisions,
//      cannot answer in a build, and exited 0 without applying anything.
//   2. It ran only `cleanup-orphans.mjs`, a hand-written list of patches. Any
//      schema change nobody copied into the list never reached production.
//      That is how `users.deletion_requested_at` (migration 0017) went missing
//      and every sign-in failed with "could not load your session".
//
// Now: cleanup-orphans still runs first (data hygiene the constraints depend
// on), then `sync-schema.mjs` applies every additive difference between the
// canonical Drizzle schema and the live database — new tables, columns,
// indexes and constraints — and never anything destructive. Differences that
// need human judgement are reported and do not block the deploy.
import { spawnSync } from "node:child_process";

if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
  console.warn(
    `db:push:vercel: skipping schema sync for ${process.env.VERCEL_ENV ?? "preview"} deployment; production deploys still enforce Neon schema sync.`,
  );
  process.exit(0);
}

const connectionUrl = process.env.VERCEL
  ? (process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL)
  : (process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING);

if (!connectionUrl) {
  const message =
    "DATABASE_URL, POSTGRES_URL, or POSTGRES_URL_NON_POOLING is not set";
  console.error(`db:push:vercel: ${message}. Production deploys must be connected to Neon.`);
  process.exit(1);
}

for (const script of ["./scripts/cleanup-orphans.mjs", "./scripts/sync-schema.mjs"]) {
  const result = spawnSync(process.execPath, [script], { stdio: "inherit", env: process.env });
  if ((result.status ?? 1) !== 0) {
    console.error(`db:push:vercel: ${script} failed (exit ${result.status ?? "signal"}). The schema is NOT confirmed in sync; refusing to deploy code on top of it.`);
    process.exit(result.status ?? 1);
  }
}
