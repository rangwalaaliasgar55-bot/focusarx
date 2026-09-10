# Remaining work (truthful tracker — done items stay listed as done)

## Done 2026-09-10 — P0.3 cross-tab single timer (this branch, in review)

- New `lib/crossTabSync.ts`: leader 1 Hz heartbeat (`state`) + `complete` /
  `resign` protocol on the shared `focusarx-timer` channel (single source of
  truth — `timerLeader` now imports the channel name from it). Validated,
  clamped, never-throw; stale after 3 missed beats (crashed leaders send no
  resign); wall-clock countdown derivation.
- `usePomodoro`: stable tabId; grant-holder-only broadcast (no flapping in
  the ~600 ms race); follower `mirror` state (display-only, cleared on
  resign/complete/stale/takeover); **only-leader-completes guard**
  (`leadDeniedRef` — a tab denied while a completion microtask was queued
  stands down instead of recording; tabs still racing record normally).
- Shared `LeaderMirrorChip` ("Running in another tab · Focus 24:31",
  `role=status` + `aria-live`) wired into desktop `Timer` and
  `FocusTimerMobileFirst` whenever the local clock isn't running.
- Tests: 7 protocol unit tests + 2 two-tab hook tests (shared mock
  `navigator.locks`: loser stands down, only leader records, handoff after
  release) + new Playwright `cross-tab-leader.spec.ts` (2 pages, one
  context). Frontend 250 → 259. E2E runs in CI (no browser in sandbox).
- Gates: typecheck 0, API 364, frontend 259, 89 pages + seo PASS,
  schema:check PASS, lint-changed 0 errors (9 pre-existing warnings).
- Follow-up (P3, not this workstream): cross-*device* session handoff via
  leader lock + push confirm; full-completion 2-tab e2e (needs a ≤60 s
  session — deep links min out at 1 min, so single-completion is enforced at
  unit level + server `clientNonce` backstop).

## Done 2026-09-10 — P0.2 user-local calendar completion (this branch, in review)

- Daily rewards (`/daily-reward/status|claim`) keyed to the user's own IANA
  zone (`users.timezone` via `userZone`, fallback legacy IST): `rewardDayKeys`
  + `isConsecutiveRewardDay` in `routes/dailyReward.ts`, DST-safe string math
  (`shiftDayKey`, never `-86_400_000`). 4 pure unit tests incl. a
  spring-forward case the old ms math gets wrong.
- Streak-endangerment nudge (`lib/streakEndangerment.ts`, lazy on
  `/api/streak`) fires on user-local evening (after 16:00 in-zone) with a
  DST-safe local-day throttle window; copy drops the hardcoded "midnight IST".
  Pure `endangermentDue` helper + 6 zone/DST unit tests.
- Gates: typecheck 0, API 364 passed (354 + 10 new), frontend 250, 89 pages +
  seo-validate PASS, schema:check PASS (no schema change), lint-changed clean.
- Still open from P0.2: `streak_history` backfill for pre-table completions
  (item 12 below); batch `/retention/reengage/run` still uses IST day keys
  (per-user zones need a per-candidate lookup — noted, not started).

## Done this pass (shipped, tested, in main)

- Session presets + Flowtime + remembered choice; distraction parking (D +
  park button); visible desktop task pill; weekly goal card.
- Streak Shield auto-apply + `streak_history` audit + `shieldUsed` plumbing.
- Deep Sea + Study Room full scenes (Full-tier, lazy, Pro-gated).
- Blog + Article schema; `/pomodoro-timer-for/:exam` funnels; per-user OG;
  live focusing-now counter.
- Stripe env-gated scaffolding + /premium card UI; weekly recap API + card +
  email; referral `?ref=` auto-apply.
- Plausible + Sentry (both env-gated); ESLint strict + changed-files CI
  gate; knip files+deps CI gate; Playwright matrix projects + 10 green
  timer-survival e2e; PiP mini-timer; print stylesheet; locale formatting
  foundations; `.browserslistrc`; qs/fflate override pins; single drizzle
  snapshot; dead-code/dependency removals.

