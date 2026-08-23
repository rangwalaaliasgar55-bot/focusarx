# Agent Guidelines

This repo uses **[CLAUDE.md](CLAUDE.md)** as its single source of truth for AI agents.
Read it before editing backend, auth, or database code.

Key rules (details in CLAUDE.md):

1. **Never** bare `db.select().from(table)` or full `.returning()` on auth/session/
   critical paths — project explicit columns. Schema drift turns bare selects into 500s
   (this once bricked login).
2. **Never** make `getServerConfig()` throw — it runs in request middleware.
3. **Don't assume** the DB matches `schema.ts` (`drizzle-kit push` can abort in CI).
4. JWT shape (`type:"access"`, issuer, audience, 7d) is fixed by design.

Project conventions and past-fix write-ups live in `.agents/memory/` (index:
`MEMORY.md`). Verify any change with `pnpm typecheck`.
