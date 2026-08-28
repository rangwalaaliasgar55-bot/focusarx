# FocusArx — Production Readiness Audit

**Date:** 2026-08-28 · **Branch:** `arena/01a04883-focusarx` · **Baseline commit:** `6df1cff`
**Scope:** full monorepo — `artifacts/api-server` (Express API), `artifacts/focusarx` (React/Vite SPA), `lib/db` (Drizzle/Postgres), `lib/api-zod` + `lib/api-client-react` + `lib/api-spec` (OpenAPI toolchain), deploy config (Vercel).

**Baseline commands run before any change:**

| Command | Result |
|---|---|
| `pnpm install` (pnpm 10.26.1, Node 22) | ✅ 591 packages |
| `pnpm run typecheck:libs` / `pnpm run typecheck` | ✅ clean (strict-ish tsconfig) |
| `pnpm run test` | ✅ 60 passed, 23 skipped (23 are DB-integration tests that skip without `DATABASE_URL`) |
| `pnpm --filter @workspace/focusarx run build` | ✅ builds + prerenders 51 pages; ⚠️ `react-three-fiber.esm` chunk = 891 kB (240 kB gzip) |

The codebase is in far better shape than a typical "audit needed" repo: pnpm catalogs, env validation, helmet/CSP, request IDs, a route-contract test, pure reward math with tests, guardrails on AI routes, and Socket.IO server-side membership checks. The findings below are therefore mostly about **economic integrity (reward races), trust boundaries (client-authoritative durations), session lifecycle, and consistency**, not a rewrite.

---

## A. Repository map

### Packages

| Package | Path | Responsibility | Key runtime deps |
|---|---|---|---|
| `workspace` | `/` | pnpm workspace root; shared catalogs + security overrides (`qs`, `ws`, `socket.io-parser`, esbuild pins) | typescript, prettier, playwright |
| `@workspace/api-server` | `artifacts/api-server` | Express 5 API, Socket.IO server (dev/self-host only), 65 route modules, ~360 endpoints | express 5, drizzle-orm, socket.io, jsonwebtoken, bcryptjs, web-push, nodemailer, pino |
| `@workspace/focusarx` | `artifacts/focusarx` | React 19 + Vite 7 SPA, ~70 route pages, R3F/Three scenes, offline queue, camera focus monitor | react 19, R3F 9, drei 10, three 0.184, tanstack query 5, wouter, socket.io-client, mediapipe |
| `@workspace/db` | `lib/db` | Drizzle schema (~70 tables), pg Pool singleton, push-based migrations | drizzle-orm, pg, drizzle-zod |
| `@workspace/api-zod` | `lib/api-zod` | **Generated** Zod schemas from `openapi.yaml` (orval) | zod |
| `@workspace/api-client-react` | `lib/api-client-react` | **Generated** React-Query client (orval) | @tanstack/react-query |
| `@workspace/api-spec` | `lib/api-spec` | Source OpenAPI 3.1 spec + orval config | orval |

### Entry points

- **Backend entry:** `artifacts/api-server/src/index.ts` (standalone HTTP + Socket.IO when `PORT` set; exports `app` for Vercel via `api/index.mjs` → `dist/app.mjs`, see `vercel.json`).
- **Frontend entry:** `artifacts/focusarx/src/main.tsx` → `App.tsx` (wouter routes, lazy pages, React Query).
- **Database:** `lib/db/src/index.ts` (pool + schema barrel); schema in `lib/db/src/schema/*.ts`; deploy migration = `drizzle-kit push` wrapped by `scripts/push.mjs`/`push-vercel.mjs` (fails build on TTY-prompt silently skipped).
- **Tests:** `artifacts/api-server` vitest (unit + DB-gated integration), `artifacts/focusarx` vitest (1 file), `tests/e2e` playwright (axe a11y + smoke), `playwright.config.ts`.
- **Deploy:** `vercel.json` (static SPA + `/api/*` → serverless fn, `/assets` immutable cache, cron `0 9 * * *` → `/api/retention/reengage/run`), `.vercelignore`, `build:vercel` chain (`db push` → api build → web build).
- **Generated-code boundary:** everything under `lib/api-zod/src/generated` and `lib/api-client-react/src/generated` — regenerate via `pnpm --filter @workspace/api-spec run codegen`; never hand-edit.

