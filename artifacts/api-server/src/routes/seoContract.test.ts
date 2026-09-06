import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEGMENTS } from "./sitemap";

/**
 * SEO contract guard — the four places a public URL must agree.
 * ══════════════════════════════════════════════════════════════════
 * A public URL has to appear in four independent files before it can
 * actually rank:
 *
 *   1. `src/App.tsx`                  — a <Route>, or the URL 404s
 *   2. `scripts/prerender-data.mjs`   — a manifest entry, or crawlers that
 *                                        don't run JS see the homepage title
 *   3. `src/routes/sitemap.ts`        — a sitemap entry, or discovery relies
 *                                        on internal links alone
 *   4. `public/robots.txt`            — not Disallow:ed, or all of the above
 *                                        is wasted
 *
 * None of those are checked by the compiler, and the failure mode is silent:
 * the build passes, the page renders in the browser, and the URL simply never
 * ranks. Two real instances of this drift:
 *
 *   • `/focus-timer` had a page component AND a PAGE_SEO entry AND a lazy
 *     import in App.tsx — but no <Route>. It 404'd for the single
 *     highest-intent query in the category, and nothing caught it.
 *   • `robots.txt` Disallow:ed /dashboard while the sitemap listed it —
 *     contradictory signals that burn crawl budget.
 *
 * This test makes all four lists mutually assertive.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(here, "../../../focusarx");
const APP_TSX = path.join(FRONTEND, "src/App.tsx");
const PRERENDER_MJS = path.join(FRONTEND, "scripts/prerender-data.mjs");
const ROBOTS = path.join(FRONTEND, "public/robots.txt");
const STATIC_SITEMAP = path.join(FRONTEND, "public/sitemap.xml");
const SEO_PAGES_MJS = path.join(FRONTEND, "src/content/seo-pages.mjs");

/** Every URL in the static (non-profile) sitemap segments. */
function sitemapUrls(): Set<string> {
  const urls = new Set<string>();
  for (const segment of SEGMENTS) {
    for (const page of segment.pages) urls.add(page.url);
  }
  return urls;
}

/**
 * Public <Route path="..."> values from App.tsx.
 *
 * Login-walled routes are deliberately excluded: they are wrapped in
 * <ProtectedRoute>, redirect anonymous crawlers to /login, and must NOT be in
 * the sitemap. We parse the wrapper to tell them apart rather than keeping a
 * second hand-maintained list.
 */
interface AppRoutes {
  publicRoutes: Set<string>;
  protectedRoutes: Set<string>;
  /** Public patterns containing a `:param`, e.g. `/exam/:slug`. */
  paramPatterns: string[];
}

function appRoutes(): AppRoutes {
  const src = fs.readFileSync(APP_TSX, "utf8");
  const publicRoutes = new Set<string>();
  const protectedRoutes = new Set<string>();
  const paramPatterns: string[] = [];
  const re = /<Route\s+path="([^"]+)"\s+component=\{([^]*?)\}\s*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const routePath = m[1]!;
    const body = m[2]!;
    const isProtected = body.includes("ProtectedRoute");
    if (routePath.includes(":")) {
      // A param route covers a whole family of sitemap URLs (/exam/jee-main,
      // /comparison/focusarx-vs-forest). Record the pattern so those URLs can
      // be matched instead of being silently skipped — skipping them made the
      // test report 20 live URLs as 404s.
      if (!isProtected) paramPatterns.push(routePath);
      continue;
    }
    (isProtected ? protectedRoutes : publicRoutes).add(routePath);
  }
  return { publicRoutes, protectedRoutes, paramPatterns };
}

/**
 * Does a public route serve this URL? Handles both static routes and
 * `/prefix/:param` patterns, matching wouter's segment-wise matching.
 */
function routeCovers(url: string, routes: AppRoutes): boolean {
  if (routes.publicRoutes.has(url)) return true;
  const segments = url.split("/").filter(Boolean);
  return routes.paramPatterns.some((pattern) => {
    const pSegs = pattern.split("/").filter(Boolean);
    if (pSegs.length !== segments.length) return false;
    return pSegs.every((p, i) => p.startsWith(":") || p === segments[i]);
  });
}

/** Paths in the prerender manifest, resolved through the dynamic imports. */
async function prerenderPaths(): Promise<Set<string>> {
  const mod = (await import(PRERENDER_MJS)) as { ROUTES: Array<{ path: string }> };
  // The manifest uses "" for the homepage; the sitemap uses "/".
  return new Set(mod.ROUTES.map((r) => (r.path === "" ? "/" : r.path)));
}

