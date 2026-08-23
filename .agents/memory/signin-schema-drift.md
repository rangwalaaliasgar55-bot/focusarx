---
name: Sign-in 500 from schema drift (POST-mortem)
description: Root cause of the "cannot sign in → internal error" outage and the rules that prevent it
---

## Incident
After the "harden platform" push, users could NOT sign in — `POST /api/auth/login`
returned **500 "Internal error"**. The app was fine before the push.

## Root cause
`/api/auth/login` did a bare `db.select().from(usersTable)`, which selects **every**
column defined in `schema.ts` (17 columns, incl. `productivity_score`,
`total_focus_minutes`, `referral_code`, `referred_by_user_id`, `referral_applied_at`).

The production DB was **behind the schema** (schema drift): the `referral_*` columns
(added in migration `0005`) were missing — most likely because `drizzle-kit push`
(which `build:vercel` runs) is interactive and aborted/skipped in CI. So the login
query threw `column "referral_code" does not exist`, was caught, and returned 500.

Verified with an in-process Postgres (pglite) reproducing the drifted table:
`db.select().from(usersTable)` **THREW**, while an explicit 5-column select **succeeded**.

A second latent landmine: `getServerConfig()` `throw`ed when `ADMIN_PASSWORD` was
unset in production — but it's called from the CORS `origin` callback on every
cross-origin request, so a throw there also surfaced as an opaque 500 on login.

## Fixes applied
1. **Auth queries project explicit columns only** — `login`/`register`/`guest` now
   select/return only what they need (`id, email, name, isGuest, hashedPassword`).
   All of those exist since migration `0000`, so sign-in works against ANY DB state,
   even fully drifted. (`/auth/session` was already explicit.)
2. **`getServerConfig()` never throws** — the `ADMIN_PASSWORD` throw became a
   `console.error` + null. `getConfigErrors()` still reports it as missing (503 with
   a clear hint), and `admin.ts` already handled a null password gracefully.

## RULES (do not regress)
- **NEVER** use a bare `db.select().from(table)` or full `.returning()` on the
  auth/session path or any "can the app boot" path. Always project explicit columns.
  A bare select couples the query to the full schema, so one missing column = 500.
- **NEVER** make `getServerConfig()` throw. It runs in request-time middleware.
  Missing-config checks belong in `getConfigErrors()` (returns a 503 list).
- Treat the DB as possibly-behind-`schema.ts`. `drizzle-kit push` is interactive and
  can fail silently in CI; the drizzle journal only tracks `0000`–`0001`, while
  `0002`–`0010` are hand-written SQL applied via `push`. Don't assume drift can't happen.

## JWT note (related, not a bug)
`makeToken` signs `{ sub, type: "access" }` with issuer `focusarx-api` + audience
`focusarx-web`, 7-day expiry. `verifyToken` requires ALL of those, so tokens issued
before this change (no `type`, 400d) are rejected → the frontend clears the token and
shows the login screen. That's a forced re-login (401), not an error.
