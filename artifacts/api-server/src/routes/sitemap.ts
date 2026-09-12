import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

/**
 * ══════════════════════════════════════════════════════════════════
 * Sitemap system — index + segmented child sitemaps
 * ══════════════════════════════════════════════════════════════════
 *
 * ── What was wrong before ─────────────────────────────────────────
 * 1. Only `/api/sitemap.xml` existed. Crawlers look for `/sitemap.xml` at the
 *    host root; the static `public/sitemap.xml` pointed at `www.` while this
 *    file defaulted to the apex, so the two disagreed on every URL.
 * 2. `robots.txt` listed pages under `Sitemap:` that it also `Disallow:`ed
 *    (e.g. /dashboard), which is contradictory and wastes crawl budget.
 * 3. A single flat file capped discovery at ~28 URLs and could not grow.
 *
 * ── What this does ────────────────────────────────────────────────
 * `/sitemap.xml` is now a **sitemap index** pointing at themed child sitemaps.
 * That is the structure Google recommends and it lets each segment cache and
 * regenerate independently:
 *
 *   /sitemap.xml                 index
 *   /sitemap-core.xml            product + app surfaces
 *   /sitemap-guides.xml          evergreen content hub
 *   /sitemap-exams.xml           exam prep cluster
 *   /sitemap-compare.xml         comparison / alternative pages
 *   /sitemap-legal.xml           policy pages
 *
 * ── Why there is no profile segment ───────────────────────────────
 * A `sitemap-profiles-<n>.xml` shard used to be generated from the users table
 * (one `/u/<name>` URL per non-guest account — 11,978 of them against ~89
 * indexable pages everywhere else). It is gone on purpose:
 *
 *   1. **The HTML at /u/<name> is the homepage.** The route is client-rendered
 *      and is not in the prerender manifest, so Vercel's SPA fallback serves
 *      `index.html` — homepage title, description, JSON-LD and a
 *      `<link rel="canonical" href="https://www.focusarx.site/">`. Twelve
 *      thousand URLs all canonicalising to the homepage is exactly the
 *      "Discovered – currently not indexed" backlog, not growth.
 *   2. **The rendered content is a default template.** Even with JS, a typical
 *      profile shows a name, "0 friends", Level 1, 0 sessions, 0 focus hours,
 *      0 badges and no bio. There is no unique text for Google to rank, and
 *      the data it would need lives behind `/api/u/…`, which robots.txt
 *      disallows — so a crawler cannot even fetch it.
 *   3. **Most of the emitted URLs 404.** The shard slugified names
 *      (`Varun Warrier` → `Varun-Warrier`) while `/api/u/:username` resolves
 *      on the raw name (`lower(name) = lower(:username)`), so every multi-word
 *      name produced a dead link in the sitemap.
 *   4. Nothing in the app links to `/u/<name>` — discovery was 100% sitemap.
 *
 * `/u/:username` stays a working product surface (share links, Add Friend,
 * per-user OG card); it is just kept out of the index and out of the sitemap.
 * See `vercel.json` (X-Robots-Tag: noindex on `/u/…`) and
 * `src/pages/user-profile.tsx` (meta robots) for the de-indexing half.
 */

interface Page {
  url: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: string;
  lastmod?: string;
}

/**
 * Canonical base URL — the www host, matching the canonical tag in
 * `index.html`, the prerenderer and `public/robots.txt`. `APP_URL` wins when
 * set, but it MUST be the same host as the canonical
 * (https://www.focusarx.site); a different host makes every sitemap URL a
 * duplicate of its canonical.
 */
function baseUrl(): string {
  const fromEnv = process.env.APP_URL?.replace(/\/+$/, "");
  return fromEnv || "https://www.focusarx.site";
}

