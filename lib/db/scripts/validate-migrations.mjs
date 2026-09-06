#!/usr/bin/env node
/**
 * Validate migration files, numbering and journal consistency without a DB.
 * Destructive SQL is a warning unless --strict is passed. This is a structural
 * check, NOT a SQL parser; replay migrations on an empty test DB to validate SQL.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const DESTRUCTIVE_PATTERNS = [/DROP\s+TABLE/i, /DROP\s+COLUMN/i, /DROP\s+INDEX/i, /TRUNCATE/i, /ALTER\s+.*\s+TYPE/i, /RENAME\s+(TABLE|COLUMN)/i];
const MIGRATION_NAME = /^\d{4}_[a-zA-Z0-9_]+\.sql$/;

export function validateMigrations({
  drizzleDir = path.resolve(dirname, "../drizzle"),
  migrationsDir = path.resolve(dirname, "../migrations"),
  strict = false,
} = {}) {
  const errors = [];
  const warnings = [];
  const filesIn = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort() : [];
  const drizzleFiles = filesIn(drizzleDir);
  const handWrittenFiles = filesIn(migrationsDir);
  const numbered = drizzleFiles.filter((file) => /^\d/.test(file));
  if (numbered.length === 0) errors.push("No numbered Drizzle migrations found.");

  for (const [label, dir, files] of [["drizzle", drizzleDir, drizzleFiles], ["migrations", migrationsDir, handWrittenFiles]]) {
    const versions = new Set();
    for (const file of files) {
      if (/^\d/.test(file)) {
        if (!MIGRATION_NAME.test(file)) errors.push(`${label}/${file}: expected NNNN_description.sql.`);
        const version = file.slice(0, 4);
        if (versions.has(version)) errors.push(`${label}: duplicate migration version ${version}.`);
        versions.add(version);
      }
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      if (!sql.trim()) errors.push(`${label}/${file}: migration is empty.`);
      // Preserve line numbers while ignoring block and line comments.
      const lines = sql.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " ")).split("\n");
      lines.forEach((line, index) => {
        if (line.trim().startsWith("--")) return;
        if (DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(line))) {
          (strict ? errors : warnings).push(`${label}/${file}:${index + 1}: review destructive SQL: ${line.trim()}`);
        }
      });
    }
  }

  try {
    const journal = JSON.parse(fs.readFileSync(path.join(drizzleDir, "meta/_journal.json"), "utf8"));
    if (!Array.isArray(journal.entries)) throw new Error("entries must be an array");
    const tags = new Set();
    let previousWhen = -1;
    for (const [index, entry] of journal.entries.entries()) {
      if (!entry || entry.idx !== index) errors.push(`Journal entry ${index}: idx must be ${index}.`);
      if (!entry || typeof entry.tag !== "string" || !MIGRATION_NAME.test(`${entry.tag}.sql`)) {
        errors.push(`Journal entry ${index}: invalid migration tag.`);
        continue;
      }
      if (!entry.tag.startsWith(`${String(index).padStart(4, "0")}_`)) errors.push(`Journal entry ${index}: tag version does not match idx.`);
      if (tags.has(entry.tag)) errors.push(`Journal: duplicate tag ${entry.tag}.`);
      tags.add(entry.tag);
      if (!drizzleFiles.includes(`${entry.tag}.sql`)) errors.push(`Journal references missing migration ${entry.tag}.sql.`);
      if (!Number.isFinite(entry.when) || entry.when <= previousWhen) errors.push(`Journal entry ${index}: timestamps must increase.`);
      previousWhen = entry.when;
    }
    for (const file of numbered) {
      if (!tags.has(file.slice(0, -4))) errors.push(`Unjournaled migration: ${file}.`);
    }
  } catch (error) {
    errors.push(`Cannot read migration journal: ${error.message}`);
  }
  return { errors, warnings, drizzleCount: drizzleFiles.length, handWrittenCount: handWrittenFiles.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateMigrations({ strict: process.argv.includes("--strict") });
  console.log(`Migration files: ${result.drizzleCount} Drizzle, ${result.handWrittenCount} hand-written.`);
  for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  console.log(`${result.errors.length} error(s), ${result.warnings.length} warning(s).`);
  process.exitCode = result.errors.length ? 1 : 0;
}
