# Changelog

All notable changes to FocusArx. Dates are UTC.

## [Unreleased] — P0.2 user-local calendar completion

**Daily rewards and the streak nudge now follow the user's own day.** Two
surfaces were still on the legacy IST calendar while sessions, habits and
missions had already moved to per-user IANA zones:

- `GET/POST /daily-reward/status|claim` derive today/yesterday in
  `users.timezone` (legacy IST fallback until a real zone is adopted, so
  existing streaks never shift), with DST-safe string math — subtracting
  86,400,000 ms across a spring-forward lands on the wrong day, and there is
  now a test proving the old math wrong on 2026-03-09 in `America/New_York`.
- The lazy streak-endangerment nudge on `/api/streak` fires after 16:00
  **user-local** with a DST-safe local-day throttle window, and the copy no
  longer says "midnight IST" to someone in another hemisphere.

10 new unit tests (API 354 → 364). No schema change. Deliberately not done:
`streak_history` backfill for pre-table completions, and per-user zones for
the batch `/retention/reengage/run` cron (needs a per-candidate lookup).

## [Unreleased] — v2 design system pass

**Brand, rebuilt.** FocusArx has a new identity: an "iris tile" mark — a
liquid-glass squircle in a violet→azure gradient holding a calm focus reticle
(ring + luminous point). One authored SVG (`public/brand/focusarx-mark.svg`)
feeds the whole raster set through a committed generator
(`scripts/generate-brand-assets.sh`): favicon, apple-touch icon (now 180px,
previously pointed at the 192 app icon), PWA icons incl. a properly inset
maskable, the org logo, and a redesigned 1200×630 social card. The old Zap
glyph is gone from the app shell, marketing header/footer, auth layout and
admin/developer consoles; the JSON-LD, manifest, service-worker cache and OG
references were all verified against the new files.

**Design system v4 — Liquid Glass materials.** Theme-aware translucent
materials with real backdrop blur + saturation boost, specular hairline edges
and soft depth now back `.glass` panels, app chrome (sidebar, bottom nav) and
new `.glass-strong/.glass-chrome/.glass-chip` surfaces; `@supports` fallbacks
keep them opaque where backdrop-filter is unavailable and
`prefers-reduced-transparency` is honoured. Light mode's auth/settings glass
no longer renders as a dark slab, adaptive `--backdrop` values are glassier,
and brand tiles use the new continuous-corner iris gradient.

**Error paths hardened.** `ErrorBoundary` and `ErrorState` never surface raw
`Error.message` to visitors (SQL/tokens/paths can leak through them), show
offline-aware copy with queue reassurance, offer a support path, and only
expose technical details under the opt-in debug flag. Boundaries support
reset keys (tab retries) and a dark variant for the developer console.

**Admin console, rebuilt.** New "System Settings"-style shell: searchable
grouped navigation, brand lockup, calm neutral identity (the old danger-red
console chrome is gone), glass content header, mobile drawer parity, branded
skeleton loading, and an error boundary per section that recovers without a
full page reload. The developer console got the same treatment: a dark
native-tools material that works in both app themes, a crisp header with
session identity, and a segmented section bar replacing the amber "God Mode"
language.

The overview panel was rebuilt on design tokens (ui-panel surfaces that theme
correctly in light and dark, violet session bars with per-day counts, h/m
duration formatting, flame icon in place of the streak emoji, themed admin
chips), and section headers shed the danger-red eyebrow. The database layer
got a real fix: CI `schema:check` was red because `database/full_schema.sql`
had never been regenerated after the schema gained the
`follows(follower_id, following_id)` unique index; the snapshot is now
canonical again.

## [Unreleased] — fifth pass

Search results are copy, so copy got a budget, a generator, and a gate.

**Objective defects, measured first.** An audit of the 51 prerendered page
directories in `dist/public` — not a style opinion, a count:

- `public/robots.txt` shipped `Disallow: /adminDisallow: /onboarding` on **one
  line** (an edit had dropped the newline). That is not a syntax error to a lenient
  parser: it is one `Disallow` for a path no URL can ever match, so the admin
  console and onboarding were *not* disallowed for the general `User-agent: *`
  group while the file still looked fine. Split, and now machine-checked.
- **15 of 51 titles** and **9 of 51 descriptions** were outside the range a search
  result can display (Google clips a title near 580px ≈ 60 characters and a snippet
  near 160), worst cases 71 and 180 characters. Every one of those pages loses the
  end of its own sentence to an ellipsis. Now: 0 and 0, with the same rule enforced
  at build time.
- `robots.txt` disallows 48 paths, and **all 51 prerendered pages said
  `index, follow` in their HTML** — the two of them that are also prerendered
  (`/premium`, `/achievements`) included. A `Disallow` only stops fetching; a URL Google already knows
  keeps an entry with no description. `noindex` is the signal that removes it, and
  it only works on HTML the crawler can read — so the two must agree, not be 48
  pages apart.
