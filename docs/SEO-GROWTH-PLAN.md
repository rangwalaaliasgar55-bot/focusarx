# FocusArx SEO & Growth Plan

**Site:** https://www.focusarx.site
**Goal:** maximize impressions, clicks, and users — path toward 1,000,000 users/month
**Based on:** [Google Search Central — SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) (applied section-by-section) + current best practice.

---

## 1. What was implemented (2026-08-24)

### A. "Check if Google can see your page the same way a user does" → Build-time prerendering
The site is a client-rendered React SPA. Before this change, **every URL served the same homepage `<title>`, meta description, and an empty `<body>`** unless the crawler executed JavaScript. Social scrapers (Facebook, WhatsApp, X, Discord, LinkedIn) don't run JS at all — every shared link previewed as the homepage.

Now `pnpm build` runs `scripts/prerender.mjs` after Vite, emitting a **static HTML file for all 36 public routes** (`dist/public/<route>/index.html`), each with:

- Unique `<title>` (≤ ~60 chars, keyword-led) — *guide section: "Influence your title links"*
- Unique meta description (≤ ~160 chars) — *guide section: "Control your snippets"*
- Correct canonical URL, `og:url`, `og:title/og:description`, `twitter:*`, `al:web:url`
- Route-scoped JSON-LD: `BreadcrumbList` (+ `Article` on guides, `FAQPage` on FAQ-bearing pages)
- Real, crawler-visible body content inside `#root` (replaced when React mounts — interactive behavior unchanged)
- Homepage-only global schemas (FAQPage, ItemList) stripped from subpages to avoid invalid markup

Vercel's existing `{ "handle": "filesystem" }` route serves these files automatically before the SPA fallback — **zero config change needed**.

### B. "Make your site interesting and useful" + "Expect your readers' search terms" → New long-tail content
5 new public pages targeting high-volume keyword clusters, each with genuinely useful, unique content, FAQs + FAQ schema, Article schema, and internal links with descriptive anchor text:

| Route | Target queries |
|---|---|
| `/guides` | study guides, focus guides, how to focus/study (hub) |
| `/adhd-focus-tips` | how to focus with ADHD, ADHD study tips, time blindness, body doubling |
| `/stop-procrastinating` | how to stop procrastinating, why do I procrastinate, 2-minute rule |
| `/study-with-me` | study with me, study with me online, virtual study session |
| `/focus-music` | focus music, study music, lo-fi, binaural beats, best music for studying |

Plus a real `/search` page (client-side index of all public pages) so the existing `WebSite > SearchAction` (sitelinks searchbox) schema points at a working page.

