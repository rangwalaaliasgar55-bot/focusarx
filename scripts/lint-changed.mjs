// Incremental lint gate. Full-repo lint still has a tracked legacy backlog.
// Usage: pnpm lint:changed [--base <commit-or-ref>]
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function parseBase(args) {
  if (args.length === 0) return "origin/main";
  if (args.length !== 2 || args[0] !== "--base" || !args[1] || args[1].startsWith("--")) {
    throw new Error("Usage: pnpm lint:changed [--base <commit-or-ref>]");
  }
  return args[1];
}

export function changedFiles(base, cwd = process.cwd()) {
  const git = (args) => execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Resolve first, and fail closed: a missing/fetch-limited base used to be
  // swallowed and reported as a successful 'no changed files' lint run.
  let commit;
  try {
    commit = git(["rev-parse", "--verify", "--end-of-options", `${base}^{commit}`]).trim();
  } catch {
    throw new Error(`Cannot resolve lint base ${JSON.stringify(base)}. Fetch the base ref or pass --base <commit>.`);
  }
  const tracked = git(["diff", "--name-only", "-z", "--diff-filter=ACMR", commit, "--"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"]);
  // NUL separation preserves whitespace, quotes and newlines in filenames.
  return [...new Set([...tracked.split("\0"), ...untracked.split("\0")])].filter((file) =>
    /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file) && !/(^|\/)(node_modules|dist)\//.test(file),
  );
}

export function main(args = process.argv.slice(2)) {
  const files = changedFiles(parseBase(args));
  if (files.length === 0) {
    console.log("lint-changed: no JS/TS files changed — skipping.");
    return 0;
  }
  console.log(`lint-changed: ${files.length} file(s)`);
  const require = createRequire(import.meta.url);
  const eslint = path.join(path.dirname(require.resolve("eslint/package.json")), "bin/eslint.js");
  // No shell: filenames and user-supplied refs must never become commands.
  // Running the JS entry with Node also avoids Windows .cmd quoting issues.
  const result = spawnSync(process.execPath, [eslint, "--", ...files], { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`lint-changed: ${error.message}`);
    process.exitCode = 1;
  }
}