## Still needs an explicit owner decision (not started on purpose)

- [decision] **Next.js migration.** Recommended: stay on Vite + Express
  (prerender covers SEO; rewrite risks the P0 retention paths).
- [decision] **Supabase + RLS.** App-side ownership + contract tests hold.
- [decision] **Stripe pricing/launch.** Infra ships dormant until keys +
  prices + tax/refund ops are decided. Free AI-chat quota rides with it.
- [decision] **Full UI translation (hi/es/pt/id/ar + RTL).** No
  machine-translated user strings ship without native review; locale
  formatting foundations are in.

## Engineered backlog (no decision needed, ordered)

1. Full Dexie offline-first sync (`/sync/push|pull`, conflict policy).
2. Constellation + Zen Garden scenes (stubs with Pro gating ship now).
3. Design-token lint (one accent, radii, shadow, weights) + copy pass.
4. Hreflang stub; exam URL canonicalization review after funnel indexing.
5. Phase 9 remainder: task drag-reorder + estimates, exam-mode planner,
   class/school codes, extension (MV3), calendar/imports, desktop/mobile
   wrappers, voice check-in, flashcard breaks, teams.
6. Device lab: BrowserStack real-device videos for the Playwright matrix;
   200% zoom + RTL manual passes.
7. Legacy differential bundle (measure `device_context` tiers first).
8. Knip export-level tuning (currently files+deps gated; 209 export flags
   are mostly router-registration false positives).
9. ESLint legacy backlog (changed-files gated; full-repo still red). Three
   sites are suppressed inline instead: the admin SQL console's mount poll and
   the two MonsterBattleArena progress/abandon effects (`set-state-in-effect`).
   The rule's own remedy is to run them through the query client
   (`artifacts/focusarx/src/lib/queryClient.ts`), which the admin console does
   not use yet — migrating those loaders is the real fix, and the console's
   `adminFetch` adapter already gives them refresh + error reporting to lean on.
   Related: ~150 user-facing pages still call `fetch` directly rather than
   `apiFetch`, so they get no silent refresh on a 401; the admin console is now
   fully converted and can be used as the pattern.
10. ~~Streak endangerment nudges on user-local timing~~ (done 2026-09-10,
    incl. user-local daily rewards — see top of file); still open:
    push-subscription sweeper; missed-day nudge scheduling.
11. Dependabot 41: prod-surface pins applied (qs/fflate); remainder is
    dev/transitive — triage in CI where network is reliable.
12. `streak_history` backfill for pre-table completions (table writes from
    this release forward).
13. SEO copy has two authored sources that must be kept equal by hand:
    `artifacts/focusarx/scripts/prerender-data.mjs` (crawler-facing, built by
    Node) and the preset table in `components/PageSEO.tsx` (client navigation).
    Fifth pass aligned 7 stale titles and gated both against the text budgets in
    `src/lib/seo-text.mjs`, but *content* equality is unenforced — a page can
    still ship a different `<title>` to a crawler than to a visitor who clicks a
    link. The fix is to move the table into a `.mjs` both sides import (it lives in
    a `.tsx` today for one `ReactNode` in a footnote), then delete the manifest's
    copies and generate `ROUTES` from it. Descriptions have the same duplication
    and are still aligned only where they were stale. Also unowned: unknown URLs
    return 200 + the SPA shell (`vercel.json` `/(.*) → /index.html` after
    `handle: filesystem`); `pages/not-found.tsx` is `noindex` now, which stops the
    index damage, but a real 404 status needs an edge function in front of every
    page view — deliberately not bought.

## Ops checklist (manual, each deploy)

- Vercel primary domain = apex (see docs/DEPLOYMENT.md).
- Stripe webhook registered (`/api/stripe/webhook`,
  `checkout.session.completed`) when enabling cards.
- Sentry DSN + Plausible domain set when enabling observability.
- Resend key + EMAIL_FROM for recap/retention emails.