// ── lastmod ────────────────────────────────────────────────────────
/**
 * A lastmod date has to be one somebody can stand behind. Emitting today's
 * date for every URL — which `p.lastmod ?? now` did — tells Google the whole
 * site was rewritten on every deploy, and a crawler that catches it lying
 * stops trusting the field entirely (and crawls less often).
 *
 * So: the date the copy was last reviewed, mirrored from the frontend content
 * modules named in each comment. `seoContract.test.ts` asserts this file and
 * the prerender manifest agree, page by page, so the mirror cannot drift. A
 * page with no known review date emits no <lastmod> at all — omission is
 * honest, a guessed date is not.
 */
const SEO_CONTENT_REVIEWED = "2026-08-29"; // src/content/seo-pages.mjs LAST_REVIEWED
const MINUTE_TIMERS_REVIEWED = "2026-09-08"; // src/content/minute-timers.mjs
const AUDIENCE_PAGES_REVIEWED = "2026-09-11"; // the two audience pages (WS8d)
const GUIDE_LIBRARY_REVIEWED = "2026-09-11"; // src/content/seo-pages.mjs
const ABOUT_REVIEWED = "2026-09-11"; // src/content/seo-pages.mjs — editorial standards copy
const ADHD_GUIDE_REVIEWED = "2026-09-11"; // /adhd-focus-tips, rebuilt around its sources
const EXAM_CLUSTER_REVIEWED = "2026-09-05"; // src/content/exam/derive.mjs
const COMPARISONS_REVIEWED = "2026-09-06"; // src/content/seo-pages.mjs
const BLOG_REVIEWED = "2026-09-05"; // src/content/blog.mjs post dates
const APP_PAGES_REVIEWED = "2026-09-04"; // /focus and /changelog

/**
 * Per-segment default, used when a page has no date of its own. Only segments
 * whose every page is dated content get one: the blog, the exam cluster, the
 * funnels, the comparisons and the trust pages. The tools, guides, core and
 * legal segments mix dated copy with app shells (`/study-calculator`,
 * `/leaderboard`, `/terms`) that have no review date anybody could stand
 * behind, so they default to nothing and their dated pages are listed below.
 */
const SEGMENT_LASTMOD: Record<string, string | undefined> = {
  "sitemap-core.xml": undefined,
  "sitemap-tools.xml": undefined,
  "sitemap-guides.xml": undefined,
  "sitemap-blog.xml": BLOG_REVIEWED,
  "sitemap-funnel.xml": EXAM_CLUSTER_REVIEWED,
  "sitemap-exams.xml": EXAM_CLUSTER_REVIEWED,
  "sitemap-compare.xml": COMPARISONS_REVIEWED,
  "sitemap-trust.xml": SEO_CONTENT_REVIEWED,
  "sitemap-legal.xml": undefined,
};

/** Pages whose review date differs from their segment's — or whose segment has none. */
const PAGE_LASTMOD: Record<string, string> = {
  // Company pages reviewed as copy.
  "/about": ABOUT_REVIEWED,

  // App pages, last edited with the app rather than reviewed as copy.
  "/focus": APP_PAGES_REVIEWED,
  "/changelog": APP_PAGES_REVIEWED,

  // Timer tools and their minute-length variants.
  "/pomodoro-timer": SEO_CONTENT_REVIEWED,
  "/focus-timer": SEO_CONTENT_REVIEWED,
  "/study-timer": SEO_CONTENT_REVIEWED,
  "/5-minute-timer": MINUTE_TIMERS_REVIEWED,
  "/10-minute-timer": MINUTE_TIMERS_REVIEWED,
  "/15-minute-timer": MINUTE_TIMERS_REVIEWED,
  "/30-minute-timer": MINUTE_TIMERS_REVIEWED,
  "/45-minute-timer": MINUTE_TIMERS_REVIEWED,

  // Guides reviewed with the rest of the SEO content set.
  "/deep-work-guide": SEO_CONTENT_REVIEWED,
  "/how-to-focus-while-studying": SEO_CONTENT_REVIEWED,
  "/body-doubling": SEO_CONTENT_REVIEWED,
  "/adhd-focus-tools": SEO_CONTENT_REVIEWED,
  "/stop-scrolling": SEO_CONTENT_REVIEWED,

  // The long-form guide library, rewritten in the on-page ranking pass
  // (GUIDE_LIBRARY_REVIEWED in scripts/prerender-data.mjs).
  "/focus-guide": GUIDE_LIBRARY_REVIEWED,
  "/pomodoro-guide": GUIDE_LIBRARY_REVIEWED,
  "/study-techniques": GUIDE_LIBRARY_REVIEWED,
  "/stop-procrastinating": GUIDE_LIBRARY_REVIEWED,
  "/study-with-me": GUIDE_LIBRARY_REVIEWED,
  "/focus-music": GUIDE_LIBRARY_REVIEWED,
  "/deep-study-guide": GUIDE_LIBRARY_REVIEWED,
  "/two-hour-study-method": GUIDE_LIBRARY_REVIEWED,
  "/science-of-deep-work": GUIDE_LIBRARY_REVIEWED,
  "/feynman-technique": GUIDE_LIBRARY_REVIEWED,
  "/virtual-study-room": GUIDE_LIBRARY_REVIEWED,

  // Rewritten around their sources today.
  "/adhd-focus-tips": ADHD_GUIDE_REVIEWED,
  "/study-timer-for-medical-students": AUDIENCE_PAGES_REVIEWED,
  "/focus-timer-for-programmers": AUDIENCE_PAGES_REVIEWED,
};

