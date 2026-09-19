# FocusArx Deployment Guide

## Production Deployment (Vercel)

### Prerequisites
- Vercel account
- Neon PostgreSQL database
- Domain (optional)

### Environment Variables

Set these in Vercel project settings:

**Required:**
```
DATABASE_URL=postgresql://...
AUTH_SECRET=<32+ character random string>
APP_URL=https://your-domain.com
ADMIN_PASSWORD=<secure password, 8+ chars>
```

**Optional:**
```
GOOGLE_CLIENT_ID=...        # Google OAuth
GOOGLE_CLIENT_SECRET=...    # Google OAuth
RESEND_API_KEY=re_...       # Email delivery
GROQ_API_KEY=gsk_...        # AI coach features
GEMINI_API_KEY=...          # AI roadmap generation
VAPID_PUBLIC_KEY=...        # Web push
VAPID_PRIVATE_KEY=...       # Web push
UPSTASH_REDIS_REST_URL=...  # Shared rate limiting
UPSTASH_REDIS_REST_TOKEN=...
CORS_ALLOWED_ORIGINS=...    # Additional CORS origins
```

### Build Command

```bash
pnpm run build:vercel
```

This runs:
1. `pnpm --filter @workspace/db run push:vercel` — bring the production
   database up to date with `lib/db/src/schema` (see *Database Migration*
   below). Production builds only; preview builds skip it.
2. `pnpm --filter @workspace/api-server run build` — build API
3. `pnpm --filter @workspace/focusarx run build:vercel` — build frontend

### Vercel Configuration

See `vercel.json` for routing rules:
- `/api/*` → API serverless function
- `/socket.io/*` → API serverless function (WebSocket)
- All other routes → static frontend (SPA fallback)

## Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and AUTH_SECRET

# 3. Push database schema
pnpm db:push

# 4. Start development servers
pnpm dev
```

This starts:
- Frontend: http://localhost:5173 (Vite)
- API: http://localhost:8080 (Express)

The Vite dev server proxies `/api` and `/socket.io` to the Express server.

## Database Migration

`lib/db/src/schema` is the source of truth. Two tools bring a database in
line with it; which one you use depends on whether people are relying on the
data in it.

### Production and any shared database: `sync-schema`

```bash
pnpm --filter @workspace/db run sync            # apply
pnpm --filter @workspace/db run sync:dry-run    # print the plan, change nothing
pnpm --filter @workspace/db run sync:check      # exit 1 unless already in sync (CI)
```

`scripts/sync-schema.mjs` diffs the live database against the schema and
applies **only additive, idempotent** changes: `CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and guarded
`ADD CONSTRAINT`. It never drops, renames or retypes anything, never needs an
interactive confirmation, and runs each statement in its own transaction so a
single failure cannot block the rest. A `NOT NULL` column without a default on
a populated table is reported as `MANUAL` and left for a reviewed migration.

What fails the deploy and what does not:

- a **table or column** that cannot be created → exit 1, the deploy stops and
  the previous code stays live (the code would read a column that is not there);
- a **CHECK or FOREIGN KEY** that existing rows violate → added `NOT VALID`,
  so new writes are enforced from now on; the run prints a `WARN` with the
  exact `ALTER TABLE … VALIDATE CONSTRAINT …` to run once the rows are cleaned up;
- a **UNIQUE** that duplicates violate (Postgres has no `NOT VALID` for these)
  or an **index** that cannot be built → `WARN`, skipped, deploy continues.

The summary line (`N applied (M NOT VALID), F failed, W warning(s), R left for
review`) is in the build log; anything other than `0 failed, 0 warning(s)`
deserves a look after the deploy. The sync sets `lock_timeout = 15s` and
retries three times, so a long-running transaction makes it fail fast with a
clear message instead of hanging the build.

This is what runs in production — from the Vercel build via `push:vercel`
and from the `Production Deploy` workflow's *Sync database schema* step
(both call `cleanup-orphans.mjs` first, then `sync-schema.mjs`). An empty
database is bootstrapped by the same command.

> Why not `drizzle-kit push` in production? Against a real database it wants
> to drop and re-create constraints whose names differ from the schema's and
> prompts for confirmation, so it either hangs the build or does something
> destructive. The old build ran it in "skip" mode, which is how production
> ended up several columns behind the code (the *"confirmed your sign-in but
> could not load your session"* incident: `GET /api/auth/session` selected
> `users.deletion_requested_at`, which production never received).

### Local / throw-away databases: `push`

```bash
pnpm db:push
```

Runs `cleanup-orphans` → `sync-schema` → `drizzle-kit push`, so a local
database also gets drizzle-kit's non-additive changes (renames, drops).

### Verify Schema
```bash
pnpm --filter @workspace/db run sync:check       # in sync with lib/db/src/schema?
psql "$DATABASE_URL" -f database/verify.sql      # required tables present?
```

## Health Checks

- `GET /api/health` — basic health check
- `GET /api/deployment` — version info
- `GET /api/db-health` — database connection check (admin only)

## Monitoring

- Pino structured logging (JSON format in production)
- Request IDs on all responses (`X-Request-Id`)
- Deployment version headers (`X-FocusArx-Deployment`)
- Client-side deployment skew detection

## Canonical domain (www vs apex) — ops requirement

The app canonical is `https://www.focusarx.site` (`artifacts/focusarx/index.html`,
`robots.txt`, sitemap). The apex → www 308 lives in **two** places that must
agree — the top-level `redirects` entry in `vercel.json` (host-conditioned on
the apex, so previews are unaffected; Vercel applies `redirects` alongside
legacy `routes`) **and** the Vercel dashboard:

1. Vercel → Project → Settings → Domains: set `www.focusarx.site` as **Primary**.
2. `focusarx.site` then 308-redirects to www automatically at the edge.
3. Verify: `curl -sI https://focusarx.site | grep -i location` must point
   at www, and every sitemap `<loc>` must return 200 (not a redirect).

If the primary ever flips back to the apex, every canonical points at a
redirect and Google drops the pages. The SEO contract tests
(`seoContract.test.ts`) guard route/sitemap/prerender agreement, not DNS —
the dashboard half of this step is manual.
