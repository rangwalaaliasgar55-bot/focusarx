# FocusArx — Production Hardening Audit (Phase 1)

Date: 2026-08-28
Scope: full repository inspection prior to architectural change.

---

## 1. Root cause of the production HTTP 500s — **FOUND AND REPRODUCED**

### Symptom

Every `/api/*` endpoint returns HTTP 500 in production:

```
/api/site/settings
/api/auth/session
/api/auth/login
/api/deployment
/api/track
```

The fact that **all** endpoints fail — including `/api/healthz`-adjacent public
endpoints and ones with completely unrelated code paths — is the decisive clue.
It is not a per-route bug; the serverless function module never finishes
evaluating.

### Mechanism

`getEnv()` in `artifacts/api-server/src/lib/env.ts` **throws during module
evaluation** when `NODE_ENV === "production"` and *any* Zod validation fails:

```ts
// lib/env.ts:87-93  (before fix)
const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("[env] Invalid environment variables:\n" + formatZodErrors(result.error));
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invalid environment variables:\n" + formatZodErrors(result.error));
  }
  ...
}
```

`getEnv()` is reached at **module load time** through this chain:

```
src/routes/auth.ts
  → src/lib/rateLimiter.ts      (module scope: `store(...)` × 8)
    → src/lib/rateLimitStore.ts (getRateLimitStore → getRedisClient → isDistributedLimiterConfigured)
      → src/lib/env.ts          (getEnv()  ← THROWS)
```

Confirmed stack trace from the built bundle (`artifacts/api-server/dist/app.mjs:65330`):

```
Error: Invalid environment variables:
  - AUTH_SECRET: AUTH_SECRET must be at least 32 characters
    at getEnv (…/app.mjs:65330:13)
    at isDistributedLimiterConfigured (…/app.mjs:87515:15)
    at getRedisClient (…/app.mjs:87519:8)
    at getRateLimitStore (…/app.mjs:87530:18)
    at store (…/app.mjs:87577:10)
    at src/lib/rateLimiter.ts (…/app.mjs:87600:14)
    at src/routes/auth.ts (…/app.mjs:88036:5)
```

On Vercel, a serverless function whose module throws on import returns **HTTP
500 for every request** and never emits a route-level log. That is why the
runtime logs looked empty and why per-endpoint debugging found nothing.

### Reproduction

`scripts/repro-500.mjs` boots the built `dist/app.mjs` under five environment
scenarios. Results **before** the fix:

| Scenario | Result |
|---|---|
| A. No env vars at all | 503 `CONFIG_ERROR` (module loads fine — everything is optional) |
| B. `AUTH_SECRET` = 12 chars | **module load crash → 500 on all routes** |
| C. `ADMIN_PASSWORD` = 5 chars | **module load crash → 500 on all routes** |
| D. All vars valid, DB unreachable | correct 200/401/400 responses |
| E. `DATABASE_URL=""` | **module load crash → 500 on all routes** |

### Critical nuance

**Missing** variables do **not** cause 500 — every field in `envSchema` is
`.optional()`, so an empty environment parses cleanly and the request-time gate
returns an explicit `503 CONFIG_ERROR` naming what is missing.

**Malformed** variables cause 500. Any of these is fatal:

| Variable | Zod rule | Malformed example |
|---|---|---|
| `NODE_ENV` | `enum(["development","test","production"])` | `prod`, `Production`, `prodution` |
| `AUTH_SECRET` | `.min(32)` | any shorter secret |
| `SESSION_SECRET` | `.min(32)` | any shorter secret |
| `ADMIN_PASSWORD` | `.min(16)` | any shorter password |
| `CRON_SECRET` | `.min(16)` | any shorter secret |
| `DATABASE_URL` / `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` / `POSTGRES_PRISMA_URL` | `.url()` | empty string, `postgres://…` typo, pasted value with surrounding quotes |
| `APP_URL` / `VITE_APP_URL` / `UPSTASH_REDIS_REST_URL` | `.url()` | empty string, missing scheme |
| `PORT` / `SMTP_PORT` | `z.coerce.number()` | empty string, `abc` |

This is why the previously attempted remedies (adding `DATABASE_URL`, adding
`AUTH_SECRET`, checking migrations, checking SSL) all appeared not to help: they
addressed *absence*, and the failure was *invalidity*.

### Secondary defects found in the same area

1. `getEnv()` cached only the success path, so the dev recovery re-parsed on
   every call.
2. `validateProductionEnv()` (called only from the standalone `index.ts`) also
   throws, producing a boot crash loop instead of a diagnosable running server.
3. `/api/site/settings` is exempt from the maintenance gate but **not** from the
   config gate, so it 503s even though it is perfectly capable of returning safe
   defaults.
4. `/api/track` is a best-effort analytics endpoint, but a DB failure there
   returns 500 and the client may retry, amplifying load during an incident.
