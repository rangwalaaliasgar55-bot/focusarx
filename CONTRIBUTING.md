# Contributing

Thanks for taking the time to contribute! 🎉

## How to contribute

1. **Fork** the repo and create your branch from `main`.
2. Make your changes — keep them focused and well-tested.
3. Follow the existing code style and conventions.
4. Open a **Pull Request** with a clear title and description:
   - Use the PR template.
   - Reference any related issues (`Closes #12`).
   - Add or update tests where possible.

## Reporting issues

Found a bug or have an idea? Open an **Issue** — the templates make it easy to describe what's happening and what you'd like.

## Database query rules (important)

Schema changes are applied with `drizzle-kit push`, which can abort silently in
non-interactive deploys — so the live database may lag the Drizzle schema.

1. **Never bare-select on auth/session/critical paths.** `db.select().from(usersTable)`
   pulls every column in the schema; if one is missing in the live DB the query throws
   and the route 500s (this once bricked sign-in). Always project explicit columns:
   ```ts
   db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable)
   ```
   The same applies to `.returning()` — return only the columns you use.
2. **`getServerConfig()` must never throw** — it runs inside request middleware
   (e.g. the CORS origin callback); a throw becomes an opaque 500 on every request.
   Missing-config checks belong in `getConfigErrors()`, which answers 503 with a
   readable list.
3. **The JWT shape is fixed by design** — `{ sub, type: "access" }`, issuer
   `focusarx-api`, audience `focusarx-web`, 7-day expiry. Changing any of it
   invalidates every active session; do it deliberately.

## Code of conduct

Be respectful and constructive. Harassment and trolling will not be tolerated.

## License

By contributing, you agree that your contributions are licensed under the same license as this project.