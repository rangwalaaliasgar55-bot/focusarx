# Changelog

All notable changes to FocusArx. Dates are UTC.

## [Unreleased] — second pass

### Added (product)

- Session-mode presets (Pomodoro 25/5, Extended 50/10, Deep Work 90/15,
  Animedoro 40/10, Custom, Flowtime stopwatch), remembered across visits.
  Flowtime completion flows through the same record→sync→summary pipeline.
- Distraction parking: `D` key on desktop, park button on mobile, review at
  the break. Desktop shows the deep-linked task as a visible pill.
- Weekly goal card on the dashboard (personal target vs server week total).
- Deep Sea and Study Room scenes, fully data-mapped (progress, pause,
  hidden-tab penalty, completion burst, streak, weekly facets, time of day),
  lazy-loaded, Full-tier only, Pro-gated in Settings.
- Blog (`/blog`, three essays, Article JSON-LD) and programmatic
  `/pomodoro-timer-for/:exam` funnels (14 exams, unique angles, live timer
  above the fold). Sitemap + prerender grow with the content files.
- Per-user OG share cards (`/api/og/user`) wired into public profiles.
- Live "focusing right now" counter on the landing hero (real aggregate,
  fail-silent — no fabricated claims).
- Weekly recap API + dashboard card (summary, share image, 1/day email via
  Resend when configured).
- Referral `?ref=` capture with auto-apply on first login (the code-entry
  fallback still works).
- Document PiP mini-timer on desktop Chrome/Edge.
- Card payments via Stripe (env-gated Checkout + verified webhooks granting
  the same entitlements; token unlocks unchanged; UI appears only when
  configured).

### Fixed / hardened

- Streak Shield auto-applies on exactly one missed day (banked freeze
  token consumed transactionally) with a `streak_history` audit trail and
  `shieldUsed` in completion responses + UI toasts.
- Leader-election remount race fixed (retry with backoff; e2e-proven).
- Removed dead code flagged by knip (cross-tab announcer superseded by the
  leader, orphan motion module) and unused deps (cors, cookie,
  styled-components, prettier).
- Patched transitive vulns via overrides (qs ≥6.16, fflate ≥0.6.11).
- Single drizzle-orm snapshot enforced (OTEL peer alignment for Sentry).
- Print stylesheet for the weekly report; `vh`-first viewport fallbacks.
- Observability: Plausible (env-gated, 1 KB) and Sentry client+server
  (env-gated, release-tagged, no PII).
- Quality gates: strict ESLint (changed-files gate in CI), knip dead-code
  gate (files+deps), Playwright device projects (landscape, tablet,
  reduced-motion) + timer survival e2e (deep links, reload resume,
  offline start — 10/10 green), `.browserslistrc` floor, LHCI config.
- Leader retry with backoff (remount-race tolerant, e2e-proven); desktop
  task pill for deep-linked tasks; auth mount fetch without cascading
  setState; unused imports/dead components removed.

## [Unreleased] — first pass

### Fixed (retention P0s)

- Guest timer sessions now survive refresh, back-swipe, browser close and
  system sleep via a local deadline snapshot (`focusarx-guest-timer`).
  Authenticated server recovery is unchanged and still wins when present.
- Only one tab can run a timer at a time (`navigator.locks` leader election
  with `BroadcastChannel` fallback; server `clientNonce` idempotency remains
  the backstop). The stood-down tab explains itself instead of double-running.
- Streaks, productivity logs and weekly XP resets are keyed to the user's own
  IANA timezone (adopted from the device, stored on the profile). Missing or
  never-set zones keep the legacy IST calendar, and adopting a real zone can
  never silently reset a streak (legacy-yesterday continuity).
- Completion chimes now resume a suspended `AudioContext` and the context is
  unlocked on the start/pause gesture (autoplay-policy fix).
- `SqlEditor` no longer uses raw `100vh`; viewport utilities ship `vh`
  fallbacks ahead of `dvh` for legacy browsers.

### Added

- `/focus`: public, guest-first focus app, deep-linkable with
  `?duration=25&task=…&src=…` (duration 1–240 min). `/go/ig` redirects to an
  armed `/focus?duration=25&src=ig` for the Instagram funnel.
- Device capability tiers (Full / Lite / Essential): feature-detected,
  user-overridable in Settings → Appearance, reported once per tab session
  in the `device_context` analytics event (with `src` attribution).
- In-app WebView guidance: a single dismissible pill after the first
  completed session suggests Chrome/Safari for alerts and offline mode.
  Install/push prompts stay suppressed in WebViews (none exist to fire).
- 3D hero pauses its render loop while the tab is hidden and never mounts a
  GL context on Tier Essential.
- `/changelog` (this page) and `AUDIT.md` / `VERIFICATION.md` in the repo.

## [1.0] — 2026-09-03 and earlier

- Apple-style frontend polish and scroll-motion pass; retro texture layers.
- SEO hardening: build-time prerender + `seo-validate`, sitemap index with
  segments, robots coherence tests (`seoContract`), dynamic SVG OG cards
  (`/api/og`), exam guides (JEE Main/Advanced, NEET, UPSC, CAT, CBSE, GATE…).
- Server-authoritative sessions: verified durations, `clientNonce`
  idempotency, lazy expiry finalization, transactional streak + wallet
  credit, anti-farm reward gating.
- Auth: JWT access (15 min) + rotating refresh families, guest accounts,
  per-IP/per-user rate limits (Upstash-backed when configured).
- AI: server-only Groq/Gemini with daily budgets, per-user quotas, prompt
  sanitization and injection guards, graceful static fallbacks.
- PWA shell: versioned service worker, manifest shortcuts, offline-tolerant
  navigation (API never cached).
- Removed the fabricated member counter; added claim ledger at `/evidence`.
