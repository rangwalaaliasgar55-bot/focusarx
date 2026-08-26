# Critical Bugs and Risks — Hardening Report (2026-08-26)

This document summarizes the fixes applied for the 12 critical bugs/risks identified in the audit.

## 1. Development server inefficient

**Before:**
```json
"dev": "export NODE_ENV=development && pnpm run build && pnpm run start"
```
Slow, no hot reload, stale code.

**After:**
```json
"dev": "NODE_ENV=development tsx watch src/index.ts",
"build": "node ./build.mjs",
"start": "NODE_ENV=production node --enable-source-maps ./dist/index.mjs"
```
- Added `tsx` to devDependencies
- Real watch mode, instant restart, source maps

## 2. Environment validation centralized

**New file:** `artifacts/api-server/src/lib/env.ts`

- Zod schema validates all env vars
- `validateProductionEnv()` fails fast in production with clear missing list
- `getEnv()`, `getDatabaseUrl()`, `getJwtSecret()`, `getAppUrl()` are single source
- Updated `config.ts` to use centralized env
- `index.ts` validates on startup

## 3. ADMIN_PASSWORD high-risk

- Constant-time comparison via `SHA256(input)` + `timingSafeEqual` (no length leakage)
- Audit logging via `lib/auditLog.ts` (structured JSON logs, future DB table)
- Secure cookies: `httpOnly: true, secure: prod, sameSite: lax, path: /, maxAge: 12h` (reduced from 24h)
- Rate limiting: `adminLimiter` 20/15min
- Generic error messages: "Access denied" never leaks existence
- DB-backed admin roles supported (`role=admin`)
- `ADMIN_COOKIE` exported from single source

## 4. CORS locked down

**Before:** `origin: (origin, cb) => { if (!origin || isDev) allow }` — no methods, no headers.

