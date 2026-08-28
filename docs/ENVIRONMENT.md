# Environment Variables Reference

Complete inventory of every environment variable this app reads, verified against the source code.

## ✅ Required (production)

| Variable | Read by | Purpose |
|---|---|---|
| `DATABASE_URL` | `lib/db/src/index.ts`, `lib/config.ts` | PostgreSQL connection string. On Vercel, `POSTGRES_URL_NON_POOLING` is preferred first (pooler transaction mode breaks prepared statements). Also accepts `POSTGRES_PRISMA_URL` / `POSTGRES_URL`. |
| `AUTH_SECRET` | `lib/config.ts` | JWT signing secret (32+ random chars). `SESSION_SECRET` accepted as legacy alias. In dev, an ephemeral secret is generated per boot if unset. |
| `ADMIN_PASSWORD` | `lib/config.ts`, `routes/admin.ts` | Bootstrap password for `/admin` (**min 12 chars**). Mandatory in production; users with `role=admin` in DB also have access. |
| `APP_URL` | `lib/config.ts` | Canonical public origin — used for password-reset links, CORS allowlist, OAuth redirects. Falls back to `VERCEL_URL`, then `https://focusarx.vercel.app`. |

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
| `VERCEL_GIT_COMMIT_SHA` | `lib/deploymentVersion.ts`, `vite.config.ts` | Git commit SHA (fallback when deployment ID unavailable). |
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
ADMIN_PASSWORD=<strong password, min 12 chars>
APP_URL=https://your-domain.com
RESEND_API_KEY=re_...
EMAIL_FROM="FocusArx <noreply@your-domain.com>"
```
