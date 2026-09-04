# FocusArx — Phase 0 Audit (v1 verification, no code changed)

Date: 2026-09-04 · Repo: `rangwalaaliasgar55-bot/focusarx` @ `ea8b67f` · Live: `focusarx.site`
Method: full repo read. Every claim below cites `file:line`. Nothing was modified.

---

## 1. Stack, folder structure, build/deploy, hosting

### Stack

| Layer | What it actually is | Evidence |
|---|---|---|
| Frontend | React 19 + Vite 7 + Tailwind CSS 4 + TypeScript, `wouter` routing, TanStack Query, Framer Motion, R3F (`@react-three/fiber` + `drei` + `three`), Socket.IO client | `artifacts/focusarx/package.json:16-26`, `artifacts/focusarx/src/App.tsx:8` |
| Backend | Express 5 + Drizzle ORM + Zod, Socket.IO server, JWT access (15 min) + rotating refresh families (httpOnly cookie) + legacy 7-day bearer fallback | `artifacts/api-server/src/routes/auth.ts:52-72`, `artifacts/api-server/src/lib/refreshTokens.ts` |
| Database | PostgreSQL (Neon serverless) via Drizzle; 14 schema files, **no Supabase, no RLS** — ownership enforced app-side (`eq(table.userId, req.userId)`) | `lib/db/src/schema/` (14 files), e.g. `artifacts/api-server/src/routes/sessions.ts:229-232` |
| Auth | Email+password (bcryptjs) + guest accounts + Google OAuth optional; **no magic link, no Apple** | `artifacts/api-server/src/routes/auth.ts:16-42`, `.env.example:31-36` |
| Realtime | Socket.IO with 60 s ticket exchange (`connectSocket(getToken())`) | `artifacts/focusarx/src/App.tsx:247-257` |
| Email/push | Resend *or* SMTP fallback; Web Push via VAPID (`pushSubscriptions`, `pushSender`) | `.env.example:38-82`, `artifacts/api-server/src/lib/pushSender.ts:28` |
| AI | Server-only Groq (`llama-3.3-70b-versatile`) + Gemini (`gemini-2.5-flash`) with budget ledger, rate limits, zod, sanitization | `artifacts/api-server/src/lib/aiProvider.ts:54-210` |
| Tests | Vitest (unit) + Playwright (e2e: `token-premium`, `responsive`, `accessibility`) + contract tests (`seoContract`, `routeContract`, `routerAuthScope`, `regressionGuard`) | `tests/e2e/`, `artifacts/api-server/src/routes/seoContract.test.ts` |

> **Not present:** Next.js, Supabase, Stripe, Dexie/IndexedDB, `next/image`, `@vercel/og`, PostHog/Plausible, Sentry DSN in repo, Supabase cron. Premium is **token/coin-based**, not Stripe (`premium.ts`, `premiumPlans.ts` — "purchasePremiumWithTokens").

### Folder structure (abridged)

```
focusarx/
├── artifacts/focusarx/       # SPA frontend (React+Vite). src/{pages(~95),components,hooks,lib,store,content}
│   ├── index.html            # SEO head: canonical/OG/JSON-LD (403 lines)
│   ├── public/{manifest.json,sw.js,robots.txt,sitemap.xml,ads.txt,opengraph.jpg,audio/…}
│   ├── scripts/{prerender.mjs,prerender-data.mjs,seo-validate.mjs,serve-dist.mjs}
│   └── vite.config.ts        # manualChunks: vendor-react/motion/query/three/charts/…
├── artifacts/api-server/src/ # Express API. routes/~70 files, lib/, middlewares/{cors,auth,security}
├── lib/{db,api-spec,api-client-react,api-zod}  # Drizzle schema, Orval client, shared zod
├── api/index.mjs             # Vercel serverless entry → artifacts/api-server/dist/app.mjs
├── database/ docs/ tests/ scripts/ .github/
├── vercel.json               # static + /api routing, cron retention/reengage 9am daily
└── pnpm-workspace.yaml (pnpm@10.26.1, Node 24 in CI)
```

### Build/deploy/hosting

