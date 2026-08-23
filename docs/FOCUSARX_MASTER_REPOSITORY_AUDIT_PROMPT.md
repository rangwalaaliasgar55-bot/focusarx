# FocusArx Master Repository Audit and Engineering Prompt

**Audit date:** 2026-08-23  
**Repository:** `rangwalaaliasgar55-bot/focusarx`  
**Audited branch baseline:** `arena/01a02d61-focusarx`  
**Purpose:** A verified repository map, risk register, truthfulness audit, and execution prompt for the next engineering agent.

---

## 1. Audit scope and confidence

The repository contains **921 tracked files**. The review inventoried every tracked path and then performed a detailed static review of the active runtime, configuration, schemas, migrations, deployment files, generated contracts, documentation, and representative shared UI primitives. Binary images/archives, generated lock/snapshot content, and historical prompt attachments were inventoried but are not executable runtime code.

Active source reviewed includes approximately:

- `artifacts/api-server`: 10,678 TypeScript lines
- `artifacts/focusarx/src`: 41,378 TypeScript/TSX lines
- `lib`: 4,414 TypeScript/SQL/YAML lines
- `scripts`: 1,421 lines
- 54 Drizzle/PostgreSQL tables
- Roughly 250 Express route handlers

This is a point-in-time static audit, not proof that no defect exists. Production behavior still needs integration, browser, database, concurrency, accessibility, and penetration testing.

---

## 2. Repository understanding

### Runtime architecture

FocusArx is a pnpm monorepo with:

1. **Frontend — `artifacts/focusarx`**
   - React 19, TypeScript, Vite, Wouter, TanStack Query, Tailwind 4, Radix UI, Framer Motion.
   - A large SPA with focus timer/session recovery, tasks, analytics, social, groups, DMs, study rooms, flashcards, AI tools, webcam monitoring, gamification, premium, admin, SEO content, legal pages, and PWA assets.
   - Authentication is a seven-day JWT stored in `localStorage` and attached as a Bearer token.
   - Most pages are lazy loaded. Three.js/React Three Fiber powers several 3D experiences.

2. **API — `artifacts/api-server`**
   - Express 5, Drizzle ORM, PostgreSQL, JWT/bcrypt authentication, Helmet, CORS, rate limiting, Pino, email, web push, and Socket.IO.
   - Route modules implement auth, focus sessions, tasks, analytics, social, DMs, groups, study rooms, flashcards, AI, admin/CMS, premium, marketplace, loot boxes, pets, quests, rewards, and related systems.
   - Vercel uses `api/index.mjs`, which imports the built Express app as a serverless function.
   - Local/Replit startup uses an HTTP server and initializes Socket.IO and VAPID.

3. **Data — `lib/db`**
   - Drizzle schema split across focus, analytics, chat, social, groups, city, flashcards, quests, seasonal, loot-box, gamification, and site modules.
   - PostgreSQL pool is initialized at module import.
   - Migrations exist, but several root SQL snapshots/scripts overlap with Drizzle migration responsibility.

4. **Contract packages**
   - `lib/api-spec` contains OpenAPI and Orval configuration.
   - `lib/api-client-react` and `lib/api-zod` contain generated clients/types.
   - The claimed “contract-first source of truth” is not currently true: OpenAPI describes only 6 paths while the API contains roughly 250 handlers.

5. **Deployment and secondary material**
   - Vercel serves the SPA and proxies `/api/*` to one serverless function.
   - `artifacts/mockup-sandbox` is a separate design sandbox.
   - `.migration-backup` contains 270 tracked historical files, including 221 paths duplicated by active artifacts.
   - `attached_assets`, `.agents`, transformation plans, and pasted prompts are reference/history, not production runtime.

I understand the repository’s active architecture, data flow, authentication model, deployment model, feature boundaries, duplicated historical material, and the main cross-module dependencies. I am ready to work on it, but the risks below should be addressed before adding more product surface area.

---

## 3. Verified repository health

