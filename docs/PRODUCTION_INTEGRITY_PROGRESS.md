# Production Integrity Progress

Date: 2026-08-23

This document records the first implementation slice from `FOCUSARX_MASTER_REPOSITORY_AUDIT_PROMPT.md`. It does **not** claim the entire multi-phase program is complete.

## Completed in this slice

### Baseline and automation

- Fixed the `useTheme` `Promise<boolean>` type contract.
- Added a root test command, Vitest, canonical battle-pass unit tests, and a GitHub Actions quality/security workflow.
- Added frozen install, typecheck, tests, build, production audit, migration naming, and secret-scan CI gates.
- Upgraded vulnerable dependencies and pinned patched `ws` and `socket.io-parser` transitive versions.
- Production audit now reports no known vulnerabilities.

### Authentication and administration

- Unified admin authorization through `lib/adminAuth.ts`; removed known `dev-secret` verification fallbacks.
- Added explicit HS256/issuer/audience/type checks to access JWTs and HS256/issuer/audience checks to admin JWTs.
- Password-reset tokens are now SHA-256 hashed at rest and atomically consumed with the password update.
- Restricted production CORS to explicitly configured origins.
- Disabled the admin SQL console in production and by default; when explicitly enabled in development it runs in a read-only transaction with a two-second timeout and one-statement/row limits.
- Enabled database TLS certificate verification.

### Authorization and privacy

- Fixed flashcard deck/card cross-user read, delete, and review IDORs.
- Added Socket.IO origin checks, active study-room membership authorization, payload bounds, acknowledgements, and per-socket chat limits.
- Protected private group details, direct joins, leaderboards, group room listings, private study-room reads, direct joins, and room chat.
- Protected DM reactions and reply targets with conversation membership checks.
- Protected direct post reads, comments, reactions, saves, moderation state, and group visibility.

### Economy and progression

- Added one canonical battle-pass definition/calculation shared by session advancement and retention APIs.
- Fixed free/premium claim-ID collisions and frontend/backend reward-shape drift.
- Removed the client-authoritative battle-pass advance endpoint.
- Disabled arbitrary client pet-XP and group-XP award endpoints.
- Added server-bounded session duration, active-session proof, client nonce idempotency, and reward eligibility checks.
- Added indexed, one-time, transactional referral redemption; removed the 5,000-user scan and the unlimited invalid-code reward flaw.
- Added premium-only marketplace items with backend entitlement enforcement and frontend lock state.
- Made marketplace purchases transactional with conditional balance deduction and unique ownership.

### Truthful behavior and UX

- Replaced the always-perfect vision stub with actual on-device MediaPipe face detection and truthful unavailable state. Phone detection is explicitly not fabricated.
- Removed the fake demo video and mounted no-op components.
- Missing email provider configuration now records delivery failure instead of mock success.
- Registered the production service worker and removed its duplicate precache entry.
- Removed fake leaderboard sample data.
- Added reusable retryable error states to leaderboard, battle pass, loot boxes, and pets.
- Marked unfinished competing battle-pass tables as deprecated/non-canonical.

## Database migrations

- `0005_add_indexed_referrals.sql`
- `0006_add_premium_marketplace_items.sql`
- `0007_add_session_idempotency.sql`
- `0008_harden_marketplace_inventory.sql`
- `0009_add_active_session_start.sql`

Deploy migrations before deploying application code. Back up the production database first. Migration `0008` intentionally deduplicates inventory ownership before adding the unique index.

## Verification

```text
pnpm typecheck                         PASS
pnpm test                              PASS (11 tests)
pnpm build                             PASS with pre-existing source-map and large-chunk warnings
pnpm audit --prod --audit-level low    PASS — no known vulnerabilities
```

## Product completion extension

The previously deferred product backlog is now implemented:

- Premium emote catalogue, entitlement API, and pickers in DMs/study rooms.
- Premium Cosmic, Neon, and Aurora Focus City skins with server-side gating.
- Premium seasonal-event schema, seeded Cosmic Focus season, challenge API, and locked/unlocked banner state.
- Expanded onboarding flight plan explaining first action, AI, tracking, analytics, and progression.
- Dashboard “Today’s Focus” recommendation based on active tasks, streak, focused minutes, and time of day.
- Session Replay page with timeline scrubber and AI recap.
- Premium roadmap milestones, progress checks, resources, and richer fallback plans.
- Free three-deck limit, unlimited Premium decks, and Premium AI flashcard generation from notes.
- Mobile study-room fixes, safe-area composer, touch targets, accurate API payloads, and emotes.
- Premium push priority and alert-style preferences, carried into Web Push payloads; priority alerts remain visible until dismissed where supported.
- 60-day free / 180-day Premium analytics plus an animated 7×24 time-of-day heatmap.
- Forest and Focus To-Do comparison pages with guide linking and sitemap entries.
- Optional Upstash Redis premium-status cache with safe database fallback and invalidation.
- Playwright desktop/mobile responsive checks and axe WCAG 2.2 AA serious/critical violation gates in CI.

## Still required before the master program is complete

- Full integration tests against PostgreSQL, cross-tenant API tests, browser E2E, concurrency/failure-injection tests, and coverage thresholds.
- Atomic transactions for every remaining reward/claim path (premium, loot boxes, daily rewards, missions, quests, battle pass, and session fan-out).
- Short-lived access/rotated refresh sessions, session inventory/revocation, admin MFA, and password-reset-driven access-token revocation.
- Complete API contract coverage and replacement of ad-hoc fetch/`any` usage.
- Persistent production realtime infrastructure for Vercel or truthful removal/relabeling.
- Distributed rate limits, durable jobs, observability, accessibility/privacy work, bundle optimization, and documentation cleanup.
- Browser accessibility tests are configured in CI; local execution requires the Playwright Chromium download, which the current sandbox CDN connection could not complete.

## Audit corrections to the follow-up prompt

- The alleged `premiumCheck.ts` circular import is not currently a runtime circular dependency; no speculative change was made.
- No active `scripts/premium-tier-migration.sql` or `streak_start_date` occurrence exists in the audited branch, so the claimed schema mismatch could not be reproduced.
- Referral redemption was more severe than an O(n) query: it granted the applicant reward before code validation and allowed repeat claims. The implemented fix addresses both integrity and performance.