- `pnpm build:vercel` = `db push` → `api-server build` → `focusarx build:vercel` (`package.json:9`). Frontend `build` = `vite build && prerender.mjs && seo-validate.mjs` (`artifacts/focusarx/package.json:9`).
- `vercel.json:4-10`: `outputDirectory: artifacts/focusarx/dist/public`, `/api/(.*)` → serverless `api/index.mjs` (maxDuration 30 s). `/sitemap*.xml` rewritten to API with CDN cache headers. SPA fallback `/(.*)` → `/index.html:37`. `/sw.js` served `no-cache` (`vercel.json:78-89`).
- Hosting is **Vercel** (static + functions) + **Neon Postgres**. Canonical host is the **apex** `https://focusarx.site` (`index.html:34`, `robots.txt:152`, `.env.example:18-22`). The index.html comment itself warns the Vercel primary domain **must** be the apex or every canonical points at a redirect and "Google refuses to index" (`index.html:26-33`) — there is **no 301 rule in `vercel.json`**, so www↔apex depends entirely on dashboard settings.
- Cron: only `GET /api/retention/reengage/run` daily `0 9 * * *` (`vercel.json:104-109`). No user-local-midnight streak cron; streaks are evaluated **lazily on completion/read** (see §2.5).
- Package manager enforced as pnpm (`package.json:7` preinstall guard).

---

## 2. How things work TODAY

### 2.1 Routing — single client-only SPA, wouter, prerendered for crawlers

- **Client-only SPA.** `artifacts/focusarx/src/main.tsx:62` mounts `<App/>` into `#root`; `App.tsx:259-395` is a single `<Switch>` with ~70 `<Route>`s, all `lazy()` + `<Suspense fallback={<PageLoader/>}>`. No SSR, no Next.js App Router, no `/focus` route: guests get `<LandingPage/>` and authed users get `<FocusHomePage/>` (pages/focus.tsx) **both at `/`** (`App.tsx:218-235`). `/dashboard` exists but is `ProtectedRoute`-gated (`App.tsx:286`). No `?duration=&task=` deep-link parsing was found in timer/focus pages.
- **Marketing vs app are not separated** (`/` serves both by auth state). An unauth mobile gate redirects unknown paths to `/welcome` (with bot-UA exemption, `App.tsx:159-186`).
- **Crawler story is build-time prerender, not SSR.** `scripts/prerender.mjs:3-12` states the app is client-rendered and emits one static HTML per route in `prerender-data.mjs` (separate `<title>/meta/H1/FAQ/JSON-LD`), hidden from JS users via `.fa-seo` CSS. `seo-validate.mjs` fails the build if sitemap↔prerender drift. `seoContract.test.ts` enforces the same three-list invariant (routes/sitemap/prerender). Good — but it is still one JS bundle at runtime.
- Page transitions: `AnimatePresence mode="wait"` + `motion.div` fade/slide 250 ms (`App.tsx:262-270`). Every lazy route has a fixed-height `ViewSkeleton` fallback — no layout-shift-by-design.

### 2.2 Timer — timestamp-based + Worker tick, server-verified, guest gap

