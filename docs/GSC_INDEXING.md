# Search Console "not indexed" — diagnosis and remediation

Written 2026-09-17 against `eab9962` (branch `arena/01a0affc-focusarx`).

The report this answers, pasted from Search Console:

| Reason | Pages |
|---|---|
| Discovered – currently not indexed | 42 |
| Crawled – currently not indexed | 5 |
| Page with redirect | 3 |
| Alternative page with proper canonical tag | 3 |
| Duplicate, Google chose different canonical than user | 1 |
| **Not indexed** | **54** |

For scale: the sitemap currently offers **117 `<loc>` entries (115 unique URLs —
`/break-free` and `/breathe` are listed in both the core and the tools segment)**
across nine child sitemaps, and the build prerenders **119 documents**. So
roughly half the URLs Google knows about are in a not-indexed bucket.

---

## 1. The headline finding: Google is reporting on a site that no longer exists

Everything below is checkable from the two artefacts I could reach — the
repository at `eab9962`, and Google's own snippet for `https://www.focusarx.site/`
(retrieved 2026-09-17 through the search index, because the sandbox's network
egress cannot open a TLS connection to the production host).

Google's stored copy of the homepage contains:

| Field in Google's copy | In `eab9962` |
|---|---|
| `aggregateRating` — 4.9 from 2,847 reviews | **removed.** `index.html:198-209` carries an explicit comment: "NO aggregateRating, deliberately … An unsourced rating risks a structured-data manual action against the whole domain." |
| `softwareVersion: "12.0"` | `"1.0"` (`index.html:237`) |
| `operatingSystem: "Web, iOS, Android, Windows, macOS, Linux, ChromeOS"` | `"Web, iOS, Android"` (`index.html:216`) |
| `contactPoint.email: "support@focusarx.app"` | `"focusarx@gmail.com"` (`index.html:161`) |
| `sameAs: ["https://twitter.com/focusarx", "https://focusarx.site"]` | YouTube + the GitHub repo (`index.html:165-168`) |
| `screenshot: "https://focusarx.site/opengraph.jpg"` (apex) | www host |
| FAQ answer quoting `https://focusarx.site/privacy` (apex) | — |
| FAQ copy: "It is the most feature-complete free focus app available", "the most accurate free measure of true deep work quality available" | **absent** — `grep` over the built homepage returns nothing |

Two independent proofs of the same thing:

```
$ grep -ro 'https://focusarx\.site' artifacts/focusarx/dist/public --include=*.html | wc -l
0
$ grep -c "the most feature-complete free focus app" artifacts/focusarx/dist/public/index.html
0
```

The current build emits **zero** apex URLs in 119 documents, and the FAQ text
Google has indexed does not exist anywhere in it. `git log -S aggregateRating`
dates the removal to `eab9962`, 2026-09-12.

**Conclusion: Google's crawl predates the 2026-09-12 deploy.** The 54-URL
backlog is a description of the *previous* site — the one with a self-serving
`aggregateRating`, apex-host URLs in its own metadata, and (per the header
comment in `artifacts/api-server/src/routes/sitemap.ts`) a generated
`sitemap-profiles-<n>.xml` shard emitting **11,978 `/u/<name>` URLs whose HTML
was the homepage**, every one of them canonicalising to `/`.

That last item is worth quoting from the code, because it is the single best
explanation for a 42-page "Discovered – currently not indexed" bucket:

> *"Twelve thousand URLs all canonicalising to the homepage is exactly the
> 'Discovered – currently not indexed' backlog, not growth."*
> — `artifacts/api-server/src/routes/sitemap.ts:36-53`

The shard is now a tombstone: `/sitemap-profiles-:shard.xml` answers 200 with an
empty `<urlset>` (`sitemap.ts:483-495`), `/u/<name>` carries
`X-Robots-Tag: noindex, nofollow` (`vercel.json`) **and** a matching meta robots
tag, and robots.txt deliberately does *not* disallow `/u/` so Google can still
fetch the page and honour the noindex.