- The prerender manifest held a **third copy** of the same titles and descriptions
  (`scripts/prerender-data.mjs` alongside `components/PageSEO.tsx`'s preset table),
  already stale: 7 routes' crawler-facing title differed from the title the page
  itself sets, so navigating to `/premium` in the browser showed a different
  `<title>` than a crawler or a social card received. The 7 are aligned to the
  page-authored copy; the rest were shortened.
- Any unknown URL answers 200 with the SPA shell (`vercel.json` rewrites
  `/(.*) → /index.html` after `handle: filesystem`), and `pages/not-found.tsx` set
  no metadata at all — so a mistyped link was indexed with the previous route's
  head, or the homepage's. It now declares itself `noindex`.

**One generator for both renderers.** `src/lib/seo-text.mjs` (new) owns the brand
mark and the text budgets. `components/PageSEO.tsx` (client) and
`scripts/prerender.mjs` (build) both call it, which fixes three things at once:
titles no longer author `| FocusArx` themselves (`title.includes("FocusArx")` used
to *skip* the suffix, so the brand had three spellings and an unpredictable length),
a page cannot emit an over-budget title at all, and programmatic copy that cannot
know its length ahead of time — the `/pomodoro-timer-for/:exam` funnels, built from
exam names between 8 and 63 characters — is clamped where it is composed, at a
clause boundary, instead of mid-parenthesis by Google. `clampText` refuses to emit a
19-character "sentence" just because it ends in a full stop; `MIN_SNIPPET` is the
same floor the gate fails the build on.

**`src/lib/robots-parse.mjs` (new)** is one strict robots.txt reader for the three
places that have to agree with it: the prerenderer (which now derives each page's
`robots` meta from the file, so the HTML and the directives cannot drift — 2 pages
changed, `noindex, nofollow`, and every future prerendered private page gets it for
free), `scripts/seo-validate.mjs`, and the API's own generated copy. It implements
prefix matching, `*`, and trailing `$` (`Disallow: /*.map$` blocks source maps,
`Disallow: /api/` does not block `/api`), and reports a merged or stray line as an
error rather than absorbing it. `sitemap.ts`'s `robots.txt` route now builds from an
exported `ROBOTS_PRIVATE_PATHS` list (15 paths → 48, matching the static file) via a
pure `buildRobotsTxt(base)`; the two copies used to disagree about 33 paths, which
is the part that actually hurts.

**Gates, and proof they bite.** `scripts/seo-validate.mjs` gained: title/description
budgets against the *unescaped* text as rendered, the same budgets applied to the
manifest **before** the clamp (so a long string is a build failure, not something
quietly shortened for you), robots.txt line-shape, and indexability parity in both
directions. 26 new unit tests in `src/lib/seo-text.test.ts` and
`src/lib/robots-parse.test.ts` — including the real shipped files, so a
newline-eating edit to `public/robots.txt` fails the frontend suite — plus 3
contract tests in `seoContract.test.ts` that read the frontend's parser rather than
reimplementing it. Falsified deliberately, then reverted: deleting `Disallow:
/premium` from the generated copy fails the parity test naming `/premium`; setting
`index, follow` on `/premium`'s HTML fails the gate.

**Incidental, in files this pass touched.** `pages/search.tsx` mirrored `?q=` into
state inside an effect, so the page mounted twice and the input rendered empty on
the first frame; the query is now read from the location with typed text as an
override. `pages/study-calculator.tsx` had three `<label>`s attached to no control —
two now point at their range input, and the third labels a button group, which a
`<label>` cannot own, so it is the group's `aria-labelledby` instead. Four unused
icon imports and an unused `renderBody(entry, url)` argument went out with them.
`lint-changed`: 0 errors (75 warnings, non-fatal), `tsc --noEmit` clean,
229 frontend tests and 325 API tests green, `pnpm run build` green through the
extended gate.

**Deliberately not done.** The manifest and `PageSEO.tsx`'s table remain two copies
of the same *strings* — the budgets are enforced on both, content equality is not,
because making one import the other means moving the preset table out of a `.tsx`
the API-side scripts can also read. Descriptions are aligned only where they were
already stale. A real `404` status for unknown routes would need an edge function in
front of every page view; `noindex` costs nothing instead. `AUDIT.md` item 9's
`~150 user-facing pages still on raw fetch` is untouched (the admin console's 55
were the ones with a broken data layer), as is the repo-wide `eslint` backlog of
1042 problems and the `Knip` failure (`RangeError` inside oxc-parser, upstream).

## [Unreleased] — fourth pass