- **Engine is deadline-based, not naive decrement.** `usePomodoro.ts:65-70` arms `deadlineMsRef = Date.now() + secondsLeft*1000`; the Worker callback recomputes `left = ceil((end-now)/1000)` (`usePomodoro.ts:164-168`). Pause snapshots `left` and clears the deadline (`:179-196`); resume re-arms (`:240-243`). `restoreFromSnapshot` re-derives the deadline from persisted `secondsLeft` (`:285-291`).
- **Web Worker tick (150 ms) with fallback.** `lib/timerWorker.ts:9-24` Blob worker posts `TICK`; `createTimerWorker:32-82` falls back to `setInterval(onTick,150)` when Workers are unavailable. Unit-tested (`timerWorker.test.ts:14-23`). Vite `workerSrc: ['self','blob:']` CSP allows it (`app.ts:77`).
- **Double-fire guarded client-side, idempotent server-side.** `completingRef` + `queueMicrotask(advancePhase)` prevents re-entry (`usePomodoro.ts:170-173`). Server inserts with `onConflictDoNothing([userId, clientNonce])` and serves the original row with `idempotentReplay:true` on replay (`sessions.ts:384-414`). `clientNonce` is `^[a-zA-Z0-9_-]{8,64}$` (`sessions.ts:108`).
- **Server is authoritative on duration.** Completion computes `verified = min(claim, serverActive + 15 s grace, 4 h cap)` and rewards **only** when a same-mode `active_sessions` row exists (`sessionCompletionCore.ts:47-85`, `sessions.ts:314-331`). `POST /sessions/sync` clamps `activeSeconds ≤ wallClock` (`sessions.ts:253-255`). Expired rows are lazily finalized by a state machine (`evaluateActiveSession` + `finalizeExpiredSession`, `sessions.ts:150-157,657-733`): running-past-deadline auto-completes with rewards; paused/idle-past-TTL archives without rewards. Delete-first guard handles races (`:669-672`).
- **Background-tab/phone-lock behaviour.** Deadline math means the *value* self-corrects on return (no cumulative drift), `GET /sessions/active` returns `serverRemaining` computed from `startedAt` (`sessions.ts:159-170`), and autosync fires on `visibilitychange`→visible + `pagehide` keepalive POST (`useSessionPersistence.ts:205-248`). Wake Lock is re-acquired on `visibilitychange` (`useWakeLock.ts:57-62`). **Gaps:** the Worker itself is still `setInterval`-driven so ticks freeze while suspended (display stalls until visible); there is **no `navigator.locks` leader election** — `crossTabSync.ts:23-169` only *broadcasts* timer/focus events, nothing prevents two tabs running two timers; completion relies on `clientNonce` dedupe, not on single-leader.
- **Refresh/close survival is auth-gated.** `useSessionPersistence.ts:148` returns early unless `authenticated`; `dbSessionId` (required for every sync/backup, `:63-95`) only exists after `POST /sessions/active`. **Guests never write `focusarx-active-session-backup`** — a refresh/back-swipe during a guest session loses it. Autosave cadence is 10 s (`AUTOSAVE_MS`), TTL 2 h (`SESSION_TTL_MS`), `beforeunload` warns only when `activeSeconds > 30` (`:215-225`).
- **Sounds/notifications.** Chime/click exist (`soundEngine.ts`, `public/audio/coach/*.mp3`), notification permission uses a soft prompt after the 1st completed session (`useNotificationPermission.ts:28-69`) — good — but `components/Timer.tsx:294` also calls `Notification.requestPermission()` inline (verify it is gesture-gated before release). Several `new AudioContext()` call sites (`Timer.tsx:57`, `FocusLockOverlay.tsx:17`, `SoundEngine.tsx:241`, `ambientEngine.ts:1297`) need an unlock-on-gesture audit. Document PiP mini-timer: **not implemented** (only YouTube iframe `picture-in-picture` allow attr in `YouTubeFocusTimer.tsx:121`).

### 2.3 State & persistence — localStorage only, no DB for guests, no RLS

- **Client source of truth is localStorage, not IndexedDB.** Keys observed: `focusarx-auth-token` (`lib/auth.tsx:35-42`), `focusarx-active-session-backup` (`useSessionPersistence.ts:21`), `focusarx-sessions`, `focusarx-tasks` (`lib/constants.ts:4-6`), `focusarx-offline-queue` (`useOfflineQueue.ts:12`), `focusarx-theme/accent`, `focusarx-mobile-welcome-done`, `focusarx-notif-soft-dismissed`, `focusarx-sessions-completed`, `fx_muted`, etc. **No Dexie/IndexedDB import found; no `/sync/push|pull` endpoints; no `last-write-wins` logic.**
- **Corruption safety is mixed.** The shared `useLocalStorage` hook wraps `JSON.parse`/`setItem` in try/catch (`useLocalStorage.ts:7-26`). But scattered direct `localStorage.getItem/setItem` calls (auth token, analytics visitor id, session backup, offline queue) assume availability — Safari private-mode `QuotaExceededError` on `setItem` is caught in most writers (`catch{}`) but **not all readers guard `JSON.parse`** (e.g. `site-analytics.ts:144` parses `LAST_PAGE_KEY` without try). No schema-version key was found (`focusarx-schema-v*` absent).
- **Auth storage:** access JWT in `localStorage` (`auth.tsx:38-42`) + httpOnly `refresh_token` cookie rotation (`auth.ts` + `refreshTokens.ts`), `GET /auth/session` cookie-first, socket ticket 60 s (`App.tsx:250-254`). Rate-limited: login 10/15 min, forgot 5/h, guest 20/15 min, refresh 30/min (`rateLimiter.ts:42-102`).
- **DB:** Drizzle + Neon, ~dozens of tables across `focusarx/gamification/premium-economy/social/city/chat/analytics/…`. Access control is **row-ownership WHERE clauses**, not Postgres RLS/Supabase Auth. Google OAuth is scaffolded via env (`GOOGLE_CLIENT_ID/SECRET`) — verify callback route before claiming it works; magic-link/Apple sign-in absent.

