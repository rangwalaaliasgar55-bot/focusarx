# Environment Variables Reference

Complete inventory of every environment variable this app reads, verified against the source code (August 2026).

## ✅ Required (production)

| Variable | Read by | Purpose |
|---|---|---|
| `DATABASE_URL` | `lib/db/src/index.ts`, `lib/config.ts` | PostgreSQL connection string. On Vercel, `POSTGRES_URL_NON_POOLING` is preferred first (pooler transaction mode breaks prepared statements). Also accepts `POSTGRES_PRISMA_URL` / `POSTGRES_URL`. |
| `AUTH_SECRET` | `lib/config.ts` | JWT signing secret (32+ random chars). `SESSION_SECRET` accepted as legacy alias. In dev, an ephemeral secret is generated per boot if unset. |
| `ADMIN_PASSWORD` | `lib/config.ts`, `routes/admin.ts` | Bootstrap password for `/admin`. Mandatory in production; users with `role=admin` in DB also have access. |
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
| `GROQ_API_KEY` | `routes/coach.ts`, `lib/moderation.ts` | AI coach chat + LLM content moderation. Without it: built-in canned responses + keyword-only moderation. |
| `GEMINI_API_KEY` | `routes/ai.ts` | AI study-roadmap generator. Without it: local template roadmap. |

> Note: `ANTHROPIC_API_KEY` appears in older docs but is **not read anywhere** in current code.

## 🔔 Web push (optional)

| Variable | Read by | Purpose |
|---|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | `lib/pushSender.ts` | Web-push identity. If unset, ephemeral keys are generated at boot and printed to logs — push subscriptions break on every restart/deploy, so set these. Generate: `npx web-push generate-vapid-keys`. |

## 🌐 Frontend (Vite — build-time, prefix `VITE_`)

| Variable | Read by | Purpose |
|---|---|---|
| `VITE_APP_URL` | SEO/meta code | Canonical origin for `<link rel=canonical>`, og:url, sitemap. Defaults to `https://focusarx.site`. |
| `VITE_GA_MEASUREMENT_ID` | `src/lib/gtag.ts` | GA4 measurement ID (`G-...`). Loads gtag.js + SPA page-view events when set. |

## 🔧 Platform / infra (set automatically)

`PORT` (server listen; Vercel serverless skips listen), `NODE_ENV`, `VERCEL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `LOG_LEVEL`, `BASE_PATH`.

Google OAuth placeholders (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) are read into config but no OAuth route is currently implemented — optional.

## Quick start (minimum viable prod)

```bash
DATABASE_URL=postgresql://...?sslmode=require
AUTH_SECRET=<32+ random chars>
ADMIN_PASSWORD=<strong password>
APP_URL=https://your-domain.com
RESEND_API_KEY=re_...
EMAIL_FROM="FocusArx <noreply@your-domain.com>"
```
