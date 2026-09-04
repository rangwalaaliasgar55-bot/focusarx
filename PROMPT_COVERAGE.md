# FocusArx — Whole-Prompt Coverage Report (v1 Phases 0–4 · v2 Phases 5–10 · v3 Phases 11–14)

Date: 2026-09-04 · Branch: main · Method: code read + test/build/e2e outputs.
Scale: DONE = shipped, tested, in main · PARTIAL = works but spec-incomplete ·
TODO = not started · DECISION = needs an explicit owner call before building.
Evidence paths are relative to the repo root.

## Headline counts

| Phase | DONE | PARTIAL | TODO / DECISION |
|---|---|---|---|
| 0 Audit | 6/6 | — | — |
| 1 Foundation | 2 | 6 | 2 (Supabase, Next.js→DECISION) |
| 2 Design system | 0 | 4 | 1 |
| 3 Focus + 3D | 3 | 6 | 2 (hero states, Core polish) |
| 4 SEO/growth | 5 | 5 | 2 |
| 5 Verify/hunt | 4 | 1 | 1 (device lab) |
| 6 Tiers/views | 3 | 2 | 1 |
| 7 Themes/scenes | 2 | 3 | 1 (Storybook) |
| 8 Backend | 3 | 6 | 1 (Dexie sync) |
| 9 Features | 7 | 6 | 9 |
| 10 Gates | 3 | 2 | 1 |
| 11 Share/identity | 1 | 2 | 3 |
| 12 SEO scale | 1 | 3 | 4 |
| 13 Community | 0 | 1 | 3 |
| 14 Measure/launch | 1 | 1 | 3 |

## Phase 0 — Audit: 6/6 DONE

`AUDIT.md`: stack/structure/hosting (§1), eight how-it-works with file:line
(§2), Top-15 ranked issues (§3), security findings (§4), localStorage
migration plan (§5), H1–H6 verdicts (H1 CONFIRMED, H2 CONFIRMED, H3
REFUTED-on-exposure, H4 PARTIAL, H5 CONFIRMED, H6 CONFIRMED-for-Stripe).

## Phase 1 — Foundation

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 1 | Next.js App Router migration | DECISION | Stayed on Vite+Express; case in `AUDIT.md` §7. Awaiting owner call. |
| 2 | `/` marketing, `/focus` app `?duration=&task=`, `/dashboard` | PARTIAL | `/focus` public + deep-linkable (`src/App.tsx`, `src/lib/focusDeepLink.ts` + tests, e2e green); `/dashboard` exists gated; `/` still dual-purpose SPA, prerender instead of SSR. |
| 3 | Timestamp timer + Worker + IndexedDB + survive everything + tests | PARTIAL | Deadline + Worker (`src/hooks/usePomodoro.ts`, `src/lib/timerWorker.ts`); guest localStorage snapshot (not IndexedDB); 8 snapshot tests + 4 hook tests + 10 Playwright e2e green. |
| 4 | Supabase + magic/Google/Apple + RLS + tables | TODO | Neon+Drizzle+JWT+guest instead; Google env-only; ownership app-side. |
| 5 | Anonymous-first + one-time import on sign-in | PARTIAL | Guest timer fully works; no import endpoint. |
| 6 | Coach server-only, streaming, Free 10/day, 7-day context, calm tone | PARTIAL | Server-only + budgets + guards (`artifacts/api-server/src/lib/aiProvider.ts`); `/coach/chat` premium-gated (no free tier); streaming UI unverified; 7-day prompt not found. |
| 7 | env/zod/CORS/Sentry/audit | DONE | Sentry env-gated both ends; qs/fflate override pins; gitleaks CI. |
| 8 | Analytics API (weekly, best hours, completion, streak, live count) | DONE | `routes/recap.ts` (sessions/minutes/bestHour/streak), `GET /stats/focusing-now`, existing stats routes. |
| 9 | User-local-midnight cron + weekly recap email | PARTIAL | Recap endpoint + 1/day Resend email; no cron schedule; streaks lazy. |
| 10 | Stripe Free/Pro | PARTIAL | `routes/stripe.ts` + webhook grants + `/premium` UI, dormant without keys. Needs pricing/tax call. |

## Phase 2 — Design system

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| Tokens (Inter, 8 sizes, 2 weights, 1 accent ≤5%, 8px grid, radii 12/20/980, 1 shadow, glass spec) | PARTIAL | No `/design-system` route; Geist/Manrope kept; ~30 colors/7 radii/13 shadows remain. |
| Motion (springs, enter 600, hover/press, crossfade, skeletons, reduced-motion) | PARTIAL | Skeletons + `MotionConfig` + CSS kill-switch; springs not exclusive; looping decor remains. |
| Copy (short, nouns, no hype/`!`) | PARTIAL | Mixed; emoji/hype instances remain. |
| Two sounds only | TODO | Chime + coach-voice + ambient engines + 5 mp3s. |
| Primitives (Button/Card/Sheet/Toast/Palette/Stat/Skeleton/Segmented) | PARTIAL | Toast, ⌘K palette, Skeleton exist; no unified kit. |