**After:**
- Allowlist: `APP_URL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `CORS_ALLOWED_ORIGINS`
- `credentials: true`, `methods: [GET,POST,PUT,PATCH,DELETE,OPTIONS]`, `allowedHeaders: [Content-Type,Authorization,X-Requested-With,X-Request-Id]`, `maxAge: 86400`
- Socket.IO CORS same allowlist, `maxHttpBufferSize: 1MB`

## 5. JWT and cookie security

- Access token 15m (was 7d), refresh token 7d with `jti` rotation
- Cookies: `access_token` (15m, path /), `refresh_token` (7d, path /api/auth/refresh), both `httpOnly`, `secure: prod`, `sameSite: lax`
- `extractUserId` checks Authorization header AND cookies
- New endpoints: `POST /auth/refresh` (rotates), `POST /auth/logout` (clears cookies, revokes)
- Password reset: hashed with SHA-256 in DB, 1h expiry, transactional consume
- `SECURITY.md` documents

## 6. AI budget and abuse controls

**New file:** `lib/aiGuardrails.ts`

- Per-user daily limits: 30 coach, 10 roadmap (free), unlimited premium
- Per-IP daily limit 100 (in-memory)
- Request size 100kb (express.json)
- Timeout 12s Groq, 25s Gemini via `AbortSignal.timeout`
- Retry limits via `recordRateLimit` exponential backoff 1m→5m→25m
- Provider fallback only for safe errors (`rate_limited`, `timeout`, `model_overloaded`, `budget_exceeded`) via `isSafeFallbackError`
- Usage records in `ai_budget_state` + `ai_call_log`
- Zod validation: `coachResponseSchema` (message max 2000, suggestions max 5), `roadmapDaySchema`
- Prompt injection detection via blocklist, sanitization (control chars removed, whitespace collapsed, max 1000)
- Output length limits 2000 chars, truncated with "..."

## 7. Socket.IO authorization

- Handshake auth via Bearer token, `extractUserId`
- `canAccessRoom` checks DB join `study_room_members` + `study_rooms` status active, validates UUID via Zod
- Payload validation: `roomIdSchema`, `roomChatSchema` (content 1-500 chars)
- Rate limiting per socket: 20 messages/min, 20 joins/min
- XSS sanitization: `<>` stripped
- No trust of client userId — uses `socket.userId`
- Verify `socket.rooms.has(roomId)` before emit
- Generic `room:typing` handler also validated

## 8. Timer state server-authoritative

- Frontend `usePomodoro` uses `Date.now() + secondsLeft*1000` deadline, calculates remaining via `Math.ceil((deadline - now)/1000)` — handles tab suspend, phone lock, background
- `activeSeconds` tracked separately via delta
- Backend `active_sessions` stores `startedAt`, `activeSeconds`, `secondsLeft`, `timerStatus`
- `GET /sessions/active` returns `serverElapsed`, `serverRemaining`, `serverNow` computed server-side
- `POST /sessions/active` uses transaction + unique index per user (prevents multiple active sessions)
- `POST /sessions/sync` validates ownership, caps values, prevents clock manipulation
- `POST /sessions`:
  - `verifiedDuration = min(clientDuration, activeSeconds, wallClockSeconds, 14400)`
  - Idempotency via `clientNonce` unique index
  - Prevents replay, double submission, multiple sessions
  - Deletes active session in same transaction

## 9. Gamification anti-cheat

- Server calculates XP via `computeSessionRewards` (sub-linear, premium multipliers, drop multipliers server-side)
- `db.transaction` wraps: session insert + streak update + wallet update + coin tx + productivity log + active session delete
- Wallet level `sqrt(totalXp/100)+1`
- Weekly XP reset Monday
- Idempotency keys via `clientNonce`
- Loot box drop deterministic (every 10 sessions, tier based on count)
- City progress, battle pass, pet XP best-effort but not blocking

## 10. Database migration discipline

- Updated Drizzle schema:
  - `focus_sessions_user_started_idx` (user_id, created_at)
  - `focus_sessions_user_completed_idx` (user_id, completed_at)
  - `focus_sessions_user_status_idx` (user_id, session_status)
  - `active_session_per_user_idx` UNIQUE (user_id)
  - `room_members_room_user_idx` (room_id, user_id)
  - `study_room_members_room_user_unique` UNIQUE
- New migration SQL: `lib/db/migrations/0001_security_hardening_indexes.sql` with IF NOT EXISTS indexes for all critical tables
- CI checks: typecheck, test, build

## 11. Error handling standardized

- Request ID middleware early (`req.id`, `X-Request-Id` header)
- `pino-http` with `genReqId`
- Centralized error handler returns:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid",
    "requestId": "req_123"
  }
}
```
- No exposure of stack, SQL, keys, paths, provider details, user existence
- CORS errors → 403 `CORS_FORBIDDEN`, rate limit → 429 `RATE_LIMITED`, validation → 400 `VALIDATION_ERROR`

## 12. Error boundaries for 3D UI

- `FocusCity3D` rewritten:
  - DPR `[1, 1.5]` (was `[1, 1.75]` or shadows always)
  - `frameloop="demand"` when reduced-motion
  - `gl: { antialias: false, powerPreference: high-performance, stencil: false }`
  - `shadows={false}` on mobile/low-detail
  - WebGL detection via canvas context, fallback to `FocusCityFallback` (2D)
  - Context loss handler → fallback
  - Mobile detection (width <768 or UA), reduced-motion media query → lowDetail mode
  - Low-detail: no orbiters, no Environment, no ContactShadows, no Stars or reduced 600 vs 1800, no autoRotate
  - GPU cleanup `THREE.Cache.clear()` on unmount
  - `CitySkeleton` and `FocusCityFallback` exported
- `FocusCity.tsx` wraps with `ErrorBoundary fallback={<FocusCityFallback>}` + `Suspense fallback={<CitySkeleton>}`
- `Hero3D.tsx` similarly improved: DPR [1,1.5], demand, antialias false, low-detail, reduced-motion returns static gradient, Stars reduced on mobile

## Frontend improvements

