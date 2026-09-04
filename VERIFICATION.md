# FocusArx — Phase 5.1 Verification (v1 requirements vs reality)

Date: 2026-09-04 · Commit: `2b35be4` (post-Phase-0-audit) · Method: code read + `tsc` + `vitest`.
Rule followed: no PASS without proof (file:line and/or test output).

## 5.2 Tool outputs (attached, local run)

| Check | Result | Notes |
|---|---|---|
| `tsc --build` (libs) | ✅ PASS | clean |
| `tsc -p tsconfig.json --noEmit` (`@workspace/focusarx`) | ✅ PASS | clean after lib build |
| `tsc -p tsconfig.json --noEmit` (`@workspace/api-server`) | ✅ PASS | clean |
| `vitest run` (`@workspace/focusarx`) | ✅ PASS | 9 files / 93 tests incl. `timerWorker.test.ts`, `console-hygiene.test.tsx` (38 page-mount console checks) |
| `vitest run` (api pure-unit: completionCore, rewards, stateMachine, rateLimiter blastRadius, rateLimitStore, pagination) | ✅ PASS | 6 files / 70 tests |
| `npm/pnpm audit`, eslint strict, gitleaks, knip, bundle analyzer, Lighthouse CI, axe, Playwright matrix | ⏳ NOT RUN here | No CI outputs in repo; GitHub reports **41 Dependabot vulns (11 critical)** on `main` — must gate Phase 10 |
| Secret scan (manual `grep` for `VITE_*KEY\|NEXT_PUBLIC\|gsk_\|AIza\|sk-` in `artifacts/focusarx/src`) | ✅ PASS | zero hits; keys only server-side (`aiProvider.ts:55,116`, `ai.ts:53`) |

## Per-requirement verdicts

### Phase 1 — Foundation

| # | v1 requirement | Verdict | Evidence |
|---|---|---|---|
| 1.1 | Migrate to Next.js App Router + TS + Tailwind + Framer Motion | **FAIL (by design)** | Stack is React 19 + Vite 7 SPA + Express 5 (`artifacts/focusarx/package.json`, `App.tsx:8`). No `next/` dependency. Recommendation (AUDIT.md §7): stay — rewrite risks the two P0 retention bugs. |
| 1.2 | `/` marketing (SSR/SEO), `/focus` app deep-linkable `?duration=&task=`, `/dashboard` stats | **PARTIAL** | `/` dual-serves landing/home by auth (`App.tsx:218-235`); `/dashboard` exists gated (`App.tsx:286`); **no `/focus` route, no `?duration` parsing found**; prerender gives crawlers static HTML (`scripts/prerender.mjs:3-12`) instead of SSR. |
| 1.3 | Timer: target-timestamp + Worker, IDB persist every tick + DB on change, survives background/refresh/close/sleep; unit tests for drift/pause/resume-after-close | **PARTIAL** | Deadline math ✅ (`usePomodoro.ts:65-70,164-168`), Worker ✅ (`timerWorker.ts:9-82`, `timerWorker.test.ts`), server verify + idempotent completion ✅ (`sessions.ts:384-414`, `sessionCompletionCore.ts`). ❌ No IndexedDB; ❌ guest sessions lost on refresh (`useSessionPersistence.ts:148` authed-only); ❌ no resume-after-close test; ❌ no `navigator.locks` leader. |
| 1.4 | Supabase Postgres + Auth (magic link/Google/Apple) + RLS + named tables | **FAIL** | Neon + Drizzle + custom JWT (`auth.ts:52-72`); Google OAuth env-only, **no implementation found** (`grep google` in `routes/auth.ts` = none); guest accounts exist (`auth.ts:300`); no RLS (app-side `eq(userId)`). Tables exist under different names (wallets, lootboxes, battle pass…). |
| 1.5 | Anonymous-first, one-time localStorage→DB import on first sign-in | **FAIL** | No import endpoint/flag found; guest history stays local (`constants.ts:4-6`). |
| 1.6 | AI coach server-only, streaming, per-user rate limit (Free 10/day, Pro unlimited), 7-day context prompt, calm tone | **PARTIAL** | Server-only ✅, budgets/limits ✅ (`rateLimiter.ts:165-178`, `aiBudgetCore.ts`, 25 s timeout `ai.ts:101`, zod+sanitize+injection ✅). ❌ `/coach/chat` is `requirePremium` (`coach.ts:51`) — free tier gets static `builtinReply`, not 10/day LLM; 7-day context prompt not found; streaming file exists (`aiStreamingRoutes.ts`) but client streaming UI unverified. |
| 1.7 | Security: env secrets, zod inputs, locked CORS, Sentry, audit fixed | **PARTIAL** | Env ✅, zod ✅ on reviewed routes, CORS locked+sane ✅ (`cors.ts`), helmet CSP ✅ (`app.ts:40-105`). ❌ No Sentry DSN in repo; ❌ 41 Dependabot vulns open. |
| 1.8 | Analytics API: weekly summary, best hours, completion rate, streak, "focusing now" | **PARTIAL** | Stats/analytics/focusDna routes exist; **no live "focusing right now" counter found** (fabricated counter was removed in `039262d`, no replacement). |
| 1.9 | Cron: daily streak at user-local midnight; weekly recap via Resend | **FAIL** | Only cron is retention re-engage `0 9 * * *` (`vercel.json:104-109`); streaks lazy on read/completion; no weekly recap email found. |
| 1.10 | Stripe Free/Pro (Pro = unlimited AI, presets, >30 d history, rooms) | **FAIL** | Zero `stripe` hits repo-wide; premium = earned tokens (`premium.ts`, `premiumPlans.ts`). |