### 2.4 AI coach — server-route-only, guarded, but premium-gated + not 7-day-contextual

- **Keys are server-only.** `GEMINI_API_KEY`/`GROQ_API_KEY` are read only in `lib/aiProvider.ts:55,116` and `routes/ai.ts:53`. A repo-wide `rg` for `VITE_*KEY|NEXT_PUBLIC|gsk_|AIza` under `artifacts/focusarx/src` returned **zero hits**. No `sk-` client secret found.
- **Layers of defence exist:** per-user keying on stable `userId` (not rotating token prefix, `rateLimiter.ts:32-40`), `aiCoachLimiter` 20/min + `aiRoadmapLimiter` 10/h with premium bypass (`:150-178`), per-IP daily cap `checkIpLimit`, global daily caps (`GROQ_DAILY_CAP` default 3000, `GEMINI_DAILY_CAP` 1500, `aiBudgetCore.ts:10-11`) with cool-down, per-user purpose counters (`userPurposeCalls`), `max_tokens 512` / `maxOutputTokens 4096`, `AbortSignal.timeout(25_000)` (`routes/ai.ts:101`), zod on every body (`coachChatSchema`, `roadmapRequestSchema`), `sanitizeAiInput` + `detectPromptInjection` + `validateAiOutput` (`routes/coach.ts`, `routes/ai.ts:193-236`), graceful builtin fallback replies when keys/budget absent.
- **Gaps vs the v1 spec:** (a) `/coach/chat` requires `requirePremium` (`routes/coach.ts:51`) — free users never reach the LLM, so "Free 10/day" is **false for chat** (only `/ai/roadmap` enforces free-10/day, `routes/ai.ts:230-236`); (b) no evidence the system prompt receives last-7-days sessions/minutes/best-hour/completion/streak/pauses — `coach.ts` imports session tables but the prompt builder must be verified; (c) streaming route file exists (`aiStreamingRoutes.ts`) — confirm SSE + loading/error UI on the client before claiming streaming; (d) tone constraints ("calm, brief, no exclamation") are not visibly enforced in prompt text reviewed.

### 2.5 Gamification/XP/streak — solid anti-farm core, IST-locked days

- **Rewards** (`lib/sessionRewards.ts:44-86`): 20 XP/min ≤120 min, 15/min after; coins 10 per 5-min block (7 beyond 2 h); +50 coins for a full 25-min pomodoro; premium 1.5× XP / 1.25× coins; `<60 s` pays nothing (`isRewardEligible`, `sessionCompletionCore.ts:78-85`); level = `floor(sqrt(totalXp/100))+1` (`sessions.ts:621`). Loot-box drop every 10th session (`maybeDropLootBox`, `sessions.ts:28-47`), city tiers, battle-pass seasons (ISO weeks Mon–Sun UTC, `battlePass.ts:2-22`), pet XP, missions.
- **Streaks are transactional and replay-safe** (`applyStreakProgress` with `FOR UPDATE`, `sessions.ts:565-591`; pure `nextStreakValues`, `sessionCompletionCore.ts:103-117`; same-day repeat returns `changed:false`). Weekly XP resets Monday 00:00 **IST** (`istWeekStartDate`).
- **Day boundary is hardcoded IST (UTC+5:30), not the user's IANA zone.** `lib/istDate.ts:1-21` ("India-first … never the UTC one"), used for `istToday`, streak `today/yesterday` (`sessions.ts:566-567`), productivity logs (`:430`), missions/battle-pass tests. Correct for India, **wrong for every other timezone** (a US/EU evening session lands on the wrong "day"), and travel/DST is unhandled (IST has no DST, so travellers gain/lose days). No `streaks` history/audit table, no Streak Shield, no user-local-midnight cron — missed-day evaluation happens only on next completion/read.

### 2.6 SEO surface — unusually thorough for a SPA; Lighthouse needs measuring