### Observed structure facts

- Package manager: **pnpm 10.26.1** (enforced by `preinstall` shim); Node ≥ 22 (built with 22.x).
- `minimumReleaseAge: 1440` in workspace — supply-chain hardening. ✅
- The **OpenAPI spec covers only 6 of ~360 endpoints** (health + break-free). The generated clients are consumed only by the break-free feature and `main.tsx`. Everything else is hand-rolled `fetch` — a documented drift risk, mitigated only by `routeContract.test.ts`.

---

## B. Runtime architecture (traced)

```
Browser (React 19 SPA)
  → wouter route → lazy page/component
  → fetch/apiJson (Bearer token from localStorage + httpOnly cookies) or generated orval client (break-free)
  → Vercel edge → /api/* serverless fn (api/index.mjs) — or Express in dev (proxy :8080)
  → app.ts middleware chain: requestId → masterSecurity → compression → helmet(CSP) → pino-http
    → CORS allowlist → cookieParser → json(100kb) → security headers → generalLimiter(120/min)
    → config-error gate (503) → maintenance gate (503, DB-backed, /site /admin /auth /healthz exempt)
  → routes/index.ts → <feature>Router → authMiddleware (JWT HS256, issuer/audience pinned)
  → zod validation inline → drizzle queries over pg Pool (max 1 conn on Vercel, 10 local)
  → { error: { code, message, requestId } } envelope
  → React Query cache (staleTime 60s, refetchOnWindowFocus off) / local state
```

Traced flows (verified in code):

- **Registration:** `POST /api/auth/register` → zod → email-uniqueness SELECT → bcrypt(12) → insert → 201. No auto-login (client must call login). Enumeration vector: `EMAIL_EXISTS` (documented below).
- **Login:** `POST /api/auth/login` → limiter 10/15min (prod) → bcrypt compare → sets `access_token` (15m) + `refresh_token` (7d, path-scoped) + `focusarx_token` (legacy 15m) httpOnly cookies → JSON **also returns `token` = legacy 7-day JWT** which the SPA stores in `localStorage` and uses as Bearer. Consequence: the 15-minute access-token design is not actually the operative session mechanism; the 7-day localStorage token is (see Security S-1).
- **Authenticated page load:** route guard in `App.tsx` → `AuthProvider.refresh()` → `GET /api/auth/session` (Bearer) → user in context; queries then fetch with `apiFetch`.
- **Start focus session:** `Timer.tsx` → `usePomodoro.start()` → `useSessionPersistence` → `POST /api/sessions/active` (transaction: delete-then-insert, unique `active_session_per_user_idx`) → server `startedAt` is authoritative → sync every 10 s (`POST /api/sessions/sync`).
- **Pause/resume:** client-only status flip + next `sync` payload (`timerStatus: "paused"|"running"`). Server stores status but does **not** track pause intervals (see §4 note).
- **Complete:** `usePomodoro.advancePhase(record=true)` builds `Session{clientNonce=id}` → `syncFocusSessionToCloud` → `POST /api/sessions` → server verifies duration via `min(durationSec, activeSeconds, wallClock+15, 14400)` → transaction inserts `focus_sessions`, updates streak/wallet/productivity log, deletes active row → post-tx (non-atomic) battle pass, missions, pet XP, city, loot box.
- **Reward creation (coins):** two ledgers exist — `coin_transactions` (legacy, still used) and `token_ledger` (idempotency-keyed, premium economy). `mintCoins`/`burnCoins` are atomic upserts; several callers bypass with direct `user_wallets` updates (retention XP paths).
- **Dashboard analytics:** `GET /api/stats` (server-local-day buckets), `GET /api/sessions/history`, `GET /api/gamification` etc. from React Query.
- **AI coach:** `POST /api/coach/chat` (premium-gated, IP-limited, guardrails, Groq→builtin fallback). **Arx chat:** `POST /api/arx/chat` (30 LLM calls/day/user via `ai_call_log`, template fallback). Both degrade gracefully with zero keys. ✅
- **Flashcards:** `flashcards.ts` — `router.use(authMiddleware)`, per-deck ownership checks on mutations; Leitner scheduling server-side.
- **Join room / chat:** REST join via `studyRooms.ts` (membership row) + Socket.IO `join:room` → `canAccessRoom` membership check → `room:chat` (zod, 20 msg/min, sanitization, broadcast only — **room chat is not persisted**; DMs use `messages` table via `dm.ts`).
- **Push subscription:** `pushSubscriptions.ts` stores endpoint + keys per user; `pushSender` signs with VAPID; web-push 404/410 cleanup.
- **Admin:** `POST /api/admin/auth` → password (timing-safe) **or** role=admin user → 12 h `focusarx_admin` cookie JWT (aud `focusarx-admin`); every admin route re-checks `checkAdminAuth`; SQL console adds typed unlock phrase + insert-only audit log.
- **Cron:** Vercel cron → `GET /api/retention/reengage/run` with `Authorization: Bearer $CRON_SECRET` (503 if unset, 401 mismatch). Safe. (But per-user N+1 loop, see P-7.)