## Phase 3 — Focus Mode + reactive 3D

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| Chrome-less focus, 80px tabular, 17px task, 3s idle fade | PARTIAL | Zen mode + tabular + task pill exist; 3s idle fade not implemented. |
| Shortcuts Space/Esc/N/M/⌘K/F | PARTIAL | Space + ⌘K only. |
| Wake Lock, notification + chime, PiP, PWA offline, debrief | DONE | `useWakeLock.ts` + re-acquire; gesture-gated notifs; `lib/miniTimer.ts` Document PiP; SW shell + guest snapshot; `SessionSummaryCard`. |
| `useSceneState()` mappings (elapsed/paused/hidden/complete/streak/weekly/timeOfDay) | PARTIAL | Bus + `sceneElapsedPct`/`sceneIsStale` + MinimalRing + Deep Sea + Study Room honor all seven; no polished R3F Core planet, no bloom/vignette/grain, no 800-particle burst. |
| Camera orbit/parallax, dpr ≤1.5, demand loop, lazy 3D, 2D fallback | PARTIAL | dpr caps + hidden-pause + lazy scenes + tier fallbacks; decorative hero only. |
| Presets (Core, Deep Sea, Study Room, Constellation, Zen, Minimal Ring) | PARTIAL | Deep Sea + Study Room full; Minimal Ring full; Core = existing hero (not session-bound); Constellation/Zen stubs. |
| Scroll-driven landing hero states | TODO | Static hero + scrubbed reveals only. |

## Phase 4 — SEO & funnel

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| Tool-above-fold routes (/pomodoro-timer, /study-timer, /ai-study-coach, /habit-tracker, /deep-work-timer, /focus-music, /blog) | PARTIAL | pomodoro/study/focus-music/blog/focus-timer/deep-work-guide exist; ai-study-coach, habit-tracker-for-students, deep-work-timer missing; blog has CTAs not embedded timers. |
| `/pomodoro-timer-for/[exam]` + JSON-extensible unique copy | DONE | 14 exams (`src/content/exam-funnel.mjs`), unique angles, live timer above fold. Missing prompt-listed: SAT/ACT/GCSE/A-Level/MCAT/LSAT/bar/IELTS/TOEFL/CFA/ENEM/UTBK. |
| JSON-LD (SoftwareApp/FAQ/Article/Breadcrumb) + sitemap/robots/canonical/hreflang | PARTIAL | All four schemas (BreadcrumbList auto via `PageSEO.tsx`); sitemap/robots/canonical live; hreflang TODO. |
| Dynamic OG via @vercel/og (Core default + per-user crystal) | PARTIAL | Zero-dep SVG `/api/og` + per-user `/api/og/user` from real stats; no @vercel/og, no crystal render. |
| `/go/ig` armed + Begin + src analytics | DONE | `/go/ig` → armed `/focus`; `device_context` event; Plausible env-gated. |
| Live counter, changelog, privacy | DONE | `FocusingNow` (real aggregate), `/changelog`, policy pages. Fabricated claims removed. |
| Lighthouse ≥95 marketing routes | TODO | Unmeasured (config added). Fonts self-hosted; 3D in-view only. |

## Phase 5 — Verify + bug hunt: 5.1 DONE (`VERIFICATION.md` + post-fix addendum)

5.2 outputs: tsc ✓ · ESLint strict (new config, changed-files gate) ✓ ·
`pnpm audit` (qs/fflate pins) ✓ · gitleaks CI ✓ · knip files+deps gate ✓ ·
Vite build + bundle budgets ✓ · axe CI job exists ✓ · Playwright
(desktop+w360, 10 timer specs green locally) ✓ · Lighthouse ✗ ·
BrowserStack/real devices ✗ · bundle analyzer (budgets instead) ✓.
5.3: every 🔴 fixed (deadline engine, guest refresh, double-fire guards,
leader election + remount retry, NaN guards, chime unlock, IST→IANA zones
+ continuity + Shield, storage quarantine + schema stamp, 100vh sweep) or
verified absent (client keys, on-load permission). Remaining 🟠/🟡 tracked
in `VERIFICATION.md` (focus trap, contrast, legacy bundle, www 301 ops).
5.4 device-matrix videos: TODO (no lab). 5.5 regression tests: DONE.

## Phase 6 — Tiers & views

6.1 tiers DONE (`lib/deviceTier.ts` + 7 tests, Settings override,
analytics, identical meanings everywhere). 6.2 browserslist file DONE;
differential builds TODO; `--vh` vh-first fallbacks DONE; RTL TODO. 6.3
WebView mode DONE (pill; nothing to suppress). 6.4: portrait/laptop/
desktop/PWA/PiP/print DONE; landscape-phone/foldable/tablet/ultrawide/TV
explicit layouts TODO; Focus fullscreen PARTIAL (Zen); contrast/
forced-colors/200%/offline-page TODO-or-unverified. 6.5: entry 42.5kB ✓
(≤90KB); /focus Tier-C weight unmeasured; 3D lazy Tier-A ✓; LCP/CLS/INP/TTI
unmeasured; fonts self-hosted+swap ✓ (size-adjust/preload unverified).

