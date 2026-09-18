# Remaining work (truthful tracker — done items stay listed as done)

## Done 2026-09-18 (second commit) — international editions

The site claimed four audiences and served all four the same American-English
page. `index.html` carried `hreflang` for `x-default`, `en`, `en-IN` and
`en-GB` — every one resolving to the *same URL* — and its own comment said so:
*"if locale-specific URLs are ever added (a real /in/ edition, not a query
parameter), these must be repointed at them"*. That repointing is this commit.

- **Ten localized pages in five markets**, each authored rather than
  machine-translated: `/in` and `/in/pricing` (en-IN), `/us` and `/us/pricing`
  (en-US), `/hi` and `/hi/pricing` (hi), `/es` and `/es/pricing` (es),
  `/pt-br` and `/pt-br/pricing` (pt-BR). Word counts 376–641 against the
  150-word floor the content-depth gate enforces on every other page.
- **Real hreflang clusters.** `src/content/locales.mjs` is the single source of
  truth; `clusterFor()` derives each page's cluster from which editions
  actually wrote that page. `/pricing` now advertises five real edition URLs
  instead of five copies of itself. Clusters are reciprocal by construction.
- **Edition switcher on all 128 indexable documents** — in the prerendered shell
  a crawler reads, and as a React component on the client page. Every page is
  one click from every market.
- **Per-document language.** `<html lang>` and `og:locale` follow the edition;
  `inLanguage` is declared on `WebSite` and `SoftwareApplication`. The inherited
  site-wide blocks are reconciled per page rather than left claiming `en-US`
  from a Spanish document.
- **`sitemap-locales.xml`** — a tenth child sitemap with the ten URLs, added to
  both the API and the checked-in static fallback the contract test compares
  against. `llms.txt` gained an "Editions by country and language" section.
- **Analytics:** `edition_page_view`, `edition_switcher_click`, and `cta_click`
  (the one event the growth audit asked for that the union did not have).
- **Gate #14 rewritten** from "cluster must equal a fixed four-tag list" to
  reachability + reciprocity + x-default consistency. Verified non-vacuous:
  pointing one alternate at a page that does not exist fails the build twice
  over, once for the dead URL and once for the broken back-link.
- **Four currency errors found and fixed** while writing: `/premium`'s
  description, the homepage FAQ, the `/support` lead and a `/focus-guide` FAQ
  answer all still said Premium is bought with **Focus Coins**. It is bought
  with Focus Tokens (`premiumPlans.ts`); Coins buy cosmetics (`coinLedger.ts`).
  Last commit fixed `/pricing` only — this finishes the job.
- **Two latent defects fixed** that the new pages exposed: `PageSEO.tsx` rewrote
  every hreflang href to the current URL on client-side navigation (correct for
  one edition, wrong for five), and the homepage shipped two `FAQPage` entities
  because the prerenderer skipped stripping the inherited one.
- Gates: build + prerender + seo-validate PASS (**129 pages**, 10 child
  sitemaps), bundle-budget PASS, API **424 passed**, frontend **423 passed**,
  typecheck clean both artifacts, eslint clean.
- **Still open:** the switcher is in the crawler-facing shell and on the ten
  edition pages, but not yet in the React app's global footer, so a visitor on
  `/dashboard` does not see it; `de`/`fr`/`id`/`bn`/`ta` editions are
  deliberately not shipped — adding a language means committing to writing real
  copy in it; `premium_upgrade`'s `amount_inr` property is still in the
  analytics union even though nothing can be paid in rupees.

## Done 2026-09-18 — content depth pass + CTA fix (this branch, in review)

Follow-up to the indexing audit ([`docs/GSC_INDEXING.md`](docs/GSC_INDEXING.md)
§4). The gate added the day before measured the problem; this pass fixed what it
found.

- **Nineteen pages written past the 150-word floor** and measured with the gate's
  own counter: 1,268 → 6,916 words of page-specific copy. The four pillar guides
  went from 66–82 words to 661–803 (`/deep-study-guide`,
  `/science-of-deep-work`, `/two-hour-study-method`, `/feynman-technique`); the
  hubs, the blog and the homepage from 115–140 to 301–493. Every one gained an
  FAQ block, so ten more documents now emit `FAQPage` JSON-LD backed by visible
  content — the homepage had none.
- **`THIN_BASELINE` is now empty** and `APP_SURFACE_PAGES` lost ten entries
  (`/break-free`, `/study-rooms`, `/leaderboard`, `/breathe`,
  `/study-method-quiz`, `/study-calculator`, `/pricing`, `/changelog`,
  `/roadmap`, `/support`). Those pages carry real copy about what the tool is and
  how to use it — the part the app cannot prerender for itself — and are held to
  the normal floor. The exemption list is now only policy stubs and
  auth/search/account screens. A page under 150 words fails the build.