---

## C. File-level assessment (key files)

Legend: Priority **P0** = security/data-integrity, fix now · **P1** = correctness/perf/UX risk · **P2** = maintainability · **P3** = polish.

### Backend

| File | Assessment | Priority |
|---|---|---|
| `src/app.ts` | Solid middleware chain; CSP allows `unsafe-inline` scripts + `https:` img/connect (needed for GA/CDN, but loose); error envelope standardized; 100 kb body cap; maintenance + config gates. | P2 (tighten CSP) |
| `src/lib/env.ts` / `config.ts` | Zod-validated env, prod fail-fast, dev fallbacks. `config.ts` uses global `crypto` without import (works on Node 19+, implicit). | P2 (explicit import) |
| `src/middlewares/auth.ts` | Thin; depends on `extractUserId` exported from **routes/auth.ts** (layering inversion). No role helper. | P2 |
| `src/lib/adminAuth.ts` | Admin = separate aud/iss JWT cookie or DB role check; fails closed. ✅ | — |
| `src/routes/auth.ts` | Login/register/reset/guest/onboarding/profile. Refresh rotation **without state/reuse-detection**; `logout` never called by SPA; `forgot-password` returns `emailSent:false` for unknown emails (**enumeration**); legacy 7-day token in login body; register returns `EMAIL_EXISTS`. | **P0** (S-1, S-2) |
| `src/routes/sessions.ts` | The core. See §D/§E detail. Idempotency SELECT-then-INSERT is racy (DB unique constraint backstops data, but error path 500s on true concurrent duplicates); rewards computed twice (in-tx and for response — can diverge); `+15 s` wall-clock pad; **no-active-session path trusts client `durationSec` fully → XP farming**; `.catch(()=>{})` swallows coin-ledger inserts inside tx; UTC vs IST vs server-local day keys mixed; sync endpoint accepts client `activeSeconds` ≤ 4 h (client-controlled input used in reward verification). | **P0** (S-3, S-4) |
| `src/routes/retention.ts` | login-reward + battle-pass claim are read-check-write **without transactions** → double-claim races (coins/XP). Cron loop does sequential per-user queries (≤300 → could exceed 30 s serverless budget). Referral code lazy-create is atomic (`isNull` guard) ✅. | **P0** (S-5) |
| `src/routes/dailyReward.ts` | Same claim race as retention. | **P0** |
| `src/routes/admin.ts` | Auth on every route; audit log; timing-safe compare; `GET /admin/users` **unbounded** (all users + full session-count group-by + all streak rows). | P1 (pagination) |
| `src/routes/adminSql.ts` | Admin-only SQL console with real guardrails (statement split, destructive gating, timeout, insert-only audit). Powerful by design — acceptable, but any admin-cookie theft = full DB access; write-unlock is a *shared* window (any admin can ride another's unlock). | P2 (per-admin unlock) |
| `src/routes/flashcards.ts` | Count queries scan **entire** `flashcards` table (no user filter) — unbounded scan per deck list; deck-limit check-then-insert race (free tier). | P1 |
| `src/routes/stats.ts` | `/stats` pulls all completed tasks + today's full session rows just to count/aggregate; server-local day buckets (UTC in prod) inconsistent with IST missions. | P1 |
| `src/routes/coach.ts` | Premium-gated, IP limit, prompt-injection screen, builtin fallback. ✅ | — |
| `src/routes/arx.ts` | Cap via `ai_call_log`; template fallback; error → template (never 500). ✅ | — |
| `src/lib/aiProvider.ts` + `aiBudget.ts` | Unified gateway, 8 s timeout, retry, per-provider daily budget persisted in `ai_budget_state`, call logging. Interface differs from the task's `AiProvider` ideal but is functionally equivalent + better (budget/fallback); moderation exists in `moderation.ts`/`aiGuardrails.ts` but is not part of the gateway interface. | P2 (formalize interface) |
| `src/lib/socketManager.ts` | Handshake JWT auth, membership checks per event, per-socket rate limits, sanitization, membership re-check before broadcast. ✅. In-memory presence (fine for single-process; socket.io disabled on Vercel by design). | — |
| `src/lib/coinLedger.ts` | Atomic mint/burn with ledger rows; `burnCoins` guarded by balance. ✅ | — |
| `src/lib/sessionRewards.ts` | Pure, tested, taper math. ✅ | — |
| `src/lib/istDate.ts` | IST helpers exist — **but streaks/day-buckets don't use them** (inconsistency below). | P1 |
| `src/routes/routeContract.test.ts` | Excellent drift guard (frontend calls ↔ backend routes). | keep |

### Frontend

| File | Assessment | Priority |
|---|---|---|
| `src/lib/auth.tsx` | Token in `localStorage` (XSS-stealable, 7-day); `signOut` does **not** hit `/api/auth/logout` (server cookies survive); no refresh loop → silent expiry UX relies on 401 handler. | **P0** (S-1/S-2 client side) |
| `src/lib/api.ts` | Central fetch + 401 handling (clear + event). No single-flight refresh. | P0 (with above) |
| `src/lib/sync-focus-session.ts`, `session-persistence-api.ts`, `hooks/useSessionPersistence.ts` | Well-built persistence: 10 s sync, LS backup, TTL, recovery context. Completion sends `clientNonce` = session UUID. ✅ | — |
| `src/hooks/usePomodoro.ts` | Deadline-based ticking (survives tab suspend via deadline reconciliation), `completingRef` guards double-complete. ✅ | — |
| `src/lib/socket.ts` | `useSocketEvent` attaches in a mount-only effect reading module-level `socket` — **if the socket connects after mount, handlers never attach** (race). `connectSocket` gating logic otherwise good. | P1 |
| `src/components/Timer.tsx` (1,083 lines) | Mixed concerns (timer UI + persistence + rewards + summary + camera glue). Functional but should be decomposed. | P2 |
| `src/components/Pet3D.tsx` (837), `ambientEngine.ts` (1,475) | Large; ambient engine has tests. | P2 |
| `src/components/ThreeBackground.tsx` | WebGL detect + CSS fallback ✅; runs on all pages incl. mobile; `dpr [1,2]`, 2–3k stars, always-animating useFrame — no `prefers-reduced-motion` gate (Hero3D has one). | P1 (a11y/perf) |
| `src/hooks/use3DQuality.ts` | Quality tiers incl. mobile-default "battery". ✅ | — |
| `src/store/studyMonitorStore.ts` (464) | Camera focus monitoring state; mediapipe chunk (146 kB) lazy-loaded only when monitor enabled. ✅ | — |
| `App.tsx` | ~70 lazy routes, error boundaries, query cache error events. ✅ | — |
| `src/pages/admin/*` | Admin UI gated client-side + server-side (server is authoritative) ✅. | — |

---

## D. Database audit

~70 tables across 15 schema files. FK integrity is consistently declared with `onDelete: cascade` to `users` — good. Highlights and issues:

### Strengths
- `focus_sessions_user_nonce_unique (user_id, client_nonce)` — DB-level idempotency backstop. ✅
- `active_session_per_user_idx` unique — one active session per user. ✅
- `token_ledger.idempotency_key` unique — new economy is replay-safe. ✅
- `admin_drop_claims (drop_id,user_id)` unique — double-claim guard. ✅
- Wallet leaderboard indexes (`weekly_xp`, `total_xp`). ✅
- Hot-path composite indexes on sessions (`user_id, completed_at`, `user_id, status`). ✅

### Issues

| # | Finding | Impact | Priority |
|---|---|---|---|
| D-1 | **All timestamps are `timestamp` (no time zone).** Server clock is UTC on Vercel so writes are UTC-by-accident; safe only as long as nothing changes `TimeZone`. Day-based columns (`last_study_date`, `period_start`, productivity `date`) are `text` YYYY-MM-DD — mixing UTC (streaks), server-local (weekly reset), and IST (missions/ai budget). | Silent off-by-one-day bugs for the product's India-first audience at 00:00–05:30 IST | **P1** |
| D-2 | **Reward-claim tables lack atomic guards:** `login_rewards.last_claimed_date` is plain text updated after a SELECT (no conditional UPDATE, no unique (user,date) claim log); `battle_pass_progress.claimed_tiers` is a jsonb array mutated read-modify-write. | Double-claim races under concurrency | **P0** |
| D-3 | `refresh tokens are not stored` — rotation is cosmetic (old tokens valid until 7-day expiry; no reuse detection possible). | Token theft cannot be contained | **P0** |
| D-4 | Legacy duplication: `posts` vs `social_posts`, `coin_transactions` vs `token_ledger`, `battlePasses/user_battle_pass_progress` vs `battle_pass_progress` vs `battle_pass_claims`, `user_pets` vs `pet_catalog/user_pet_inventory`. Multiple sources of truth → drift bugs. | P2 (needs consolidation plan, not a quick fix) |
| D-5 | `post_reactions` has **no unique (post_id,user_id,reaction)** — same user can spam duplicate reactions. `friendships` lacks unique (requester,addressee). `push_subscriptions.endpoint` not unique (dup rows per device). | Data hygiene | P1 |
| D-6 | Unbounded list endpoints against DB: admin users (all), social feed (`socialPosts` w/ limit but offset pagination), flashcard count scans (cross-user), `GET /admin/users` group-by all sessions. | Latency growth | P1 |
| D-7 | `password_reset_tokens` never purged (expires/used rows accumulate); `ai_call_log` grows unbounded; `notifications` no cleanup for deactivated users. | Table bloat | P2 |
| D-8 | Soft-delete: none anywhere (GDPR delete route exists in admin; user delete is hard cascade — acceptable, but documented?) | P3 |
| D-9 | `focus_sessions.completed_at` nullable + no default (client-triggered insert always sets it, but DB doesn't enforce) — stats code null-checks everywhere (defensive tax). | P3 |

### Cross-user exposure check
- All per-user queries filter by `req.userId` (notifications, tasks, sessions, decks, wallets...). Spot-checked DMs, groups, rooms, marketplace: ownership checks present. ✅
- Flashcard *count* aggregation is cross-user (no leak of content, but scans all rows). P1 perf.
- Leaderboards expose name+XP only (checked `stats.ts`/`leaderboard` queries — no email). ✅

---

## E. API audit (summary; ~360 endpoints across 65 modules)

Global verification results:

- **Validation:** nearly all mutating routes zod-parse bodies; error envelope consistent. ✅
- **Auth:** every user route uses `authMiddleware` or explicit `extractUserId` + 401. Public: `/healthz*`, `/auth/*`, `/site/*`, `/sitemap*`, `/og`, `/contact`, public profiles/posts read paths (intended). Cron: bearer secret. ✅
- **Authorization:** ownership checks on individual resources (params id + userId) consistently applied; admin routes re-verify server-side. ✅
- **Rate limits:** global 120/min, auth 10/15min, forgot-password 5/h, AI coach 10/day (premium), arx 30/day, admin 20/15min. **In-memory stores** — on Vercel serverless each instance counts separately (documented limitation; Upstash Redis is a dependency but **not wired** into `express-rate-limit`). | P1
- **Idempotency:** sessions (nonce+unique), token ledger (idempotency key), drop claims (unique). **Missing:** login/daily rewards, battle-pass claims, mission claims. | **P0**
- **Response shapes:** mostly stable; a few legacy dupes (`/sessions` vs `/sessions/history` two shapes — intentional compat). ZodError details leak field paths in 400 bodies (minor).
- **AI endpoints:** quotas enforced (per-user + per-provider budget + IP for coach), 8–12 s timeouts, zero-key degrade. ✅
- **HTTP semantics:** mostly correct verbs; `DELETE /sessions/active` is fine; `POST` for claims fine.

**Per-route findings (highest value):**

| Route | Finding | Priority |
|---|---|---|
| `POST /api/sessions` | No-active-session completions trust client `durationSec` (≤4 h) and still pay full XP/coins → scriptable reward farming. | **P0** |
| `POST /api/sessions/sync` | Accepts client `activeSeconds` (≤4 h) which later feeds reward verification — client-influenced input in trust path (wall clock still caps). | **P0** |
| `POST /api/retention/login-reward/claim`, `POST /api/daily-reward/claim`, `POST /api/retention/battle-pass/claim` | TOCTOU double-claim. | **P0** |
| `POST /api/auth/forgot-password` | `emailSent:false` response distinguishes registered vs unknown emails. | **P0** |
| `GET /api/admin/users` | Unbounded; returns all users + aggregates. | P1 |
| `GET /api/flashcards/decks` | Cross-user full-table scans for counts. | P1 |
| `GET /api/sessions/history` | Pagination bounded (≤100) ✅ but page-less legacy shape returns 30 rows — fine. | — |
| `GET /api/retention/reengage/run` | Auth ✅; sequential per-user awaits (≤300) may exceed 30 s serverless cap. | P1 |

---

## F. Frontend audit (summary)

- **React Query discipline is good**: centralized cache with global error events, `refetchOnWindowFocus:false` (socket-driven updates), bounded retries, keys are path-scoped strings (no param-embedding bugs found in spot checks of tasks/dashboard/analytics).
- **`signOut` doesn't call the server** (cookies persist) — P0 pairing with S-2.
- **`useSocketEvent` attach race** — handlers may never attach when socket connects post-mount — P1.
- **Timer is correct-by-design** (deadline reconciliation handles sleep; `completingRef` blocks double-complete; recovery context restores from server). Multi-tab: unique active-session row means last-tab-wins on sync; completion idempotency via nonce — matches server design.
- **Accessibility:** axe e2e on 5 public pages; LiveAnnouncer, focus states in UI kit (Radix). Gaps: 3D scenes not motion-gated globally (`ThreeBackground`), canvas decorative (aria-hidden ✅), mobile bottom nav 44px targets checked in e2e. P1 for ThreeBackground reduced-motion.
- **Performance:** route-level code splitting ✅; heavy chunks isolated (3D 891 kB raw behind lazy pages; BarChart/recharts 377 kB on analytics only). Initial `index` chunk 201 kB (62 kB gzip) — acceptable. `ThreeBackground` mounts on every page incl. mobile — battery risk, quality tier mitigates.
- **Duplicated API calls:** `sync-focus-session.ts` and `session-persistence-api.ts` both POST `/api/sessions` with slightly different payloads (early-completion variant) — consolidation candidate (P2).

---

## G. Security audit

| ID | Severity | Finding | File | Fix |
|---|---|---|---|---|
| S-1 | **High** | Operative session credential is a 7-day JWT in `localStorage` (XSS-exfiltratable), while the 15-minute cookie design is inert. Login response also returns it as `token`. | `routes/auth.ts` (makeLegacyToken), `lib/auth.tsx` | Phase out localStorage token: keep 15-min access in memory + silent refresh via httpOnly cookie; add refresh rotation + reuse detection (S-2). |
| S-2 | **High** | Refresh rotation has no server state: rotated tokens stay valid until expiry; no reuse detection; logout doesn't revoke anything (stateless JWTs). | `routes/auth.ts` | Store hashed refresh tokens with family ids; rotate on use; revoke family on reuse; revoke on logout. |
| S-3 | **High** | Reward farming: `POST /api/sessions` without an active server session pays rewards on client-claimed duration (up to 4 h/request, repeatable with fresh nonces). | `routes/sessions.ts` | Require a server-side active session for reward eligibility; verified duration = min(client claim, wall clock since start, cap). |
| S-4 | **Medium** | Double-completion race window: nonce check is SELECT-then-INSERT outside the tx; concurrent duplicates rely on unique constraint and surface as 500 (client may then re-sync stale state). Also sync lets client push `activeSeconds` used in reward math. | `routes/sessions.ts` | Insert-first with `onConflictDoNothing` inside tx; clamp sync `activeSeconds` to wall clock. |
| S-5 | **High** | TOCTOU double-claims on login/daily rewards and battle-pass tiers (real money-adjacent economy). | `retention.ts`, `dailyReward.ts` | Transactions with conditional update / row locks. |
| S-6 | **Medium** | Password-reset enumeration via `emailSent:false` (unknown email) vs `emailSent:true`. | `routes/auth.ts` | Uniform response. |
| S-7 | **Medium** | `logout` never revokes server-side and the SPA doesn't call it — "signed out" devices keep valid cookies + 7-day bearer. | `auth.tsx` + `auth.ts` | Client calls endpoint; endpoint revokes refresh family. |
| S-8 | **Medium** | In-memory rate limiting on serverless (per-instance) — brute-force ceilings are ~∞ × instances. Upstash Redis is already a dependency but unused for limiter store. | `lib/rateLimiter.ts` | Wire Upstash store when configured (graceful fallback to memory). |
| S-9 | **Medium** | CSRF posture: cookie auth + SameSite=Lax, no CSRF token. Lax blocks cross-site POSTs in modern browsers; legacy `focusarx_token` Bearer flow is not CSRF-relevant. Acceptable-but-fragile; document + consider `SameSite=Strict` for admin cookie. | `auth.ts`, `adminAuth.ts` | Tighten admin cookie to Strict (done below). |
| S-10 | **Low** | CSP: `script-src 'unsafe-inline'` + broad `img-src https:`/`connect-src https:` in prod. Needed for GA/cookieyes today; narrows XSS blast-radius but weakens defense-in-depth (S-1's mitigation). | `app.ts` | Nonce-based CSP roadmap. |
| S-11 | **Low** | `GET /auth/reset-password/verify` unauthenticated token-check oracle (rate-limit missing) — allows probing reset tokens (tokens are 2×UUID = 244 bits, hash stored — brute-force infeasible; still rate-limit). | `auth.ts` | Add limiter. |
| S-12 | **Low** | Admin SQL console write-unlock is global (platform_meta) — admin A unlocks, admin B (or a stolen admin cookie) can write within window. | `adminSql.ts` | Per-admin unlock keys. |
| S-13 | **Low** | Login error reveals `EMAIL_EXISTS` on register only (login is generic ✅). Enumeration via register is industry-standard-ish; consider uniform "check your email" verification flow long-term. | `auth.ts` | P3 |
| S-14 | **Info** | Secrets handling: no secrets committed ✅; `.env.example` documented; config errors return structured 503 without internals; dev fallback secret clearly warned. `pino-http` serializers strip query strings ✅. | — |
| S-15 | **Info** | Prompt-injection: user input is passed as user-role content with fixed system prompts; coach screens injection patterns; AI output sanitized (`sanitizeNeverNegative`, moderation on posts). No tool-calling = low blast radius. | ✅ |

Dependency posture: pnpm overrides pin patched `qs`/`ws`/`socket.io-parser`; `minimumReleaseAge` 24 h; esbuild pinned. (No `pnpm audit` run in sandbox — recommend adding to CI; `docs/ci-workflow.example.yml` exists but no live workflow in `.github/workflows` — **CI is not actually configured**, P1.)

---

## H. 3D audit

**Inventory:** `ThreeBackground.tsx` (global starfield + nebulae + planets), `Hero3D.tsx` (landing hero: distorted sphere + orbiters, drei), `Pet3D.tsx` (837 lines — pet meshes/stages), `city.tsx` + Focus City buildings, `FloatingParticles.tsx`, `ConfettiCelebration`, `PageBackground` (CSS-only), mediapipe `FocusCamera` (lazy chunk 146 kB — not WebGL rendering per se).

**Findings:**

| Area | Status |
|---|---|
| Scene init / WebGL detect | ✅ `canUseWebGL()` + CSS fallback everywhere (`ThreeBackground`, `Hero3D`); quality tiers via `use3DQuality` (mobile defaults to battery). |
| Reduced motion | ⚠️ `Hero3D` respects `prefers-reduced-motion`; `ThreeBackground` and particle fields animate unconditionally (P1). |
| Error boundaries | ✅ App-level `ErrorBoundary`; canvas wrapped in `Suspense fallback={null}`. No per-canvas error boundary → a scene crash takes the page boundary (acceptable, but per-canvas isolation is better). |
| Disposal | R3F auto-disposes geometries/materials created declaratively; `useMemo`-allocated Float32Arrays in `Stars` are GC'd with the component; no manual leaks spotted. Pet3D rebuilds on stage change — R3F disposes. ✅ |
| Draw calls / lights | Starfield = 1 draw call (Points ✅ instanced-by-nature); nebulae spheres 2; planets 4 (2 meshes each); lights: ambient + 2 point (no shadows except high tier) — cheap. City page uses per-building meshes (dozens of draw calls; acceptable at tier counts; instancing would help at scale — P3). |
| DPR / perf | `dpr={[1,2]}` on ThreeBackground regardless of quality tier (use3DQuality config exists but ThreeBackground hardcodes — P2 inconsistency). `powerPreference: "high-performance"` on a background canvas is battery-hostile on mobile — P2. |
| Pixel/poly budget | Sphere segments 32–96 (high), stars 2–3k points, torus 12×96 — modest; est. < 100k tris total per scene. |
| Textures/models | No external textures or GLTFs (all procedural) — no loading-time or CORS risk; no KTX2. ✅ |
| Context loss | No `webglcontextlost` handling; R3F recreates context in v9 in most cases; a listener + toast would harden (P3). |
| Interaction | Background canvas is `pointer-events-none` ✅; hero uses pointer parallax only; no OrbitControls on public pages. |
| Bundle | `react-three-fiber.esm` chunk 891 kB (240 kB gzip) + `three` — loaded only on pages importing 3D; landing + pets + city affected. Consider `three` tree-shake audit + `manualChunks` for `three` (P2). |

---

## Prioritized remediation plan (this PR series)

**Phase 1 — Economic integrity & focus-session trust (P0) — ✅ implemented in this branch**
1. ✅ `POST /api/sessions`: rewards require server-side active session of the matching mode; verified duration = min(claim, wall-clock + 15 s grace, 4 h cap); single reward computation inside the tx; idempotent insert-first via `onConflictDoNothing` on the nonce constraint (replays return the original row, not a 500); no swallowed ledger errors; wallet rows locked; IST day keys; completion rate limiter.
2. ✅ `POST /api/sessions/sync`: client `activeSeconds` clamped to wall clock.
3. ✅ Login/daily-reward + battle-pass claims: transactional with `FOR UPDATE` row locks.
4. ✅ `lib/sessionCompletionCore.ts` (pure) + 18 unit tests.

**Phase 2 — Auth lifecycle (P0) — ✅ implemented in this branch**
5. ✅ DB-backed refresh-token store (`refresh_tokens`, hashed at rest, family ids); rotation with reuse detection + 30 s multi-tab grace; legacy JWT refresh cookies exchanged transparently; logout now revokes the presented refresh token and the SPA calls it; silent cookie refresh on 401 (single-flight, Web-Locks cross-tab) + 14-min proactive rotation; uniform forgot-password response; reset-verify rate limit; idempotent `refresh_tokens` DDL patch in `cleanup-orphans.mjs` for the Vercel deploy path.

**Phase 3 — implemented alongside**
6. ✅ Flashcard deck counts scoped to the user's decks (was: full cross-user table scan ×2).
7. ✅ `useSocketEvent` attach race fixed (handlers now attach whenever the socket appears).
8. ✅ `ThreeBackground`: `prefers-reduced-motion` honored (static frame, no animation loop), battery-tier DPR/power preference.

**Phase 4 — tracked follow-ups (P1/P2, not in this change set)**
9. Upstash-backed rate-limit store (dependency present, not wired); nonce-based CSP; admin `/admin/users` pagination; the retention cron loop's per-user awaits → batched; localStorage-bearer phase-out (socket auth consumes it today); legacy table consolidation (posts/coins/battle-pass duplicates); per-admin SQL-console write unlock; `pnpm audit` + CI workflow (`.github/workflows` is absent — `docs/ci-workflow.example.yml` exists but is not wired).