### Commands run

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm audit --prod --audit-level low
```

### Results

- Frozen install: **passes**.
- Production build: **passes**, but emits source-map warnings and an oversized 891.66 kB React Three Fiber chunk; the API bundle is approximately 4.1 MB plus a 7.2 MB source map.
- Typecheck: **fails** in `artifacts/focusarx/src/lib/theme.ts:127` because `useTheme` promises an updater returning `Promise<boolean>`, but the implementation returns `Promise<void>`.
- Tests: **no test files found**.
- CI: **no GitHub Actions workflow found**.
- Production dependency audit: **9 known vulnerabilities** — 4 high, 4 moderate, 1 low.
  - High: Nodemailer arbitrary file/URL access path (`GHSA-p6gq-j5cr-w38f`).
  - High: `ws` memory exhaustion DoS (`GHSA-96hv-2xvq-fx4p`).
  - High: `socket.io-parser` memory exhaustion (`GHSA-2m8v-j782-fhvr`).
  - High: `ip-address` leading-zero trust-boundary bypass (`GHSA-mwp4-54f8-5fhr`).
  - Additional moderate Nodemailer and `ip-address` advisories and a low `body-parser` DoS advisory.

Do not treat “build passes” as production readiness: Vite transpilation does not enforce the failing TypeScript check.

---

## 4. Critical and high-priority findings

### P0 — Reward economy can be forged by any authenticated user

**Files:**
- `artifacts/api-server/src/routes/sessions.ts`
- `artifacts/api-server/src/routes/pets.ts`
- `artifacts/api-server/src/routes/groups.ts`

**Problems:**

- `POST /sessions` trusts client-supplied duration, completion, focus score, timeline, and status. A client can repeatedly submit 86,400-second sessions and mint XP, coins, streak progress, mission progress, battle-pass progress, city progress, and loot boxes.
- `clientNonce` is accepted by the schema but is not persisted or checked, so there is no replay/idempotency defense.
- `POST /pets/award-xp` accepts an arbitrary positive `xpAmount` with no upper bound or server-side proof.
- `POST /groups/:id/contribute-xp` accepts arbitrary positive XP and does not deduct or derive it from a trusted event.

**Required outcome:** rewards must be generated only from server-owned, idempotent domain events. Never accept reward amounts or authoritative elapsed time from a client.

### P0 — Financial/economy mutations are non-transactional and raceable

**Files:** premium, marketplace, loot boxes, daily rewards, missions, quests, sessions, city, wallets.

**Problems:** read-modify-write sequences and parallel unrelated writes allow double claims, duplicate openings, overspending, lost updates, partial state, and inconsistent transaction logs. Examples include:

- `premium.ts` balance deduction then subscription activation.
- `marketplace.ts` `Promise.all` wallet deduction/inventory/log without a DB transaction.
- `lootboxes.ts` buy/open paths; two concurrent opens can both grant rewards.
- `dailyReward.ts`, `missions.ts`, and `quests.ts` mark-claimed and wallet-credit operations.
- Session creation and all downstream rewards are not atomic.

**Required outcome:** use PostgreSQL transactions, conditional atomic updates, row locks where needed, unique idempotency keys, and constraints that make duplicates impossible.

### P0 — Flashcard cross-user IDOR

**File:** `artifacts/api-server/src/routes/flashcards.ts`

Authenticated users can fetch cards for another user’s deck by deck UUID. Card delete and review endpoints load/update by card ID without proving that the card’s deck belongs to the current user.

**Required outcome:** every query must scope through deck ownership (`deck.userId = req.userId`) in the same database statement. Add negative authorization tests.

### P0 — Socket.IO room authorization is absent

**File:** `artifacts/api-server/src/lib/socketManager.ts`

Any authenticated socket can join an arbitrary `room:<id>` and send or receive room chat. The server does not verify study-room/group membership, room visibility, bans, or message rate. CORS accepts every socket origin.

**Required outcome:** authorize every join and message against database membership; validate payloads; enforce per-socket/per-user limits; use a strict origin allowlist.

### P0 — Private group and study-room controls can be bypassed

**Files:** `groups.ts`, `studyRooms.ts`

- Any authenticated user with a private group UUID can fetch its details and members.
- `/groups/:id/join` does not require a public group, so invite-only membership can be bypassed.
- Study-room detail/join by ID does not enforce private invite or group membership.
- Listing by arbitrary `groupId` does not verify group membership.

**Required outcome:** centralize policy checks for owner/admin/member/public/invite-only access and enforce them on reads as well as writes.

### P0 — “Read-only” admin SQL is not read-only

**File:** `artifacts/api-server/src/routes/admin.ts`

The SQL editor accepts any query beginning with `WITH`. PostgreSQL data-modifying CTEs can execute `INSERT`, `UPDATE`, or `DELETE` while the outer statement is a `SELECT`. `SELECT` can also invoke side-effecting functions or `pg_sleep`, and the route uses the application’s full-privilege pool.

**Required outcome:** remove the feature from production or execute through a dedicated read-only DB role, read-only transaction, strict statement timeout, one-statement parser/allowlist, row limit, and immutable audit log.

### P1 — Dependency vulnerabilities

Upgrade/re-resolve to patched versions and rerun the audit. At minimum validate:

- Nodemailer >= 9.0.1.
- `ws` >= 8.21.0 through compatible Socket.IO/Engine.IO updates.
- `socket.io-parser` >= 4.2.7.
- `ip-address` >= 10.3.1 through `express-rate-limit` dependency resolution.
- Express/body-parser chain to a body-parser >= 2.3.0.

Do not blindly force transitive versions without integration tests.

### P1 — Development admin secret fallback is forgeable/inconsistent

**Files:** `routes/email.ts`, `routes/adminCms.ts`, `lib/config.ts`, `lib/adminAuth.ts`

Two admin modules verify cookies with `process.env.AUTH_SECRET ?? process.env.JWT_SECRET ?? "dev-secret"`, while primary admin auth signs with `getServerConfig()`, which uses an ephemeral development secret. On a publicly reachable non-production environment without `AUTH_SECRET`, an attacker can sign an admin cookie using the known `dev-secret` for affected routes.

**Required outcome:** use one admin-auth module everywhere. Never use a known default secret. Fail closed if the configured secret is absent.

### P1 — Authentication/session hardening gaps

- Seven-day JWTs are stored in `localStorage`, exposing them to any successful XSS.
- Password reset does not revoke existing JWTs.
- JWT verification does not explicitly enforce algorithm, issuer, audience, or token type.
- Password-reset tokens are stored in plaintext and reset use/update is not transactional.
- No refresh-token rotation, session inventory, per-device revocation, account lockout strategy, MFA for admins, or security event audit trail.
- Registration reveals whether an email already exists.

Prefer short-lived access tokens plus rotated HttpOnly/Secure/SameSite refresh cookies, or a server-side session model. Store hashes of reset/refresh tokens and add `sessionVersion`/revocation.

### P1 — DM reaction authorization gap

**File:** `routes/dm.ts`

The reaction endpoint checks only message ID and current user’s existing reaction. It does not verify that the user participates in the message’s conversation. Validate reply IDs similarly.

### P1 — Post visibility/moderation bypass by direct ID

**File:** `routes/posts.ts`

`GET /posts/:id` returns a post by ID without enforcing public/private/group visibility or approved moderation status. Comments/reactions/saves should also verify that the current actor may access the parent post.

### P1 — Database TLS identity verification disabled

**File:** `lib/db/src/index.ts`

Remote TLS uses `rejectUnauthorized: false`. This encrypts traffic but does not reliably authenticate the database certificate, enabling a network-level MITM in applicable environments.

Use provider CA roots and `verify-full` semantics where supported. Do not silently weaken verification.

### P1 — PWA/push implementation is disconnected

`public/sw.js` and `manifest.json` exist, but no active source registers the service worker. Push code awaits `navigator.serviceWorker.ready`, which may never resolve. The service worker precache list also includes `/logo.png` twice.

### P1 — Production realtime is knowingly unavailable

Vercel imports only the Express app and never initializes Socket.IO. The frontend comments acknowledge Socket.IO will fail on Vercel. Therefore “realtime” DMs/study-room activity is not a production capability under the current deployment.

Choose a persistent WebSocket host/provider or implement a supported realtime transport. Do not label polling or unavailable behavior as realtime.

---

## 5. Fake, stubbed, misleading, or incomplete behavior

These must be removed, implemented, or explicitly labeled as unavailable:

1. **Vision processor always reports perfect focus**  
   `src/lib/vision/visionProcessor.ts` is a stub returning `{ facePresent: true, phoneDetected: false, attentionScore: 100 }`. This silently falsifies attention metrics while README/replit documentation claims MediaPipe webcam monitoring.

2. **Fake demo video**  
   `DemoVideoSection.tsx` embeds `dQw4w9WgXcQ` (a Rick Astley video) and displays developer replacement instructions to end users. The component appears unused, but it should not exist as a production feature.

3. **Email sends reported as success when no provider exists**  
   `routes/email.ts` returns `{ ok: true, id: "mock-..." }` when `RESEND_API_KEY` is missing, and logs records as sent. This corrupts delivery analytics.

4. **No-op production components**  
   `GuestBootstrap` and `CapacitorNativeBridge` are mounted but return null; the latter has an empty effect. Remove them from active composition until real behavior exists, or keep only behind an explicit platform build flag.

5. **OpenAPI source-of-truth claim is false**  
   Six documented paths cannot be the source of truth for roughly 250 handlers. Most frontend code also uses ad-hoc fetches and `any`, bypassing generated contracts.

6. **PWA-ready claim is incomplete**  
   Assets exist, but service-worker registration is absent.

7. **Realtime claim is deployment-dependent and false on current Vercel production.**

8. **AI fallback behavior needs honest product language**  
   Deterministic local coach/insight responses are valid graceful degradation, but the UI/API must clearly distinguish generated AI from rule-based guidance. Never present fallback output as an AI call.

9. **Security marketing overstates controls**  
   UA keyword blocking and stripping `<`/`>` from query strings are not “advanced bot mitigation” or general XSS protection. UA filtering is bypassable and can block legitimate clients.

---

## 6. Architecture and quality problems

- No automated tests and no CI quality/security gate.
- One current TypeScript error despite strictness claims.
- 202 uses of `any` patterns and many swallowed errors/“best effort” writes weaken correctness.
- Route handlers combine validation, authorization, persistence, rewards, notifications, and response formatting.
- Authorization logic is duplicated across admin modules and route files.
- Domain rules are duplicated and client/server constants can drift.
- The API spec covers a tiny fraction of runtime endpoints.
- Input validation is inconsistent; many routes destructure unvalidated bodies and parse unbounded/invalid pagination.
- N+1 query patterns are common in social, groups, DMs, flashcards, and admin analytics.
- Admin page is approximately 138 kB of source and API admin routes are broad, increasing blast radius.
- `.migration-backup`, large attached prompts, duplicate screenshots, and multiple SQL “master” snapshots create maintenance ambiguity.
- Build emits oversized WebGL/Three chunks and source-map warnings.
- `script-src 'unsafe-inline'`, broad `connect-src https:`, and broad `img-src https:` weaken CSP.
- CORS trusts every `*.vercel.app`, `*.replit.*`, and `*.e2b.app` origin rather than only owned deployments.
- Socket origin policy allows all origins.
- Rate limiting is process-memory based and unreliable across serverless instances; expensive endpoints need shared limits/quotas.
- External AI/email calls lack consistent timeout, cancellation, retry, circuit-breaker, and budget controls.
- Maintenance checks hit storage per request unless cache behavior remains effective; failure is fail-open.
- `app.set("trust proxy", 1)` and IP-derived controls need deployment-specific validation.
- Documentation contains drift: AI providers/env names, router choice, MediaPipe status, contract-first status, and production capabilities.

---

## 7. Product and feature improvement backlog

Do not start this backlog until P0/P1 integrity work and tests are complete.

### Reliability and UX

- Offline-safe timer with explicit conflict resolution and idempotent server sync.
- Clear degraded/offline states instead of silently returning null or stale local data.
- Account session/device management, export, deletion, and privacy controls.
- Consistent empty/error/loading states and retry affordances.
- Accessibility audit: keyboard flow, landmarks, labels, focus trapping, contrast, reduced motion, camera alternatives.
- Performance budgets for initial JS, route chunks, WebGL assets, CSS, API p95, and DB query counts.

### Focus intelligence

- Replace fake vision output with actual on-device MediaPipe Tasks Vision or remove attention scoring.
- Make camera processing opt-in, local-only, explainable, and independently verifiable.
- Derive focus score from transparent signals; let users disable each signal.
- Separate objective elapsed time from subjective/heuristic focus quality.

### Social safety

- Blocks, mutes, report flow, moderation appeals, abuse throttling, privacy controls, and age-aware safety.
- Message request controls and friend-only defaults.
- Group/room membership policy matrix and audit logs for moderation actions.
- Data-retention policy for messages, camera-derived events, analytics, and deleted accounts.

### Premium and economy

- A double-entry immutable ledger or equivalent auditable reward ledger.
- Server-owned reward rules with versioned events and idempotency keys.
- Fraud detection for impossible session velocity/replay.
- Clearly disclose loot-box odds and consider legal/age/regional restrictions.
- If paid premium is intended, integrate a real billing provider, webhook verification, invoices, cancellation, refunds, and entitlement reconciliation. Current coin activation is an in-app entitlement, not conventional billing.

### Engineering platform

- Complete OpenAPI or remove the false source-of-truth claim and adopt a different typed contract system.
- Structured audit logs, request IDs, metrics, tracing, error monitoring, and alerting.
- Background job queue for email blasts, push, moderation, and reward fan-out.
- Shared distributed rate limiting and quota accounting.
- Migration policy with one canonical source and rollback/backup verification.

---

# 8. Master execution prompt

Copy the prompt below into a fresh engineering-agent session.

---

## FOCUSARX PRODUCTION-INTEGRITY MASTER PROMPT

You are the principal software architect, application security engineer, staff full-stack engineer, database reliability engineer, QA lead, accessibility specialist, and product-integrity owner for FocusArx.

Your mission is **not to add flashy features**. Your mission is to make the existing product truthful, secure, transactional, testable, maintainable, accessible, and production-ready. Work directly in the existing monorepo. Preserve valid behavior and visual identity, but do not preserve fake behavior, insecure compatibility, duplicated dead code, or misleading claims.

### Non-negotiable rules

1. Inspect the current implementation before editing it. Never invent file contents or assume an endpoint works.
2. Do not add placeholder logic, fake data, fake success, mock provider IDs, hard-coded demo media, always-success fallbacks, silent perfect scores, no-op mounted components, or “coming soon” controls that look functional.
3. Never trust client-provided XP, coins, rewards, elapsed duration, completion, ownership, role, premium state, focus score, or claim state.
4. Every protected resource query must scope authorization in the database query itself where practical.
5. Every multi-write economy/entitlement/claim operation must be one atomic transaction.
6. Every retryable mutation must have an idempotency key and a database uniqueness guarantee.
7. Never use a default authentication/admin secret. Missing secrets must fail closed.
8. Do not weaken TLS, CSP, CORS, cookie policy, authorization, or validation to make a demo work.
9. Do not claim completion without tests and command output.
10. Do not add new product modules until all P0 and P1 gates pass.
11. Prefer small, reviewable phases. At the end of each phase, report changed files, migrations, security impact, tests, commands, remaining risks, and rollback notes.
12. Keep all user-facing claims consistent with actual deployed behavior.

### Phase 0 — Baseline and safety net

- Reproduce frozen install, typecheck, build, and production audit.
- Fix the `useTheme` return-type error without weakening types.
- Add GitHub Actions for frozen install, lint/format check, typecheck, unit/integration tests, build, migration validation, dependency audit, and secret scanning.
- Add Vitest for frontend/domain units, a backend test runner with Supertest, and database integration tests against ephemeral PostgreSQL.
- Establish test factories and an authenticated request helper.
- Add coverage thresholds focused on auth, authorization, sessions, economy, claims, admin, and social privacy.
- Record bundle sizes and API contract coverage as CI artifacts.

**Exit gate:** clean typecheck/build, CI green, tests run deterministically, no ignored failing command.

### Phase 1 — Immediate security remediation

- Upgrade vulnerable production dependencies to patched compatible versions. Rerun `pnpm audit --prod` and document any accepted residual advisory with exploitability analysis and expiry date.
- Replace all duplicated admin-cookie verification with one `checkAdminAuth` implementation. Remove `dev-secret` everywhere.
- Add explicit JWT algorithm, issuer, audience, token type, and session version checks.
- Hash password-reset tokens at rest; atomically consume them; revoke existing sessions after password reset.
- Replace broad CORS suffix trust with an explicit normalized allowlist of owned origins.
- Enforce Socket.IO origin allowlist, payload schemas, membership checks, and rate limits.
- Remove or redesign the admin SQL editor using a dedicated read-only DB role, read-only transaction, statement timeout, parser, one-statement restriction, and audit trail. If that cannot be proven safe, disable it in production.
- Restore database certificate verification using supported provider CA/verify-full configuration.
- Tighten CSP; remove `unsafe-inline` by using nonces/hashes where feasible and narrow network/image sources.

**Exit gate:** security tests prove forged admin cookies fail, unauthorized socket joins fail, JWT policy is enforced, reset tokens are one-time/revoking, and admin SQL cannot mutate or sleep.

### Phase 2 — Authorization matrix and IDOR removal

Create a policy matrix for every resource: owner, member, friend, public visitor, moderator, admin. Apply reusable policy functions.

At minimum fix and test:

- Flashcard deck/card read, delete, and review ownership.
- DM reactions and reply targets must belong to a conversation the actor participates in.
- Private/group post reads, comments, reactions, and saves.
- Private groups: details, member lists, direct join, invite join, role changes, leaderboard.
- Study rooms: details, list-by-group, direct join, invite join, chat, and participant visibility.
- Admin endpoints and server-side admin field filtering.

Use two-user and three-user negative tests. A successful owner test is insufficient.

**Exit gate:** automated cross-tenant tests cover every resource ID endpoint and return consistent 403/404 behavior without data leakage.

### Phase 3 — Trusted session and reward pipeline

Redesign focus completion around server-owned records:

- Start session: server creates ID, start timestamp, expected mode/duration, and signed/versioned state.
- Heartbeats: bounded monotonic progress, rate-limited and tied to the session ID.
- Complete: server computes eligible elapsed duration and reward from trusted timestamps/heartbeats.
- Enforce one completion using status transition plus unique event/idempotency key.
- Separate analytics-only imported history from reward-eligible sessions.
- Reject impossible velocity, future timestamps, replay, and overlapping reward-eligible sessions.
- Remove arbitrary pet XP and group XP endpoints; derive both from committed domain events.
- Route all rewards through one versioned reward service and immutable ledger.

Do not rely on webcam attention as proof of elapsed time or identity.

**Exit gate:** replay and concurrent-completion tests cannot mint duplicate rewards; arbitrary duration/XP inputs have no authority.

### Phase 4 — Transactional economy and entitlements

For premium activation, marketplace purchase, loot-box buy/open, daily rewards, missions, quests, battle pass, seasonal rewards, referrals, and admin grants:

- Use `db.transaction`.
- Lock/conditionally update the relevant rows.
- Use SQL arithmetic (`coins = coins + delta`) with balance predicates rather than stale read-modify-write.
- Add unique constraints for ownership, claims, reward events, openings, and idempotency keys.
- Ensure logs and entitlement updates commit or roll back together.
- Make transaction records immutable and reconcilable.
- Add concurrency tests with many parallel requests.
- Validate loot-box rewards server-side and publish odds if the feature remains.

**Exit gate:** balances cannot go negative, one box cannot open twice, one reward cannot claim twice, and partial writes are impossible under injected failures.

### Phase 5 — Remove false and stub behavior

- Implement real on-device MediaPipe vision with consent and graceful truthful unavailability, or remove attention-monitoring claims and score effects.
- Delete the Rick Astley demo and developer replacement message; add a real approved demo only when available.
- Email provider absence must produce `not_configured`/failure, never “sent.” Use a queued job and provider webhook status.
- Remove unused mounted no-op components or implement them behind platform flags.
- Register and test the service worker, or remove PWA/push claims and dead assets.
- Move production realtime to supported persistent infrastructure, or relabel/remove realtime UI.
- Clearly mark deterministic coach fallback as rule-based guidance, not generated AI.
- Replace “advanced bot/XSS protection” marketing with accurate language.

**Exit gate:** a repository-wide search and product walkthrough finds no fake success, mock IDs, perfect stub metrics, placeholder media, or misleading capability claim.

### Phase 6 — API contracts and validation

- Decide on one source of truth: complete OpenAPI for all supported endpoints or adopt an equivalent typed schema/router system.
- Generate clients and schemas in CI and fail on uncommitted drift.
- Replace ad-hoc frontend fetches and broad `any` with the typed client.
- Apply Zod validation to body, params, query, and response boundaries.
- Bound pagination, arrays, JSON depth/size, dates, URLs, IDs, names, roles, HTML, and metadata.
- Standardize error envelopes, status codes, request IDs, and safe logging.

**Exit gate:** documented paths match supported handlers, generated code is current, and invalid payload tests exist for each mutation family.

### Phase 7 — Reliability, jobs, observability, and performance

- Move email blasts, push, moderation digests, and non-critical fan-out to a durable queue with retries, deduplication, and dead-letter handling.
- Add timeout/AbortController and budget controls for AI/email calls.
- Add distributed rate limits and per-user quotas suitable for serverless/multi-instance deployment.
- Add structured security/audit events, metrics, tracing, error monitoring, and alerts.
- Replace N+1 query loops with joins/batched queries and indexes verified using `EXPLAIN`.
- Set bundle budgets and split Three/WebGL code so non-3D routes do not pay the cost.
- Resolve source-map warnings and remove the empty manual React chunk.
- Test cold starts, DB connection pressure, maintenance mode, degraded providers, and offline timer recovery.

### Phase 8 — Accessibility, privacy, and product polish

- Run automated and manual WCAG 2.2 AA checks.
- Verify keyboard-only navigation, focus order, dialogs, forms, live regions, reduced motion, contrast, and screen-reader names.
- Add camera-off equivalents and do not penalize users who decline camera access.
- Implement block/mute/report/appeal and social privacy defaults.
- Implement account export/deletion and documented retention rules.
- Update README, architecture docs, env example, API docs, security model, data-flow diagrams, and deployment runbook so every claim matches reality.
- Archive/remove duplicated historical code and clearly identify canonical migrations and runtime packages. Do not delete potentially valuable history without a reviewed retention plan.

### Required testing matrix

For every security-sensitive mutation, cover:

1. unauthenticated actor;
2. authenticated owner;
3. authenticated non-owner;
4. privileged actor where applicable;
5. malformed input;
6. boundary values;
7. duplicate retry with same idempotency key;
8. concurrent requests with different keys;
9. injected failure midway through the transaction;
10. expired/revoked token;
11. missing optional provider;
12. production configuration.

Also run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod
```

