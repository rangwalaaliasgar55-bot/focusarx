# FocusArx SEO — Manual Setup & Operating Guide

Everything in this document is work **only you can do**: account creation,
verification, console submissions, and supplying the real data behind claims.
The code side is already implemented — see [What the code already does](#what-the-code-already-does)
for what ships automatically.

Canonical host for everything below: **`https://www.focusarx.site`** (the `www`
subdomain). Every canonical, sitemap URL and OG tag uses it. If you ever serve
the apex without redirecting to `www`, every URL becomes a cross-host duplicate.

> **Prerequisites:** this guide assumes the app is already deployed — database
> created, Vercel project wired, domain and DNS pointing at it. That half is
> covered by [`PRODUCTION_SETUP.md`](PRODUCTION_SETUP.md). Do that first.

---

## 0. Before anything else: environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production
*and* Preview). They are already documented in [`ENVIRONMENT.md`](ENVIRONMENT.md).

| Variable | Value | Why it matters for SEO |
|---|---|---|
| `APP_URL` | `https://www.focusarx.site` | Drives every `<loc>` in the API-generated sitemap. Wrong value = every sitemap URL points at the wrong host. |
| `VITE_APP_URL` | `https://www.focusarx.site` | Drives canonical, `og:url`, `og:image` and the prerenderer's base URL. **Build-time** — changing it requires a redeploy. |

Verify after deploy:

```bash
curl -s https://www.focusarx.site/sitemap.xml | head -20
curl -s https://www.focusarx.site/pomodoro-timer | grep -o 'rel="canonical" href="[^"]*"'
```

Both must say `https://www.focusarx.site`. If the canonical says the apex or a
`*.vercel.app` URL, `VITE_APP_URL` is unset and you must redeploy.

---

## 1. Google Search Console (highest priority — do this first)

Nothing else on this list matters until GSC can see your site.

1. Go to <https://search.google.com/search-console> → **Add property**.
2. Choose **URL prefix** and enter `https://www.focusarx.site`.
   (The *Domain* option also works and covers apex + www + http/https in one
   property, but it requires a DNS TXT record. Either is fine; URL prefix is
   faster.)
3. Pick **HTML tag** verification. You get a value like
   `abc123XYZ...`.
4. Put it in `artifacts/focusarx/index.html`. There is a placeholder already
   sitting there commented out — find it and replace the whole comment block:

   ```html
   <!-- Before -->
   <!-- Google Search Console verification — paste your meta tag `content` value here:
   <meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />
   -->

   <!-- After -->
   <meta name="google-site-verification" content="abc123XYZ..." />
   ```

   > Alternative that needs no code change: upload the
   > `googleXXXX.html` file GSC offers into `artifacts/focusarx/public/`.
5. Commit, push, wait for the Vercel deploy, then click **Verify** in GSC.
6. **Sitemaps** (left nav) → enter `sitemap.xml` → **Submit**.
   Expected state: *Success*, with a discovered-URL count that grows over the
   next few days. It should settle around **69 URLs plus one entry per public
   profile**.
7. **URL inspection** — paste each of these and confirm *URL is on Google* or
   *Indexing allowed*. Do all of them; each is a different template:

   ```
   https://www.focusarx.site/
   https://www.focusarx.site/pomodoro-timer
   https://www.focusarx.site/deep-work-guide
   https://www.focusarx.site/comparison/focusarx-vs-forest
   https://www.focusarx.site/evidence
   https://www.focusarx.site/exam/jee-main
   ```

   For each, click **View crawled page** and check the *Rendered HTML* tab.
   The title must be the page's own title, not the homepage title. If it shows
   the homepage title, the prerendered file is not being served — stop and
   check `vercel.json`'s `handle: filesystem` route.

---

## 2. Bing Webmaster Tools

Bing is ~5–10% of search but also feeds ChatGPT's browsing, so it is worth the
ten minutes.

