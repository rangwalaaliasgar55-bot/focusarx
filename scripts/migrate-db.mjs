/**
 * Sync Prisma schema → SQLite and write migrate.log (for troubleshooting).
 * Run: node scripts/migrate-db.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logPath = path.join(root, "migrate.log");
const log = [];

function run(label, cmd) {
  log.push(`\n=== ${label} ===\n> ${cmd}\n`);
  try {
    const out = execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    log.push(out);
    return true;
  } catch (e) {
    log.push(e.stdout ?? "");
    log.push(e.stderr ?? "");
    log.push(`Error: ${e.message}\n`);
    return false;
  }
}

const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  log.push(`\n.env:\n${fs.readFileSync(envPath, "utf8")}\n`);
}

for (const rel of ["dev.db", "prisma/dev.db"]) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) {
    const st = fs.statSync(p);
    log.push(`Found ${rel}: ${st.size} bytes\n`);
  } else {
    log.push(`Missing ${rel}\n`);
  }
}

const ok =
  run("prisma db push", "npx prisma db push --accept-data-loss") &&
  run("prisma generate", "npx prisma generate");

fs.writeFileSync(logPath, log.join(""), "utf8");
console.log(ok ? `OK — see ${logPath}` : `FAILED — see ${logPath}`);
process.exit(ok ? 0 : 1);
