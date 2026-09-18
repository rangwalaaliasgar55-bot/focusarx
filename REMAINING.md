# Remaining work (truthful tracker — done items stay listed as done)

## §18 KNOWN-BUG AUDIT — verified against source, 2026-09-18

Every one of the 28 was checked by reading the code, not by trusting the list.
**28 fixed · 0 partial · 0 outstanding.** (Three of them — #2, #4 and #26 —
were already fixed before this session started, contradicting the prompt's own
research. The header previously read "21 fixed · 1 partial", which did not add
up to the 28 rows below it; the rows are individually sourced and are the
authority.)

| # | Bug | Verdict | Evidence |
|---|-----|---------|----------|
| 1 | OTEL external → cold-start 500s | **fixed** | `build.mjs` external list carries a 12-line comment explaining why `@opentelemetry/*` must not be added |
| 2 | Client-supplied XP on pet bond | **fixed** | `lib/petBond.ts` — no public route; `awardBondXpToActivePet` called only from `sessions.ts:978` on verified completion |
| 3 | Race: coins go negative | **fixed** | `coinLedger.burnCoins` is CAS (`gte(coins, amount)`, null when no row) |
| 4 | Race: double-claim missions | **fixed** | `missions.ts:145` CAS on `rewardClaimed = false` + atomic XP upsert |
| 5 | Consequence contracts never settled | **fixed** | `consequences.ts:48 settleExpiredContracts` |
| 6 | UTC date math everywhere | **fixed** | `lib/userZone.ts`, `lib/timezone.ts`; residual `getUTC*` in `battlePass.ts` is correct ISO-week math |
| 7 | AudioVisualizer bars invisible | **fixed** | `AudioVisualizer.tsx:32` `getComputedStyle` + re-read every 120 frames |
| 8 | SoundEngine boost during breaks | **fixed** | no boost code in `ambientEngine.ts` |
| 9 | Duplicate SoundEngine component | **fixed** | `components/SoundEngine.tsx` absent |
| 10 | SessionSummaryCard interval leak | **fixed** | `timers.forEach(clearTimeout, clearInterval)` cleanup |
| 11 | GET /feed missing nextCursor | **fixed** | `posts.ts:213` returns `{ posts, nextCursor }` |
| 12 | Admin list pagination mismatch | **fixed** | SQL-side guest/bot filtering |
| 13 | Mobile timer assumes 25min | **fixed** | `FocusTimerMobileFirst.tsx:323` uses `plannedDurationSec` |
| 14 | 26 set-state-in-effect | **fixed** | lint reports **0** |
| 15 | useReducedMotion flash | **fixed** | `useMediaQuery.ts` uses `useSyncExternalStore` |
| 16 | useIsMobile layout flash | **fixed** | same |
| 17 | Native confirm()/alert() | **fixed** | commit `55fcf5a` — 20 sites; `rg` clean |
| 18 | Empty state on API error | **fixed** | `QueryError` in goals/groups/habits/notifications/shop |
| 19 | Flashcards errors swallowed | **fixed** | `flashcards.tsx` toasts on load/create failure |
| 20 | SEO prerendered tables missing rows | **fixed** | commit `3305b31` — 10 tables, 92 rows, parity-gated |
| 21 | 54 URLs not indexed | **fixed** | `sitemap-profiles-1.xml` (11,978 URLs) retired; `/u/` noindexed |
| 22 | Fabricated aggregateRating | **fixed** | deliberately excluded, with a comment in `index.html` + `seo-landing.tsx` |
| 23 | 409 lint errors | **fixed** | `pnpm lint` = **0 errors** |
| 24 | Quest progress never written | **fixed** | `updateQuestProgress` called from `sessions.ts` |
| 25 | Weekly quests never assigned | **fixed** | `quests.ts:27 pickRotation` — deterministic, `Math.random`-free |
| 26 | isPremium hardcoded false on auto-complete | **fixed** | `sessions.ts:890 isUserPremium(userId)` with a comment about the old `false` |
| 27 | City weather = Math.random() | **fixed** | deterministic from behaviour |
| 28 | 8–10px text | **fixed** | **40 sites** raised to `text-[11px]` across 19 files — 7px in `messages`/`social`, 8px in `AdminEconomyPanel`, 9px in `FocusTimerMobileFirst`, 10px and `0.5625`/`0.625`/`0.6rem` elsewhere, plus 2 in `TimerDisplay`. **Guarded by `src/legibility.test.ts`**, a source scan that fails on any font-size utility below 11px and on any CSS `--text-*` token below the floor. The scan caught a site the pattern-based grep had missed within a minute of being written |

