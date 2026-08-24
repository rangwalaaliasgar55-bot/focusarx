// Runs `drizzle-kit push` and FAILS the build when it could not actually apply
// the schema.
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
// This wrapper turns that into a hard, explained build failure.
import { spawnSync } from "node:child_process";

const TTY_ABORT = /Interactive prompts require a TTY/i;
const DESTRUCTIVE_PROMPT = /Do you want to truncate/i;

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["drizzle-kit", "push", "--config", "./drizzle.config.ts"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);

const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(out);

if (TTY_ABORT.test(out)) {
  console.error(`
drizzle-push: ABORTED — schema was NOT applied.

drizzle-kit needed an interactive confirmation, which is impossible in a
non-TTY build environment. It exits 0 in this case, so without this wrapper the
deploy would have succeeded while leaving the database behind the schema
(schema drift), which breaks any query that selects a column the database does
not have yet.

Resolve it locally where you have a TTY, then commit the result:

    pnpm --filter @workspace/db run push          # answer the prompts
    # or, if the prompt is a destructive one you want to accept deliberately:
    pnpm --filter @workspace/db run push-force

Note: the prompt above asks about TRUNCATING a table. Do not accept that
blindly — it deletes rows. Generate a SQL migration instead if the change can
be expressed without data loss.
`);
  process.exit(1);
}

if (DESTRUCTIVE_PROMPT.test(out)) {
  console.error(`
drizzle-push: a destructive prompt was detected (table truncation). Refusing to
continue in a non-interactive build. Run the push locally and review it.
`);
  process.exit(1);
}

process.exit(result.status ?? 1);