5. The error handler returned `err.message` to clients in non-production only —
   acceptable, but JSON body shape was inconsistent (`{error:"..."}` in some
   routes vs `{error:{code,message}}` in others).

---

## 2. Repository map

### Workspace layout

```
/                       pnpm workspace root (pnpm@10.26.1)
├─ artifacts/focusarx/  React 19 + Vite 7 + Tailwind 4 SPA  (78 routes, 18.8k LOC pages)
├─ artifacts/api-server/ Express 5 API (78 route modules, ~60 lib modules)
├─ api/index.mjs        Vercel serverless entry → re-exports dist/app.mjs
├─ lib/db/              Drizzle schema (16 schema files) + migrations
├─ lib/api-spec/        OpenAPI source of truth
├─ lib/api-zod/         generated zod schemas
├─ lib/api-client-react/ generated typed client (2.3k LOC — ~98% unused)
├─ tests/e2e/           Playwright (2 specs, 2 projects)
└─ docs/                ENVIRONMENT, AUDIT, ENGINEERING_REPORT, migrations
```

### Frontend — 78 routes

Protected routes: 33. Router: `wouter`. All pages `React.lazy()`; one outer
`<Suspense>` (plus ~20 redundant inner ones).

Notable routes: `/` (dual landing/dashboard), `/dashboard`, `/focus` (timer),
`/forge-room`, `/city` (Focus City — currently **2D DOM grid, no 3D**),
`/ai-insights` (AI Coach), `/analytics` (Insights), `/onboarding`, `/profile`,
`/study-rooms`, plus ~20 SEO guide pages and 6 legal pages.

### Backend — 78 route modules

Mounted in `src/routes/index.ts`. Auth: `src/routes/auth.ts` (JWT access 15m +
DB-backed rotating refresh families, httpOnly cookies, bcrypt 12, reset tokens
SHA-256 hashed at rest).

### Database

Drizzle + `pg` Pool. `resolveDatabaseUrl()` prefers `POSTGRES_URL_NON_POOLING`
on Vercel (pooler transaction mode breaks prepared statements). SSL is handled
via the Pool `ssl` option with `rejectUnauthorized: true`, and SSL query params
are stripped from the URL to avoid driver conflicts. `sslmode=disable` is
respected.

---

## 3. Issues inventory

### P0 — production blocking

| # | Issue | Location |
|---|---|---|
| 1 | `getEnv()` throws at module load → 500 on every route | `lib/env.ts:87-93` |
| 2 | `getEnv()` reached at module load via rate limiter stores | `lib/rateLimiter.ts:45,107,141…` |
| 3 | `validateProductionEnv()` throws → standalone boot crash | `index.ts:11`, `lib/env.ts:117` |
| 4 | `/api/site/settings` blocked by config gate although it can return defaults | `app.ts:207-226` |

### P0 — security

| # | Issue | Location |
|---|---|---|
| 5 | `/developer` is **public** (no `ProtectedRoute`, no `AdminGate`) — exposes `ApiDocumentation` + `SchemaExplorer` | `App.tsx:296` |
| 6 | `/admin` is route-level public, relies solely on internal `AdminGate` | `App.tsx:251` |
| 7 | Hardcoded AdSense publisher ID fallback `ca-pub-3831356027941619` | `components/AdSense.tsx:17` |
| 8 | MediaPipe WASM + face model loaded from CDN with no SRI / pinning | `lib/vision/visionProcessor.ts:18-19` |
| 9 | `allowedHosts: true` + `host 0.0.0.0` on the dev server | `vite.config.ts:99-100` |
| 10 | Vite security headers are dev-server-only; `preview` has none | `vite.config.ts:115-125` |

### P1 — accessibility (WCAG)

| # | Issue | Location |
|---|---|---|
| 11 | Skip-link CSS exists (`.skip-to-content`, 33 lines) but **no element uses it** — WCAG 2.4.1 unmet | `index.css:468-483` |
| 12 | `<div onClick>` radio stand-ins for group visibility — no `role="radio"`, no `aria-checked`, no keyboard, no fieldset | `pages/groups.tsx:81,85` |
| 13 | `aria-label` on non-interactive elements without `role` | `AppShell.tsx:220,332` |
| 14 | Clickable `<div>`/`<motion.div>` with no role/keyboard handler | `pages/roadmap.tsx:198`, `pages/city.tsx:48`, `SqlConsolePanel.tsx:556,602`, `ShareCardModal.tsx:203` |
| 15 | Missing `key` on mapped rows (concentrated in `components/admin/*`, ~40 candidates) | various |
| 16 | No `<StrictMode>` — double-invoked effects and missing cleanup stay hidden | `main.tsx:61` |
| 17 | `tsconfig.base.json` disables `strictFunctionTypes`, `noUnusedLocals`, `noImplicitReturns`; `strict` is not set | `tsconfig.base.json` |

### P1 — mobile

