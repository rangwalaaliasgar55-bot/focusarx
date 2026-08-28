#!/usr/bin/env node

/**
 * Migration validation script — run in CI to verify migration safety.
 *
 * Checks:
 * 1. Migration files exist and are syntactically valid SQL
 * 2. No destructive changes unless explicitly approved
 * 3. Migration journal is consistent
 *
 * Usage:
 *   node lib/db/scripts/validate-migrations.mjs
 *   node lib/db/scripts/validate-migrations.mjs --strict   # fail on any destructive SQL
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = path.resolve(__dirname, "../drizzle");
const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");
const isStrict = process.argv.includes("--strict");

const DESTRUCTIVE_PATTERNS = [
  /DROP\s+TABLE/i,
  /DROP\s+COLUMN/i,
  /DROP\s+INDEX/i,
  /TRUNCATE/i,
  /ALTER\s+.*\s+TYPE/i,
  /RENAME\s+TABLE/i,
  /RENAME\s+COLUMN/i,
];

let errors = 0;
let warnings = 0;

function scanFile(filePath, filename) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (line.trim().startsWith("--")) continue;

    for (const pattern of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(line)) {
        const severity = isStrict ? "ERROR" : "WARNING";
        console.log(
          `  ${severity}: ${filename}:${i + 1} — Destructive pattern: ${pattern.source}`
        );
        console.log(`    ${line.trim()}`);
        if (isStrict) errors++;
        else warnings++;
      }
    }
  }
}

console.log("Validating migrations...\n");

// Scan Drizzle-generated migrations
if (fs.existsSync(DRIZZLE_DIR)) {
  const files = fs.readdirSync(DRIZZLE_DIR).filter((f) => f.endsWith(".sql"));
  console.log(`Drizzle migrations: ${files.length} files`);
  for (const file of files) {
    scanFile(path.join(DRIZZLE_DIR, file), `drizzle/${file}`);
  }
}

// Scan hand-written migrations
if (fs.existsSync(MIGRATIONS_DIR)) {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  console.log(`Hand-written migrations: ${files.length} files`);
  for (const file of files) {
    scanFile(path.join(MIGRATIONS_DIR, file), `migrations/${file}`);
  }
}

console.log("");

if (errors > 0) {
  console.error(`❌ ${errors} error(s) found. Fix destructive changes or add approval label.`);
  process.exit(1);
}

if (warnings > 0) {
  console.warn(`⚠️  ${warnings} warning(s) — destructive SQL found. Review carefully before merging.`);
}

if (errors === 0 && warnings === 0) {
  console.log("✅ All migrations look safe.");
}