**What that means practically: none of the code in this repo can clear the
backlog on its own.** Google has to re-fetch. Until it does, the report will keep
describing a build you no longer ship, and any new "fix" you make will look like
it did nothing. Step 1 of the remediation is a recrawl, not a code change.

---

## 2. Bucket by bucket

### "Page with redirect" (3) — expected, and self-clearing

Three URLs Google holds answer with a redirect. There are exactly three
redirect generators in this deployment, all of them intended:

1. **apex → www 308.** `vercel.json` `redirects` is host-conditioned on
   `focusarx.site` and 308s to `https://www.focusarx.site/:path*`. Every canonical,
   sitemap `<loc>`, `og:url` and hreflang in the build is www. Any apex URL still
   in Google's queue — from old sitemap submissions or inbound links — reads as
   "Page with redirect" until Google drops it.
2. **trailing slash.** `vercel.json` sets `"trailingSlash": false`, so `/blog/`
   308s to `/blog`. The sitemap has no trailing slashes (`seo-validate.mjs`
   gate 6 asserts the setting is `false`).
3. **uppercase paths.** The `/[A-Z]…` route 308s through
   `/api/index.mjs?canonicalize=` because Vercel redirects are case-insensitive
   and cannot lowercase a path.

No action beyond confirming the Vercel primary domain (step 2 below). A "Page
with redirect" entry where the target *is* indexed is not a problem; it is
Google telling you it dropped the duplicate.

### "Alternative page with proper canonical tag" (3) — working as designed

This bucket means Google found a duplicate and honoured the canonical you
declared. It is a *success* state, not an error — the canonical page is the one
that can rank. In the current build every page's canonical is self-referencing
(verified: 119 of 119 documents, only `/404` has none, which is deliberate), so
the three entries are almost certainly apex/www pairs or pre-fix URLs. Nothing
to fix.

### "Duplicate, Google chose different canonical than user" (1) — the soft-404, fixed

One URL where Google overruled your canonical. The documented cause in this repo
is the old catch-all route: any unknown path answered 200 with the homepage
prerender, so `/typo-page` was indexed as a homepage duplicate with Google
picking `/` as canonical. `vercel.json` now returns a real 404 for anything that
is neither a file nor a known SPA route, `dist/public/404.html` carries
`noindex, nofollow` and **no canonical at all** (`prerender.mjs:376-390`), and
`seo-validate.mjs` gate 3 fails the build if the 404 ever grows one again.

### "Crawled – currently not indexed" (5) — thin pages

Google fetched these, read them, and decided they were not worth an index slot.
This is a content verdict, and the measurement below shows where it lands.

### "Discovered – currently not indexed" (42) — the queue, and the thin tail

Google knows the URL and has not prioritised fetching it. On a domain this young
that is mostly crawl-budget triage, which resolves itself as the site earns
trust — **but** the 11,978-URL profile shard poisoned exactly this signal, and
the thin pages below give Google a reason to keep deprioritising.

---

## 3. What I measured, and what I changed

`seo-validate.mjs` had thirteen gates covering titles, descriptions, canonicals,
JSON-LD, sitemap/robots agreement, orphan pages, cannibalisation, breadcrumbs,
E-E-A-T and images. **Not one of them measured how much a page actually says.**
A page could pass all thirteen on 30 words of copy. That is the gap the
"Crawled/Discovered – currently not indexed" buckets live in, so I closed it.

### Measured: the page's own words