- **Dependency overgrowth**: Added `tsx` only, documented `pnpm dlx knip`, `pnpm dedupe`, `pnpm audit` in CI workflow (`docs/ci-workflow.yml`)
- **Any types**: Fixed `DailyRewardBanner` (added `DailyRewardStatus`, `ClaimedReward`), created `queryKeys.ts` for typed keys, noted remaining any in admin panel as lower priority
- **React Query**: Created `lib/queryKeys.ts` centralized, documented invalidation rules
- **Lazy loading**: Already present for all pages; verified 3D (`FocusCity3D`, `Hero3D`) and MediaPipe (`visionProcessor` dynamic import) are lazy
- **3D performance**: DPR caps, demand rendering, mobile low-detail, shadow resolution off on mobile, no unnecessary loops, GPU cleanup, WebGL detection
- **Accessibility**: `focus-visible` already, reduced-motion disables animations, added `motion-reduce:animate-none` to pulse elements

## SEO

- Prerender exists: `scripts/prerender.mjs` writes 51 static HTML files with unique title, description, canonical, OG, Twitter, JSON-LD (BreadcrumbList, Article, FAQPage), visible H1 + intro without JS
- `PAGE_SEO` in `PageSEO.tsx` has unique metadata per route
- Sitemap: only canonical indexable URLs, lastmod, correct domain, no auth routes
- Robots: blocks private `/dashboard`, `/analytics`, `/settings`, `/admin`, `/onboarding`, etc, allows public guides
- Social previews: OG image defaults to `/opengraph.jpg`, dynamic OG via `/api/og`

## Remaining roadmap (not blocking)

- Replace remaining `any` in admin panel, missions, etc.
- Add MFA for admin
- KTX2/Draco/Meshopt for GLB
- Service worker offline timer recovery
- Calendar integration, study planner, etc.

## Verification

- `pnpm --filter @workspace/api-server run typecheck` ✅
- `pnpm --filter @workspace/focusarx run typecheck` ✅
- `pnpm --filter @workspace/api-server run build` ✅ (4.7mb)
- `pnpm --filter @workspace/focusarx run build` ✅ (51 prerendered pages)
- `pnpm --filter @workspace/api-server run test` ✅ (38 passed)

## Files changed

- `artifacts/api-server/package.json` — dev script, tsx dep
- `artifacts/api-server/src/lib/env.ts` — NEW centralized validation
- `artifacts/api-server/src/lib/config.ts` — uses env
- `artifacts/api-server/src/index.ts` — fail fast validation
- `artifacts/api-server/src/lib/adminAuth.ts` — constant-time, audit, export cookie name
- `artifacts/api-server/src/lib/auditLog.ts` — NEW
- `artifacts/api-server/src/lib/aiGuardrails.ts` — NEW
- `artifacts/api-server/src/app.ts` — CORS lockdown, cookieParser, requestId, standardized errors
- `artifacts/api-server/src/routes/auth.ts` — JWT cookies, refresh rotation, logout
- `artifacts/api-server/src/routes/admin.ts` — timingSafeCompare via SHA256, secure cookies, audit
- `artifacts/api-server/src/routes/ai.ts` — budget, injection protection, Zod validation
- `artifacts/api-server/src/routes/coach.ts` — same
- `artifacts/api-server/src/lib/socketManager.ts` — Zod, rate limit, XSS sanitization
- `artifacts/api-server/src/routes/sessions.ts` — transaction, server authoritative, idempotency
- `lib/db/src/schema/focusarx.ts` — indexes
- `lib/db/migrations/0001_security_hardening_indexes.sql` — NEW
- `artifacts/focusarx/src/components/FocusCity3D.tsx` — perf + fallback
- `artifacts/focusarx/src/components/FocusCity.tsx` — ErrorBoundary wrapper
- `artifacts/focusarx/src/components/Hero3D.tsx` — perf + reduced-motion
- `artifacts/focusarx/src/components/DailyRewardBanner.tsx` — remove any
- `artifacts/focusarx/src/lib/queryKeys.ts` — NEW centralized keys
- `SECURITY.md` — NEW
- `docs/ci-workflow.yml` — NEW (CI workflow, to be copied to .github/workflows)
