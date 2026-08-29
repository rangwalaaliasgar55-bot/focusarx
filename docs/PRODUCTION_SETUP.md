# FocusArx — Full Production Setup Guide

This is the complete, ordered walkthrough for taking FocusArx from a repo clone
to a live production deployment on **Vercel** with a **PostgreSQL database**
(recommended: **Neon**), **GitHub Actions** CI/CD, **email**, **push
notifications**, and **AI**.

Everything a human has to do manually is marked **[MANUAL]**. Everything else
is automated by the repo (CI, migrations, build, deploy).

> Canonical host in this repository is **`www.focusarx.site`**
> (`artifacts/focusarx/index.html`, `public/robots.txt`, `public/sitemap.xml`,
> `public/manifest.json`). Either buy/use that domain, or search-and-replace it
> with your own domain in those files before going live.

---

## 0. What you need

| Task | Service / account |
|---|---|
| Code hosting | GitHub repository (this repo) |
| Hosting | Vercel account |
| Database | Neon (PostgreSQL) — free tier is fine to start |
| Email (recommended) | Resend (free tier) |
| Domain | Your own domain (e.g. `focusarx.site`) |
| Push notifications (optional) | none — VAPID keys are generated locally |
| Distributed rate limits (optional) | Upstash Redis free tier |
| AI coach / roadmap (optional) | Groq and/or Google Gemini API keys |
| Analytics (optional) | Google Analytics 4 |
| SEO verification (optional) | Google Search Console |
| Ads (optional) | Google AdSense + `public/ads.txt` |

Prerequisites on your machine (only for local dev + first migration):

- Node.js **20+** (repo tested on 20/22)
- **pnpm 10.26.1** — enable via `corepack enable && corepack prepare pnpm@10.26.1 --activate`
- Git, and a Terminal / VS Code
- For DB work: `psql` is nice but not required (Neon console has a SQL editor)

---

## 1. Local development boot ([MANUAL])

```bash
# 1. Clone your repo (in the directory where you want the project)
git clone https://github.com/<you>/focusarx.git
cd focusarx

# 2. Install dependencies
pnpm install

# 3. Create your local environment file
cp .env.example .env
```

Fill at least this in `.env`:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
AUTH_SECRET=your-32+-char-random-secret
APP_URL=http://localhost:5000
```

Then run:

```bash
# Start the API (port 8080) and the frontend (port 5000, proxying /api to 8080)
pnpm dev
```

- Frontend: http://localhost:5000
- API: http://localhost:8080
- Health: http://localhost:5000/api/healthz

> **Important env rule**: never set a variable to an empty string to "disable"
> it. Delete the line instead — empty strings fail URL/number validation and
> make the API return `503 CONFIG_ERROR` (or, before the fix, a 500 on every
> route).

Verification commands:

```bash
pnpm typecheck
pnpm test
pnpm build
```

---

## 2. Create the production database (Neon) — [MANUAL]

1. Go to https://neon.tech → sign up / log in.
2. **Create project** → pick a region close to your users (e.g. Mumbai / Singapore
   for most FocusArx users).
3. Open the project → **Connect**.
4. You get two connection strings. Save **both**:
   - Pooled URL (for apps that don't need prepared statements)
   - **Direct URL** (non-pooling) — this is what FocusArx prefers on Vercel.
5. In the **SQL Editor** (or `psql`), run the initial migration to create the
   schema **after** the app is deployed (see order in §7). You can also let the
   GitHub deploy workflow apply it.

Copy URLs into your **Vercel** environment and **GitHub** secrets (next steps).

**Security notes for the database URL:**

- Always use `?sslmode=require` in the URL when pasting into Vercel.
- Keep the real password out of Git. `.env` is already gitignored.
- The app strips SSL params itself and uses `rejectUnauthorized: true` for
  production databases, so you don't need to manage the cert.

---

## 3. Create the Vercel project — [MANUAL]

1. Go to https://vercel.com → **Add New → Project**.
2. Import your GitHub repo.
3. Framework preset: **Other** (Vercel auto-detects nothing special here).
4. Root directory: **`/`** (the monorepo root).
5. Build settings — the repo already has `vercel.json`, so you should see:
   - Build Command: `pnpm run build:vercel`
   - Output Directory: `artifacts/focusarx/dist/public`
   - Install Command: `pnpm install`
6. **Environment variables** — add them before the first deploy. See §4.
7. Click **Deploy**.

The first deploy **will not work** until the required env vars exist — and it
may deliberately fail the build if the database is unreachable (see §7). That
is intentional: it prevents shipping code whose schema the DB does not have.

---

## 4. Environment variables — [MANUAL] on Vercel

Set these in **Vercel → Project → Settings → Environment Variables**, making
sure every one is applied to **Production** (+ Preview/Development if you want
local previews to work).

### 4.1 Required

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled URL `postgresql://...?sslmode=require` | Used as fallback / local tooling |
| `POSTGRES_URL_NON_POOLING` | Neon **direct** URL | **Preferred on Vercel** (transaction-mode poolers break prepared statements) |
| `AUTH_SECRET` | ≥ 32 random characters | Generate: `openssl rand -base64 48` |
| `ADMIN_PASSWORD` | ≥ 8 chars (**16+ recommended**) | Bootstrap password for `/admin`; also covered by GitHub deploy secret |
| `APP_URL` | `https://www.focusarx.site` | Canonical origin: password-reset links, CORS, OAuth |
| `VITE_APP_URL` | `https://www.focusarx.site` | Canonical/OG/sitemap origin; set for the build environment too |

