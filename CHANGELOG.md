# Changelog

All notable changes to FocusArx. Dates are UTC.

## [Unreleased]

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
