# "All the users are gone" — silent schema drift from `drizzle-kit push`

## Symptom

The admin user list rendered **empty**. No error in the UI, just no rows.

## Cause (two layers)

**Layer 1 — the query.** `GET /admin/users` used a bare
`db.select().from(usersTable)`, which asks Postgres for all 17 columns in
`schema.ts`. If the live DB is missing even one, the query throws and the
route's `catch` returns 500 → the panel shows nothing. **The users were still
in the database the whole time.**

Reproduced by dropping the `referral_*` columns locally:

```
admin users error
Failed query: select "id", ... "referral_code", ... from "users"
caused by: error: column "referral_code" does not exist
    at artifacts/api-server/src/routes/admin.ts:88:19
```

This is the same failure mode as [signin-schema-drift](signin-schema-drift.md);
login was fixed but `admin.ts:88` was still bare. Fix: project explicit
columns, and aggregate session/streak counts in SQL instead of loading
`focus_sessions` and `study_streaks` wholesale into memory. `/admin/stats` had
the same two bare selects and was fixed the same way.

**Layer 2 — why the DB drifted at all.** `pnpm build:vercel` runs
`pnpm --filter @workspace/db run push` on Vercel. `drizzle-kit push` is
interactive; in a non-TTY build it prints

```
Error: Interactive prompts require a TTY terminal (process.stdin.isTTY …)
```

**and then exits 0.** Verified: `drizzle-kit push` alone → `exit=0`,
`pnpm db:push` → `exit=0`. So every deploy that needed a confirmation shipped
new code against an unchanged database, and reported success. That is how
production lost `referral_*` and how both the sign-in outage and the empty
user list happened.

Fix: `lib/db/scripts/push.mjs` wraps the push, detects the TTY abort (and any
truncation prompt), prints what to run locally, and exits 1 so the build fails
loudly. `lib/db` `push` now calls it. Note the prompt drizzle raises here asks
to **TRUNCATE** a table — never accept that blind; write a SQL migration.

## Admin live viewer

`/api/admin/analytics/live` returned only an analytics event log — what
happened, not who is here. It now also returns a `live` block:
`onlineVisitors`, `focusingNow`, and the users currently mid-session (joined
from `active_sessions` to `users`, explicit columns). The admin UI shows those
as "On the site right now", polls at 4s instead of 10s, refreshes headline
metrics every 30s, and surfaces a reconnecting/updated-at state.

## "Have to keep reloading to load a feature"

Every page is `lazy(() => import(...))`. After a deploy the old hashed
`/assets/*.js` files are gone, so an already-open tab fetches a filename that
404s, the dynamic import rejects, and the route stays broken until a hard
refresh. Nothing handled it: there was no `vite:preloadError` listener, and
`ErrorBoundary`'s Retry only cleared state, which re-ran the same failed
import.

`src/lib/chunkRecovery.ts` now handles `vite:preloadError` and reloads once,
guarded by a 30s sessionStorage flag so a genuinely broken build cannot loop.
`ErrorBoundary` uses `isChunkLoadError()` to reload instead of no-op'ing. The
service worker also calls `registration.update()` every 5 minutes so open tabs
stop sitting on an old build.

## Checking this yourself

```bash
# drop a column, then hit the endpoint — must still be 200 with all users
alter table users drop column referral_code;
curl -b admin.jar /api/admin/users
```
