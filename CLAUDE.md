# 🚧 FocusArx — AI Agent Barricade (READ FIRST)

> **Any AI or human editing this repo MUST read this file before changing backend/auth code.**
> It exists to prevent a repeat of the **sign-in outage** (see "Incident" below).

## ⛔ Hard rules (do NOT break these)

### 1. Never use a bare `db.select().from(table)` on auth/session/critical paths
Bare selects pull **every** column from `schema.ts`. If the live DB is even one column
behind the schema (schema drift), the query throws `column "..." does not exist` →
the route's `catch` returns **500 "Internal error"**. This is exactly what bricked login.

**Always project explicit columns:**
```ts
// ✅ GOOD — drift-resilient; only asks for what login needs
db.select({
  id: usersTable.id, email: usersTable.email, name: usersTable.name,
  isGuest: usersTable.isGuest, hashedPassword: usersTable.hashedPassword,
}).from(usersTable).where(eq(usersTable.email, email));

// ❌ BAD — couples login to the entire users schema
db.select().from(usersTable).where(eq(usersTable.email, email));
```
Same rule for `.returning()` — return only the columns you use.

### 2. `getServerConfig()` must NEVER throw
It is called from request-time middleware (the CORS `origin` callback runs on every
cross-origin request). A throw there becomes an opaque 500 on login. Missing-config
checks belong in `getConfigErrors()` (returns a 503 list with a clear hint).

### 3. Don't assume the DB matches `schema.ts`
This repo applies schema changes with `drizzle-kit push` (run by `pnpm build:vercel`),
which is **interactive and can abort in CI**, leaving the DB behind the schema
(schema drift). Also: the drizzle migration journal (`lib/db/drizzle/meta/_journal.json`)
only tracks migrations `0000`–`0001`; `0002`–`0010` are hand-written SQL applied via push.
Write queries that tolerate an older DB (rule #1), and if you add a column, make sure
the deploy actually applies it.

### 4. JWT shape is fixed
`makeToken` signs `{ sub, type: "access" }`, issuer `focusarx-api`, audience
`focusarx-web`, 7-day expiry. `verifyToken` requires all three. Changing any of these
invalidates every existing session (forces re-login) — do it deliberately.

## 🧨 Incident (the bug these rules prevent)
After the "harden platform" push, **nobody could sign in** — `POST /api/auth/login`
returned 500. Cause: login used a bare `db.select().from(usersTable)` selecting all 17
columns, but the prod DB was missing the `referral_*` columns (drift), so the query
threw. Verified with an in-process Postgres repro. Full write-up:
[`.agents/memory/signin-schema-drift.md`](.agents/memory/signin-schema-drift.md).

## 🧰 Quick facts
- **Stack:** pnpm monorepo · React 19 + Vite (frontend in `artifacts/focusarx`) ·
  Express 5 API (`artifacts/api-server`) · Drizzle ORM + Postgres (`lib/db`).
- **Run dev:** `pnpm dev` (API on :8080, Vite proxies `/api` + `/socket.io`).
- **Verify a change:** `pnpm typecheck` then `pnpm --filter @workspace/api-server run build`.
- **AI memory index:** `.agents/memory/MEMORY.md` (project conventions & past fixes).
- **DB route imports:** import tables from `"@workspace/db"`, NOT `"/schema"` (not exported).
