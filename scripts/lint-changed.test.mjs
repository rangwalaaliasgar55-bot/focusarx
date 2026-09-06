import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { changedFiles, parseBase } from "./lint-changed.mjs";

const fixtures = [];
afterEach(() => { for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture() {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "focusarx-lint-"));
  fixtures.push(cwd);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  git("init", "-q");
  git("config", "user.name", "Lint test");
  git("config", "user.email", "lint-test@example.invalid");
  writeFileSync(path.join(cwd, "existing.ts"), "export const value = 1;\n");
  writeFileSync(path.join(cwd, "deleted.js"), "export {};\n");
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-qm", "test baseline");
  return { cwd, git, base: git("rev-parse", "HEAD") };
}

test("requires an explicit value for --base", () => {
  assert.equal(parseBase([]), "origin/main");
  assert.equal(parseBase(["--base", "HEAD"]), "HEAD");
  assert.throws(() => parseBase(["--base"]), /Usage/);
  assert.throws(() => parseBase(["--other", "HEAD"]), /Usage/);
});

test("missing refs and shell metacharacters fail closed", () => {
  const { cwd } = fixture();
  assert.throws(() => changedFiles("not-a-reference", cwd), /Cannot resolve lint base/);
  assert.throws(() => changedFiles("HEAD; echo unsafe", cwd), /Cannot resolve lint base/);
});

test("covers committed, staged, unstaged and untracked changes without deletions", () => {
  const { cwd, git, base } = fixture();
  writeFileSync(path.join(cwd, "committed.ts"), "export {};\n");
  git("add", ".");
  git("-c", "commit.gpgsign=false", "commit", "-qm", "changed code");
  writeFileSync(path.join(cwd, "staged.tsx"), "export {};\n");
  git("add", "staged.tsx");
  writeFileSync(path.join(cwd, "existing.ts"), "export const value = 2;\n");
  writeFileSync(path.join(cwd, "untracked.mjs"), "export {};\n");
  writeFileSync(path.join(cwd, "README.md"), "not code\n");
  rmSync(path.join(cwd, "deleted.js"));
  assert.deepEqual(changedFiles(base, cwd).sort(), ["committed.ts", "existing.ts", "staged.tsx", "untracked.mjs"].sort());
});

test("preserves unusual filenames and filters ignored output", () => {
  const { cwd, base } = fixture();
  const filename = "space and 'quotes'\nname.ts";
  writeFileSync(path.join(cwd, filename), "export {};\n");
  writeFileSync(path.join(cwd, ".gitignore"), "ignored.js\n");
  writeFileSync(path.join(cwd, "ignored.js"), "export {};\n");
  assert.deepEqual(changedFiles(base, cwd), [filename]);
});

test("the CLI exits nonzero rather than reporting success for an invalid base", () => {
  const { cwd } = fixture();
  const script = fileURLToPath(new URL("./lint-changed.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "--base", "missing"], { cwd, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot resolve lint base/);
  assert.doesNotMatch(result.stdout, /skipping/);
});