- `index.html`: unique title/description, canonical apex, OG + Twitter large-image, 6 JSON-LD blocks (Organization, WebSite+SearchAction, SoftwareApplication *without* self-serving `aggregateRating` — deliberate, documented `:152-163` — FAQPage ×10, ItemList), `theme-color` ×2, `manifest`, `apple-touch-icon`, GA4 (`G-PXMVX28PL5`, `send_page_view:false` to avoid double-count), AdSense async. GSC verification slot present but empty (`:21-23`).
- `robots.txt`: apex sitemap, private routes disallowed, `/api/` blocked except SEO endpoints, AdsBot/Mediapartners explicitly allowed, AI crawlers deliberately allowed with rationale (`:106-149`).
- Sitemap served by API (`routes/sitemap.ts`) rewritten to `/sitemap.xml` + index children; `public/sitemap.xml` fallback exists. Prerender covers exam hub/slugs (`/exam`, `/exam/:slug` from `EXAM_GUIDES`), comparisons (`/comparison/:slug`), and intent pages (`/pomodoro-timer`, `/study-timer`, `/deep-work-guide`, `/focus-music`, … per `App.tsx:328-341`). **Missing vs spec:** `/blog`, `/ai-study-coach`, `/habit-tracker-for-students`, `/pomodoro-timer-for/[exam]` programmatic template (exam slugs live under `/exam/` instead), per-user/dynamic OG (`@vercel/og` absent — single `opengraph.jpg`), `hreflang`, `/go/ig` funnel route, live "focusing right now" counter (a fabricated counter was *removed* in `039262d` — good — but no live replacement was found).
- **Lighthouse estimate (unmeasured — run CI before quoting):** structure suggests SEO ~95+ (prerender + meta), Perf ~70-85 mobile (mitigations real: `hoistTransitiveImports:false` + `vendor-three` split so three.js is *not* in the entry preload — `vite.config.ts:50-57,84-87`; self-hosted `@fontsource`; SW shell cache; risks: `target: esnext`, AdSense+gtag third-parties, recharts/charts chunk, `Stars count 1800` desktop in Hero3D). A11y ~85-95 (skip-link, focus-visible, skeletons; axe specs exist but motion/contrast not yet proven). **Do not ship a number without running Lighthouse CI + axe + bundle analyzer.**

### 2.7 Design tokens — no system, counts violate the Apple spec

`artifacts/focusarx/src/index.css:39-265` defines, approximately: **2 variable font families** (Geist + Manrope, +SF fallbacks — not Inter), **30+ color tokens** (brand violet/pink/blue/teal/gold/navy + 7 rank + 4 rarity + 8 session-mode + success/warning/danger/info + full neutral/brand scales), **7 radii** (6/8/12/16/22/28/9999 px), **13+ shadows** (`xs→xl` + violet/teal/gold variants + 3 glows), **6 durations + 4 easings** (not springs-only), type scale 12→60 px (not the 13/15/17/21/28/40/56/80 spec), spacing/z-index scales. Glass exists but as `blur(16px)` card + `blur(8px)` subtle variants, not the single 20 px spec. There is **no `/design-system` route, no Storybook, no token lint**. Motion includes many looping decorations (`aurora-spin 36s`, `marquee 40s`, `float-orb`, `fire-flicker`, `scan`, `shimmer`, `breathe-glow` — `index.css:509-990`), directly against the "never looping decoration" rule. Copy tone also needs a pass (hustle words/emoji present in places, e.g. `FeatureCompassModal.tsx:240` "⏱️ Focus Core").

### 2.8 Accessibility, mobile, PWA

- **Present:** `viewport-fit=cover`, `theme-color`, `manifest.json` (standalone, shortcuts, maskable), `sw.js` v7 (shell precache, network-first navigations, `/api/*` never cached, versioned purge, `SKIP_WAITING`/`CLEAR_CACHE`), `skip-to-content` link, `:focus-visible` rings, `MotionConfig reducedMotion="user"` + a `prefers-reduced-motion` CSS kill-switch, `tabular-nums` metric class, `tests/e2e/accessibility.spec.ts` + `responsive.spec.ts`, mobile bottom nav with safe-area padding (`index.css:1211-1220`), UA-based `lowDetail` 3D degradation (`Hero3D.tsx:28-40,140`).
- **Gaps to verify on devices:** `target: esnext` ships untranspiled syntax (breaks the Chrome-80/iOS-13 floor); at least one `100vh`-derived layout (`SqlEditor.tsx:637` `h-[calc(100vh-200px)]`, no `--vh` fallback found); `backdrop-filter` used liberally (low-end Android jank risk); tap-target (44 px) and 320/280 px overflow unproven; focus-trap/Esc/scroll-lock for modals not confirmed; heading order and `div`-as-button instances not audited; contrast ratios not measured; landscape-phone Focus Mode not designed; no `forced-colors`/`prefers-contrast` handling; offline shell covers navigation but **timer does not work offline for guests** (no IDB) and push/e-mail digests are best-effort.

