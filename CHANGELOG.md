# Changelog

All notable changes to FocusArx. Dates are UTC.

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