1. Go to <https://www.bing.com/webmasters> and **import from Google Search
   Console** — this copies verification and the sitemap in one step.
2. A verification file is already committed at
   `artifacts/focusarx/public/BingSiteAuth.xml` containing
   `35228966C9DF3C7E896903CED1530D03`. Confirm that matches the code shown in
   your Bing account; if Bing issued a different one, replace the file contents.
3. **Sitemaps** → submit `https://www.focusarx.site/sitemap.xml`.
4. Check <https://www.focusarx.site/BingSiteAuth.xml> returns XML, not HTML.

---

## 3. Google Analytics 4 — already connected, needs event checks

GA4 property **`G-PXMVX28PL5`** is already wired into
`artifacts/focusarx/src/lib/gtag.ts` and loads automatically. What you need to
do:

1. Open GA4 → **Admin → Data Streams** and confirm the web stream's URL is
   `https://www.focusarx.site`.
2. **Admin → Data Settings → Data Retention** → set to **14 months**. The
   default is 2, which silently deletes the history you need to judge whether
   a page is improving.
3. In **Explore**, build one report filtered to the new URLs so you can see
   them separately from the app surfaces:

   ```
   /pomodoro-timer, /focus-timer, /study-timer,
   /deep-work-guide, /body-doubling, /how-to-focus-while-studying,
   /adhd-focus-tools, /stop-scrolling,
   /comparison/*, /evidence, /camera-data, /safety
   ```

4. Link GSC to GA4: **Admin → Product links → Search Console links**. This is
   what puts search queries next to landing pages.

---

## 4. Core Web Vitals — measure, then fix

Do not guess at performance work. Measure first:

1. <https://pagespeed.web.dev/> → test `https://www.focusarx.site/pomodoro-timer`
   on **Mobile**. Do the same for `/` and `/deep-work-guide`.
2. Record **LCP**, **INP**, **CLS**. Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1.
3. After ~28 days of real traffic, GSC → **Experience → Core Web Vitals** shows
   *field* data (real users), which is what Google actually uses. Lab numbers
   from PageSpeed are only a proxy.

Known heavy surfaces in this codebase, in case a number is bad:
- `vendor-three` is **731 kB** (189 kB gzipped). Only pages that render a 3D
  scene should load it. If a guide page is pulling it in, that is a regression.
- `vendor-charts` is **331 kB** and only belongs on analytics/dashboard.
- Check in the Network tab that a text page like `/deep-work-guide` fetches
  neither.

---

## 5. Claim ledger — supply the real numbers (blocks one page)

`/evidence` is now a public claim ledger, and the marketing claims elsewhere on
the site point at it. **Two items need your real data before that page is
fully honest:**

### 5a. The 92% / 67% completion-rate claim on the landing page

`src/pages/landing.tsx` shows "92% completion rate" with AI coaching vs "67%"
without. The footnote now states the definition and the confound, but it still
needs:

- **The period.** Which month or quarter does this cover?
- **The sample.** How many sessions, from how many users?
- **The source.** Which query or dashboard produced it?

Add those three to `/evidence` (in `src/content/seo-pages.mjs`, the
`/evidence` entry) and to the landing footnote. If you cannot produce them,
**remove the numbers** — an unsourced statistic on a page that promises
sourcing is worse than no statistic.

> Note the confound the footnote now discloses: users who enable coaching are
> probably already more engaged. That is not a reason to delete the claim, but
> it must not be presented as "coaching causes +25 points".

### 5b. The product rating — currently removed, deliberately

`index.html` previously published `aggregateRating: 4.8 / 1250 reviews` in
structured data. **That has been removed** for two reasons:

1. Google's review-snippet policy prohibits *self-serving reviews* — you cannot
   mark up a rating of your own product on your own site. This risks a
   structured-data **manual action against the whole domain**, not just the page.
2. There was no platform, review count or date behind the number.