### Phase 2 — Design system

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 2.1 | `/design-system`, Inter, 8 sizes, 2 weights, 1 accent ≤5%, 8 px grid, radii 12/20/980, single shadow, glass spec | **FAIL** | No route; Geist+Manrope fonts (`index.css:1-3`); ~30 colors, 7 radii, 13+ shadows (`index.css:39-265`); looping decorations (`index.css:509-990`) |
| 2.2 | Springs only, enter 600 ms once, hover 1.02/press 0.98, crossfade 300 ms, skeletons, `prefers-reduced-motion` | **PARTIAL** | Skeletons ✅, `MotionConfig reducedMotion="user"` ✅ + CSS kill-switch ✅, 250 ms page fade ✅. Springs not exclusive; looping ambient animations exist. |
| 2.3 | Copy: short declarative, capitalised nouns, no hype/`!` | **PARTIAL** | Mixed; emoji/hype instances remain (e.g. `FeatureCompassModal.tsx:240`). |
| 2.4 | Two sounds only (chime/click) | **PARTIAL** | Chime + coach-voice + ambient engines + 5 mp3s exceed "two sounds"; mute respected. |
| 2.5 | Primitives: Button/Card/Sheet/Toast/Palette/Stat/Skeleton/SegmentedControl | **PARTIAL** | Toast, CommandPalette (`⌘K`), Skeleton, Stat-ish pills exist; no unified Button/Card Sheet SegmentedControl kit. |

### Phase 3 — Focus Mode + reactive 3D

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 3.1 | Fullscreen chrome-less focus, idle fade, shortcuts (Space/Esc/N/M/⌘K/F), Wake Lock, Notification+chime, PiP, PWA offline, debrief card | **PARTIAL** | Space ✅ (`Timer.tsx:307-319`), `⌘K` ✅ (`App.tsx:427-441`), Wake Lock ✅+re-acquire ✅ (`useWakeLock.ts:57-62`), PWA manifest+SW ✅, debrief-like flows partial. ❌ No Esc/N/M/F bindings found; ❌ no Document PiP; ❌ timer offline for guests. |
| 3.2 | Focus Core with `useSceneState()` data→visual bindings, orbit camera, bloom/vignette/grain, dpr ≤1.5, `frameloop="demand"`, lazy 3D, 2D fallback | **FAIL** | `Hero3D.tsx:46-134` is time-driven décor (no session props); `frameloop="always"` (`:171`); no bloom/vignette; WebGL-missing + reduced-motion CSS fallbacks ✅; lazy via `lazy()` ✅; `use3DQuality` + `is3DCapable` scaffolding exists but no data bindings. |
| 3.3 | Presets: Core + Deep Sea/Study Room (Pro stubs) behind segmented control | **FAIL** | Ambient *sound* presets exist (`ambientEngine.ts`), no visual scene presets. |
| 3.4 | Landing sticky 100 vh scroll-driven Core states | **FAIL** | Static hero + scrubbed reveals (`landing.tsx:144` lazy Hero3D); no scroll-driven session states. |

