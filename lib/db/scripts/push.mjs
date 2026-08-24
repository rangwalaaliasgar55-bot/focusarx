// Runs `drizzle-kit push` and reports loudly when it could NOT apply the schema.
//
// Why this exists: `drizzle-kit push` is interactive. When it needs a
// confirmation (e.g. "add unique constraint … do you want to truncate the
// table?") in a non-TTY environment such as a Vercel build, it prints
//
//   Error: Interactive prompts require a TTY terminal …
//
// and then **exits 0**. The build carries on and deploys code whose schema the
// database never received. That silent drift is what turned bare
// `db.select().from(usersTable)` queries into 500s — the admin user list went
// blank and sign-in broke — while every deploy reported success.
//
// drizzle-kit has no non-interactive-safe flag: `--strict` asks for *more*
// confirmations and `--force` auto-approves statements that can TRUNCATE
// tables. So this wrapper detects the abort and reports it.
//
// It does NOT fail the build by default. A failed deploy ships nothing at all,
// which is worse than shipping against a slightly-behind database — especially
// now that the auth/admin query paths project explicit columns and therefore
// tolerate drift. Set DB_PUSH_STRICT=1 to turn the warning into a hard build
// failure once the pending change has been resolved.
import { spawnSync } from "node:child_process";

const TTY_ABORT = /Interactive prompts require a TTY/i;
const DESTRUCTIVE_PROMPT = /Do you want to truncate/i;

const strict = process.env.DB_PUSH_STRICT === "1";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["drizzle-kit", "push", "--config", "./drizzle.config.ts", "--verbose"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);

const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(out);

const aborted = TTY_ABORT.test(out);
const destructive = DESTRUCTIVE_PROMPT.test(out);

if (aborted || destructive) {
  // Surface the change drizzle was asking about, so the log says what is
  // actually missing instead of just "something went wrong".
  const pending = out
    .split("\n")
    .filter((line) => /You're about to/i.test(line))
    .map((line) => `    ${line.replace(/^[\s·•-]+/, "")}`);

  const banner = `
drizzle-push: schema was NOT applied — the database is still behind schema.ts.

drizzle-kit needed an interactive confirmation, which is impossible in a
non-TTY build environment. It exits 0 in that case, so without this wrapper the
deploy reports success while leaving the database behind the schema. Queries
that select a column the database does not have yet will 500.
${pending.length ? `\nPending change(s) drizzle wanted to apply:\n${pending.join("\n")}\n` : ""}
Resolve it where you have a TTY:

    pnpm --filter @workspace/db run push          # answer the prompts
${destructive ? `
The pending prompt asks about TRUNCATING a table. Do not accept that blindly —
it deletes rows. Write a SQL migration under lib/db/drizzle/ instead if the
change can be expressed without data loss.
` : ""}
This did NOT fail the build: a failed deploy ships nothing at all, which is
worse than shipping against a slightly-behind database. Set DB_PUSH_STRICT=1 to
make this a hard build failure once you want that gate.
`;

  if (strict) {
    console.error(banner);
    console.error("drizzle-push: DB_PUSH_STRICT=1 — failing the build.");
    process.exit(1);
  }
  console.warn(banner);
}

process.exit(result.status ?? 1);