/** The date one URL should advertise, or undefined to omit <lastmod>. */
export function lastmodFor(url: string, segmentFile?: string): string | undefined {
  return PAGE_LASTMOD[url] ?? (segmentFile ? SEGMENT_LASTMOD[segmentFile] : undefined);
}

// ── static segments ────────────────────────────────────────────────

const CORE_PAGES: Page[] = [
  // ONLY publicly crawlable surfaces belong here. Routes wrapped in
  // <ProtectedRoute> (dashboard, missions, shop, quests, …) redirect anonymous
  // crawlers to /login, so listing them in a sitemap feeds Google thin,
  // login-walled pages that read as soft-404s and waste crawl budget. Verified
  // against the <Route> table in artifacts/focusarx/src/App.tsx.
  { url: "/", changefreq: "daily", priority: "1.0" },
  { url: "/signup", changefreq: "monthly", priority: "0.9" },
  { url: "/login", changefreq: "monthly", priority: "0.5" },
  { url: "/pricing", changefreq: "monthly", priority: "0.9" },
  { url: "/leaderboard", changefreq: "hourly", priority: "0.8" },
  { url: "/study-rooms", changefreq: "hourly", priority: "0.8" },
  { url: "/roadmap", changefreq: "weekly", priority: "0.7" },
  { url: "/breathe", changefreq: "monthly", priority: "0.5" },
  { url: "/break-free", changefreq: "weekly", priority: "0.6" },
  // /search is deliberately absent: internal search results are thin,
  // near-duplicate pages with an unbounded ?q= parameter space. It is
  // noindex in both the prerender manifest and PAGE_SEO.search, and a URL that
  // is noindex must not also be offered in the sitemap — the two signals
  // contradict each other and waste crawl budget on pages we asked Google to
  // drop.
  { url: "/about", changefreq: "monthly", priority: "0.6" },
  { url: "/contact", changefreq: "monthly", priority: "0.5" },
  { url: "/support", changefreq: "monthly", priority: "0.5" },
  { url: "/focus", changefreq: "weekly", priority: "0.9" },
  { url: "/changelog", changefreq: "weekly", priority: "0.5" },
];

/**
 * Tool pages — the highest-intent utility queries in the category.
 *
 * These are split out from CORE_PAGES because they carry their own schema
 * (SoftwareApplication / HowTo) and because the audits both identify
 * "instant, no-signup timer" as the single most important acquisition wedge.
 * Mirrors the tool entries in
 * artifacts/focusarx/src/content/seo-pages.mjs; asserted against by
 * seoContract.test.ts.
 */
