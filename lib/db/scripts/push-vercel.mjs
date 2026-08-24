// Vercel build wrapper for database schema push.
//
// Production deploys must have a database URL and must apply the schema. Preview
// deployments in this repo can run without database env vars (Vercel often does
// not expose production Neon secrets to PR previews); in that case we skip only
// the DB push so the static/frontend build can still be validated.
import { spawnSync } from "node:child_process";

if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
  console.warn(
    `db:push:vercel: skipping schema push for ${process.env.VERCEL_ENV ?? "preview"} deployment; production deploys still enforce Neon schema sync.`,
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

// Do not run drizzle-kit here. It prompts (unique/truncate) and cannot
// confirm in a Vercel build. cleanup-orphans applies the known safe patches.
const result = spawnSync("node", ["./scripts/cleanup-orphans.mjs"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
