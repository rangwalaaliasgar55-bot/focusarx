# Remaining work (deferred with rationale — nothing dropped silently)

Owner decisions needed before starting any row marked `[decision]`.

## Architecture bets (need explicit approval)

- [decision] **Next.js migration.** Recommended: stay on Vite + Express.
  The prerender pipeline, anti-farm session core and rate-limit layers are
  proven; a rewrite risks the two P0 retention bugs for SEO gains we
  already get via prerender. Revisit only if a requirement truly needs SSR.
- [decision] **Supabase + RLS.** Ownership is enforced app-side with
  `routerAuthScope` contract tests. A Supabase move is a full auth/data
  migration — do it only for a concrete capability need.
- [decision] **Stripe Free/Pro.** Token/coin premium works and is
  student-friendly. Stripe needs pricing, tax and refund ops — a business
  call, not an engineering one. Free AI-chat quota (10/day) is part of the
  same decision (chat is premium-gated today).

## Data & backend

- **Full Dexie offline-first sync** (`/sync/push|pull`, idempotent queue,
  last-write-wins). P0 covered: guest deadline snapshots + localStorage
  offline queue + server idempotency. Needs a sync-protocol design note in
  `ARCHITECTURE.md` first.
- **Streak Shield + `streak_history` audit table + user-local-midnight
  evaluation.** Logic is zone-aware and transactional now; Shield UI and
  the audit table are schema migrations.
- **Missed-day nudge scheduling** (`streakEndangerment` is still IST-timed).
- **Expiring push-subscription sweeper.**

## Scenes & design system

- **Deep Sea + Study Room full builds** (spec Phase 7.4): each needs scene
  design, data mappings, perf pass on Moto G4, and reduced-motion
  variants. Stubs with Pro gating ship in Settings now.
- **Constellation + Zen Garden** (Pro stubs, same story).
- **Token lint in CI** (one accent, radii 12/20/980, single shadow, two
  weights): needs a stylelint/token-grep rule + codemod of legacy screens.
- **Copy pass**: remove remaining hype words and emoji from UI strings.

## SEO & growth

- **`/blog` + Article schema**, **hreflang stub**, **per-user OG share
  images** (real weekly crystal + stats via `@vercel/og` or the SVG
  generator), **live "focusing right now" counter** (needs Realtime
  presence aggregation — the fabricated claim stays removed until real).
- **`/pomodoro-timer-for/[exam]` URL shape**: content exists under
  `/exam/:slug` with unique copy; a URL migration needs redirect mapping
  + reindex budget. Do not 404 existing `/exam/*` URLs.

## Product features (Phase 9 order, unstarted)

Session modes (Flowtime/Animedoro), task drag-reorder + estimates,
distraction parking key-D wiring (modal exists), weekly goals UI, exam
mode planner, weekly recap email/PDF, referrals/class codes, extension,
public `/u/` OG polish, calendar/imports, desktop/mobile wrappers, i18n
(hi/es/pt/id/ar + RTL), voice check-in, flashcard breaks, teams.

## Quality gates (need lab/services)

- **Playwright device matrix videos + BrowserStack real devices**
  (Phase 5.4 rows: SE1, A10/J7, Redmi 6A, Moto G4, Fold cover, landscape,
  ultrawide, IG WebViews, PiP, 200% zoom, offline, RTL). CI runs axe on
  chromium today. Unit coverage for timer/streak/storage/tiers exists.
- **Lighthouse CI on previews** (`lighthouserc.json` added; needs a
  preview URL + `(lhci` GitHub action secret).
- **Sentry (client+server) + PostHog/Plausible (IN/EU hosting)** — needs
  DSNs and a hosting decision. Release-tagging convention documented in
  `docs/PRODUCTION_SETUP.md`.
- **Differential legacy bundle** (Chrome 80 / iOS 13): `vh` fallbacks and
  `@supports` guards ship; check `device_context` tier data first to size
  the legacy audience before paying the double-build cost.
- **Knip + strict eslint (jsx-a11y, react-hooks) in CI.**
- **E2E hidden-tab + reload scenarios** (fake-timer unit coverage exists).