const TOOL_PAGES: Page[] = [
  { url: "/pomodoro-timer", changefreq: "weekly", priority: "1.0" },
  { url: "/focus-timer", changefreq: "weekly", priority: "0.9" },
  { url: "/study-timer", changefreq: "weekly", priority: "0.9" },
  { url: "/study-calculator", changefreq: "monthly", priority: "0.8" },
  { url: "/study-method-quiz", changefreq: "monthly", priority: "0.7" },
  { url: "/break-free", changefreq: "weekly", priority: "0.7" },
  { url: "/breathe", changefreq: "monthly", priority: "0.5" },
  // Minute-length timers. Each duration is its own search intent ("15 minute
  // timer", "45 minute timer online") with its own copy, FAQ and pre-armed
  // countdown — see artifacts/focusarx/src/content/minute-timers.mjs.
  { url: "/5-minute-timer", changefreq: "monthly", priority: "0.8" },
  { url: "/10-minute-timer", changefreq: "monthly", priority: "0.8" },
  { url: "/15-minute-timer", changefreq: "monthly", priority: "0.8" },
  { url: "/30-minute-timer", changefreq: "monthly", priority: "0.8" },
  { url: "/45-minute-timer", changefreq: "monthly", priority: "0.8" },
];

/**
 * Trust and transparency pages.
 *
 * These exist to substantiate the marketing claims elsewhere on the site and
 * to answer the privacy, safety and accessibility questions that gate
 * conversion for a product with an optional webcam feature. They are in the
 * sitemap on purpose: thin legal pages are not, but a claim ledger and a
 * camera-data explanation are real content people search for.
 */
const TRUST_PAGES: Page[] = [
  { url: "/evidence", changefreq: "monthly", priority: "0.6" },
  { url: "/camera-data", changefreq: "monthly", priority: "0.6" },
  { url: "/safety", changefreq: "monthly", priority: "0.6" },
  { url: "/accessibility", changefreq: "yearly", priority: "0.4" },
  { url: "/press", changefreq: "monthly", priority: "0.4" },
];

const GUIDE_PAGES: Page[] = [
  { url: "/guides", changefreq: "weekly", priority: "0.9" },
  { url: "/focus-guide", changefreq: "monthly", priority: "0.9" },
  { url: "/deep-work-guide", changefreq: "monthly", priority: "0.9" },
  { url: "/deep-study-guide", changefreq: "monthly", priority: "0.9" },
  { url: "/how-to-focus-while-studying", changefreq: "monthly", priority: "0.9" },
  { url: "/body-doubling", changefreq: "monthly", priority: "0.8" },
  { url: "/adhd-focus-tools", changefreq: "monthly", priority: "0.8" },
  { url: "/stop-scrolling", changefreq: "monthly", priority: "0.8" },
  { url: "/pomodoro-guide", changefreq: "monthly", priority: "0.9" },
  { url: "/study-techniques", changefreq: "monthly", priority: "0.9" },
  { url: "/two-hour-study-method", changefreq: "monthly", priority: "0.8" },
  { url: "/science-of-deep-work", changefreq: "monthly", priority: "0.8" },
  { url: "/feynman-technique", changefreq: "monthly", priority: "0.8" },
  { url: "/stop-procrastinating", changefreq: "monthly", priority: "0.9" },
  { url: "/adhd-focus-tips", changefreq: "monthly", priority: "0.9" },
  { url: "/virtual-study-room", changefreq: "weekly", priority: "0.8" },
  { url: "/study-with-me", changefreq: "weekly", priority: "0.8" },
  { url: "/focus-music", changefreq: "weekly", priority: "0.8" },
  // Audience pages (WS8d): one reader's day, described properly, instead of a
  // head term that serves nobody in particular.
  { url: "/study-timer-for-medical-students", changefreq: "monthly", priority: "0.8" },
  { url: "/focus-timer-for-programmers", changefreq: "monthly", priority: "0.8" },
];

