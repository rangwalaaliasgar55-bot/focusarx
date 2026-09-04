# FocusArx Architecture

## Overview

FocusArx is a monorepo productivity application built with React + Vite on the frontend and Express 5 + Drizzle ORM on the backend, targeting PostgreSQL (Neon serverless) for data persistence.

```
focusarx/
├── artifacts/
│   ├── focusarx/          # Frontend (React + Vite + Tailwind)
│   └── api-server/        # Backend (Express 5 + Drizzle + Socket.IO)
├── lib/
│   ├── api-spec/          # OpenAPI specification
│   ├── api-client-react/  # Generated API client (Orval)
│   ├── api-zod/           # Shared Zod validation schemas
│   └── db/                # Database schema + migrations (Drizzle)
├── database/              # Schema SQL + verification
├── docs/                  # Documentation
├── tests/                 # E2E tests (Playwright)
└── scripts/               # Build + dev utilities
```

## Frontend Architecture

- **Framework**: React 19 with TypeScript
- **Build tool**: Vite 7
- **Styling**: Tailwind CSS 4 with CSS custom properties for theming
- **Routing**: wouter (lightweight, ~2kB)
- **State management**: TanStack React Query (server state) + React context (auth)
- **Real-time**: Socket.IO client
- **Animation**: Framer Motion
- **3D/Visual**: Three.js via @react-three/fiber + @react-three/drei
- **Components**: shadcn/ui (Radix UI primitives)

### Code Splitting

The Vite build produces ~50 route-level chunks via `React.lazy()` + dynamic imports. Vendor code is split into stable, independently cacheable chunks:

- `vendor-react` — React core (~190kB)
- `vendor-motion` — Framer Motion (~129kB)
- `vendor-three` — Three.js (~732kB, only loaded for 3D pages)
- `vendor-charts` — Recharts/D3 (~332kB)
- `vendor-query` — TanStack Query (~36kB)
- `vendor-radix` — Radix UI primitives (~77kB)

### Key Pages

| Route | Component | Auth Required | Description |
|---|---|---|---|
| `/` | Landing / Focus Home | No | Landing for guests, focus home for authenticated |
| `/dashboard` | Dashboard | Yes | Main productivity dashboard |
| `/tasks` | Tasks | Yes | Task management |
| `/goals` | Goals | Yes | Goal tracking |
| `/analytics` | Analytics | Yes | Focus session analytics |
| `/admin` | Admin Panel | Admin | Admin control center |
| `/developer` | Developer Mode | Admin | Developer god-mode panel |

## Backend Architecture

- **Framework**: Express 5
- **Database**: PostgreSQL (Neon serverless) via Drizzle ORM
- **Authentication**: JWT (access + refresh tokens) with httpOnly cookies
- **Real-time**: Socket.IO with ticket-based authentication
- **Rate limiting**: express-rate-limit with optional Upstash Redis shared store
- **Logging**: Pino (structured JSON logging)

### API Structure

All API routes are mounted under `/api/` and follow REST conventions. Routes are organized by domain:

- `auth.ts` — Registration, login, logout, password reset, token refresh
- `sessions.ts` — Focus session CRUD, active session management
- `tasks.ts` — Task CRUD, missed review, stats
- `goals.ts` — Goal CRUD
- `stats.ts` — Analytics, streaks, productivity stats
- `admin.ts` — Admin user management, economy, seeding
- `developer.ts` — Developer god-mode (overview, user search, flags, AI budget)
- `adminSql.ts` — SQL console (read/write with guardrails)
- `adminCms.ts` — Content management (site settings, announcements)
- + 50+ domain-specific route files

### Security Layers

1. **Helmet** — CSP, HSTS, X-Frame-Options, etc.
2. **CORS** — Origin allowlist, credentials support
3. **Rate limiting** — Per-route and global limits
4. **Auth middleware** — JWT verification on protected routes
5. **Admin auth** — Separate admin cookie + role check
6. **Input validation** — Zod schemas on all write endpoints
7. **Ownership checks** — All user data queries filter by `userId`
8. **Error sanitization** — No stack traces or internals exposed

## Data Flow

```
Browser → Vite dev server → /api proxy → Express API → Drizzle ORM → PostgreSQL
                                         ↕
                                    Socket.IO (real-time)
```

### Authentication Flow

1. User registers → bcrypt password hash → JWT access + refresh tokens
2. Access token: 15-minute expiry, httpOnly cookie
3. Refresh token: 7-day expiry, httpOnly cookie, family-based rotation
4. Token refresh: POST /api/auth/refresh → new access + refresh pair
5. Logout: revoke refresh token, clear cookies

### Focus Session Flow

1. Start: POST /api/sessions/active → creates active session row
2. Sync: PUT /api/sessions/active/:id → periodic heartbeat
3. Complete: POST /api/sessions → finalizes session, computes rewards
4. Idempotency: client nonce prevents double-counting
5. Rewards: server-side computation of XP, coins, streak updates

## Deployment

- **Platform**: Vercel (serverless functions)
- **Database**: Neon PostgreSQL
- **Cache**: Upstash Redis (optional, for shared rate limiting)
- **Frontend**: Static export + server-side prerendering (69 pages)
- **API**: Single serverless function at `/api/*`