### Phase 4 — SEO/growth/funnel

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 4.1 | Unique pages `/pomodoro-timer /study-timer /ai-study-coach /habit-tracker-for-students /deep-work-timer /focus-music /blog`, live timer above fold | **PARTIAL** | `/pomodoro-timer`, `/study-timer`, `/focus-music`, `/focus-timer`, `/deep-work-guide` + 13 exam guides ✅ with prerender + live app; ❌ no `/blog`, `/ai-study-coach`, `/habit-tracker-for-students`, `/deep-work-timer` slugs. |
| 4.2 | `/pomodoro-timer-for/[exam]` programmatic, NEET/JEE/UPSC/…, JSON-extensible, unique copy | **PARTIAL** | 13 exam guides under `/exam/:slug` (JEE Main/Advanced, NEET, UPSC, CAT, CBSE 10/12, GATE…) with unique files ✅, but **not** the specified URL shape; extensible via `src/content/exam/*.mjs` ✅. |
| 4.3 | JSON-LD SoftwareApp/FAQ/Article/Breadcrumb, sitemap/robots/canonical/hreflang | **PARTIAL** | SoftwareApp (no self-serving rating — correct), FAQ ×10, ItemList, WebSite+SearchAction ✅; sitemap index+shards ✅; robots ✅; canonical apex ✅. ❌ no Article/Breadcrumb, ❌ no hreflang. |
| 4.4 | Dynamic OG via `@vercel/og` (default Core + per-user crystal) | **PARTIAL** | Zero-dep SVG OG generator `/api/og` ✅ (`og.ts:1-13`) used by exam guides; ❌ no `@vercel/og`, no per-user share images. |
| 4.5 | `/go/ig` → armed `/focus?duration=25&src=ig`, `src` analytics (privacy-first) | **FAIL** | Neither route nor `src` tracking found. |
| 4.6 | Live "focusing now" counter or claim removed; changelog + privacy | **PARTIAL** | Fabricated counter removed ✅; no live counter; privacy/terms pages ✅; ❌ no changelog page (repo has `IMPLEMENTATION_SUMMARY.md`, `PRODUCTION_AUDIT_*` but no `CHANGELOG.md` or `/changelog`). |
| 4.7 | Lighthouse ≥95 perf/SEO/a11y on marketing; preload font, `next/image`, no 3D until in-view | **PARTIAL** | Fonts self-hosted ✅, 3D lazy/in-view ✅ (`landing.tsx:144`), three.js kept out of entry preload ✅ (`vite.config.ts:50-87`). No `next/image` (N/A — Vite); Lighthouse unmeasured here. |

## 5.3 Bug-hunt verdicts (fix list for Phase 5.3)