/**
 * Exam prep cluster. Mirrors the slugs in
 * `artifacts/focusarx/src/content/exam/index.mjs` — the server cannot import
 * the frontend package at runtime, so the list is duplicated here and asserted
 * against by `routeContract.test.ts`.
 */
const EXAM_SLUGS = [
  "jee-main", "jee-advanced", "neet-ug", "cbse-class-12", "cbse-class-10",
  "gate", "cat", "upsc-cse", "ssc-cgl", "nda", "ctet", "ibps-po",
  // State, professional and international exams (Workstream 7b). Mirrors
  // EXAM_GUIDES in artifacts/focusarx/src/content/exam/index.mjs.
  "bitsat", "kcet", "mht-cet", "wbjee", "cuet-ug", "clat", "ca-foundation",
  "gre", "gmat",
  "exam-anxiety", "last-minute-revision",
];

const EXAM_PAGES: Page[] = [
  { url: "/exam", changefreq: "weekly", priority: "0.9" },
  ...EXAM_SLUGS.map<Page>((slug) => ({ url: `/exam/${slug}`, changefreq: "monthly", priority: "0.8" })),
];

/**
 * Comparison / alternative pages — high-intent commercial research queries.
 * Must stay in step with COMPARISON_PATHS in
 * artifacts/focusarx/src/content/seo-pages.mjs (asserted by seoContract.test.ts).
 */
const COMPARISON_SLUGS = [
  "focusarx-vs-forest",
  "focusarx-vs-focus-todo",
  "focusarx-vs-focusmate",
  "focusarx-vs-pomofocus",
  "focusarx-vs-freedom",
  "focusarx-vs-stayfocusd",
  // Adjacent-category comparisons (Workstream 7c): recall, workspace, task
  // and time-tracking tools people weigh against a focus system.
  "focusarx-vs-anki",
  "focusarx-vs-notion",
  "focusarx-vs-todoist",
  "focusarx-vs-toggl-track",
];

const COMPARE_PAGES: Page[] = COMPARISON_SLUGS.map<Page>((slug) => ({
  url: `/comparison/${slug}`,
  changefreq: "monthly",
  priority: "0.8",
}));

/**
 * Blog. Mirrors `BLOG_POSTS` slugs in
 * `artifacts/focusarx/src/content/blog.mjs` (asserted by routeContract).
 */
const BLOG_SLUGS = [
  "why-25-minutes-works",
  "attention-residue-task-switching",
  "body-doubling-study-accountability",
];

const BLOG_PAGES: Page[] = [
  { url: "/blog", changefreq: "weekly", priority: "0.8" },
  ...BLOG_SLUGS.map<Page>((slug) => ({ url: `/blog/${slug}`, changefreq: "monthly", priority: "0.7" })),
];

/**
 * Programmatic exam funnels (/pomodoro-timer-for/:exam). Mirrors the slugs
 * in src/content/exam-funnel.mjs — extend there, never here.
 */
const FUNNEL_SLUGS = [
  "jee-main", "jee-advanced", "neet-ug", "upsc-cse", "cat", "gate",
  "cbse-class-12", "cbse-class-10", "ssc-cgl", "nda", "ctet", "ibps-po",
  "bitsat", "kcet", "mht-cet", "wbjee", "cuet-ug", "clat", "ca-foundation",
  "gre", "gmat",
  "exam-anxiety", "last-minute-revision",
];

const FUNNEL_PAGES: Page[] = FUNNEL_SLUGS.map<Page>((slug) => ({
  url: `/pomodoro-timer-for/${slug}`,
  changefreq: "monthly",
  priority: "0.8",
}));

const LEGAL_PAGES: Page[] = [
  { url: "/privacy", changefreq: "yearly", priority: "0.3" },
  { url: "/terms", changefreq: "yearly", priority: "0.3" },
  { url: "/cookie-policy", changefreq: "yearly", priority: "0.3" },
  { url: "/acceptable-use", changefreq: "yearly", priority: "0.3" },
  { url: "/ai-policy", changefreq: "yearly", priority: "0.3" },
  // /data-deletion is deliberately absent: PAGE_SEO marks it `noindex`, and
  // listing a noindex page in the sitemap is a contradictory signal that
  // wastes crawl budget. It stays reachable from the footer.
];