> **On the "23 sites" figure:** the original audit counted with a hand-written
> grep listing the sizes it expected to find, so it missed `text-[0.5rem]` (8px)
> entirely and undercounted the rest. `git grep` over the full size list finds
> **40** at commit `a564a84`. This is the argument for the gate over the grep:
> `src/legibility.test.ts` matches the *shape* of a font-size utility and
> compares numerically, so it cannot be defeated by an unforeseen unit.

### Genuinely absent — the real remaining work

Ordered by value. The first two are the only large unbuilt subsystems.

1. **§7.3 Dexie/IndexedDB offline-first sync.** No Dexie, no `/sync/push|pull`,
   no conflict resolver. `useOfflineQueue` is a localStorage retry queue with no
   entity store and no field-merge. Backlog item 1 in this file.
2. **§1.6 Webhook & integration layer.** Nothing exists: no Google Calendar, no
   Slack/Discord, no Apple Health/Google Fit, no HMAC-signed webhooks, no
   AES-256-GCM token storage. Needs OAuth app registrations before it can ship.
3. **§1.9 CHECK constraints — mostly done.** `user_wallets` is now constrained
   (migration 0016). Not yet constrained: `user_pet_inventory` (the prompt's
   `happiness BETWEEN 0 AND 100` does not map — the column is `mood text`, so
   the invariant is a different one and needs a decision), and the various
   `*_coins`/`amount` columns on transactions and inventory.
4. **§1.10 auth hardening.** `auth.ts` uses **bcryptjs** (cost 12), not Argon2id.
   No TOTP/2FA, no backup codes, no Apple sign-in, no PKCE on the Google flow.
   Changing the hash touches every stored credential and needs a
   rehash-on-next-login path — a decision, not a cleanup.
5. **§1.7 GDPR 30-day grace.** `DELETE /auth/account` exists with password
   confirmation and PII scrubbing, but hard-deletes immediately. No
   `deleted_at` column, no 30-day window, no undo. `GET /settings/data/export`
   exists.
6. **§1.8 cursor pagination.** Only `posts.ts` returns `nextCursor`; the
   `{ data, nextCursor }` shape is not applied across list endpoints.
7. **§1.2 Redis SETNX locks.** `@upstash/redis` is a dependency but no
   `SETNX ... EX` locking is used. Read-check-then-write is protected by
   Postgres transactions + row locks instead (`dailyReward.ts:59`,
   `retention.ts:51`) — equivalent for a single primary, and worth leaving
   alone unless a second writer is introduced.
8. **§14 acceptance criteria not yet verified:** Lighthouse thresholds, cold
   start < 200ms, real-device a11y passes, Playwright E2E runs (no browser in
   this sandbox), pen-test of rate limiting (no DB here).

### SEO follow-ups surfaced by the new depth gate

- Six pages hold a full document in React but declare `sections: []`, so the
  crawler gets a heading and one sentence: `/terms` 15 words, `/privacy` 25,
  `/cookie-policy` 20, `/acceptable-use` 17, `/ai-policy` 23, `/contact` 23.
- Eleven pages are genuinely thin and need editorial work: `/support` 65,
  `/changelog` 70, `/deep-study-guide` 73, `/science-of-deep-work` 79,
  `/two-hour-study-method` 83, `/pricing` 86, `/feynman-technique` 104,
  `/guides` 131, `/study-techniques` 135, `/blog` 145, `/focus-guide` 147.


## Done 2026-09-18 — comparison tables reach the crawler; content-depth gate

- §18 #20 fixed: the ten `/comparison/*` pages had **no `<table>` in their
  HTML** while `src/pages/comparison.tsx` drew one from `COMPARISONS`. Now
  `prerender-data.mjs` emits `table` + `sections[].bullets` from that same
  `COMPARISONS` entry (new `cellText()` maps booleans to Yes/No **text**, not a
  tick glyph) and `prerender.mjs` emits a real `<table>` with `scope="col"` /
  `scope="row"` headers plus a dated note. 10 tables, 92 rows, 0 parity problems.