Word counts below are the prerendered document's visible text with the repeated
shell furniture stripped (breadcrumb, badge, byline, "On this page", "Keep
reading", the cluster block, the closing CTA, the no-JS notice) — i.e. the words
that page wrote itself. This is what a crawler that does not finish the
JavaScript sees.

```
path                                 own words   sections  faq  table
/roadmap                                     8        0    0      0
/break-free                                 10        0    0      0
/study-rooms                                11        0    0      0
/leaderboard                                11        0    0      0
/breathe                                    40        1    0      0
/study-method-quiz                          46        1    0      0
/study-calculator                           46        1    0      0
/support                                    56        1    0      0
/pricing                                    62        2    0      0
/changelog                                  64        2    0      0
/deep-study-guide                           66        2    0      0
/science-of-deep-work                       69        2    0      0
/two-hour-study-method                      74        2    0      0
/feynman-technique                          82        2    0      0
/guides                                    115        4    0      0
/focus-guide                               115        3    0      0
/study-techniques                          115        3    0      0
/blog                                      138        3    0      0
/                                          140        3    0      0
--- floor: 150 ---
/comparison/focusarx-vs-focus-todo         241        2    2      1   (was ~100)
/comparison/focusarx-vs-forest             283        2    2      1   (was ~110)
/exam/*  (23 pages)                    1312–2966        —    —      0
```

### Change 1 — comparison pages now ship their feature table to crawlers

The ten comparison pages are built from a feature grid in
`src/content/seo-pages.mjs` (`rows`, `ours`, `theirs`). The hydrated page has
always rendered it; **the prerenderer did not**, so a crawler saw a lead
paragraph plus two short verdicts — 324–470 words — while a visitor saw the
whole comparison. For a `"X vs Y"` query the table *is* the answer, so these
pages were structurally thin in exactly the way that fills
"Crawled – currently not indexed", and nothing in the build caught it because
nothing was malformed.

- `scripts/prerender.mjs` — new `entry.table` support: a real `<table>` with
  `scope="row"`/`scope="col"`, a `<caption>` carrying the review date, and
  Yes/No rendered as text (not icons, which a crawler cannot read). Plus
  `section.bullets`, so the "what each side is good at" lists prerender too.
  Table and tick-list CSS added to the scoped `SHELL_CSS`.
- `scripts/prerender-data.mjs` — the ten comparison entries now build `table`
  from `c.rows` and attach `c.ours` / `c.theirs` as section bullets. Same content
  module the live page reads, so the two cannot disagree.
- `src/pages/comparison.tsx` — the table heading is now a visible `<h2>` with the
  shared `headingAnchors` id and is in the on-page TOC, matching the prerendered
  document exactly (previously the table had only an `aria-label` on its scroll
  region, so the TOCs differed).

Measured effect: comparison pages went from ~100 own words to **241–283**, and
average prerendered document size from 35.4 kb to 36.5 kb.

### Change 2 — two new build gates in `scripts/seo-validate.mjs`

**Gate 14, content depth.** Every indexable prerendered page needs 150 words of
its own copy. Two documented exceptions, both explicit lists so a new page cannot
quietly join:

- `APP_SURFACE_PAGES` (21 paths) — policy stubs, auth screens, and pages whose
  substance is a widget or an API response (`/study-rooms`, `/leaderboard`,
  `/break-free`, `/pricing`, `/changelog`, `/roadmap`, …). Floor 5 words: an app
  screen still has to name itself.
- `THIN_BASELINE` (9 paths) — real copy pages currently under the floor, each
  with the count it measured at. **This is a ratchet, not a pass-list:** a page
  may not get thinner, no new page may join, and fixing one means deleting its
  line so the floor then holds it permanently.

**Gate 15, crawler/visitor parity.** For every manifest entry with a `table`,
every row label must appear in the emitted HTML and the document must contain a
`<table>`. This is the specific regression that caused change 1.

Both gates were negative-tested, i.e. deliberately broken to confirm they fire:

```
# ratchet regression
- /feynman-technique: content-depth regression — 82 words of its own copy, down from 500 when the ratchet was set
# a new page under the floor
- /blog: only 138 words of its own copy in the prerendered document (floor 150) — …
# table row dropped from the static document
- /comparison/focusarx-vs-anki: 1 of 11 table rows are missing from the prerendered document (Custom card templates and add-ons…)
```

---

## 4. Remediation plan

### Ops — you have to do these, and they are the ones that move the number

1. **Confirm the 2026-09-12 (or newer) build is actually the live one.**
   ```bash
   curl -s https://www.focusarx.site/ | grep -c aggregateRating     # must be 0
   curl -s https://www.focusarx.site/ | grep -o 'softwareVersion[^,]*'   # must say 1.0
   ```
   If either is wrong, the deploy did not go out and nothing else matters.
2. **Vercel → Project → Settings → Domains: `www.focusarx.site` must be Primary.**
   Every canonical, sitemap URL, `og:url` and hreflang in the build is www.
   `docs/DEPLOYMENT.md` and `docs/SEO_SETUP.md` already say this; the ops
   checklist line in `REMAINING.md` still said "primary domain = apex" and has
   been corrected in this branch. If the primary is the apex, every canonical
   points at a URL that 308s, and Google drops the page.
3. **Re-submit `sitemap.xml` in Search Console** and note the "last read" time.
   Then **Remove the stale `sitemap-profiles-*.xml`** from the Sitemaps report if
   it is still listed — the route answers with an empty urlset on purpose, but a
   submitted sitemap that resolves to nothing is noise in the report.
4. **URL Inspection → Request indexing** on the ten highest-value URLs, in this
   order: `/pomodoro-timer`, `/`, `/study-timer`, `/focus-timer`,
   `/exam/jee-main`, `/comparison/focusarx-vs-forest`,
   `/comparison/focusarx-vs-pomofocus`, `/guides`, `/focus-guide`,
   `/how-to-focus-while-studying`. Budget is ~10/day; do not spend it on the
   thin pages until they are written.
5. **Verify robots.txt as served**: `curl -s https://www.focusarx.site/robots.txt | tail -3`
   must end with `Sitemap: https://www.focusarx.site/sitemap.xml`.
6. **Then wait.** "Discovered – currently not indexed" on a young domain clears
   over weeks as the recrawl replaces the old assessment. Re-read the report
   14 days after the recrawl, not the next morning.

### Code/content — what shipped in the second pass, and what is still open

Items 7 and 8 below were done the day after this document was first written.
They are kept here with their measurements because the numbers are the argument
for the gate, and because the direction of travel matters: the ratchet is only
worth anything if lines get deleted from it.

7. ~~**Write the nine baselined copy pages.**~~ **Done 2026-09-18.** All nine
   written past the floor and their `THIN_BASELINE` lines deleted, so the gate
   now holds them at 150 permanently. Measured with the gate's own counter:

   | Page | Before | After |
   |---|---|---|
   | `/deep-study-guide` | 66 | 803 |
   | `/science-of-deep-work` | 69 | 726 |
   | `/two-hour-study-method` | 74 | 667 |
   | `/feynman-technique` | 82 | 661 |
   | `/focus-guide` | 115 | 493 |
   | `/guides` | 115 | 377 |
   | `/study-techniques` | 115 | 362 |
   | `/blog` | 138 | 301 |
   | `/` (homepage) | 140 | 352 |
   | **total** | **1,268** | **6,916** |

   Each also gained an FAQ block, which means ten more pages now emit
   `FAQPage` JSON-LD backed by visible content — the homepage included, which
   previously had none.

8. ~~**Decide the app surfaces honestly.**~~ **Done 2026-09-18 — written, not
   dropped.** Ten pages left `APP_SURFACE_PAGES` and are held to the normal 150
   floor: `/break-free` 10→245, `/study-rooms` 11→241, `/leaderboard` 11→151,
   `/breathe` 40→233, `/study-method-quiz` 46→212, `/study-calculator` 46→213,
   `/support` 56→203, `/pricing` 62→336, `/changelog` 64→169, `/roadmap` 8→171.
   The copy is the part the app cannot prerender for itself: what the tool is,
   who it is for, how to use it. `APP_SURFACE_PAGES` now holds only the policy
   stubs and the auth/search/account screens, with a comment recording why the
   list got shorter and what it takes to add a page back.

9. **De-duplicate `/break-free` and `/breathe`** — still open. Each is listed in
   two sitemap segments (core *and* tools), so 117 `<loc>` entries describe 115
   URLs.

10. **Do not add more comparison or timer pages yet.** The audit you pasted
    proposes 8–12 new comparison pages and `/timer/25-minute` style pages. The
    exam cluster is already 46 near-parallel URLs (`/exam/:slug` × 23 plus
    `/pomodoro-timer-for/:slug` × 23) on a domain where half of everything is
    unindexed. Depth on the pages you have beats breadth until the backlog
    clears; gate 14 is what enforces that. One exception is defensible when you
    get to it: `/90-minute-timer`, since `MINUTE_TIMER_DURATIONS` is
    `[5, 10, 15, 30, 45]` and 25/50/90 are the durations the product itself
    pre-arms — but it needs the same treatment as the other five, not a stub.

### The hreflang cluster was decoration until the editions existed

`index.html` declared four alternates — `x-default`, `en`, `en-IN`, `en-GB` —
and every one of them resolved to the page's own canonical. That is legal, and
it is worthless: it tells Google "we intend to serve India, Britain and
everyone else" while serving all four the identical document, and Google
ignores a cluster whose alternates are identical. The file's own comment
anticipated the fix — *"if locale-specific URLs are ever added (a real /in/
edition, not a query parameter), these must be repointed at them"*.