/** The themed child sitemaps, in the order they appear in the index. */
const SEGMENTS = [
  { file: "sitemap-core.xml", pages: CORE_PAGES },
  { file: "sitemap-tools.xml", pages: TOOL_PAGES },
  { file: "sitemap-guides.xml", pages: GUIDE_PAGES },
  { file: "sitemap-blog.xml", pages: BLOG_PAGES },
  { file: "sitemap-funnel.xml", pages: FUNNEL_PAGES },
  { file: "sitemap-exams.xml", pages: EXAM_PAGES },
  { file: "sitemap-compare.xml", pages: COMPARE_PAGES },
  { file: "sitemap-trust.xml", pages: TRUST_PAGES },
  { file: "sitemap-legal.xml", pages: LEGAL_PAGES },
] as const;

// ── XML helpers ────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlsetXml(pages: Page[], segmentFile?: string): string {
  const body = pages.map((p) => {
    const loc = `${baseUrl()}${p.url === "/" ? "/" : p.url}`;
    const lastmod = p.lastmod ?? lastmodFor(p.url, segmentFile);
    return [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      // Omitted entirely when unknown: <lastmod> is optional, and a wrong one
      // costs more than a missing one.
      ...(lastmod ? [`    <lastmod>${escapeXml(lastmod)}</lastmod>`] : []),
      `    <changefreq>${p.changefreq}</changefreq>`,
      `    <priority>${p.priority}</priority>`,
      "  </url>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...body,
    "</urlset>",
    "",
  ].join("\n");
}

function sitemapIndexXml(entries: Array<{ loc: string; lastmod?: string }>): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((e) => [
      "  <sitemap>",
      `    <loc>${escapeXml(e.loc)}</loc>`,
      ...(e.lastmod ? [`    <lastmod>${escapeXml(e.lastmod)}</lastmod>`] : []),
      "  </sitemap>",
    ].join("\n")),
    "</sitemapindex>",
    "",
  ].join("\n");
}

// ── routes ─────────────────────────────────────────────────────────

/**
 * Sitemap index. Mounted at BOTH `/api/sitemap.xml` and `/sitemap.xml`
 * (app.ts mounts this router twice) so crawlers find it at the host root.
 */