---

## 3. Top 15 issues (ranked by user impact)

| # | Sev | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | P0 | **Guest timer lost on refresh/back-swipe.** Persistence requires auth + server row; guests (the entire Instagram funnel) have no backup. | `useSessionPersistence.ts:63-95,148` (early-return unauth; backup only inside authed sync) | Persist deadline snapshot to localStorage/IDB on every tick for *all* users; restore on mount; keep server as arbiter when authed. Regression test: start → reload → resume. |
| 2 | P0 | **Streak day = IST for everyone.** Non-India users gain/lose days; travel breaks streaks — the #2 retention killer. | `istDate.ts:1-21`, `sessions.ts:566-567,599` | Store user IANA zone (`profiles.timezone`), compute days in SQL/JS with it, backfill; nightly user-local job; history table; DST-safe tests. |
| 3 | P0 | **Two tabs can run two timers.** Broadcast only notifies; no leader election → double sessions/XP attempts (saved only by nonce dedupe). | `crossTabSync.ts:23-169` (no locks), no `navigator.locks` usage found | `navigator.locks` leader + `BroadcastChannel` follower mirror; completion allowed only from leader; Playwright 2-tab test. |
| 4 | P1 | **No `/focus` app route; `/` is dual-purpose.** Cannot deep-link `/focus?duration=25&task=…` from Instagram; `/go/ig` funnel absent. | `App.tsx:218-235,285` (no `/focus` path) | Add `/focus` (client, fullscreen-capable) + `/go/ig` → armed Core + `src` attribution; keep `/` marketing. |
| 5 | P1 | **No reactive Focus Core.** Hero3D is a decorative planet (time-driven rotation, pointer parallax) with zero session-state bindings and `frameloop="always"`. | `Hero3D.tsx:51-78,169-202` (no elapsed/paused/streak props) | Build `useSceneState()` + data→visual map per spec; `frameloop="demand"`; lazy-load; 2D/CSS fallbacks. |
| 6 | P1 | **Free AI coach unreachable.** `/coach/chat` is `requirePremium`-gated; "Free 10/day" only applies to roadmaps. | `routes/coach.ts:51`, `routes/ai.ts:230-236` | Free 10/day chat quota server-side; premium unlimited; streaming + 7-day context prompt. |
| 7 | P1 | **No monetisation infra.** Premium = earned coins/tokens; no Stripe, no plans page wired to payment. | `routes/premium.ts:27-50` (token plans), rg `stripe` = 0 hits | Stripe Free/Pro + webhook → entitlements; keep coin path as student-friendly alternative. |
| 8 | P1 | **Modern-only bundle.** `target: esnext` + no legacy build/polyfill split → blank page risk on Chrome 80/iOS 13 and many 4-7 y/o Instagram-WebView phones. | `vite.config.ts:37-43` | browserslist floor + differential modern/legacy, `@supports` guards, `--vh` fallback. |
| 9 | P1 | **No offline timer / no IDB sync.** SW skips `/api/*`; queue is localStorage-only; queue flush + conflict policy unverified. | `public/sw.js:73-…`, `useOfflineQueue.ts:12-27` | Dexie as client truth + `/sync/push|pull` idempotent queue; timer runs fully offline. |
| 10 | P1 | **www↔apex canonical risk.** No server 301; correctness depends on Vercel dashboard primary-domain setting. | `vercel.json` (no redirect), `index.html:26-33` warning | 301 www→apex in config + `rel=canonical` audit; verify in prod headers. |
| 11 | P2 | **Chime/AudioContext autoplay risk.** Multiple `new AudioContext()` sites; unlock-on-gesture not proven; completion may be silent. | `Timer.tsx:57`, `FocusLockOverlay.tsx:17`, `SoundEngine.tsx:241` | Single sound engine, resume on first gesture, test on iOS/Android WebView. |
| 12 | P2 | **Design-system drift.** ~30 colors, 7 radii, 13 shadows, looping decorations, 2 non-spec fonts. Every new screen adds debt. | `index.css:39-265,509-990` | Freeze tokens to the Phase-2 spec; lint (stylelint/token grep) in CI; codemod screens. |
| 13 | P2 | **SEO gaps that cost growth.** No `/blog`, no per-exam `/pomodoro-timer-for/[exam]` URLs, single static OG image, no hreflang, no changelog/privacy-linked claims audit. | `App.tsx:328-341`, `public/opengraph.jpg` (single) | Programmatic exam template (JSON-extensible), `@vercel/og` crystal images, changelog. |
| 14 | P2 | **Analytics without privacy-first funnel.** GA4 + AdSense only; no `src=ig` attribution, no tier/device reporting, no "focusing now" API. | `index.html:367-391`, no PostHog/Plausible dep | PostHog/Plausible (IN/EU), `src` param end-to-end, realtime-presence counter. |
| 15 | P2 | **Error/empty sweets missing.** No top-level route error boundaries beyond per-route `ErrorBoundary`; unhandled-rejection reporting and offline/404 pages unverified. | `App.tsx:285-389` (per-route only) | Root `ErrorBoundary` + `/404` + offline page + Sentry client+server with releases. |

