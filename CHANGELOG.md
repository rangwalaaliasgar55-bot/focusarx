# Changelog

All notable changes to FocusArx. Dates are UTC.

## [Unreleased] — third pass

### Fixed (sign-in)

Every item below was reproduced against the running API before it was fixed,
and each has a test that fails without the fix.

- **Sign-in rejected valid credentials that differed only by whitespace.**
  Email validation ran before `z.string().trim()`, so the common autofill
  paste (`"  me@x.com "`, or a trailing newline from a password manager) got a
  400 `VALIDATION_ERROR` and the form said the email was bad — while the
  password never reached the browser, so users could not tell whether it was
  wrong too. Trim + lowercase now happen before the format check on every auth
  endpoint, and the client trims what it sends.
- **Guest sign-ins collided into one shared account.** A `guestKey` made only
  of symbols sanitised to `""`, and the old length check saw the
  pre-sanitise string, so every such client matched the same
  `guest_key=''` row — one person's tasks appearing in another's workspace.
  Keys are now sanitised before validation (short keys are a 400, not a
  collision), and the derived guest email comes from a digest of the key.
- **A transient 503 signed users out.** `tryRefreshSession` returned a single
  ok/fail boolean, and a failed refresh called `clearToken()` — so a cold
  start, a rolling deploy or a database blip destroyed the session in
  localStorage while the refresh token was still valid. The outcome is now
  three-state (`ok` / `invalid` / `unavailable`); only the server is allowed to
  declare a session dead, and `unavailable` keeps the credentials and retries
  with backoff. The same three states gate page boot in `resolveSession`: a
  hiccup during boot still renders the signed-out UI, but it no longer throws
  the credentials away, so the next mount picks the session straight back up.
- **Users saw `Request failed (400)` instead of what the server said.**
  `apiFetch` threw `ApiError(status, "Request failed (NNN)", body)`, and every
  screen that renders `error.message` — which is most of the app — displayed
  the HTTP code the user can act on least, while the actual sentence ("Your
  current password is incorrect") sat unread in `error.data`. The thrown error
  now carries the server's own message, and `apiErrorMessage()` unwraps an
  `ApiError` as well as a raw response body, so forms that pass the caught
  error still land on the real text and only fall back when the body was
  genuinely unusable.
- **Reset-link traffic ate the password-reset budget.** The `verify` probe the
  reset page fires on mount shared `forgotPasswordLimiter` with "send me a
  reset email" — so two refreshes of the reset page plus one forgotten
  password on a shared IP could lock a whole network out of recovery.
  Reset-link work now has its own, generous limiter.
- **Shared-IP office/school lockout.** Failed attempts accumulated in a
  per-IP bucket that also counted successful logins, so one curious coworker
  could lock out the whole floor. The auth limiter now skips successful
  requests, and the general API limiter stands down on auth paths that have
  their own (larger) limits, so a saturated shared bucket can no longer 429 a
  correct password.
- **Duplicate registration returned 500** (a Postgres unique violation
  reaching the generic error handler), and a case-variant of an existing email
  escaped the pre-check entirely. Both are a 400 "email already registered"
  now; if credentials could not be minted for a created account the response
  says `needsLogin` and the signup form routes to sign-in instead of to
  onboarding, which bounced back.
- **Cross-account cache leak.** React Query responses were shared across
  sign-out and auth expiry in the same tab, so the next user to sign in on a
  back navigation could see the previous account's dashboard data.
  `clearSessionCache()` runs on sign-out, when a session is declared expired,
  and after a password reset — which revokes every other session, possibly in
  someone else's browser.
- **Password reset worked in production but not in development** (the token is
  emailed, and no mailer is configured locally). The dev response now carries
  `devResetUrl` and the forgot-password page renders the link when it exists.
- **Private-mode and full-disk browsers.** `localStorage.setItem` throws
  `QuotaExceededError` there; the throw escaped `signIn` *after* a successful
  login and escaped the guest-key write before it started. Token and guest key
  now go through `safeStorage`, which keeps them in memory for the tab.
- **Sign-in reported success on a 200 it could not verify.** `signIn` now
  confirms the session read before navigating, so a hiccup surfaces "try
  again — you may already be signed in" instead of a Welcome-back toast and a
  bounce back to the form.
- **Login timing leaked account existence** (200–400 ms for a known email vs
  ~2 ms for an unknown one, i.e. an account-enumeration oracle and perceptibly
  slower sign-ins). An unknown email now runs a dummy bcrypt compare.
- **Legacy refresh promoted the 7-day token into localStorage** for browsers
  that cannot send the HttpOnly cookie, defeating the whole point of the
  split. It stays cookie-only, and its `Set-Cookie` is replayed so the rotation
  is not lost.
- **Auth responses were cacheable.** `/api/auth/*` now sends
  `Cache-Control: no-store, private` + `Vary: Cookie`, so a shared cache,
  proxy or the service worker cannot hand one person's session to the next.
- New regression suites: `artifacts/api-server/src/routes/auth.integration.test.ts`
  (live app + real database, 8 tests) and
  `artifacts/focusarx/src/lib/auth.session.test.ts` (session-resolution
  semantics, 7 tests).

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