## Addendum — 2026-09: retention hardening (Phases 5–7)

### Timer engine (`usePomodoro` + Worker + server verify)

- Deadline-based (`deadlineMs = Date.now() + slice`), Worker tick 150 ms
  recomputes `ceil((end - now)/1000)` — background stalls self-correct.
- Guest-local snapshot (`focusarx-guest-timer`, `lib/timerPersistence.ts`):
  stores the *deadline*, so resume-after-close/sleep lands on true
  remaining. Written on transitions + ≤5 s while running + `pagehide`;
  cleared on reset. Server recovery (authed) arrives later and wins.
- Single-leader election (`lib/timerLeader.ts`): `navigator.locks`
  `ifAvailable` while `running`, auto-released on tab death;
  `BroadcastChannel` announce-only fallback on legacy browsers. Loser
  stands down to `paused` and surfaces `leaderBlocked` for the UI toast.
- Completion is idempotent end-to-end: `completingRef` guard client-side,
  `(user_id, client_nonce)` unique insert server-side (`sessions.ts`).
- Chime path: shared `AudioContext` resumed opportunistically
  (`soundEngine.getCtx`), unlocked on start/pause gestures.

### Streaks in user-local days (`lib/timezone.ts`, `routes/sessions.ts`)

- Day keys via `Intl` in `users.timezone` (adopted from the device
  `Intl.DateTimeFormat().resolvedOptions().timeZone` on session
  create/sync/complete). Missing/invalid/`"UTC"`-default → legacy IST.
- `nextStreakValues` accepts `legacyYesterday`: a match continues the
  streak, so zone adoption and travel never silently reset progress.
- Productivity logs and weekly XP resets use the same zone
  (`dayKeyInZone`, `weekStartInZone`). DST-safe: calendar-string math.

### Capability tiers (`lib/deviceTier.ts`)

- Pure `detectTier(caps)`: full / lite / essential per WebGL2, memory,
  concurrency, reduced-motion, saveData, effectiveType, and old-OS in-app
  WebView gating. Unknown memory/concurrency counts as passing.
- Override in Settings → Appearance (`focusarx-visual-tier`); reported once
  per tab in the `device_context` analytics event (with `src`).
- Hero3D never mounts GL on essential; render loop pauses when hidden.

### Reactive scene bus (`lib/sceneBus.ts`, `SceneBackdrop`, `MinimalRing`)

- `usePomodoro` publishes throttled (1 Hz) snapshots + one
  `scene-complete` event on focus completion. Staleness (>2.5 s) doubles
  as the hidden-tab signal (desaturate = visible penalty).
- All tiers render the same meaning: elapsed%, paused, complete, streak
  satellites (cap 30 → halo), 7 weekly facets, time-of-day hue.
- Presets (`lib/scenePreset.ts`): Core + Minimal Ring ship; Deep Sea,
  Study Room, Constellation, Zen Garden are Pro stubs.

### Funnel routes

- `/focus` (public, guest-first, `?duration=&task=&src=`), `/go/ig` →
  armed `/focus?duration=25&src=ig`, `/changelog`. SEO contract
  (route/prerender/sitemap/robots) enforced by `seoContract.test.ts`.

## Addendum — 2026-09: features, scenes, gates (second pass)

### Session presets + Flowtime (`sessionPresets.ts`, `FlowTimer.tsx`)

- Named recipes applied via the normal custom-duration path (no engine
  change); choice persisted. Flowtime is a count-up stopwatch whose Finish
  builds a `Session` into the shared `handleSessionRecorded` pipeline, so
  XP/streak/summary semantics match countdown sessions.
- Timer's completion callback was extracted from inline (also fixing a
  pre-existing conditional `useEffect` nested inside it).

### Streak Shield (`resolveStreakOutcome`, `streak_history`)

- Pure decision: same-day → continue → shield (exactly one missed day +
  banked token) → reset. Consumption + history insert happen in the same
  transaction as the streak row; `shieldUsed` rides completion responses.

### Scenes (`sceneMaps.ts`, `DeepSeaScene`, `StudyRoomScene`)

- Pure mapping layer (depth, creatures, camera, fog, lamp, sky, books)
  tested without GL. R3F scenes are `lazy()`-split (three.js never enters
  the focus chunk), mount only on Full tier without reduced-motion, pause
  when hidden. Lite/essential fall back to Minimal Ring; Lite also serves
  as the fallback for non-Pro users picking Pro presets.

### Money, recap, referrals

- Stripe: REST Checkout + HMAC webhooks (no SDK), idempotent grants into
  the existing entitlement tables, 503-dormant without keys.
- Recap: 7-day aggregate (zone-aware best hour) + share image + 1/day
  email via the logged Resend helper.
- Referrals: `?ref=` captured at boot, auto-applied on first auth
  (server-409 idempotent); manual code entry unchanged.

### Observability + gates

- Plausible (1 KB, env-gated) beside first-party `/api/track`; Sentry
  lazy on both ends (release-tagged, no PII). Single drizzle snapshot
  enforced via the OTEL peer (see `sentry.ts` note).
- ESLint strict (changed-files CI gate; legacy backlog tracked),
  knip files+deps CI gate, Playwright landscape/tablet/reduced-motion
  projects + guest timer-survival specs, bundle budgets, `.browserslistrc`.
