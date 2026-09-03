import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";
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
 *   /sitemap-profiles-<n>.xml    public profiles, straight from Postgres
 *
 * The profile segment is the one that scales: it is generated from the users
 * table at request time, so the sitemap grows with real, crawlable profiles
 * instead of a hand-maintained list. Google's hard limits are 50,000 URLs and
 * 50MB per file; we shard at 45,000 to stay clear of both.
 */

/** Google allows 50,000 URLs per sitemap; shard below that with headroom. */
const URLS_PER_SHARD = 45_000;

interface Page {
  url: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: string;
  lastmod?: string;
}

/**
 * Canonical base URL — the apex host, matching the canonical tag in
 * `index.html`, the prerenderer and `public/robots.txt`. `APP_URL` wins when
 * set, but it MUST be the same host as the canonical (https://focusarx.site);
 * a different host makes every sitemap URL a duplicate of its canonical.
 */
function baseUrl(): string {
  const fromEnv = process.env.APP_URL?.replace(/\/+$/, "");
  return fromEnv || "https://focusarx.site";
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
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
  { url: "/search", changefreq: "daily", priority: "0.4" },
  { url: "/about", changefreq: "monthly", priority: "0.6" },
  { url: "/contact", changefreq: "monthly", priority: "0.5" },
  { url: "/support", changefreq: "monthly", priority: "0.5" },
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
];

const COMPARE_PAGES: Page[] = COMPARISON_SLUGS.map<Page>((slug) => ({
  url: `/comparison/${slug}`,
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

function urlsetXml(pages: Page[]): string {
  const now = today();
  const body = pages.map((p) => {
    const loc = `${baseUrl()}${p.url === "/" ? "/" : p.url}`;
    return [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <lastmod>${p.lastmod ?? now}</lastmod>`,
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

function sitemapIndexXml(entries: Array<{ loc: string; lastmod: string }>): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((e) => [
      "  <sitemap>",
      `    <loc>${escapeXml(e.loc)}</loc>`,
      `    <lastmod>${e.lastmod}</lastmod>`,
      "  </sitemap>",
    ].join("\n")),
    "</sitemapindex>",
    "",
  ].join("\n");
}

// ── profile segment (dynamic) ──────────────────────────────────────

/**
 * Count of indexable public profiles. Cached briefly — this is a COUNT over
 * the users table and the sitemap is re-fetched far more often than users
 * sign up.
 */
let profileCountCache: { value: number; at: number } | null = null;
const PROFILE_COUNT_TTL_MS = 10 * 60 * 1000;

async function countProfiles(): Promise<number> {
  if (profileCountCache && Date.now() - profileCountCache.at < PROFILE_COUNT_TTL_MS) {
    return profileCountCache.value;
  }
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(and(eq(usersTable.isGuest, false), isNotNull(usersTable.name)));
  const value = Number(row?.count ?? 0);
  profileCountCache = { value, at: Date.now() };
  return value;
}

/**
 * A public profile is addressed by `/u/<name>` (see publicProfiles.ts, which
 * matches on email or a case-insensitive name). We slugify the name the same
 * way a visitor would arrive at it.
 */
function profileSlug(name: string): string {
  return name.trim().replace(/\s+/g, "-");
}

/**
 * Fetch one shard of profile URLs, newest first so a partial crawl still
 * reaches the most recent accounts.
 */
async function fetchProfileShard(shard: number): Promise<Page[]> {
  const limit = URLS_PER_SHARD;
  const offset = (shard - 1) * limit;
  const rows = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(and(eq(usersTable.isGuest, false), isNotNull(usersTable.name)))
    .orderBy(sql`${usersTable.createdAt} desc`)
    .limit(limit)
    .offset(offset);

  const seen = new Set<string>();
  const pages: Page[] = [];
  for (const r of rows) {
    if (!r.name) continue;
    const slug = profileSlug(r.name);
    if (!slug || seen.has(slug.toLowerCase())) continue;
    seen.add(slug.toLowerCase());
    pages.push({
      url: `/u/${encodeURIComponent(slug)}`,
      changefreq: "weekly",
      priority: "0.5",
    });
  }
  return pages;
}

// ── routes ─────────────────────────────────────────────────────────

/**
 * Sitemap index. Mounted at BOTH `/api/sitemap.xml` and `/sitemap.xml`
 * (app.ts mounts this router twice) so crawlers find it at the host root.
 */
router.get("/sitemap.xml", async (_req, res) => {
  try {
    const now = today();
    const base = baseUrl();
    const entries = SEGMENTS.map((s) => ({ loc: `${base}/${s.file}`, lastmod: now }));

    // Add one index entry per profile shard. A COUNT(*) is cheap and cached.
    // If the database is unreachable we still emit the static segments rather
    // than failing the whole index — a partial sitemap is far better for
    // crawlers than a 500.
    let profileShards = 0;
    try {
      profileShards = Math.max(1, Math.ceil((await countProfiles()) / URLS_PER_SHARD));
    } catch (err) {
      logger.warn({ err }, "profile count failed — emitting sitemap index without profile shards");
    }
    for (let i = 1; i <= profileShards; i++) {
      entries.push({ loc: `${base}/sitemap-profiles-${i}.xml`, lastmod: now });
    }

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
    res.send(urlsetXml(segment.pages));
  });
}

/** Dynamic public-profile shards. */
router.get("/sitemap-profiles-:shard.xml", async (req, res) => {
  const shard = Number.parseInt(req.params.shard as string, 10);
  if (!Number.isFinite(shard) || shard < 1 || shard > 10_000) {
    res.status(400).type("application/xml").send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
    return;
  }
  try {
    const pages = await fetchProfileShard(shard);
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=1800, s-maxage=43200, stale-while-revalidate=86400");
    res.set("X-Robots-Tag", "all");
    res.send(urlsetXml(pages));
  } catch (err) {
    // Never 500 a sitemap — an empty urlset keeps the index valid.
    logger.error({ err, shard }, "profile sitemap shard failed");
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "no-store");
    res.send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>');
  }
});

/**
 * robots.txt.
 *
 * Must not contradict the sitemap: every path listed in a sitemap is allowed
 * here, and only genuinely private surfaces are disallowed. The previous file
 * disallowed `/api/` (which is where the sitemap lived) and listed `/dashboard`
 * in the sitemap while blocking it here.
 */
router.get("/robots.txt", (_req, res) => {
  const base = baseUrl();
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.send([
    "# FocusArx robots.txt — served by the API and mirrored at the host root.",
    "",
    "User-agent: *",
    "Allow: /",
    "",
    "# Private application surfaces — not indexable, no crawl value.",
    "Disallow: /admin",
    "Disallow: /onboarding",
    "Disallow: /reset-password",
    "Disallow: /forgot-password",
    "Disallow: /auth/callback",
    "Disallow: /profile",
    "Disallow: /notifications",
    "Disallow: /messages",
    "Disallow: /session-replay",
    "Disallow: /referral",
    "Disallow: /wallet",
    "Disallow: /style-guide",
    "",
    "# API — except the SEO endpoints crawlers must reach.",
    "Disallow: /api/",
    "Allow: /api/sitemap.xml",
    "Allow: /api/sitemap-",
    "Allow: /api/robots.txt",
    "Allow: /api/og",
    "",
    "# Build artifacts",
    "Disallow: /*.map$",
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
  ].join("\n"));
});

export { router as sitemapRouter };
export { EXAM_SLUGS, SEGMENTS, URLS_PER_SHARD };
