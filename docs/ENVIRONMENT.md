# Environment Variables Reference

Complete inventory of every environment variable this app reads, verified against the source code.

> For the **ordered production launch walkthrough** (Vercel + Neon + GitHub
> secrets + domain + admin), see **[docs/PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)**.

---

## ⚠️ Values are validated, not just read — a malformed value is worse than a missing one

Every variable below is parsed by a Zod schema in `artifacts/api-server/src/lib/env.ts`.
There are two failure modes, and they behave very differently:

| Situation | Result |
|---|---|
| Variable **absent** | API returns `503 CONFIG_ERROR` naming exactly what is missing. The app stays up. |
| Variable **present but invalid** | Before the fix described below: the serverless module crashed at import and **every** `/api/*` route returned HTTP 500. Now: the variable is dropped, logged at ERROR, and reported by the same `503 CONFIG_ERROR` gate. |

### Hard constraints

| Variable | Rule | Invalid examples |
|---|---|---|
| `NODE_ENV` | exactly `development`, `test` or `production` | `prod`, `Production`, `prodution` |
| `AUTH_SECRET` / `SESSION_SECRET` | ≥ 32 characters | any shorter secret |
| `ADMIN_PASSWORD` | ≥ 8 characters (16+ recommended) | a password under 8 characters |
| `CRON_SECRET` | ≥ 16 characters | any shorter secret |
| `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL` | a parseable URL — **never an empty string** | `` (empty), missing scheme, a value wrapped in quotes |
| `APP_URL`, `VITE_APP_URL`, `UPSTASH_REDIS_REST_URL` | a parseable URL | empty string, `example.com` with no `https://` |
| `PORT`, `SMTP_PORT` | a number | empty string, `abc` |

> **Do not set a variable to an empty string to "disable" it. Delete it instead.**
> An empty string fails URL/number validation, which is the single most common
> cause of the 500-on-every-route failure this document now guards against.

### Errors vs. advisories

`ADMIN_PASSWORD` is the one variable where "invalid" and "not ideal" are
different things, so `lib/env.ts` splits them:

| Length | Result |
|---|---|
| under 8 chars | **error** — dropped, feature disabled, named in `503 CONFIG_ERROR` |
| 8–15 chars | **warning** — accepted, admin login works, logged as "shorter than the recommended 16 characters" |
| 16+ chars | accepted silently |

Only **errors** reach the config gate. A shorter-but-usable admin password must
never take the API down: the failure mode of a stricter floor is not a crash
(that was fixed) but a *silent* one, where the key is dropped, admin login
stops working, and every health check still reports green.

Look for `[env] Ignoring invalid <VAR>` in the logs — one greppable line per
rejected variable, with the value never included.

### Diagnosing a misconfigured deployment

Three unauthenticated probes, none of which expose values, hosts or credentials:

```bash
curl -s https://<host>/api/healthz          # 200 as long as the function loaded
curl -s https://<host>/api/healthz/config   # { ok, database, authSecret, adminPassword, errors[] }
curl -s https://<host>/api/healthz/ready    # 200 ready / 503 degraded, incl. a live DB query
```

`GET /api/healthz/config` returns `200` even when misconfigured — a probe that
503s on the exact condition you are trying to diagnose is useless. Read
`ok: false` and the `errors` array.

These three endpoints are exempt from the configuration gate, as are
`/api/site/settings` (falls back to built-in defaults, flagged `degraded: true`)
and `/api/deployment` (so users are still told to refresh during an incident).

---

## ✅ Required (production)