`DATABASE_URL` is required to run; if you only set `POSTGRES_URL_NON_POOLING`,
things still work (the app prefers it).

### 4.2 Recommended

| Variable | Value | Purpose |
|---|---|---|
| `RESEND_API_KEY` | `re_...` | Password resets, admin blasts, contact + moderation emails. Get at https://resend.com |
| `EMAIL_FROM` | `"FocusArx <noreply@yourdomain.com>"` | Verified sender in Resend |
| `CRON_SECRET` | ≥ 16 random chars | Guards `GET /api/retention/reengage/run` (Vercel Cron attaches it) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` | `npx web-push generate-vapid-keys` | Stable web-push identity. Without it push subs break on each deploy |
| `GROQ_API_KEY` | `gsk_...` | AI coach, insights, flashcard generation, LLM moderation |
| `GEMINI_API_KEY` | `AIza...` | AI study-roadmap generator (falls back to local template if unset) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | from Upstash | Distributed rate limiting across Vercel serverless instances |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from Google Cloud | Read by config today; no OAuth route is wired yet (optional/placeholder) |

### 4.3 Frontend / build-time

| Variable | Value | Purpose |
|---|---|---|
| `VITE_APP_URL` | `https://www.focusarx.site` | SEO canonical/OG/sitemap |
| `VITE_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` | Google Analytics 4; loads gtag.js + SPA page views |
| `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_ID` | auto | Deployment-version skew protection (Vercel injects automatically) |

> User-provided variable names that begin with `VITE_` are **baked into the
> frontend at build time**. If you change them, you must redeploy.

**If you are deploying outside Vercel** (self-host on a server/Render/fly.io):
use `DEPLOYMENT_VERSION` to set the deployment version explicitly; it will be
read by `artifacts/api-server/src/lib/deploymentVersion.ts`.

---

## 5. GitHub secrets — [MANUAL]

In **GitHub → repo → Settings → Secrets and variables → Actions**, add:

| Secret | Value | Needed by |
|---|---|---|
| `DATABASE_URL` | Neon **direct** URL (same as `POSTGRES_URL_NON_POOLING`) | `deploy.yml` migrate step |
| `POSTGRES_URL_NON_POOLING` | Neon **direct** URL | `deploy.yml` migrate step (preferred) |
| `AUTH_SECRET` | ≥ 32 random chars | `deploy.yml` pre-deploy verification |
| `VERCEL_TOKEN` | Vercel → Account → Settings → Tokens → new token | `deploy.yml` deploy step |
| `VERCEL_ORG_ID` | Vercel → Account/Team → settings → ID | `deploy.yml` deploy step |
| `VERCEL_PROJECT_ID` | Vercel → Project → Settings → General → Project ID | `deploy.yml` deploy step |
| `APP_URL` | `https://www.focusarx.site` | `deploy.yml` post-deploy smoke test |