| # | Issue | Location |
|---|---|---|
| 18 | `MobileBottomNav` accepts `onMoreClick` but never uses it → "More" affordance is dead; `MobileMoreTrigger` exported but never imported | `MobileBottomNav.tsx:31,35`, `AppShell.tsx:401` |
| 19 | `MobileBottomNav` runs a permanent 1s `setInterval` DOM poll duplicating `fx:focus-*` events | `MobileBottomNav.tsx:51` |
| 20 | `MobileWelcomeGate` hardcoded public-path allowlist — every new public page must be manually added or mobile visitors get bounced to `/welcome` | `App.tsx:154-163` |
| 21 | `ProtectedRoute` drops the redirect target — deep links land on `/` after login | `App.tsx:179-188` |
| 22 | Only 5 of 78 routes have any e2e coverage, all public marketing pages | `tests/e2e/` |

### P2 — architecture / maintainability

| # | Issue | Location |
|---|---|---|
| 23 | `pages/focus-timer.tsx` lazy-declared but never routed (dead) | `App.tsx:82` |
| 24 | `/dna` and `/focus-dna` both render `FocusDnaPage` | `App.tsx:305,318` |
| 25 | 203 raw `fetch("/api/…")` calls in 80 files bypass `apiFetch` → no 401 refresh, no skew handling, no typed errors | various |
| 26 | 3 separate sound engines (`components/SoundEngine.tsx`, `lib/soundEngine.ts`, inline class in `pages/forge.tsx:34`) | |
| 27 | `canUseWebGL()` duplicated 3× (`Hero3D.tsx:7`, `ThreeBackground.tsx:8`, `Pet3D.tsx:23`) | |
| 28 | `use3DQuality` tier system exists (4 tiers) but is wired only to `ThreeBackground`; `Hero3D` and `Pet3D` hardcode DPR | `hooks/use3DQuality.ts` |
| 29 | `Pet3D.tsx` (837 LOC, imports `three`) is **statically** imported by `pages/pets.tsx` | `pages/pets.tsx:7` |
| 30 | `ShareCardModal.tsx` (253 LOC) entirely unused | |
| 31 | `store/studyMonitorStore.ts` is a non-reactive mutable singleton misnamed "store" | |
| 32 | ~200 undeclared CSS variables referenced from TSX (`--palette-*`, `--rgba-*`); they resolve to `unset` → silent visual breakage | `App.tsx:194`, `focus-timer.tsx:34`, `city.tsx:21`, `AppShell.tsx:220`, … |
| 33 | Three overlapping colour systems (`--brand-violet`, `--brand-600`, `--forge-*`) + two competing token idioms (`var(--x)` vs shadcn semantic classes in `ui/command.tsx`) | `index.css` |
| 34 | 4 dead `manualChunks` branches for uninstalled packages; `has()` matcher too loose (`id.includes(pkg + "/")`) | `vite.config.ts:53-91` |
| 35 | Inconsistent canonical domain: `focusarx.app` vs `focusarx.site` vs `focusarx.site` | `ShareCardModal.tsx:193`, `index.html:32`, `PageSEO.tsx:17` |
| 36 | `sw.js` is outside Vite's pipeline — `SW_VERSION` must be bumped by hand | `public/sw.js:17` |
| 37 | `main.tsx:45` SW update `setInterval` never cleared | |
| 38 | `vitest.config.ts:19` aliases `@assets` to a nonexistent `../../attached_assets` | |
| 39 | `console-hygiene.test.tsx:165` allowlists a file that no longer exists (`camera/FloatingCamera.tsx`) | |
| 40 | `seo:audit` script is `echo` + `grep` — audits nothing | `package.json` |
| 41 | No ESLint in the frontend package | |

---

## 4. Remediation plan

**Phase 2** — make env handling total; add structured errors, health + DB
connectivity checks; make `/api/site/settings` and `/api/track` non-fatal;
document production setup. Deliverable: `pnpm test` + `pnpm build` green and
`scripts/repro-500.mjs` reporting correct status codes in every scenario.

**Phase 3** — single design-token system in `index.css` (`@theme` + `:root`),
consolidating the three colour systems and replacing every undeclared
`--palette-*` / `--rgba-*` reference. New/expanded primitives under
`components/ui` with explicit default / hover / focus-visible / active /
disabled / loading / error / empty / mobile states.

**Phase 4** — navigation restructured around Today · Focus · Forge Room · Focus
City · Insights · Coach · Learn · Profile; onboarding wizard with persisted
progress and skip.

**Phase 5** — mobile-first pass: fix dead "More" affordance, skip link, drawer
conversion, 44px targets, safe areas, keyboard-safe inputs, scroll lock,
add Playwright responsive specs at 320/360/375/390/414/768/desktop.

**Phase 6** — Today command centre, timer hardening, AI Coach states, Forge Room
presence, Focus City 3D with WebGL detection / low-power mode / static fallback.

**Phase 7** — `pnpm typecheck && pnpm test && pnpm build` green, commit, push.