- **Two prerender bugs found and fixed, same class — it was only correct on a
  fresh `vite build`:** (a) the body substitution matched an *empty*
  `<div id="root"></div>`, and since `TEMPLATE` is `dist/public/index.html` with
  `/` as a route, a second consecutive `node scripts/prerender.mjs` silently
  left **the homepage body on every route** (right title, right canonical, wrong
  page); (b) per-route JSON-LD was appended rather than replaced, so a second run
  left two `BreadcrumbList`s and the first one won. Both idempotent now; three
  consecutive runs are byte-stable and validate clean.
- New `seo-validate.mjs` gates, negative-tested: **content depth** (150 words of
  own copy, shell furniture stripped; app surfaces exempt at 5; 17 pages in a
  ratchet baseline that may not get thinner) and **table parity** (every declared
  row label, column header, cell value and Yes/No **text** must be emitted,
  counted so one text cell among nine icons still fails).
- 67 new tests in `src/content/seo-pages.test.ts`. Frontend 443 → 510.
- Still open, now visible in the source rather than silent: six ratcheted pages
  (`/terms` 15, `/privacy` 25, `/cookie-policy` 20, `/acceptable-use` 17,
  `/ai-policy` 23, `/contact` 23 words) hold a full document in React but declare
  `sections: []` in the manifest — §2.10's "prerendered != hydrated" failure. The
  fix is to move each policy body into the manifest. Also `/changelog` 70,
  `/deep-study-guide` 73, `/science-of-deep-work` 79, `/two-hour-study-method` 83,
  `/pricing` 86, `/feynman-technique` 104, `/guides` 131, `/study-techniques` 135,
  `/blog` 145, `/focus-guide` 147, `/support` 65 are genuinely thin and need
  editorial work.
- Verified **absent** in this repo, in priority order: (a) no webhook/integration
  layer at all (§1.6); (b) no Dexie/IndexedDB offline-first sync — see backlog
  item 1 below; (c) `/vs-*`-style standalone alternative pages do not exist
  (the `/comparison/*` set is the equivalent).

## Done 2026-09-18 — no native dialogs left; modal focus contract fixed

- `alert()` / `confirm()` / `prompt()` are gone from the whole frontend
  (`rg` clean, excluding the `usePrompt`/`useConfirm` helpers themselves). New
  `components/ui/PromptDialog.tsx` (`usePrompt()`, promise-based, validates
  in-dialog); `ConfirmDialog` rebuilt on Radix Dialog.
- **Real bug found and fixed while rebuilding:** Radix's modal close does
  `preventDefault()` + `triggerRef.current?.focus()`. These dialogs have no
  `<Dialog.Trigger>` — they open from arbitrary code — so `triggerRef` is null,
  the generic FocusScope restore is already cancelled, and focus ended on
  `<body>` after every confirmation. New `lib/dialogFocus.ts` captures and
  restores the origin element (skipping `<body>` and unmounted nodes). Both
  dialogs also set `aria-modal="true"` explicitly; `noValidate` on the prompt
  form so native constraint validation cannot pre-empt our message.
- Gates: typecheck 0, lint 0 errors, frontend 421 → 443, API 424, build PASS
  (119 pages, SEO validate PASS, bundle budget PASS: entry 49.5 kb gzip,
  initial 110.6 kb). No critical-path regression — `vendor-radix` was already in
  `index.html`.
- Still open from the same document: the rest of the master-prompt acceptance
  list is not audited end-to-end. Verified **absent** in this repo, in priority
  order: (a) no webhook/integration layer at all (§1.6 — Google Calendar,
  Slack/Discord, Apple Health); (b) no Dexie/IndexedDB offline-first sync —
  `useOfflineQueue` is a localStorage retry queue, and it is backlog item 1
  below; (c) no SEO word-count/content-depth gate or table-parity gate in
  `seo-validate.mjs` (it has orphan, JSON-LD, canonical, cannibalisation,
  E-E-A-T and title-budget gates, but nothing that counts a page's own prose);
  (d) no `/vs-*` or `/comparison/*` pages exist at all, so the §2.10
  "prerendered comparison table" requirement has no subject yet.



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
