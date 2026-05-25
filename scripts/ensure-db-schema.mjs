/**
 * Applies prisma/schema.prisma to the SQLite database.
 * Run: node scripts/ensure-db-schema.mjs
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const dbs = ["dev.db", "prisma/dev.db"].map((p) => path.join(root, p));
const found = dbs.filter((p) => existsSync(p));
console.log("Database files:", found.length ? found.join(", ") : "(none yet — will be created on push)");

console.log("\n→ prisma db push\n");
execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });

console.log("\n→ prisma generate\n");
execSync("npx prisma generate", { stdio: "inherit" });

console.log("\nSchema sync complete. Restart: npm run dev");