router.get("/sitemap.xml", (_req, res) => {
  try {
    const base = baseUrl();
    // Static, synchronous, database-free: every listed URL is a page we
    // prerender at build time. (This used to append one entry per
    // `/u/<name>` profile shard read from Postgres — see the file header for
    // why those URLs are out of the sitemap.)
    // A child sitemap's own lastmod is the newest date inside it.
    const entries = SEGMENTS.map((s) => {
      const dates = s.pages
        .map((p) => p.lastmod ?? lastmodFor(p.url, s.file))
        .filter((d): d is string => Boolean(d))
        .sort();
      return { loc: `${base}/${s.file}`, lastmod: dates.at(-1) };
    });

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400");
    res.set("X-Robots-Tag", "all");
    res.send(sitemapIndexXml(entries));
  } catch (err) {
    logger.error({ err }, "sitemap index failed");
    res.status(500).type("application/xml").send('<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
  }
});

/** Themed child sitemaps. */
for (const segment of SEGMENTS) {
  router.get(`/${segment.file}`, (_req, res) => {
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    res.set("X-Robots-Tag", "all");
    res.send(urlsetXml(segment.pages, segment.file));
  });
}

/**
 * Deprecated profile shard — kept as an empty urlset.
 *
 * `/sitemap-profiles-1.xml` was advertised by the sitemap index (and by the
 * static fallback) until profiles were dropped from the sitemap, so Google
 * still has the URL and will re-request it for a while. Answering with a
 * valid, empty `<urlset/>` lets it retire the file cleanly; a 404 would show
 * up as "Couldn't fetch" in Search Console for a sitemap that is supposed to
 * be going away quietly. An empty sitemap is explicitly allowed by the
 * sitemaps protocol and costs nothing to serve.
 *
 * Safe to delete once the profile shard no longer appears in the Search
 * Console sitemaps report.
 */
router.get("/sitemap-profiles-:shard.xml", (req, res) => {
  const shard = Number.parseInt(req.params.shard as string, 10);
  if (!Number.isFinite(shard) || shard < 1 || shard > 10_000) {
    res.status(400).type("application/xml").send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    return;
  }
  res.set("Content-Type", "application/xml; charset=utf-8");
  // Short cache: this is a tombstone, and a stale copy in a CDN edge is fine.
  res.set("Cache-Control", "public, max-age=1800, s-maxage=43200, stale-while-revalidate=86400");
  res.set("X-Robots-Tag", "all");
  res.send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
});

/**
 * robots.txt.
 *
 * Must not contradict the sitemap: every path listed in a sitemap is allowed
 * here, and only genuinely private surfaces are disallowed. The previous file
 * disallowed `/api/` (which is where the sitemap lived) and listed `/dashboard`
 * in the sitemap while blocking it here.
 */
/**
 * Private surfaces, in the order and content of artifacts/focusarx/public/robots.txt.
 *
 * That static file is what the production host serves (vercel.json rewrites only the
 * sitemaps to this function); this route is what a standalone API — or any deploy
 * without the static copy — answers with. Two copies of one policy is only safe if
 * something checks it, so routes/seoContract.test.ts compares the two sets and fails
 * on drift in either direction. A path missing *here* is an app screen a crawler can
 * walk into; a path missing *there* is a page Google is told to skip by one copy and
 * crawl by the other.
 */
export const ROBOTS_PRIVATE_PATHS = [
  "/go/",
  "/admin",
  "/onboarding",
  "/profile",
  "/settings",
  "/notifications",
  "/messages",
  "/session-replay",
  "/replay",
  "/referral",
  "/wallet",
  "/style-guide",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/dashboard",
  "/analytics",
  "/missions",
  "/tasks",
  "/goals",
  "/habits",
  "/flashcards",
  "/achievements",
  "/social",
  "/groups",
  "/shop",
  "/marketplace",
  "/lootboxes",
  "/dreams",
  "/pets",
  "/city",
  "/quests",
  "/dna",
  "/focus-dna",
  "/constellations",
  "/consequences",
  "/battle-pass",
  "/ai-insights",
  "/forge",
  "/forge-room",
  "/premium",
  "/wrapped",
  "/ghosts",
  "/distractions",
  "/profiles",
  "/api/",
  "/*.map$",
  "/src/",
] as const;

/** The robots.txt body. Split out from the route so the contract test reads it. */
export function buildRobotsTxt(base: string): string {
  return [
    "# FocusArx robots.txt — served by the API and mirrored at the host root.",
    "",
    "User-agent: *",
    "Allow: /",
    "",
    "# Private application surfaces — not indexable, no crawl value.",
    ...ROBOTS_PRIVATE_PATHS.map((p) => `Disallow: ${p}`),
    "",
    "# API — except the SEO endpoints crawlers must reach.",
    "Allow: /api/sitemap.xml",
    "Allow: /api/sitemap-",
    "Allow: /api/robots.txt",
    "Allow: /api/og",
    "",
    "# Advertising — AdSense's crawler must always be allowed.",
    "User-agent: AdsBot-Google",
    "Allow: /",
    "",
    "User-agent: Googlebot",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Allow: /api/sitemap.xml",
    "",
    "User-agent: Bingbot",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "Allow: /api/sitemap.xml",
    "",
    "Sitemap: " + base + "/sitemap.xml",
    "",
  ].join("\n");
}

router.get("/robots.txt", (_req, res) => {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.send(buildRobotsTxt(baseUrl()));
});

export { router as sitemapRouter };
export { EXAM_SLUGS, SEGMENTS };