**TIMER** 🔴 guest session lost on refresh → FIX (guest-local deadline snapshot). 🔴 double-fire → already guarded both sides (keep + regression test). 🟠 two tabs → FIX (leader election). 🟠 NaN/negative at zero → guarded (`Math.max(0,…)`) + test. 🟠 chime autoplay → FIX (`resume()` + gesture unlock). 🟠 Notification on load → PASS (gesture-gated `Timer.tsx:288-298`; soft-prompt only after 1st session). 🟠 Wake Lock re-acquire → PASS (`useWakeLock.ts:57-62`).
**STREAK** 🔴 IST-for-all → FIX (per-user IANA zone, IST fallback, no silent resets). 🟠 DST/travel/double-count/missed-day → covered by same fix + history table.
**STATE** 🔴 corrupt localStorage white screen → FIX (versioned safe storage + quarantine; `trackPageView` parse already guarded `site-analytics.ts:143-147`). 🟠 Safari private-mode → FIX (quota-safe writes).
**AI** 🔴 client keys → PASS (zero hits). 🔴 limits/tokens/timeout → PASS (caps + 512/4096 + 25 s). 🟠 injection/streaming → guards PASS; streaming UI unverified (carry to Phase 8).
**UI** 🔴 100 vh → FIX (`SqlEditor.tsx:637` + sweep). 🔴 320/280 px overflow → verify via CSS guard + Playwright when browsers available. 🟠 safe-area ✅ (`viewport-fit=cover`, bottom-nav insets); tap targets/contrast/focus-trap → audit in 5.4 pass. 🟠 `target: esnext` modern-only → differential build deferred to Phase 6 (browserslist + legacy split).
**SEO** 🔴 www↔apex 301 → OPS action (no `redirects` possible alongside legacy `routes` in `vercel.json`; set Vercel primary = apex); canonical already apex. 🔴 client-only content → MITIGATED by prerender (crawler HTML verified in `prerender.mjs`). 🟠 sitemap/robots/manifest/icons/theme-color ✅; CSP ✅ on API; static headers need HSTS/CSP (Phase 8 edge).

## Post-verification fixes applied (same session, proof attached)

All items below are implemented, typechecked, unit-tested and built.

- Guest timer restore: `lib/timerPersistence.ts` + `usePomodoro.persistKey`
  (`usePomodoro.ts`), wired in `Timer.tsx` + `FocusTimerMobileFirst.tsx`
  as `focusarx-guest-timer`. Tests: `timerPersistence.test.ts` (8),
  `usePomodoro.persist.test.tsx` (4: remount-resume, paused-verbatim,
  reset-clears, no-key-no-restore).
- Single-leader tabs: `lib/timerLeader.ts` (`navigator.locks`
  `ifAvailable`, BroadcastChannel fallback); loser pauses + `leaderBlocked`
  toast in both timer UIs.
- Chime autoplay: `soundEngine.getCtx` resumes when suspended +
  `unlockAudio()` on start/toggle; completion chimes resume before playing.
- Notification permission: verified gesture-only (`Timer.tsx:288-298`);
  no on-load request anywhere.
- Zone-aware streaks: `lib/timezone.ts`, `legacyYesterday` continuity in
  `sessionCompletionCore`, device zone adopted in `sessions.ts`
  (create/sync/complete) and sent by `sync-focus-session`,
  `session-persistence-api`, `useSessionPersistence`. Tests:
  `timezone.test.ts` (10, incl. DST-boundary and adoption cases).
- Safe storage: `lib/safeStorage.ts` (quarantine + memory fallback +
  schema stamp + `deviceTimeZone`). Tests: `safeStorage.test.ts` (5).
- Viewport: `SqlEditor` 100vh removed; `.viewport-panel` + `vh`-first
  `dvh` fallbacks in `index.css`; redundant inline `100dvh` dropped.
- Device tiers: `lib/deviceTier.ts` + tests (7), Settings override,
  `device_context` analytics (tier + `src`), Hero3D essential-static +
  hidden-tab loop pause, in-app WebView pill.
- Funnel: `/focus` (`?duration=&task=&src=`), `/go/ig`, `/changelog`;
  prerender 69 → 71 pages, `seo-validate` PASS, contract suites PASS
  (seo 8, route 2, authScope 3, regressionGuard 32).
- Scene: `sceneBus` (1 Hz snapshots + complete event), `MinimalRing`,
  `SceneBackdrop` on `/focus`, preset store + Settings picker (Core and
  Minimal Ring live; four Pro stubs).
- Compliance/ops: `GET /api/settings/data/export` (capped, secret-free),
  `docs/DEPLOYMENT.md` www-primary note, `ARCHITECTURE.md` addendum,
  three runbooks, `CHANGELOG.md`, `REMAINING.md`, bundle-budget gate
  (`budget` script + CI `budgets` job, PASS: entry 42 kb, initial 103 kb),
  `lighthouserc.json`, theme pre-paint script.
- Full battery re-run: `tsc` libs/frontend/api PASS; frontend vitest and
  API pure-unit suites PASS (see final message for counts); production
  frontend build PASS (37 s, 71 pages).