| Variable | Read by | Purpose |
|---|---|---|
| `DATABASE_URL` | `lib/db/src/index.ts`, `lib/config.ts` | PostgreSQL connection string. On Vercel, `POSTGRES_URL_NON_POOLING` is preferred first (pooler transaction mode breaks prepared statements). Also accepts `POSTGRES_PRISMA_URL` / `POSTGRES_URL`. |
| `AUTH_SECRET` | `lib/config.ts` | JWT signing secret (32+ random chars). `SESSION_SECRET` accepted as legacy alias. In dev, an ephemeral secret is generated per boot if unset. |
| `ADMIN_PASSWORD` | `lib/config.ts`, `routes/admin.ts` | Bootstrap password for `/admin`. Mandatory in production; users with `role=admin` in DB also have access. |
| `APP_URL` | `lib/config.ts` | Canonical public origin — used for password-reset links, CORS allowlist, OAuth redirects. Falls back to `VERCEL_URL`, then `https://focusarx.vercel.app`. **Set this to the custom domain you actually serve (e.g. `https://focusarx.site`) right after attaching it** — otherwise every login/refresh/track POST fails CORS while GETs keep working (see `docs/SECURITY.md` § CORS). |
| `CORS_ALLOWED_ORIGINS` | `middlewares/cors.ts` | Comma-separated extra CORS origins (e.g. a staging host). Optional — same-origin requests (`Origin` host === request host) and `www.`/apex counterparts of `APP_URL` are always allowed. |

## 📧 Email via Resend (recommended)

Powers **all** outbound email. Already wired into four code paths:

| Variable | Read by | Purpose |
|---|---|---|
| `RESEND_API_KEY` | `routes/auth.ts` (password reset), `routes/email.ts` (admin blasts), `routes/contact.ts` (contact notifications), `routes/adminModeration.ts` (moderation digest) | Resend API key (`re_...`). Get one at resend.com → API Keys. |
| `EMAIL_FROM` | same four files | Verified sender, e.g. `"FocusArx <noreply@yourdomain.com>"`. Defaults vary per path — set this explicitly once your domain is verified in Resend. Test-mode keys may only send from `onboarding@resend.dev` to your own address. |

### SMTP fallback (only if `RESEND_API_KEY` is unset)

Password-reset emails fall back to nodemailer SMTP:

`SMTP_HOST`, `SMTP_PORT` (587 default; 465 ⇒ implicit TLS), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

Without Resend or SMTP: admin blasts/moderation digests are skipped (logged), password reset reports `emailSent: false`.

## 🤖 AI features (optional — all degrade gracefully)

| Variable | Read by | Purpose |
|---|---|---|
| `GROQ_API_KEY` | `routes/coach.ts`, `routes/aiInsights.ts`, `routes/flashcards.ts`, `routes/focusDna.ts`, `lib/moderation.ts`, `lib/aiProvider.ts` | AI coach chat, insights, flashcard generation + LLM content moderation. Without it: built-in canned responses + keyword-only moderation. |
| `GEMINI_API_KEY` | `routes/ai.ts`, `lib/aiProvider.ts` | AI study-roadmap generator + shared LLM gateway (Gemini → Groq fallback chain). Without it: local template roadmap. |


## 🔔 Web push (optional)

| Variable | Read by | Purpose |
|---|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | `lib/pushSender.ts` | Web-push identity. If unset, ephemeral keys are generated at boot and printed to logs — push subscriptions break on every restart/deploy, so set these. Generate: `npx web-push generate-vapid-keys`. |

## 🌐 Frontend (Vite — build-time, prefix `VITE_`)

| Variable | Read by | Purpose |
|---|---|---|
| `VITE_APP_URL` | SEO/meta code | Canonical origin for `<link rel=canonical>`, og:url, sitemap. Defaults to `https://focusarx.site`. |
| `VITE_GA_MEASUREMENT_ID` | `src/lib/gtag.ts` | GA4 measurement ID (`G-...`). Loads gtag.js + SPA page-view events when set. |

## ⏰ Scheduled jobs (optional)

| Variable | Read by | Purpose |
|---|---|---|
| `CRON_SECRET` | `routes/retention.ts` | Bearer secret Vercel Cron sends to `GET /api/retention/reengage/run` (win-back push digests; see `crons` in `vercel.json`). Vercel attaches `Authorization: Bearer $CRON_SECRET` automatically when the variable is set on the project. Without it the endpoint replies 503 and no pushes are sent. |