They are repointed now. Ten real pages in five markets:

| URL | lang | Words | Written for |
|---|---|---|---|
| `/in`, `/in/pricing` | en-IN | 641 / 497 | JEE, NEET, UPSC, CA, GATE, boards |
| `/us`, `/us/pricing` | en-US | 532 / 433 | GRE, GMAT, finals, remote work |
| `/hi`, `/hi/pricing` | hi | 472 / 376 | Hindi-first readers |
| `/es`, `/es/pricing` | es | 503 / 423 | Spain and Latin America |
| `/pt-br`, `/pt-br/pricing` | pt-BR | 498 / 433 | Brazil |

The split is not arbitrary. **21 of the 23 exam guides under
`src/content/exam/` are Indian exams**; the two US exams the site covers are
GRE and GMAT; the AI coach's system prompt is written for Indian aspirants
(`api-server/src/lib/aiTemplates.ts:41`) and IST is the legacy default calendar
(`istDate.ts`). The product was India-first in code while presenting one
American-English homepage to every market. That is the gap the editions close.

Each page is authored, not machine-translated, and each is held to the same
150-word content-depth gate as every English page. Regional pricing pages now
state the configured Pro offer while keeping the free core and earned Focus
Credits route explicit. Checkout remains environment-gated, so payment controls
are hidden unless the matching provider and webhook configuration is complete.