Getting Vercel IDs quickly:

```bash
# install vercel once
npx --yes vercel@latest link
npx --yes vercel@latest whoami
# The CLI prints org/project ids; they're also in your vercel dashboard.
```

---

## 6. CI/CD in this repo — [already committed; activation check]

Both workflows are already committed in **[`.github/workflows/`](../.github/workflows/)**:

- **`ci.yml`** (source of truth in `docs/ci-workflows/ci.yml`): every PR and
  push to `main` runs typecheck → unit/contract tests → API + frontend builds →
  migration naming check → `pnpm audit` → DB migrations applied to an
  **ephemeral Postgres** + DB-gated integration tests + integrity check →
  Playwright/axe accessibility (desktop + 360 px) → gitleaks + secret sweep.
- **`deploy.yml`** (source of truth in `docs/ci-workflows/deploy.yml`): on push
  to `main` → preflight (`typecheck`/`test`/`build`) → verify production
  secrets → **acquire migration lock** → **apply DB migrations** → release
  lock → post-migration health check → **deploy to Vercel** (`vercel deploy
  --prod`) → live smoke test.

### If the workflows don't appear in the Actions tab [MANUAL]

GitHub only starts a workflow if the file reaches the repo through a push made
by an account/App with the **`workflows`** permission. If your integration
pushed this branch without it, verify in GitHub → repo → **Actions** tab; if
`CI` / `Production Deploy` are missing, commit the files once from your own
account:

```bash
mkdir -p .github/workflows
cp docs/ci-workflows/ci.yml      .github/workflows/ci.yml
cp docs/ci-workflows/deploy.yml  .github/workflows/deploy.yml
git add .github/workflows
git commit -m "ci: activate FocusArx CI/CD workflows"
git push origin main
```

(or paste the files via GitHub web UI → *Add file → Create new file*).

### What the workflows need

- `ci.yml` needs **no** secrets.
- `deploy.yml` needs the GitHub secrets from §5: `DATABASE_URL`,
  `POSTGRES_URL_NON_POOLING`, `AUTH_SECRET`, `VERCEL_TOKEN`,
  `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `APP_URL`.

### ⚠️ Avoid double deployments

`deploy.yml` deploys with the Vercel CLI **and** Vercel's Git integration
auto-deploys `main`. Pick **one**:

- **Use `deploy.yml`** (recommended — migrations are guaranteed to run before
  the deploy): in Vercel → Project → Settings → Git → disable *"Deploy on push
  to main"* so only GitHub Actions deploys.
- **Use Vercel auto-deploy** (simplest): delete `.github/workflows/deploy.yml`,
  and run `pnpm --filter @workspace/db run push` from your machine before
  merging schema changes (Vercel's build only applies `cleanup-orphans.mjs`,
  not `drizzle-kit push`).

Either way, set `CI` + `deploy.yml` secrets (§5) **before** the first push to
`main`, otherwise the deploy job fails fast with an explicit "Missing required
env vars" message.

---

## 7. First deployment order — [MANUAL, but concise]

Do these in order:

1. **Create Neon DB** and save both connection strings (§2).
2. **Create Vercel project** and set env vars (§3–§4).
3. **Add GitHub secrets** (§5).
4. **Push the branch / merge to `main`.** GitHub Actions will run CI then the
   deploy workflow.
5. **If you'd rather not wait for the workflow**, run migrations manually:

```bash
# from your local machine, pointed at the Neon direct URL
export DATABASE_URL="postgresql://...:5432/...?sslmode=require"
export AUTH_SECRET="<32+ chars>"
pnpm --filter @workspace/db run push
```

6. **Deploy on Vercel** (the deploy workflow does this, or push to `main` and
   let Vercel auto-build).
7. **Create your admin user** (§8).
8. **Point your domain** at Vercel (§9).
9. **Verify** (§10).

---

## 8. Create an admin user — [MANUAL]

The `/admin` UI is protected by `ADMIN_PASSWORD` as a bootstrap gate. Healthier
permissions come from a **user row with `role = 'admin'`** in the database.

In the **Neon SQL Editor** (or `psql`):

1. Find the user id:

```sql
SELECT id, email, role FROM users WHERE email = 'you@example.com';
```

2. Promote it:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

3. Confirm:

```sql
SELECT id, email, role FROM users WHERE email = 'you@example.com';
```

Now that user can access admin APIs when signed in normally, in addition to the
bootstrap `ADMIN_PASSWORD`.

---

## 9. Domain + DNS — [MANUAL]

1. Register/buy the domain (e.g. at Namecheap/GoDaddy/Cloudflare).
2. In Vercel → **Project → Settings → Domains**, add `focusarx.site` and
   `www.focusarx.site`.
3. At your DNS provider, add the records Vercel gives you, typically:

| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

4. Wait for DNS propagation, then set your **primary domain** to
   `https://www.focusarx.site` (Vercel → Domains → make it the default).
