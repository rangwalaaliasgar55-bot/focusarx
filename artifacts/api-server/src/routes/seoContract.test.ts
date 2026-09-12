import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEGMENTS, lastmodFor } from "./sitemap";

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
  const { paths } = await prerenderManifest();
  return paths;
}

/**
 * The manifest's paths *and* its `noindex` flags.
 *
 * A prerendered page is not automatically an indexable page. `/search` is built
 * as a document (so a shared link gets a real title instead of the homepage's)
 * but is flagged `noindex: true`, because internal search results are thin,
 * near-duplicate pages with an unbounded `?q=` space. Treating "prerendered"
 * as "must be in the sitemap" is what made that flag impossible to set: the
 * contract test failed the moment the page was correctly de-indexed.
 */
async function prerenderManifest(): Promise<{
  paths: Set<string>;
  noindex: Set<string>;
  lastReviewed: Map<string, string>;
}> {
  const mod = (await import(PRERENDER_MJS)) as {
    ROUTES: Array<{ path: string; noindex?: boolean; lastReviewed?: string }>;
  };
  const paths = new Set<string>();
  const noindex = new Set<string>();
  const lastReviewed = new Map<string, string>();
  for (const entry of mod.ROUTES) {
    // The manifest uses "" for the homepage; the sitemap uses "/".
    const url = entry.path === "" ? "/" : entry.path;
    paths.add(url);
    if (entry.noindex === true) noindex.add(url);
    if (typeof entry.lastReviewed === "string" && entry.lastReviewed) lastReviewed.set(url, entry.lastReviewed);
  }
  return { paths, noindex, lastReviewed };
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
    const { paths: prerendered, noindex } = await prerenderManifest();
    const { protectedRoutes } = appRoutes();
    const disallowed = await robotsDisallowed();

    // Prerendering a login-walled, robots-disallowed or noindex page is correct —
    // a shared link still needs a good social preview — but those URLs are
    // intentionally OUT of the sitemap. Only indexable public pages must be in.
    const orphaned = [...prerendered]
      .filter((url) => !inSitemap.has(url))
      .filter((url) => !protectedRoutes.has(url))
      .filter((url) => !noindex.has(url))
      .filter((url) => isBlocked(url, disallowed) === null)
      .sort();

    expect(
      orphaned,
      `Indexable prerendered pages missing from the sitemap (discovery falls back to internal links alone): ${orphaned.join(", ")}`,
    ).toEqual([]);
  });

  it("no noindex page is offered in the sitemap", async () => {
    const { noindex } = await prerenderManifest();
    const inSitemap = sitemapUrls();
    const contradictory = [...noindex].filter((url) => inSitemap.has(url)).sort();

    // Asking Google to drop a URL and simultaneously handing it the same URL in
    // the sitemap wastes crawl budget and makes the intent unreadable. The two
    // lists must stay disjoint.
    expect(
      contradictory,
      `noindex pages that are also in the sitemap (contradictory signals): ${contradictory.join(", ")}`,
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
    const declared = [...xml.matchAll(/<loc>https:\/\/www\.focusarx\.site\/(sitemap-[^<]+\.xml)<\/loc>/g)]
      .map((m) => m[1]!)
      .sort();
    const fromApi = SEGMENTS.map((s) => s.file).sort();
    // The static index also advertises the dynamic profile shard, which the
    // API appends at request time and SEGMENTS does not contain.
    const declaredWithoutProfiles = declared.filter((f) => !f.startsWith("sitemap-profiles"));
    expect(declaredWithoutProfiles).toEqual(fromApi);
  });

  it("the static sitemap fallback advertises the same lastmod the API computes", () => {
    const xml = fs.readFileSync(STATIC_SITEMAP, "utf8");
    const declared = new Map<string, string | undefined>();
    const block = /<sitemap>([\s\S]*?)<\/sitemap>/g;
    let m: RegExpExecArray | null;
    while ((m = block.exec(xml))) {
      const file = /\/(sitemap-[^<]+\.xml)</.exec(m[1]!)?.[1];
      if (!file) continue;
      declared.set(file, /<lastmod>([^<]+)<\/lastmod>/.exec(m[1]!)?.[1]);
    }

    const drift: string[] = [];
    for (const segment of SEGMENTS) {
      const dates = segment.pages
        .map((pg) => pg.lastmod ?? lastmodFor(pg.url, segment.file))
        .filter((d): d is string => Boolean(d))
        .sort();
      const fromApi = dates.at(-1);
      const fromStatic = declared.get(segment.file);
      if (fromApi !== fromStatic) {
        drift.push(`${segment.file}: static ${fromStatic ?? "(no lastmod)"} vs API ${fromApi ?? "(no lastmod)"}`);
      }
    }
    expect(
      drift,
      `The checked-in sitemap index and the API disagree about when a segment last changed: ${drift.join(", ")}`,
    ).toEqual([]);
  });

  it("every internal link in the intent-page content resolves to a real page", async () => {
    const prerendered = await prerenderPaths();
    const routes = appRoutes();
    const reachable = new Set([...prerendered, ...routes.publicRoutes]);
    // Compare on the path only: a CTA may carry a deep-link query
    // (`/focus?duration=45` pre-arms the timer), which resolves to the /focus
    // route. The query is intent, not a different page — scripts/seo-validate.mjs
    // strips it the same way before checking for broken links.
    const isReachable = (t: string) => {
      const path = t.split(/[?#]/)[0] || "/";
      return reachable.has(path) || routeCovers(path, routes);
    };

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
    const broken = parseDirectiveLines(buildRobotsTxt("https://www.focusarx.site")).filter((entry) => entry.error);
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
    const generatedSet = wildcardDisallows(buildRobotsTxt("https://www.focusarx.site"));

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

/**
 * Public profiles (/u/<name>) — out of the sitemap, de-indexed at the edge.
 * ══════════════════════════════════════════════════════════════════
 * `sitemap-profiles-1.xml` used to list 11,978 `/u/<name>` URLs against ~89
 * real pages. Every one of them served the *homepage* document: the route is
 * client-rendered and absent from the prerender manifest, so Vercel's SPA
 * fallback answered with index.html — homepage title, homepage JSON-LD and
 * `<link rel="canonical" href="https://www.focusarx.site/">`. Twelve thousand
 * URLs canonicalising to one page is not extra coverage, it is the
 * "Discovered – currently not indexed" backlog, and it burns the crawl budget
 * the 89 pages that can rank actually need.
 *
 * Rendered, they are no better: a typical profile is a name, "0 friends",
 * Level 1, 0 sessions, 0 focus hours, 0 badges and no bio, and the data would
 * come from `/api/u/…`, which robots.txt disallows — a crawler cannot fetch it
 * even when it does run JS. Most of the emitted URLs did not resolve at all:
 * the shard slugified names (`Varun Warrier` → `Varun-Warrier`) while
 * `/api/u/:username` matches the raw name, so every multi-word name 404'd.
 *
 * The decision these tests pin down: profiles are noindexed (not merely
 * unlisted) and stay crawlable so Google can see the noindex.
 */
describe("public profiles: out of the sitemap, noindexed, still crawlable", async () => {
  const VERCEL = path.join(FRONTEND, "../../vercel.json");

  it("no segment lists a /u/ profile URL", () => {
    const profileUrls = [...sitemapUrls()].filter((url) => url === "/u" || url.startsWith("/u/"));
    expect(
      profileUrls,
      "Profile URLs are thin, client-rendered duplicates of the homepage shell — " +
        `they must not be in the sitemap: ${profileUrls.join(", ")}`,
    ).toEqual([]);
  });

  it("the emitted sitemap index advertises the static segments and no profile shard", async () => {
    // Asserted over HTTP rather than by reading the source: the index is what
    // Google actually fetches, and the shard entries used to be appended at
    // request time from a COUNT(*) over the users table.
    const express = (await import("express")).default;
    const { sitemapRouter } = (await import("./sitemap.ts")) as {
      sitemapRouter: import("express").Router;
    };
    const app = express();
    app.use(sitemapRouter);
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("no port");
      const base = `http://127.0.0.1:${address.port}`;

      const index = await (await fetch(`${base}/sitemap.xml`)).text();
      const locs = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
      expect(locs.map((l) => l.replace(/^https:\/\/www\.focusarx\.site\//, "")).sort())
        .toEqual(SEGMENTS.map((s) => s.file).sort());

      // The retired shard must still answer 200 with an empty urlset while
      // Search Console holds the URL — a 404 there reads as "Couldn't fetch".
      const res = await fetch(`${base}/sitemap-profiles-1.xml`);
      expect(res.status, "retired profile shard should not 404").toBe(200);
      const body = await res.text();
      expect(body).toContain("<urlset");
      expect([...body.matchAll(/<loc>/g)], "retired profile shard must be empty").toEqual([]);
    } finally {
      server.close();
    }
  });

  it("robots.txt leaves /u/ crawlable so the noindex can be seen", async () => {
    // Deliberate: Google only honours a noindex on a page it may fetch. Adding
    // `Disallow: /u/` would stop the crawl and leave the URLs listed as
    // "Indexed, though blocked by robots.txt".
    const patterns = await robotsDisallowed();
    const blocking = patterns.filter((p) => p === "/u" || p.startsWith("/u/"));
    expect(
      blocking,
      `/u/ must stay crawlable — it is de-indexed with X-Robots-Tag, not blocked: ${blocking.join(", ")}`,
    ).toEqual([]);
  });

  it("vercel.json de-indexes /u/ with an X-Robots-Tag header", () => {
    // The HTML at /u/<name> is the homepage shell, which carries
    // `robots: index, follow` — the header is the only signal a crawler that
    // does not execute JS can act on, so it has to come from the edge.
    const cfg = JSON.parse(fs.readFileSync(VERCEL, "utf8")) as {
      routes?: Array<{ src?: string; dest?: string; headers?: Record<string, string> }>;
    };
    const route = (cfg.routes ?? []).find(
      (r) => r.src?.startsWith("/u/") && /noindex/.test(r.headers?.["X-Robots-Tag"] ?? ""),
    );
    expect(route, "no vercel.json route sets X-Robots-Tag: noindex for /u/<name>").toBeTruthy();
    // It must serve the SPA like the catch-all does, and sit after the
    // filesystem handler so a future prerendered profile page still wins.
    expect(route?.dest).toBe("/index.html");
    const srcs = (cfg.routes ?? []).map((r) => r.src);
    const fsIdx = (cfg.routes ?? []).findIndex((r) => (r as { handle?: string }).handle === "filesystem");
    expect(srcs.indexOf(route?.src)).toBeGreaterThan(fsIdx);
  });

  it("the profile page sets a matching meta robots tag", () => {
    const src = fs.readFileSync(path.join(FRONTEND, "src/pages/user-profile.tsx"), "utf8");
    expect(src).toContain('"noindex, nofollow"');
    // …and must not undo it when the user navigates on to an indexable page.
    expect(src).toMatch(/prevRobots/);
  });
});

/**
 * sitemap lastmod: a review date somebody can stand behind.
 * ══════════════════════════════════════════════════════════
 * `urlsetXml` used to fall back to today's date for any page without an
 * explicit `lastmod`, which is most of them — so every deploy rewrote the
 * modification date of all 119 URLs. Google treats a chronically wrong lastmod
 * as a reason to ignore the field, and the freshness signal the byline and the
 * Article/BlogPosting `dateModified` are meant to send then arrives from three
 * places that disagree.
 *
 * The server cannot import the frontend package at runtime (separate deploys),
 * so the dates are mirrored in sitemap.ts and asserted equal here, page by
 * page, against `scripts/prerender-data.mjs`.
 */
describe("sitemap lastmod: real review dates, mirrored from the prerender manifest", async () => {
  it("agrees with the manifest for every page that has a review date", async () => {
    const { lastReviewed } = await prerenderManifest();
    const mismatched: string[] = [];
    const missingFromSitemap: string[] = [];

    const advertised = new Map<string, string>();
    for (const segment of SEGMENTS) {
      for (const page of segment.pages) {
        const date = page.lastmod ?? lastmodFor(page.url, segment.file);
        if (date) advertised.set(page.url, date);
      }
    }

    for (const [url, date] of lastReviewed) {
      const got = advertised.get(url);
      if (!got) {
        // Only a sitemap-listed URL can advertise a date.
        if ([...sitemapUrls()].includes(url)) missingFromSitemap.push(`${url} (manifest says ${date})`);
        continue;
      }
      if (got !== date) mismatched.push(`${url}: sitemap ${got} vs manifest ${date}`);
    }

    expect(
      mismatched,
      `sitemap lastmod disagrees with the visible "Last updated" and the schema dateModified: ${mismatched.join(", ")}`,
    ).toEqual([]);
    expect(
      missingFromSitemap,
      `sitemap-listed pages with a review date that emit no <lastmod>: ${missingFromSitemap.join(", ")}`,
    ).toEqual([]);
  });

  it("never advertises a date the manifest does not have", async () => {
    const { lastReviewed } = await prerenderManifest();
    const invented: string[] = [];
    for (const segment of SEGMENTS) {
      for (const page of segment.pages) {
        const date = page.lastmod ?? lastmodFor(page.url, segment.file);
        if (date && !lastReviewed.has(page.url)) invented.push(`${page.url} (${date})`);
      }
    }
    expect(
      invented,
      `These URLs advertise a lastmod with no matching manifest review date — either add it to prerender-data.mjs or drop it here: ${invented.join(", ")}`,
    ).toEqual([]);
  });

  it("emits no lastmod for pages whose review date is unknown", () => {
    // Omission beats a guess. The homepage, the app routes and the legal pages
    // have no dated review, so they must not carry one.
    for (const url of ["/", "/login", "/signup", "/pricing", "/terms", "/privacy"]) {
      expect(lastmodFor(url, "sitemap-core.xml"), `${url} should omit <lastmod>`).toBeUndefined();
      expect(lastmodFor(url, "sitemap-legal.xml"), `${url} should omit <lastmod>`).toBeUndefined();
    }
  });

  it("emits <lastmod> over HTTP only where a review date exists", async () => {
    // Asserted over the wire, not by reading the tables: the XML is what a
    // crawler fetches, and "omit when unknown" is exactly the kind of rule that
    // a helpful default (`?? today()`) silently reverses.
    const express = (await import("express")).default;
    const { sitemapRouter } = (await import("./sitemap.ts")) as {
      sitemapRouter: import("express").Router;
    };
    const app = express();
    app.use(sitemapRouter);
    const server = app.listen(0);

    /** loc → lastmod, with undefined meaning the element was omitted. */
    const entriesOf = (xml: string) => {
      const map = new Map<string, string | undefined>();
      const block = /<url>([\s\S]*?)<\/url>/g;
      let m: RegExpExecArray | null;
      while ((m = block.exec(xml))) {
        const loc = /<loc>([^<]+)<\/loc>/.exec(m[1]!)?.[1]?.replace(/^https:\/\/www\.focusarx\.site/, "") ?? "";
        map.set(loc, /<lastmod>([^<]+)<\/lastmod>/.exec(m[1]!)?.[1]);
      }
      return map;
    };

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("no port");
      const base = `http://127.0.0.1:${address.port}`;

      const guides = entriesOf(await (await fetch(`${base}/sitemap-guides.xml`)).text());
      expect(guides.get("/focus-guide"), "rewritten guide library").toBe("2026-09-11");
      expect(guides.get("/deep-work-guide"), "guide reviewed with the SEO set").toBe("2026-08-29");
      expect(guides.get("/study-timer-for-medical-students"), "audience page").toBe("2026-09-11");
      expect(guides.get("/guides"), "an index of guides has no review date of its own").toBeUndefined();

      const core = entriesOf(await (await fetch(`${base}/sitemap-core.xml`)).text());
      expect(core.get("/focus"), "app page, dated with the app").toBe("2026-09-04");
      expect(core.get("/about"), "editorial standards copy").toBe("2026-09-11");
      for (const undated of ["/", "/signup", "/login", "/pricing", "/study-rooms", "/leaderboard"]) {
        expect(core.get(undated), `${undated} has no dated review`).toBeUndefined();
      }

      const legal = await (await fetch(`${base}/sitemap-legal.xml`)).text();
      expect([...legal.matchAll(/<lastmod>/g)], "no policy page has a dated review").toEqual([]);

      // The index dates each child with the newest date inside it — and omits
      // the date for a segment whose pages have none.
      const index = await (await fetch(`${base}/sitemap.xml`)).text();
      const children = new Map<string, string | undefined>();
      const childBlock = /<sitemap>([\s\S]*?)<\/sitemap>/g;
      let bm: RegExpExecArray | null;
      while ((bm = childBlock.exec(index))) {
        const file = /\/(sitemap-[^<]+\.xml)</.exec(bm[1]!)?.[1];
        if (file) children.set(file, /<lastmod>([^<]+)<\/lastmod>/.exec(bm[1]!)?.[1]);
      }
      expect(children.get("sitemap-guides.xml"), "newest date in the guides segment").toBe("2026-09-11");
      expect(children.get("sitemap-core.xml"), "/about was reviewed today").toBe("2026-09-11");
      expect(children.get("sitemap-trust.xml")).toBe("2026-08-29");
      expect(children.get("sitemap-legal.xml"), "a segment with no dated pages gets no date").toBeUndefined();
      expect(children.size, "every segment must be described").toBe(SEGMENTS.length);
    } finally {
      server.close();
    }
  });

  it("never advertises a date in the future", () => {
    const today = new Date().toISOString().slice(0, 10);
    const future: string[] = [];
    for (const segment of SEGMENTS) {
      for (const page of segment.pages) {
        const date = page.lastmod ?? lastmodFor(page.url, segment.file);
        if (date && date > today) future.push(`${page.url} (${date})`);
      }
    }
    expect(future, `lastmod dates in the future: ${future.join(", ")}`).toEqual([]);
  });
});