What the build now enforces, in `scripts/seo-validate.mjs`:

- every `hreflang` alternate must resolve to a document **this build wrote** —
  declaring an edition before its pages exist now fails the build;
- clusters must be **reciprocal** — if `/pricing` says the Hindi edition lives
  at `/hi/pricing`, that page must say `/pricing` is its English original;
- `x-default` must exist and must agree with the `en` alternate;
- `<html lang>` must match the edition, so a page cannot declare `es` in its
  hreflang and `en` in its markup.

Verified non-vacuous by corrupting one built document: pointing the homepage's
Hindi alternate at a page that does not exist fails the build **twice** — once
for the dead alternate and once for the now-broken back-link.

Two latent defects surfaced the moment more than one edition existed, both
fixed: `PageSEO.tsx` rewrote every hreflang `href` to the current URL on
client-side navigation (right for one edition, wrong for five — a navigation
from `/pricing` to `/hi/pricing` would have pointed the Hindi and Spanish
alternates back at the English page), and the homepage emitted two `FAQPage`
entities because the prerenderer skipped stripping the inherited block on the
one route that keeps it.

### Two defects found while writing that copy

Both were invisible to every gate, because both were *true* statements about a
product that did not match them.

- **The primary CTA sent visitors to a signup form.** `landing.tsx` had four
  "start focusing" buttons pointing at `/signup` — directly under the line
  "No signup friction — start your first session in 10 seconds" — while
  `App.tsx:292` documents `/focus` as *"public, deep-linkable, guest-first"*.
  The prerenderer's default CTA had the same problem on a much larger surface:
  88 prerendered documents, the comparison, exam, funnel and guide pages
  included, closed with "Start focusing free" → `/signup`. All four landing
  buttons and the prerender default now point at `/focus`; after the rebuild
  **95 of 119 documents** close on the timer and exactly one still points at
  `/signup` (the `/focus` page itself, whose label is "Save sessions with a free
  account" — correct there). This is the mechanism behind the 0.2–0.7%
  landing-to-timer rate in your analytics.
- **`/pricing` conflated two currencies.** The copy said Premium is bought with
  "Focus Coins". It is not: Coins buy cosmetics, and Premium is priced in Focus
  Tokens (`lib/premiumPlans.ts`: 10,000 / 25,000 / 80,000 for 30 / 90 / 365
  days), earned at 50 per completed session with a 500/day cap
  (`lib/tokenLedger.ts`). The page now says which is which and publishes the
  real numbers, which is the kind of claim `/evidence` exists to hold.

---

## 5. Verification

All of this was run in this branch:

```
$ cd artifacts/focusarx && pnpm run build
prerender: wrote 119 static pages to dist/public (incl. 404.html and feed.xml)
seo-validate: 119 pages, 0 sitemap page entries, 9 child sitemap(s) served by the API in production
PASS — titles, descriptions, canonicals, JSON-LD, sitemap, robots, internal-link depth,
cannibalisation, llms.txt and consent wiring, breadcrumbs, jump links, title budgets,
PageSEO agreement, pillar/cluster wiring, bylines, visible freshness, citation links,
content depth, crawler/visitor table parity and image hygiene all consistent
bundle-budget: PASS   (avg prerendered document 36.5 kb)

$ pnpm --filter @workspace/api-server run test      → 424 passed, 32 skipped
   incl. seoContract.test.ts (23), regressionGuard.test.ts (32), routeContract.test.ts (2)
$ pnpm --filter @workspace/focusarx run test        → 421 passed (46 files)
$ pnpm run typecheck                                → both artifacts clean
```

Note for anyone rerunning: `scripts/prerender.mjs` is **not idempotent** — it
rewrites `dist/public/index.html`'s `<div id="root">`, which is its own template.
Running it twice against the same `dist` drops the bylines and citations and
`seo-validate` then fails on ~30 pages. Always `rm -rf dist` (or run the full
`pnpm run build`, which starts with `vite build`) before prerendering.

---

## 6. The GA4 half of the audit you pasted

Your analytics audit asks for `sign_up`, `timer_started`,
`first_session_completed`, `session_completed` and `dashboard_viewed`. Those
already fire:

- the loader is installed once in `index.html` with `send_page_view: false`;
- `SiteAnalyticsTracker` emits exactly one `page_view` per SPA route, with
  `page_title` from `document.title` and a canonicalised `page_location` that
  strips `_v`, `_skew`, `code`, `state` and anything credential-shaped
  (`src/lib/gtag.ts`);
- `src/lib/analytics.ts` defines 40 events including `signup_complete`,
  `session_started`, `session_complete`, `first_session_complete` and
  `session_abandoned`;
- `src/lib/gtag.test.ts` pins the single-loader and one-view-per-route contract.

**So "4 key events" is a GA4 Admin configuration gap, not a code gap:** the
events are arriving as ordinary events and have not been toggled to *Key events*
in GA4 Admin → Data display → Events. That step is already written up as
[`SEO_SETUP.md` §3 item 2](SEO_SETUP.md) — `src/lib/gtag.ts:19-23` names the same
three (`sign_up`, `session_complete`, `first_session_complete`).

Your duplicate-page-title finding is also already fixed at the source: the double
brand mark ("…Tracker | FocusArx" next to the raw "FocusArx") is what
`composeTitle` in `src/lib/seo-text.mjs` now strips and re-appends once, and its
docstring cites that exact GA4 report. The `FocusArx` row with 520 views from 14
users is the SPA shell's title before `PageSEO` runs — i.e. the pre-fix build
again.

**One genuine gap remains:** there is no CTA-click event. `cta_click_hero` /
`cta_click_comparison` do not exist in the `AnalyticsEvent` union, so "which CTA
works" is currently unmeasurable. That is a small, well-scoped addition to
`src/lib/analytics.ts` plus the two components, and it is the one item from the
growth plan's Phase 1 that still needs code.