If you have genuine reviews on a third-party platform (Chrome Web Store, an app
store, Trustpilot, G2), you can mark those up — but on the page that displays
them, citing the platform, with a real count and date. Do not put a rating back
into the site-wide `SoftwareApplication` block.

### 5c. Everything else on the ledger

`src/content/seo-pages.mjs` → the `/evidence` entry lists what we publish, what
we removed, and what we refuse to claim. Keep it updated: **any new number that
appears anywhere on the site should be added there with a definition, source,
sample, period and review date.**

---

## 6. AI Overviews / answer engines — nothing to configure, one thing to watch

`public/robots.txt` now explicitly allows `GPTBot`, `OAI-SearchBot`,
`ChatGPT-User`, `ClaudeBot`, `Claude-Web`, `PerplexityBot` and
`Google-Extended`. `public/llms.txt` gives those systems a structured index of
the tools and guides.

**Do not block `Google-Extended`.** It is the only AI-training control Google
offers, and blocking it does **not** remove you from Search or from AI
Overviews — it only removes you from training. There is no upside.

What to watch: search your own key queries ("pomodoro timer online", "body
doubling meaning", "how to focus while studying") and note whether an AI
Overview appears and whether it cites you. Each intent page opens with a
self-contained 40–60 word answer specifically so it can be quoted intact. If a
page is consistently skipped, the answer block is the thing to rewrite.

---

## 7. Weekly operating cadence (30–60 minutes)

The audits both land on the same conclusion: the compounding comes from
refreshing and linking, not from publishing volume. Every week:

1. **GSC → Performance.** Sort by impressions, filter to the last 7 days vs the
   previous 28. Note what moved.
2. **Find pages at position 4–15.** These are the fastest wins — they already
   rank, they just need to be better. Expand one, add an internal link or two,
   update `lastReviewed` in `src/content/seo-pages.mjs`.
3. **Re-submit** any URL you changed via URL inspection → *Request indexing*.
4. **Internal links.** When you add a page, link it from `/guides`, the footer,
   and 2–3 related pages. A page nothing links to is an orphan and will rank
   slowly or never.
5. **One free community contribution** — r/getdisciplined, r/ADHD, r/studytips.
   Answer a question properly. Do not link unless it is genuinely the answer;
   those subreddits remove link-dropping and it costs you the account.
6. **Log any new mention.** GSC → Links shows new referring domains.

### Adding a new page — the checklist

The build **fails** if you skip steps, which is the point. A new public URL has
to be added in all of these:

| # | File | What to add |
|---|---|---|
| 1 | `src/content/seo-pages.mjs` | Content entry (title, description, h1, lead, `answerFirst`, sections, faq, related, cta) |
| 2 | `src/pages/<slug>.tsx` | Four-line wrapper rendering `<SeoLandingPage path="/<slug>" />` |
| 3 | `src/App.tsx` | Lazy import + `<Route path="/<slug>" .../>` |
| 4 | `artifacts/api-server/src/routes/sitemap.ts` | Entry in the right `*_PAGES` segment |
| 5 | `src/pages/guides.tsx` and/or `landing.tsx` footer | A real internal link |

`prerender-data.mjs` picks the page up automatically from step 1 — no separate
edit. Then run:

```bash
pnpm typecheck && pnpm test
pnpm --filter @workspace/focusarx run build
```

If any of the four lists drifted, `seoContract.test.ts` names the exact URL and
the exact list that is missing it.

---

## 8. Verification commands

Run these after every deploy. All should return 200 and sensible content.

```bash
# Crawler-facing files
curl -sI https://www.focusarx.site/robots.txt
curl -s  https://www.focusarx.site/robots.txt | grep Sitemap
curl -s  https://www.focusarx.site/sitemap.xml        | head -20
curl -s  https://www.focusarx.site/sitemap-tools.xml  | grep -c '<loc>'
curl -s  https://www.focusarx.site/llms.txt           | head -5
curl -s  https://www.focusarx.site/ads.txt

# Every new URL must return its OWN title, not the homepage's
for p in pomodoro-timer focus-timer study-timer deep-work-guide body-doubling \
         how-to-focus-while-studying adhd-focus-tools stop-scrolling evidence \
         camera-data safety accessibility press \
         comparison/focusarx-vs-forest comparison/focusarx-vs-focusmate \
         comparison/focusarx-vs-pomofocus comparison/focusarx-vs-freedom \
         comparison/focusarx-vs-stayfocusd comparison/focusarx-vs-focus-todo; do
  printf "%-40s " "$p"
  curl -s "https://www.focusarx.site/$p" | grep -o '<title>[^<]*</title>'
done

# No page may claim a rating in structured data
curl -s https://www.focusarx.site/ | grep -c aggregateRating   # must print 0

# Host canonicalisation — apex must 301 to www
curl -sI https://focusarx.site/ | head -5
```

Locally, before pushing, you can check the crawler view of the built site:

```bash
pnpm --filter @workspace/focusarx run build
pnpm --filter @workspace/focusarx preview:seo
curl -s localhost:4173/pomodoro-timer | grep -o '<title>[^<]*</title>'
```

`preview:seo` mirrors Vercel's filesystem-first resolution, so it serves the
prerendered per-route HTML. **`vite preview` does not** — it falls back to
`index.html` for extensionless paths and will show you the homepage title for
every URL, which looks like a broken build but is not.

---

## What the code already does

So you do not redo it by hand:

| Done | Where |
|---|---|
| Sitemap index + 7 themed child sitemaps + dynamic profile shards | `artifacts/api-server/src/routes/sitemap.ts` |
| Static sitemap fallback (survives a function cold start) | `artifacts/focusarx/public/sitemap.xml` |
| `robots.txt` — app surfaces blocked, AI crawlers allowed, sitemap declared | `artifacts/focusarx/public/robots.txt` |
| Build-time prerendering: 69 pages, each with its own title, description, canonical, OG tags, JSON-LD and real body copy | `scripts/prerender.mjs`, `scripts/prerender-data.mjs` |
| One content source shared by prerender + client render (no cloaking) | `src/content/seo-pages.mjs` |
| Schema: Organization, WebSite, SoftwareApplication, Article, HowTo, FAQPage, BreadcrumbList | `index.html`, `scripts/prerender.mjs`, `src/pages/seo-landing.tsx` |
| Answer-first blocks for AI Overviews | `answerFirst` on every intent page |
| Visible source/attribution + last-reviewed date on every guide | `sources` / `lastReviewed` |
| `llms.txt` for AI assistants | `artifacts/focusarx/public/llms.txt` |
| Claim ledger, camera-data, room-safety, accessibility and press pages | `/evidence`, `/camera-data`, `/safety`, `/accessibility`, `/press` |
| Six comparison pages, each stating when the competitor is the better choice | `COMPARISONS` in `src/content/seo-pages.mjs` |
| Drift guard — build fails if sitemap / routes / prerender / robots disagree | `artifacts/api-server/src/routes/seoContract.test.ts` |
| PWA manifest, service worker, icon set | `public/manifest.json`, `public/sw.js` |
| GA4 + AdSense ads.txt + Bing verification file | `src/lib/gtag.ts`, `public/ads.txt`, `public/BingSiteAuth.xml` |

### Fixed along the way

Two real defects, both silent:

- **`/focus-timer` 404'd.** It had a page component, a `PAGE_SEO` entry and a
  lazy import in `App.tsx` — but no `<Route>`. The highest-intent utility query
  in the category pointed at a 404, and nothing in the build caught it.
- **`/data-deletion` was in the sitemap while marked `noindex`.** Contradictory
  signals that waste crawl budget. It is now reachable from the footer only.

`seoContract.test.ts` exists so neither class of bug can ship again. It was
verified by re-introducing the `/focus-timer` defect: the test fails with
`Sitemap lists URLs with no route (they would 404): /pomodoro-timer`.