## 🔧 Platform / infra (set automatically)

`PORT` (server listen; Vercel serverless skips listen), `NODE_ENV`, `VERCEL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `LOG_LEVEL`, `BASE_PATH`.

Google OAuth placeholders (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) are read into config but no OAuth route is currently implemented — optional.

## 🚀 Deployment Skew Protection (set automatically on Vercel)

These variables are injected by Vercel during builds and deployments. They power
the deployment skew protection system that prevents users from loading frontend
assets from one deployment while API requests go to another.

| Variable | Read by | Purpose |
|---|---|---|
| `VERCEL_DEPLOYMENT_ID` | `lib/deploymentVersion.ts`, `vite.config.ts` | Unique per-deployment identifier. Used as the canonical deployment version. |
| `VERCEL_GIT_COMMIT_SHA` | `lib/deploymentVersion.ts`, `vite.config.ts` | Git commit SHA (also accepted for skew checks, including abbreviated 7+ char prefixes). |
| `DEPLOYMENT_VERSION` / `VITE_DEPLOYMENT_VERSION` | `lib/deploymentVersion.ts`, `vite.config.ts`, frontend `lib/deploymentSkew.ts` | Explicit override for Docker/custom hosts. **Set both to the same value** (one at API runtime, one at frontend build time) or skew detection cannot work there. |

### Skew protection needs a stable identifier — or it stays off

The guard compares the frontend's baked version against every stable id the
API knows (`VERCEL_DEPLOYMENT_ID`, 12-char `VERCEL_GIT_COMMIT_SHA`,
`DEPLOYMENT_VERSION`). Two rules prevent a repeat of the incident where skew
protection 409'd every mutation while the banner survived every refresh:

- **Fail open, never closed.** With no stable identifier the API answers
  `unverifiable` (every instance agrees) and lets mutations through instead
  of blocking the product. Watch for
  `[deploy-skew] No stable deployment identifier … skew protection is OFF`
  in the logs — that line means: enable **Settings → Environment Variables
  → System Environment Variables** on Vercel, or set `DEPLOYMENT_VERSION`
  (+ matching `VITE_DEPLOYMENT_VERSION` at build time) on custom hosts.
- **The frontend stays quiet when skew can't be judged** (dev sentinels,
  `unverifiable`), clears the banner itself when versions agree again, and
  caps fast polling (~10 min) before dropping back to the normal 2-minute
  interval — a stuck mismatch can no longer poll `/api/deployment` every
  30s forever.
| `VERCEL_ENV` | `lib/deploymentVersion.ts` | `production`, `preview`, or `development`. Controls environment-specific behavior. |
| `DEPLOYMENT_VERSION` | `lib/deploymentVersion.ts` | Explicit deployment version override (for Docker / custom deploys). |
| `VITE_DEPLOYMENT_VERSION` | Frontend (via `define`) | Deployment version baked into the frontend at build time. |

### How deployment skew protection works

1. The frontend embeds its build version at compile time (`__DEPLOYMENT_VERSION__`).
2. Every API request includes an `X-FocusArx-Deployment` header with the frontend version.
3. The server compares this header with its own version.
4. On mismatch: GET requests pass through (safe), mutations are blocked (409).
5. The frontend polls `GET /api/deployment` every 5 minutes + on window focus.
6. On detected skew: an "Update available" banner is shown (non-destructive).
7. User clicks "Update now" → form data is saved → hard refresh loads new deployment.
8. The service worker clears its cache on `CLEAR_CACHE` messages to purge stale chunks.

## Quick start (minimum viable prod)

```bash
DATABASE_URL=postgresql://...?sslmode=require
AUTH_SECRET=<32+ random chars>
ADMIN_PASSWORD=<strong password>
APP_URL=https://your-domain.com
RESEND_API_KEY=re_...
EMAIL_FROM="FocusArx <noreply@your-domain.com>"
```