- **CTA leak fixed (the conversion half).** `landing.tsx` had four "start
  focusing" buttons pointing at `/signup`, under the line "No signup friction —
  start your first session in 10 seconds", while `App.tsx:292` documents
  `/focus` as *"public, deep-linkable, guest-first"*. The prerenderer's default
  CTA did the same on 88 documents. Landing buttons and the default now target
  `/focus`; **95 of 119** prerendered pages close on the timer and exactly one
  still points at `/signup` (the `/focus` page, whose label is "Save sessions
  with a free account"). This is the mechanism behind the 0.2–0.7%
  landing-to-timer rate in the analytics audit.
- **`/pricing` was factually wrong.** It said Premium is bought with Focus Coins.
  Coins buy cosmetics; Premium is priced in Focus Tokens
  (`lib/premiumPlans.ts`: 10,000 / 25,000 / 80,000 for 30 / 90 / 365 days)
  earned at 50 per completed session with a 500/day cap (`lib/tokenLedger.ts`).
  The page now separates the two and publishes the real numbers.
- Gates: build + prerender + seo-validate PASS (119 pages, content-depth and
  table-parity gates included), bundle-budget PASS, API 424 passed, frontend 421
  passed, typecheck clean, eslint clean on all five changed files.
- **Still open:** de-duplicate `/break-free` and `/breathe` in the sitemap
  segments (117 `<loc>` entries describe 115 URLs); `/90-minute-timer` is the one
  defensible new page, since the product pre-arms 25/50/90 and
  `MINUTE_TIMER_DURATIONS` stops at 45 — it needs the full treatment the other
  five got, not a stub; CTA-click analytics events still do not exist, so the
  effect of the CTA change above cannot be measured in GA4 until they do.

## Done 2026-09-17 — Search Console indexing audit + content-depth gates (this branch, in review)

Full write-up: [`docs/GSC_INDEXING.md`](docs/GSC_INDEXING.md).

- **Diagnosis.** Google's indexed copy of the homepage still carries
  `aggregateRating` 4.9/2,847, `softwareVersion "12.0"`, `support@focusarx.app`
  and apex-host URLs — all removed in `eab9962` (2026-09-12). The current build
  emits **0** apex URLs across 119 documents and none of the indexed FAQ copy
  exists in it, so the 54-URL not-indexed backlog describes the *previous* site
  (the one whose `sitemap-profiles-*` shard listed 11,978 homepage duplicates).
  No code change clears it; a recrawl does. Bucket-by-bucket mapping and the ops
  sequence (verify deploy → Vercel primary = www → resubmit sitemap → request
  indexing on 10 URLs) are in the doc.
- **Comparison pages now prerender their feature table.** The ten pages are built
  from a grid in `src/content/seo-pages.mjs` that the hydrated page rendered and
  the prerenderer dropped, so a crawler saw 324–470 words where a visitor saw the
  whole comparison. `prerender.mjs` gained `entry.table` (real `<table>`,
  scoped headers, dated `<caption>`, Yes/No as text) and `section.bullets`;
  `prerender-data.mjs` fills them from the same rows; `comparison.tsx` now shows
  the table heading as a visible `<h2>` with the shared anchor id so both TOCs
  match. Measured: ~100 → **241–283** own words per page.
- **`seo-validate.mjs` gates 14–15.** Content depth (150 words of a page's *own*
  copy, shell furniture stripped; 21 app surfaces exempt at 5; 9 thin copy pages
  in a ratcheting baseline that may not regress and may not grow) and
  crawler/visitor table parity (every declared row label must be in the emitted
  HTML). Both negative-tested — each fires on a deliberately introduced defect.
- **`REMAINING.md` ops checklist corrected**: it said "Vercel primary domain =
  apex", which is backwards and contradicted `docs/DEPLOYMENT.md`,
  `docs/SEO_SETUP.md` and `docs/PRODUCTION_SETUP.md`. If the primary ever is the
  apex, every canonical points at a 308 and Google drops the page.
- Gates: build + prerender + seo-validate PASS (119 pages, avg doc 35.4 → 36.5 kb),
  bundle-budget PASS, API 424 passed (incl. seoContract 23 / regressionGuard 32),
  frontend 421 passed, typecheck clean both artifacts.
- **Still open** (content and ops, not code): write the 9 baselined copy pages
  (`/deep-study-guide` 66 words, `/science-of-deep-work` 69,
  `/two-hour-study-method` 74, `/feynman-technique` 82, then the hubs at 115–140);
  decide whether `/roadmap` (8), `/break-free` (10), `/study-rooms` (11) and
  `/leaderboard` (11) get copy or leave the sitemap; de-duplicate `/break-free`
  and `/breathe` (each listed in two sitemap segments); add CTA-click events —
  the one Phase-1 analytics item with no code behind it.

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

- Vercel primary domain = **`www.focusarx.site`** (the apex must 308 *to* it —
  see docs/DEPLOYMENT.md §"Canonical domain"). This line previously said "apex",
  which is backwards: every canonical, sitemap `<loc>`, `og:url` and hreflang in
  the build is www, so a primary of apex makes every canonical point at a URL
  that redirects and Google drops the page.
- Stripe webhook registered (`/api/stripe/webhook`,
  `checkout.session.completed`) when enabling cards.
- Sentry DSN + Plausible domain set when enabling observability.
- Resend key + EMAIL_FROM for recap/retention emails.