## Phase 7 — Themes & scenes

7.1 layers DONE. 7.2 spec theme set TODO (existing 5 themes kept;
pre-paint script + persistence DONE). 7.3 five-tint rule TODO (unverified).
7.4 presets PARTIAL (see Phase 3). 7.5 micro-details PARTIAL (tabular,
haptics, hairlines, empty states yes; digit-flip, iOS sheet, 2-sounds,
no-`!` no). 7.6 Storybook + visual regression TODO.

## Phase 8 — Backend

8.1 Dexie sync TODO (localStorage queue + idempotency cover P0). 8.2 DONE
(Worker, visibility recompute, nonce idempotency, locks + announce).
8.3 PARTIAL (IANA zones + Shield + history DONE app-side; nightly job TODO;
Shield not capped at 1/week; no backfill). 8.4 PARTIAL (VAPID infra exists;
scheduled complete/break/8PM pushes TODO). 8.5 PARTIAL (daily budgets +
sanitization DONE; weekly cache, model split, monthly cap TODO). 8.6
PARTIAL (rooms exist; presence orbs/break-chat unverified). 8.7 DONE
(Sentry + Plausible env-gated, tier/src/first-session events; /admin
exists; Web-Vitals-per-tier TODO). 8.8 PARTIAL (export DONE, delete page
exists, policies DONE; AdSense present despite "no ads"; DPDP formal TODO).
8.9 PARTIAL (Upstash optional, API CSP, X-Frame/Referrer DONE; www 301 ops;
HSTS partial).

## Phase 9 — Features

MUST: 9.1 DONE · 9.2 PARTIAL (estimates exist; subtasks/Today-Later/drag
TODO; task bound to session via taskName) · 9.3 DONE (exists) · 9.4 DONE ·
9.5 DONE (goals, best-hours, Shield UI) · 9.6 PARTIAL (noise engines +
presets exist; ducking/Tier-C-off unverified) · 9.7 PARTIAL (welcome +
guest timer; post-completion account ask + import TODO).
SHOULD: 9.8 extension TODO · 9.9 DONE (profile + real-data OG;
3D crystal on profile TODO) · 9.10 TODO (guides+links only) · 9.11 DONE
(email+image+print CSS; PDF TODO) · 9.12 PARTIAL (coins/XP both sides;
Pro-month = pricing decision; class codes TODO).
COULD 9.13–9.19: TODO except i18n formatting foundations.

## Phase 10 — Gates

CI (typecheck, changed-lint, unit, e2e, axe job, LHCI config, budgets,
secrets, audit, knip, migrations) DONE; device-matrix-in-CI PARTIAL (a11y
job; responsive script not scheduled); feature flags + rollout TODO;
release checklist TODO; CHANGELOG + /changelog DONE; /status TODO;
ARCHITECTURE + runbooks DONE (CONTRIBUTING pre-exists).

## Phases 11–14 — Growth (v3)

11.1 share cards (9:16/1:1/16:9, debrief Share, Web Share, share_* events)
TODO — only server OG images exist. 11.2 profile crystal/CTA/privacy
toggles PARTIAL. 11.3 /go/yt /go/dc /go/rd + src-on-signup TODO (/go/ig
only; src in analytics only). 11.4 /r/[code] + Pro-month + k-factor TODO.
11.5 buddy TODO. 11.6 stakes PARTIAL (hidden desaturation DONE; crack +
matte facet TODO; calm copy yes).
12.1 tool-routes Tier-aware TODO (only exam funnels embed timers). 12.2
tools.json + 21 exams + 15 tool routes TODO (14 funnels done). 12.3 MDX +
6 posts PARTIAL (3 posts, .mjs). 12.4 Focus Report TODO. 12.5 PARTIAL
(sitemap index, canonicals, internal links; hreflang/GSC-file/IndexNow
TODO). 12.6 embed widget TODO.
13.1 Discord bot TODO. 13.2 rooms v2 (exam halls, TV view) TODO. 13.3
extension TODO. 13.4 admin community tab TODO.
14.1 PostHog dashboards TODO (events beyond pageview/device_context TODO).
14.2 counters PARTIAL (focusing-now DONE; weekly-hours TODO). 14.3 launch
kit TODO. 14.4 growth digest TODO.

## Delivery-rules ledger

- User data: never migrated destructively (additive schema only:
  `streak_history`; all else additive/compatible).
- Secrets: none committed (sweeps clean; gitleaks CI).
- Tokens/radii/shadows: none added (brand-var reuse; circles only).
- Tests per bugfix: yes (§5.5 + second-pass suites).
- Storybook stories: TODO (no Storybook).
- Before/after screenshots-recordings: TODO (no capture environment;
  Playwright traces exist locally only).