5. Because the repo hardcodes `www.focusarx.site` in HTML/robots/sitemap, use
   that exact host, or update the hardcoded files (see §0).

**HTTPS**: Vercel provisions a certificate automatically.

---

## 10. Verify production — [MANUAL]

After the first deploy, check:

```bash
# 1. Function loads without a 500 (this should show config health, not crash)
curl -s https://www.focusarx.site/api/healthz
curl -s https://www.focusarx.site/api/healthz/config
curl -s https://www.focusarx.site/api/healthz/ready

# 2. Migrations + tables metadata (no secrets leaked)
curl -s https://www.focusarx.site/api/healthz/migrations
curl -s https://www.focusarx.site/api/healthz/tables

# 3. Deployment/skew endpoint (public)
curl -s https://www.focusarx.site/api/deployment

# 4. Sitemap is served from the root (not an SPA 200)
curl -s https://www.focusarx.site/sitemap.xml | head

# 5. Root page loads with brands/meta
curl -sI https://www.focusarx.site/
```

Open in a browser:

- `/` landing page
- `/signup` → create a test account
- `/login` → log in
- `/dashboard` → today view
- `/focus` → start + complete a 1-minute Pomodoro (use if offered)
- `/profile` → account/security
- `/admin` → admin gate

Also check the live deployment skew banner is absent on a normal visit and
that `/sw.js` returns `Service-Worker-Allowed: /` (it should via `vercel.json`).

---

## 11. Optional production add-ons — [MANUAL]

### Email (Resend)

1. https://resend.com → create account → verify your domain.
2. Create API key (`re_...`) → add `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to your verified sender.
4. If you skip Resend, password-reset and admin emails degrade silently (and
   password reset reports `emailSent: false` to avoid enumeration).

### Push notifications (VAPID)

```bash
npx web-push generate-vapid-keys
```

Add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`.

### AI coach / roadmap (Groq + Gemini)

1. https://console.groq.com → API key → `GROQ_API_KEY`.
2. https://aistudio.google.com → API key → `GEMINI_API_KEY`.
   - Without keys all AI features fall back to templates/coach; the app works.

### Distributed rate limiting (Upstash)

