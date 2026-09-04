// Incremental lint gate (Phase 10).
// Full-repo strict lint has a legacy backlog (see REMAINING.md), so CI gates
// the files each PR actually touches — errors there fail the build.
// Usage: pnpm lint:changed [--base origin/main]
import { execSync } from "node:child_process";
import { spawnSync } from "node:child_process";

const base = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "origin/main";

function changedFiles() {
  const cmd = (args) => {
    try {
      return execSync(`git ${args}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      return "";
    }
  };
  try {
    // Two-dot against the working tree: covers committed AND uncommitted
    // changes locally, and equals HEAD on a clean CI checkout.
    // ACMR skips deletions (nothing to lint). Untracked files are included
    // explicitly — plain `git diff` cannot see them.
    const tracked = cmd(`diff --name-only --diff-filter=ACMR ${base}`);
    const untracked = cmd("ls-files --others --exclude-standard");
    return (
      tracked +
      "\n" +
      untracked
    )
      .split("\n")
      .map((s) => s.trim())
      .filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !f.includes("node_modules/") && !f.includes("/dist/"));
  } catch {
    return [];
  }
}

const files = changedFiles();
if (files.length === 0) {
  console.log("lint-changed: no JS/TS files changed — skipping.");
  process.exit(0);
}
console.log(`lint-changed: ${files.length} file(s)`);
// corepack (not bare pnpm): works on dev machines without a PATH install
// and on CI runners where corepack ships with Node. shell:true for Windows.
const res = spawnSync("corepack", ["pnpm", "exec", "eslint", ...files], {
  stdio: "inherit",
  shell: true,
});
process.exit(res.status ?? 1);