Smaller but real: `SqlEditor 100vh` (`developer/SqlEditor.tsx:637`); `Timer.tsx:294` notification-permission call-site audit; AdSense CLS/perf cost; `Stars count 1800` on desktop; `orientation: portrait-primary` in manifest blocks landscape PWA; missing `CSP` on static (API has helmet CSP, static headers only nosniff/referrer — add HSTS/CSP/X-Frame via `vercel.json`).

---

## 4. Security findings

| # | Finding | Severity | Evidence | Action |
|---|---|---|---|---|
| S1 | **No client-reachable LLM keys found.** Good hygiene. | — | rg `VITE_*KEY\|NEXT_PUBLIC\|gsk_\|AIza` in `artifacts/focusarx/src` = 0 hits; keys only in `aiProvider.ts:55,116`, `ai.ts:53` | Keep; add gitleaks/trufflehog to CI on repo **and** `dist/` |
| S2 | **User token in localStorage (XSS-bearer).** Refresh rotation + short-lived access mitigate, but any XSS = session theft. | High | `lib/auth.tsx:35-42` | Move to httpOnly cookie session; add CSP `script-src` tightening; audit `dangerouslySetInnerHTML` |
| S3 | **CORS is allowlist + same-origin aware — reasonable.** Preflights bypass limiters by design. | Low | `middlewares/cors.ts:139-230`, `app.ts:127` | Add integration test for evil-origin POST rejection; monitor `CORS_FORBIDDEN` logs |
| S4 | **Rate limiting is per-user (fixed token-rotation bug) + Upstash-optional.** In-memory fallback on serverless = per-instance buckets. | Med | `rateLimiter.ts:32-40`, `rateLimitStore.ts` | Set `UPSTASH_*` in prod; alert on limiter-hit spikes |
| S5 | **Validation is zod-everywhere on reviewed routes; bodies capped at 100 kb.** | — | `sessions.ts:94-133`, `coach.ts:26-33`, `app.ts:130-131` | Extend zod audit to remaining ~70 routers; fuzz `focusTimeline/sessionInsights` unknown fields |
| S6 | **Admin SQL console exists (gated).** Privileged read/write behind password + role + optional unlock phrase. | Med | `.env.example:95-101`, `routes/adminSql.ts:15-22` | Keep disabled by default; require 2-person review for enabling; log every query |
| S7 | **No RLS — app-layer ownership only.** One missing `where(userId)` = cross-user leak. | Med | `sessions.ts:229-232` pattern | Add `routerAuthScope` tests to every new router (pattern exists); consider RLS migration with Supabase long-term |
| S8 | **Helmet CSP allows AdSense/GA origins (necessary) — widens XSS blast radius.** | Med | `app.ts:40-105` | Nonce/hash inline scripts; strip `unsafe-inline` where possible; `frameSrc` locked to Google only (already) |
| S9 | **PII: DMs, camera-data copy, UGC (posts/comments) + Socket.IO.** Moderation + bot filter exist. | Med | `lib/moderation.ts`, `lib/botFilter.ts` | DPDP/GDPR export/delete (`/settings/data`) still to build; under-18 minimization review |
| S10 | **Secrets/DI hygiene:** `.env.example` clean, `ADMIN_PASSWORD` min-8 enforced, `AUTH_SECRET` 32+ required, `npm audit`/Knip/Sentry not yet in CI. | Med | `.env.example`, `lib/env.ts` | Enable secret-scan + `npm audit` + Sentry releases in CI (Phase 5.2 already demands it) |

Dependency CVEs: **not measured** — `pnpm audit` / `npm audit` +Dependabot must run in Phase 5.2 (repo pins `pnpm@10.26.1`; frontend pulls `three@0.184`, `framer-motion`, `recharts`, `mediapipe` — all heavy, all need CVE + weight review).

