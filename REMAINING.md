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

Ordered by value. Four of the original eight have shipped since this list was
written; what remains is listed honestly below, including the parts that are not
code.

1. **§7.3 offline-first — SHIPPED as a retry queue, not an entity store.** The
   queue is now a module store (`useSyncExternalStore`) with exponential backoff,
   response classification, and one hard rule: **it never discards a payload by
   itself.** The old queue deleted a session after five failed attempts and
   persisted the shortened queue, giving a completed session a two-and-a-half
   minute window before it was destroyed with nothing shown to the user.
   Items now leave only on an accepted response, its 409 duplicate, or the user
   dismissing them; sign-out clears the queue so the next user on the device
   cannot submit the previous user's history under their own token.

   **What is deliberately not built:** the prompt's Dexie/IndexedDB entity store
   with field-level merge. This stack has no Dexie, and the merge semantics only
   matter for *offline editing* of shared entities — which nothing in the product
   does. Sessions are append-only and already carry client-supplied idempotency
   keys, so there is nothing to merge. Building a conflict resolver for
   operations that cannot conflict would be code without a failing case.
2. **§1.6 Webhook & integration layer — SHIPPED.** Signed outbound webhooks
   with a retrying delivery worker, plus OAuth providers for Google Calendar,
   Google Fit, Slack, Discord and Apple Health. Secrets and tokens are
   AES-256-GCM ciphertext (`lib/secrets.ts`), the signing secret is returned
   once and only hinted afterwards, and URLs are validated against the metadata
   and private ranges before every fetch.

   **What is left, and why it is not code:** the Google, Slack and Discord
   providers need real app registrations (`GOOGLE_CALENDAR_CLIENT_ID`, …,
   `SLACK_CLIENT_SECRET`, `DISCORD_CLIENT_SECRET`) before they can complete a
   flow. Until then each reports `configured: false` and the UI disables Connect
   with the reason, so nothing is half-broken — but the OAuth round trip itself
   has not been exercised against a live provider, and no test can do that here.
   `docs/ENVIRONMENT.md` lists every variable and the exact redirect URI to
   register. **Apple Health is an import, not a connection** — HealthKit is
   device-only by design, so that one needs an export-file upload path, not a
   token.

3. **§1.9 CHECK constraints — mostly done.** `user_wallets` is now constrained
   (migration 0016). Not yet constrained: `user_pet_inventory` (the prompt's
   `happiness BETWEEN 0 AND 100` does not map — the column is `mood text`, so
   the invariant is a different one and needs a decision), and the various
   `*_coins`/`amount` columns on transactions and inventory.
4. **§1.10 auth hardening — NEEDS A DECISION, NOT A PATCH.** `auth.ts` uses
   **bcryptjs** (cost 12), not Argon2id. There is no TOTP/2FA, no backup codes,
   and no Apple sign-in. Note that PKCE now *does* exist on the Google flow as
   part of §1.6 (`createPkce`, with the verifier carried inside the signed state).
   Moving to Argon2id touches every stored credential and needs a
   rehash-on-next-login path, and 2FA changes the login contract for every user
   — both are product decisions with migration and support consequences, so they
   are left for you rather than taken unilaterally.
5. **§1.7 GDPR 30-day grace — SHIPPED.** `DELETE /auth/account` schedules rather
   than deletes (`deletionRequestedAt`, migration 0017); the user can sign back in
   and cancel; an admin route lists the backlog and purges rows whose window has
   passed. The purge scrubs `email_logs.recipient_email` *before* the cascade.
   `GET /settings/data/export` was already present.
6. **§1.8 cursor pagination — SHIPPED** for every mutable feed. Cursors are
   base64url `[createdISO, id]`, deliberately **unsigned** (they carry data the
   client already has; opaqueness, not secrecy), decoded to `null` on malformed
   input so a bad cursor serves page one instead of a 500. The tiebreak is
   row-wise `(created_at, id) < (:created, :id)` — one index scan, unlike the
   expanded `OR` form — and `hasMore` comes from a `+1` probe rather than a
   second `COUNT`, which would run at a different instant and can hand back an
   empty "next" page. `cursorAdoption.test.ts` is a source-level gate that fails
   if a mutable feed regresses to offset.
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



---

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
- Blog + Article schema; `/pomodoro-timer-for/:exam` funnels; per-user OG.
  (The live focusing-now counter shipped here was later removed on purpose:
  live user counts are not published — see the study-rooms/stats contract.)
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