1. https://upstash.com → create a Redis database.
2. Copy REST URL + token → `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
   - Without it, rate limits are per serverless instance (still present, but
     global counts are approximate).

### Google Analytics 4

`VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` and redeploy the frontend.

### Google Search Console

1. Search Console → add `www.focusarx.site`.
2. Choose DNS verification (simplest) or HTML tag.
3. If HTML tag: paste the `content` value into
   `artifacts/focusarx/index.html` where the `google-site-verification` comment
   is, then redeploy. The `BingSiteAuth.xml` is already present for Bing.

> **For the full search setup — sitemap submission, URL inspection, Bing Webmaster
> Tools, Core Web Vitals targets, the claim ledger and the weekly refresh
> cadence — see [`SEO_SETUP.md`](SEO_SETUP.md).** This section only covers
> getting the property verified.

### Ads (optional)

`public/ads.txt` already exists. Edit it with your AdSense publisher ID and
make sure AdsBot crawlers are allowed (they are — robots.txt + security
middleware already permit them).

### Scheduled retention cron

`vercel.json` defines `crons` → `/api/retention/reengage/run` at `0 9 * * *`.
Set `CRON_SECRET` as a Vercel env var; Vercel attaches it as the bearer token
automatically.

---

## 12. Database maintenance tasks [MANUAL]

The repo ships admin scripts you can run from your machine against the Neon
direct URL:

```bash
# Apply schema + safe cleanup patches (idempotent)
export DATABASE_URL="postgresql://...direct...?...sslmode=require"
pnpm --filter @workspace/db run push

# Validate migrate behavior locally (unit checks)
pnpm --filter @workspace/db run validate-migrations

# Seed dev data (never point this at prod unless you know what you're doing)
pnpm --filter @workspace/db run seed
pnpm --filter @workspace/db run seed:clear
```

### Legacy table cleanup — exact steps

`docs/TABLE_CONSOLIDATION.md` documents six legacy tables (`posts`,
`post_likes`, `user_battle_pass_progress`, `study_buddies`, `shared_goals`,
`leaderboard_snapshots`) that the code no longer reads or writes. Do **not**
drop them without archiving them first:

```bash
# 1. Archive (keep the .sql OUT of Git, e.g. object storage) — must come first
pg_dump "$DATABASE_URL" --table=posts --table=post_likes \
  --table=user_battle_pass_progress --table=study_buddies \
  --table=shared_goals --table=leaderboard_snapshots \
  --data-only --column-inserts > legacy_tables_archive_$(date +%F).sql
grep -c '^INSERT INTO' legacy_tables_archive_$(date +%F).sql

# 2. Pre-flight counts (record for post-drop verification)
psql "$DATABASE_URL" -c \
"SELECT 'posts' t, count(*) FROM posts UNION ALL SELECT 'post_likes', count(*) FROM post_likes
UNION ALL SELECT 'user_battle_pass_progress', count(*) FROM user_battle_pass_progress
UNION ALL SELECT 'study_buddies', count(*) FROM study_buddies
UNION ALL SELECT 'shared_goals', count(*) FROM shared_goals
UNION ALL SELECT 'leaderboard_snapshots', count(*) FROM leaderboard_snapshots;"

# 3. Safe cleanup + patches (idempotent — orphans, dedupe, unique indexes,
#    bounded purges, refresh_tokens table). On Vercel builds this also runs.
DATABASE_URL="$DATABASE_URL" node lib/db/scripts/cleanup-orphans.mjs