Add browser smoke/E2E coverage for signup/login/reset, onboarding, timer start/recovery/complete, tasks, rewards, flashcards, social privacy, DMs, groups, study rooms, premium/marketplace, admin authorization, service worker/offline behavior, and account deletion.

### Definition of done

A phase is complete only when:

- implementation is real and user-visible behavior is truthful;
- authorization is server-enforced;
- database invariants survive concurrency;
- tests include negative and race cases;
- typecheck, tests, build, and audit gates pass;
- migrations are forward-safe and rollback/recovery is documented;
- logs contain no secrets, tokens, private message content, or reset URLs in production;
- documentation and product copy match deployed behavior;
- there are no placeholder functions or fake success paths introduced.

At the end, produce a concise evidence report containing: architecture changes, threat-model changes, migration list, endpoint contract changes, tests and coverage, dependency audit result, performance deltas, accessibility result, known residual risks, and exact verification commands.

---

## 9. Recommended first work item

Start with one focused “production integrity” pull request containing only:

1. the `useTheme` type fix;
2. patched vulnerable dependencies;
3. unified fail-closed admin authentication;
4. flashcard IDOR fixes;
5. socket study-room authorization;
6. tests for those changes;
7. CI gates.

Then implement the session/reward/economy redesign as a separately reviewed migration-heavy change. Mixing it with visual features would make the critical invariants harder to review.