---

## 5. Migration plan — existing users lose nothing

Current client data (all localStorage, **unversioned**):

| Key | Content | Owner |
|---|---|---|
| `focusarx-auth-token` | bearer JWT | authed |
| `focusarx-active-session-backup` | last authed sync payload + `_ts` | authed |
| `focusarx-sessions` / `focusarx-tasks` | guest/local history | guests + authed |
| `focusarx-offline-queue` | unsent mutations | all |
| `focusarx-theme/accent`, `fx_muted`, welcome/notification flags | prefs | all |

Plan (one-time, idempotent, reversible):

1. **Version + snapshot.** On first run of the new build, read every `focusarx-*` key under try/catch (never throw on corrupt JSON — quarantine to `focusarx-quarantine-<ts>`), write `focusarx-schema-v1` snapshot backup before touching anything.
2. **Import guests on first sign-in.** After auth, POST the snapshot to a new idempotent `/sync/import` (dedupe by existing `clientNonce`/timestamps); server returns imported counts; client sets `focusarx-imported-v1=1` and **keeps** local keys for 30 days (dual-read), then GCs.
3. **Streaks:** recompute from imported `completedAt` timestamps in the *user's* IANA zone (prompt once, default device zone); never lower an existing `currentStreak` — take `max(legacy, recomputed)` and log the delta to a new `streak_history` table for audit.
4. **Timer in flight:** if a `focusarx-active-session-backup` or new IDB row is unexpired (<2 h), offer "Resume 23:41 left" — never auto-discard.
5. **Safari private-mode:** every `setItem` wrapped; quota failure → in-memory + IDB fallback + non-blocking toast (no white screen).
6. **Rollback:** `?no-migrate=1` flag skips import; snapshot restores with one tap in Settings → Data.

Tests required: corrupt-JSON fixture, legacy-key fixture, double-import idempotency, timezone-travel streak fixture.

---

## 6. Hypotheses H1–H6 — verdicts

- **H1 "single indexable URL" — CONFIRMED.** One SPA entry (`/`), one canonical, prerendered per-route static copies for crawlers but a single runtime bundle. No SSR routes.
- **H2 "client-only state" — CONFIRMED (with nuance).** Timer math + prefs + guest history are client-only (localStorage); authed sessions sync to Postgres, but there is no IndexedDB, no Supabase, no RLS, no offline-first sync engine.
- **H3 "exposed/unlimited AI calls" — REFUTED on exposure, PARTIAL on limits.** No key is client-reachable (rg clean); server enforces per-user/per-IP/global budgets, timeouts, token caps, injection guards. But free chat is premium-blocked (not "10/day free"), and 7-day-context coaching is unproven.
- **H4 "timer drifts in background tabs" — PARTIAL.** Value drift is *corrected* by deadline math + server remaining, so it does not accumulate; but ticks stall while hidden (Worker is still interval-driven), guests lose sessions on reload, and dual-tab races exist. The retention-killing *perception* (frozen display, lost session) is still possible.
- **H5 "no design system" — CONFIRMED.** Tokens exist as loose CSS vars (~30 colors / 7 radii / 13 shadows / 2 off-spec fonts / looping motion), no `/design-system`, no Storybook, no lint.
- **H6 "no monetisation infra" — CONFIRMED for Stripe; present for coins.** Zero Stripe refs; premium is earned-token entitlements (`premiumPlans`/`tokenLedger`). No checkout, webhook, or paid-plan gating.

---

## 7. What I need from you before Phase 1

1. Approve this audit + the migration plan (§5), or mark corrections.
2. Decisions: (a) Next.js App Router vs stay on Vite+Express (my recommendation after audit: **stay** — the Express+Drizzle+Neon backend, prerender SEO pipeline, and anti-farm session core are production assets; a framework rewrite risks the two P0 retention bugs; implement `/`, `/focus`, `/dashboard` split inside the existing SPA + API instead); (b) Stripe vs coin-premium priority; (c) IST-only streaks: keep India-first or move to per-user IANA zones now (I recommend IANA now — it is the #2 retention risk for IG-driven non-India users).
3. Confirm I may run `tsc/eslint/npm audit/Lighthouse/axe/Playwright` in Phase 5 (read-only, no deploys) and that pushing branches is allowed with this token (you said you will revoke after).

**STOP — waiting for approval before Phase 1.**