# 4. Drop the six orphaned tables — only after the current code is live
psql "$DATABASE_URL" <<'SQL'
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TABLE IF EXISTS post_likes;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS user_battle_pass_progress;
DROP TABLE IF EXISTS study_buddies;
DROP TABLE IF EXISTS shared_goals;
DROP TABLE IF EXISTS leaderboard_snapshots;
COMMIT;
SQL
```

Rollback is `psql "$DATABASE_URL" < legacy_tables_archive_$(date +%F).sql`.

### timestamp → timestamptz migration

`docs/TIMESTAMPTZ_MIGRATION.md` contains the zero-downtime
`timestamp` → `timestamptz` plan. It is optional; the app is already
UTC/IST-day-key safe. Apply in a maintenance window if you want to remove the
latent timezone hazard.

### Backup + maintenance schedule

| Task | When | Command |
|---|---|---|
| Schema push | every change to `lib/db/src/schema/*` | `pnpm --filter @workspace/db run push` (local, prod URL) — or let `deploy.yml` do it |
| `cleanup-orphans.mjs` | every deploy (Vercel build) + monthly manual | `node lib/db/scripts/cleanup-orphans.mjs` |
| Purges (`password_reset_tokens` > 7 d, `ai_call_log` > 90 d) | in cleanup script | ✅ automated |
| DB backups | Neon daily/PITR + nightly `pg_dump` | `0 23 * * * pg_dump "$DATABASE_URL" -Fc > /backups/focusarx_$(date +%F).dump` |
| Dependency audit | CI + monthly manual | `pnpm audit --prod --audit-level high` |
| Secret rotation | on suspicion | §13 |
| `SW_VERSION` bump | asset-heavy releases | `public/sw.js` |

---

## 13. Secrets hygiene rules [MANUAL]

1. Never commit `.env`, real keys, tokens, or connection strings.
2. `AUTH_SECRET` ≥ 32 chars; `ADMIN_PASSWORD` ≥ 16 for production.
3. Rotate `AUTH_SECRET` by: set new Vercel value → redeploy → (optionally)
   revoke users' devices from `/profile` → remove the old value.
4. Vercel and GitHub secrets should hold the same values; keep them in sync.
5. If you use the GitHub deploy workflow, do NOT set `VERCEL_TOKEN` with a
   broad scope — prefer a scoped token for only the production project.
6. `.env.example` shows only placeholders and is safe to commit.

---

## 14. Manual vs automated — summary

**Automated by the repo (nothing for you to do):**

- `pnpm typecheck`, `pnpm test`, `pnpm build`
- CI on every PR/push
- DB migration safety checks + apply in deploy workflow
- Deployment-version skew protection (server + frontend)
- Service-worker version-aware caching
- Recommendation engine (now includes due flashcard reviews)
- Schema explorer + developer docs page
- Security headers, rate limiting, moderation, anti-cheat reward math
- Sitemap, robots, PWA manifest, SEO JSON-LD
- Vercel build config in `vercel.json`

**Manual only (you must do these):**

1. Create/register accounts: GitHub, Vercel, Neon, Resend (optional), Upstash
   (optional), Groq/Gemini (optional), GA4 (optional), Search Console
   (optional), AdSense (optional).
2. Create the Neon project and **copy the two connection strings**.
3. Create the Vercel project and enter all **required env vars**.
4. Add **GitHub Actions secrets**.
5. Buy the domain and add Vercel DNS records.
6. Make an **admin** user (`role='admin'`).
7. Run the optional add-ons (email, AI keys, VAPID, analytics, ads, cron).
8. Do the **live-DB maintenance** tasks in §12 (legacy table archive/drop and
   `timestamptz` migration) if/when you want them.
9. Verify the live URLs in §10 after every significant launch.

---

## 15. Troubleshooting common production issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Every `/api/*` returns 500 | malformed env (often `DATABASE_URL=""`, short `AUTH_SECRET`, bad `NODE_ENV`) | read `/api/healthz/config`. Delete empty env vars, set ≥32-char secret, redeploy |
| `/api/healthz/config` shows `ok:false` | missing required vars | add `DATABASE_URL`/`POSTGRES_URL_NON_POOLING` + `AUTH_SECRET` to Vercel |
| Build fails: `DATABASE_URL... is not set` | Vercel build env lacks DB URL | add `POSTGRES_URL_NON_POOLING` (preferred) or `DATABASE_URL` to **build** env |
| `drizzle-push: ABORTED` | a schema change needs a TTY/destructive confirm | run `pnpm --filter @workspace/db run push` locally, review, then push |
| Push notifications break after deploy | no VAPID keys (ephemeral keys per boot) | set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` |
| You see "Update available" banner after deploy | normal rollout skew | click "Update now" or hard refresh; not an error |
| `/api/recommendations` returns only generic suggestions | fallback path after a DB error | check API logs; usually transient; also confirm you're signed in |
| AdSense `ads.txt` disapproved | domain mismatch or AdsBot blocked | ensure `ads.txt` has your publisher id and AdsBot is not blocked |
| `new` tables missing after Vercel auto-deploy (without GitHub Deploy) | `push-vercel` only applies safe cleanup, not `drizzle-kit push` | run `pnpm --filter @workspace/db run push` against Neon, or use the GitHub deploy workflow |