/**
 * The `User-agent: *` group's Disallows, read with the same strict parser the
 * prerenderer and scripts/seo-validate.mjs use. The regex this function used to
 * apply matched one directive per line and silently *skipped* a line where two
 * directives had been glued together (`Disallow: /adminDisallow: /onboarding`) —
 * so the file read as "nothing private is blocked" while still looking fine.
 */
async function robotsDisallowed(): Promise<string[]> {
  const { parseRobots } = await loadRobotsParser();
  const { groups } = parseRobots(fs.readFileSync(ROBOTS, "utf8"));
  return (groups.get("*")?.disallow ?? []).map((p: string) => p.replace(/\/$/, ""));
}

/**
 * The frontend's robots parser, shared rather than reimplemented: an assertion about
 * robots.txt is only worth having if it reads the format the same way the build does.
 */
async function loadRobotsParser(): Promise<{
  parseRobots: (text: string) => { groups: Map<string, { allow: string[]; disallow: string[] }>; errors: Array<{ line: number; raw: string; error?: string }> };
  parseDirectiveLines: (text: string) => Array<{ line: number; raw: string; field?: string; value?: string; error?: string }>;
}> {
  const { pathToFileURL } = await import("node:url");
  return import(pathToFileURL(path.join(FRONTEND, "src/lib/robots-parse.mjs")).href) as never;
}

/** Does a robots Disallow pattern block this URL? */
function isBlocked(url: string, patterns: string[]): string | null {
  for (const p of patterns) {
    // `/*.map$` and `/src/` style patterns are not URL prefixes we care about.
    if (p.includes("*") || p.includes("$")) continue;
    if (url === p || url.startsWith(`${p}/`)) return p;
  }
  return null;
}