### C. "Help Google find your content" → Discovery files
- `sitemap.xml`: 36 URLs (added 5 new pages, removed `/data-deletion` which is `noindex` — don't put noindex URLs in a sitemap; refreshed `lastmod`)
- `robots.txt`: new public routes explicitly `Allow`ed
- Fixed `ItemList` schema URLs that pointed at robots-disallowed routes

### D. "Influence your title links" → Bug fix
`/two-hour-study-method` title contained stray Chinese characters (`高效学习`) — replaced with a clean English title across PAGE_SEO + prerender manifest.

### E. "Link to relevant resources" → Internal linking
- Landing nav "Study guides" now points to the `/guides` hub
- Landing footer "Learn" column expanded (All guides, ADHD focus tips, Stop procrastinating, Focus music)
- Every new page cross-links to related guides + product pages with descriptive anchors
- Every prerendered page includes a "Keep reading" crawlable link block

---

## 2. What YOU must do (cannot be done from the repo)

### Step 1 — Verify & monitor in Search Console (highest ROI, ~15 min)
1. Go to https://search.google.com/search-console → add property `focusarx.site` (Domain type, DNS TXT record, covers www + non-www).
2. Once verified, submit `https://www.focusarx.site/sitemap.xml` (Sitemaps → Add).
3. Use **URL Inspection → Request indexing** for the new pages: `/guides`, `/adhd-focus-tips`, `/stop-procrastinating`, `/study-with-me`, `/focus-music`.
4. Check **Pages (Indexing) report** weekly: look for "Crawled – not indexed" (weak content) or "Duplicate without canonical" issues.
5. In `artifacts/focusarx/index.html`, uncomment and fill the `google-site-verification` meta tag with the value Search Console gives you.
6. Do the same on **Bing Webmaster Tools** (imports from Search Console in one click) — free extra impressions.

### Step 2 — Validate structured data (~10 min)
- https://search.google.com/test/rich-results → test `/`, `/adhd-focus-tips`, `/stop-procrastinating`, `/study-with-me`, `/focus-music` (expect: SoftwareApplication, FAQ, Breadcrumb).
- https://validator.schema.org → same URLs.

### Step 3 — Check Core Web Vitals & mobile UX
- PageSpeed Insights on `/` and `/guides` (mobile). Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1.
- The heavy 3D bundle (`react-three-fiber`, ~890 kB) should stay out of the initial path for public pages — verify it's lazy-loaded (it is for the landing page; keep it that way).

---

## 3. Content roadmap (the actual growth engine)

Google's #1 message: **compelling, useful, people-first content influences search presence more than any technical tweak.** Ship 2–4 pages/week, each answering a real query better than the current top 10. Every page: unique title/description (add to `PAGE_SEO` **and** `scripts/prerender-data.mjs`), 1,500+ words of genuinely useful content, FAQ section, internal links, sitemap + robots entry.

Next 20 targets (est. monthly search volume, US-only):

| Priority | Route | Query cluster | Est. vol |
|---|---|---|---|
| ★★★ | `/pomodoro-calculator` | pomodoro calculator, how many pomodoros per day | 10K+ |
| ★★★ | `/study-playlist` / extend `/focus-music` | study playlist, music for studying | 100K+ |
| ★★★ | `/how-to-wake-up-early` | how to wake up early, morning routine students | 50K+ |
| ★★★ | `/exam-anxiety` | exam anxiety, test anxiety tips | 30K+ |
| ★★★ | `/study-tips-for-exams` | study tips for exams, last minute study tips | 50K+ |
| ★★☆ | `/active-recall` | active recall, active recall techniques | 40K+ |
| ★★☆ | `/spaced-repetition` | spaced repetition, anki alternative | 60K+ |
| ★★☆ | `/52-17-rule` | 52 17 rule, productivity ratio | 20K+ |
| ★★☆ | `/study-with-me-25-5` | study with me 25/5, pomodoro with me | 30K+ |
| ★★☆ | `/best-study-apps` | best study apps, focus apps compared | 40K+ |
| ★★☆ | `/focusarx-vs-pomofocus` | pomofocus alternative, focus timer comparison | 10K+ |
| ★★☆ | `/how-to-read-more` | how to read more books | 30K+ |
| ★☆☆ | `/dopamine-detox` | dopamine detox, dopamine fasting | 60K+ |
| ★☆☆ | `/deep-work-rules` | cal newport deep work rules | 20K+ |
| ★☆☆ | `/study-motivation-quotes` | study motivation | 100K+ (consider carefully) |
| ★☆☆ | `/2-minute-rule` | 2 minute rule productivity | 15K+ |
| ★☆☆ | `/parkinsons-law` | parkinson's law productivity | 15K+ |
| ★☆☆ | `/eisenhower-matrix` | eisenhower matrix, prioritize tasks | 60K+ |
| ★☆☆ | `/time-blocking` | time blocking, time blocking calendar | 25K+ |
| ★☆☆ | `/monk-mode` | monk mode, monk mode challenge | 20K+ |

Every comparison page (`/focusarx-vs-X`) should be genuinely fair — Google's guidance rewards honesty, and users smell hit-pieces.

---

## 4. Promotion (guide: "Promote your website" — links are how Google finds & ranks pages)

Code can't build backlinks. Roughly in order of ROI:

1. **Reddit, honestly** — r/GetStudying, r/productivity, r/ADHD, r/GetDisciplined: share the *guides* (not the app) where they answer a real question. One good guide link from a Reddit thread can outrank weeks of on-page work.
2. **StudyTube / StudyTok** — "study with me" creators use tools live; the `/study-with-me` and `/virtual-study-room` pages are natural pitches.
3. **Product Hunt / alternativeto.net / slashdot.org free listings** — high-authority dofollow-adjacent links + direct traffic.
4. **Student orgs & universities** — free productivity workshops using the Pomodoro guide; .edu links are gold.
5. **Word of mouth (the guide calls it the most lasting channel)** — the app already has a referral system; make sure session-summary cards have share links with OG images (now that prerendering makes previews work everywhere).
6. **X/Instagram/TikTok content** — daily study-tip threads that end on a guide link. The twitter handle `@focusarx` is already in the schema.

---

## 5. Honest math to 1,000,000 users/month

1M users/month ≈ 33K/day. With avg. 1.7 pages/user that's ~19K sessions/day ≈ (at 5% SERP CTR) **~380K daily impressions**. Realistic compounding timeline:

| Phase | Focus | Expected monthly users |
|---|---|---|
| Months 1–2 | Search Console, indexation, 10 more pages, first backlinks | 1K–10K |
| Months 3–6 | 2–4 pages/week, rank for long-tail (#1–#10 for dozens of terms) | 10K–100K |
| Months 6–12 | Domain authority compounds, comparison pages rank, viral loops | 100K–500K |
| Months 12–24 | Head terms (focus timer, study with me) + brand search | 500K–1M+ |

Things that accelerate: consistency of publishing, backlinks from real communities,Core Web Vitals in the green, and features people actually share (streaks, study rooms). Things that DON'T (per Google's own "don't focus on" list): meta keywords, keyword stuffing, domain-keyword obsession, word-count quotas, PageRank sculpting, E-E-A-T as a "factor."

---

## 6. Maintenance checklist

- [ ] Every new public page → add to `PAGE_SEO` (PageSEO.tsx), `scripts/prerender-data.mjs`, `sitemap.xml`, `robots.txt` Allow list, `/guides` hub, `/search` index
- [ ] Re-run `pnpm --filter @workspace/focusarx build` — prerenderer fails loudly if the template stops matching (intentional)
- [ ] Monthly: Search Console → Pages + Performance reports; refresh `lastmod` for updated content
- [ ] Quarterly: re-test rich results, prune/update stale guides (guide: keep content "up-to-date")