describe("SEO contract: sitemap, routes, prerender manifest and robots.txt agree", async () => {
  it("every sitemap URL has a public <Route> in App.tsx", () => {
    const routes = appRoutes();
    const missing = [...sitemapUrls()]
      .filter((url) => url !== "/" && !routeCovers(url, routes))
      .sort();
    expect(missing, `Sitemap lists URLs with no route (they would 404): ${missing.join(", ")}`).toEqual([]);
  });

  it("every sitemap URL is prerendered", async () => {
    const prerendered = await prerenderPaths();
    const missing = [...sitemapUrls()].filter((url) => !prerendered.has(url)).sort();
    expect(
      missing,
      `Sitemap lists URLs with no prerender entry (crawlers without JS see the homepage head): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every PUBLIC prerendered page is in the sitemap", async () => {
    const inSitemap = sitemapUrls();
    const prerendered = await prerenderPaths();
    const { protectedRoutes } = appRoutes();
    const disallowed = await robotsDisallowed();

    // Prerendering a login-walled or robots-disallowed page is correct — a
    // shared link still needs a good social preview — but those URLs are
    // intentionally OUT of the sitemap. Only indexable public pages must be in.
    const orphaned = [...prerendered]
      .filter((url) => !inSitemap.has(url))
      .filter((url) => !protectedRoutes.has(url))
      .filter((url) => isBlocked(url, disallowed) === null)
      .sort();

    expect(
      orphaned,
      `Indexable prerendered pages missing from the sitemap (discovery falls back to internal links alone): ${orphaned.join(", ")}`,
    ).toEqual([]);
  });

  it("no sitemap URL is Disallow:ed in robots.txt", async () => {
    const patterns = await robotsDisallowed();
    const conflicts = [...sitemapUrls()]
      .map((url) => ({ url, blockedBy: isBlocked(url, patterns) }))
      .filter((c) => c.blockedBy !== null);
    expect(
      conflicts,
      `robots.txt blocks URLs the sitemap asks Google to crawl: ${conflicts
        .map((c) => `${c.url} (Disallow: ${c.blockedBy})`)
        .join(", ")}`,
    ).toEqual([]);
  });

  it("no login-walled route is in the sitemap", () => {
    const { protectedRoutes } = appRoutes();
    const inSitemap = sitemapUrls();
    const leaked = [...protectedRoutes].filter((url) => inSitemap.has(url)).sort();
    expect(
      leaked,
      `ProtectedRoute pages must not be in the sitemap — they redirect crawlers to /login and read as soft-404s: ${leaked.join(", ")}`,
    ).toEqual([]);
  });

  it("the static sitemap fallback lists exactly the segments the API emits", () => {
    const xml = fs.readFileSync(STATIC_SITEMAP, "utf8");
    const declared = [...xml.matchAll(/<loc>https:\/\/focusarx\.site\/(sitemap-[^<]+\.xml)<\/loc>/g)]
      .map((m) => m[1]!)
      .sort();
    const fromApi = SEGMENTS.map((s) => s.file).sort();
    // The static index also advertises the dynamic profile shard, which the
    // API appends at request time and SEGMENTS does not contain.
    const declaredWithoutProfiles = declared.filter((f) => !f.startsWith("sitemap-profiles"));
    expect(declaredWithoutProfiles).toEqual(fromApi);
  });

  it("every internal link in the intent-page content resolves to a real page", async () => {
    const prerendered = await prerenderPaths();
    const routes = appRoutes();
    const reachable = new Set([...prerendered, ...routes.publicRoutes]);
    const isReachable = (t: string) => reachable.has(t) || routeCovers(t, routes);

    const mod = (await import(SEO_PAGES_MJS)) as {
      SEO_PAGES: Record<string, { related: string[]; cta: { href: string } }>;
      COMPARISON_PATHS: string[];
    };

    const broken: string[] = [];
    for (const [pagePath, entry] of Object.entries(mod.SEO_PAGES)) {
      const targets = [...entry.related.map((r) => String(r).split("|")[0]!), entry.cta.href];
      for (const target of targets) {
        if (!isReachable(target)) broken.push(`${pagePath} → ${target}`);
      }
    }
    expect(broken, `Broken internal links in seo-pages.mjs: ${broken.join(", ")}`).toEqual([]);
  });

  it("comparison pages are routed by slug, not hardcoded per-competitor", async () => {
    const src = fs.readFileSync(APP_TSX, "utf8");
    expect(src).toContain('<Route path="/comparison/:slug"');
    const mod = (await import(SEO_PAGES_MJS)) as { COMPARISON_PATHS: string[] };
    const inSitemap = sitemapUrls();
    const missing = mod.COMPARISON_PATHS.filter((p) => !inSitemap.has(p));
    expect(missing, `Comparison pages missing from the sitemap: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("robots.txt: the static copy and the API-generated copy agree", async () => {
  it("the checked-in file is one directive per line, with no merged or stray lines", async () => {
    const { parseDirectiveLines } = await loadRobotsParser();
    const broken = parseDirectiveLines(fs.readFileSync(ROBOTS, "utf8")).filter((entry) => entry.error);
    expect(
      broken.map((entry) => `line ${entry.line}: ${entry.raw}`),
      "robots.txt has lines a crawler cannot parse — every Disallow after the bad one is still honoured, but the bad one blocks nothing"
    ).toEqual([]);
  });

  it("the generated file is too", async () => {
    const { parseDirectiveLines } = await loadRobotsParser();
    const { buildRobotsTxt } = (await import("./sitemap.ts")) as { buildRobotsTxt: (base: string) => string };
    const broken = parseDirectiveLines(buildRobotsTxt("https://focusarx.site")).filter((entry) => entry.error);
    expect(broken.map((entry) => `line ${entry.line}: ${entry.raw}`)).toEqual([]);
  });

  it("lists the same private paths in both copies", async () => {
    // Two answers to /robots.txt is already a compromise (the static file wins on the
    // production host, this route answers for a standalone API); disagreeing about
    // *which* paths are private is the part that actually hurts — a page one copy
    // blocks and the other invites is a page that gets crawled and then complained
    // about, or a login screen that gets indexed.
    const { parseRobots } = await loadRobotsParser();
    const { ROBOTS_PRIVATE_PATHS, buildRobotsTxt } = (await import("./sitemap.ts")) as {
      ROBOTS_PRIVATE_PATHS: readonly string[];
      buildRobotsTxt: (base: string) => string;
    };
    const wildcardDisallows = (text: string) =>
      new Set(parseRobots(text).groups.get("*")?.disallow ?? []);
    const staticSet = wildcardDisallows(fs.readFileSync(ROBOTS, "utf8"));
    const generatedSet = wildcardDisallows(buildRobotsTxt("https://focusarx.site"));

    expect(
      [...staticSet].filter((path) => !generatedSet.has(path)),
      "disallowed by public/robots.txt but crawlable per the API's generated copy"
    ).toEqual([]);
    expect(
      [...generatedSet].filter((path) => !staticSet.has(path)),
      "blocked by the API's generated copy but absent from public/robots.txt"
    ).toEqual([]);
    // The list lives in one place, and the generator emits it rather than repeating it.
    expect(ROBOTS_PRIVATE_PATHS.length).toBe(generatedSet.size);
    expect(generatedSet.size).toBeGreaterThan(10);
  });
});
