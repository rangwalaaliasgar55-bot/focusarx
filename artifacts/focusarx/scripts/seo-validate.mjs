/**
 * Post-build SEO validation over the prerendered pages in dist/public.
 *
 * Complements the route/sitemap/robots contract tests (seoContract,
 * regressionGuard) by checking the actual emitted HTML: every page needs a
 * unique title and description, an apex-host canonical, parseable JSON-LD,
 * and the sitemap must not reference pages that were never prerendered.
 *
 * Run after `vite build && node scripts/prerender.mjs`:
 *   node scripts/seo-validate.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { isDisallowed, parseRobots } from "../src/lib/robots-parse.mjs";
import { clampText, DESCRIPTION_BUDGET, MIN_SNIPPET, PAGE_TITLE_BUDGET } from "../src/lib/seo-text.mjs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/public", import.meta.url));
const CANONICAL_HOST = "https://focusarx.site";

/** Routes that are intentionally not in the sitemap (auth/private screens). */
const NON_SITEMAP_ALLOWLIST = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/onboarding",
  "/404",
]);

/**
 * Routes allowed to carry `noindex` with nothing to say about them in robots.txt.
 * A signup page is worth ranking; an app screen is not. The prerender manifest is
 * consulted too (see the ROUTES pass below), so a deliberate `noindex: true` there
 * never has to be repeated in this list.
 */
const manifestNoindex = new Set();
const NON_INDEXABLE = new Set(["/login", "/signup", "/forgot-password", "/reset-password", "/404"]);

function walkHtml(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, acc);
    else if (entry.endsWith(".html")) acc.push(full);
  }
  return acc;
}

const problems = [];
const titles = new Map();
const descriptions = new Map();

const files = walkHtml(DIST);

// The prerender manifest, read once and reused: its `noindex` flags exempt a route
// from the indexability parity check below, and its copy is itself gated further down.
const { ROUTES: manifestRoutes } = await import(new URL("./prerender-data.mjs", import.meta.url).href);
for (const entry of manifestRoutes) {
  if (entry.noindex === true) manifestNoindex.add(entry.path === "" ? "/" : `/${String(entry.path).replace(/^\/+/, "")}`);
}

// One strict parser (src/lib/robots-parse.mjs) for the same file the prerenderer
// reads, so the gate cannot pass a document the generator would have rejected.
const robots = readFileSync(join(DIST, "robots.txt"), "utf8");
const { groups: robotsGroups, errors: robotsErrors } = parseRobots(robots);
for (const entry of robotsErrors) {
  problems.push(`robots.txt line ${entry.line}: ${entry.error} (${JSON.stringify(entry.raw)})`);
}
const sitemapDirective = robots.match(/^Sitemap:\s*(\S+)$/m)?.[1];
if (!sitemapDirective) problems.push("robots.txt: missing Sitemap directive");
else if (!sitemapDirective.startsWith(CANONICAL_HOST)) problems.push(`robots.txt sitemap is not the apex host (${sitemapDirective})`);

for (const file of files) {
  const route = relative(DIST, file).replace(/index\.html$/, "").replace(/\.html$/, "");
  const routePath = route ? `/${route}` : "/";
  const html = readFileSync(file, "utf8");

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim();
  if (!title) problems.push(`${routePath}: missing <title>`);
  else if (titles.has(title)) problems.push(`${routePath}: duplicate title "${title}" (also on ${titles.get(title)})`);
  else titles.set(title, routePath);

  const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1]?.trim();

  // Search-result real estate is measured, not felt. Google clips the title at
  // roughly 580px (~60 characters) and the description at ~160: a page that runs
  // past that loses the end of its own sentence to an ellipsis, so the length is
  // gated here at build time instead of tuned by eye. `composeTitle` in
  // components/PageSEO.tsx owns the same budget at runtime.
  if (title) {
    const unescaped = title.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    if (unescaped.length > 60) problems.push(`${routePath}: title is ${unescaped.length} chars, over the 60-char budget and will be clipped — "${unescaped}"`);
    if (unescaped.length < 10) problems.push(`${routePath}: title is ${unescaped.length} chars, too thin to rank on its own — "${unescaped}"`);
  }
  if (desc) {
    const unescapedDesc = desc.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    if (unescapedDesc.length > 160) problems.push(`${routePath}: description is ${unescapedDesc.length} chars, over the 160-char budget and will be clipped`);
    if (unescapedDesc.length < MIN_SNIPPET) problems.push(`${routePath}: description is ${unescapedDesc.length} chars, below the ${MIN_SNIPPET}-char floor (thin snippet)`);
  }
  {
    // A page robots.txt disallows is not removed from the index — the crawler just
    // stops fetching it, so any URL it already knows keeps ranking with a
    // description-less snippet. Disallowed routes must say `noindex` in the HTML
    // too, which only works for routes it can still reach. The two must agree.
    const robotsMeta = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/)?.[1] ?? "";
    const disallowed = isDisallowed(routePath, robotsGroups.get("*"));
    const noindexed = /noindex/i.test(robotsMeta);
    if (disallowed && !noindexed) problems.push(`${routePath}: disallowed in robots.txt but indexable — add noindex or remove the Disallow`);
    if (noindexed && !disallowed && !NON_INDEXABLE.has(routePath) && !manifestNoindex.has(routePath)) problems.push(`${routePath}: marked noindex but not disallowed in robots.txt (it will be crawled and dropped from the index on trust)`);
  }
  if (!desc) problems.push(`${routePath}: missing meta description`);
  else if (descriptions.has(desc)) problems.push(`${routePath}: duplicate description (also on ${descriptions.get(desc)})`);
  else descriptions.set(desc, routePath);

  for (const canonical of html.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/g)) {
    if (canonical[1].startsWith("www.") || canonical[1].includes("://www.")) {
      problems.push(`${routePath}: canonical points at www host (${canonical[1]})`);
    }
    if (!canonical[1].startsWith(CANONICAL_HOST)) {
      problems.push(`${routePath}: canonical is not the apex host (${canonical[1]})`);
    }
  }

  for (const og of html.matchAll(/<meta\s+property="og:url"\s+content="([^"]*)"/g)) {
    if (!og[1].startsWith(CANONICAL_HOST)) problems.push(`${routePath}: og:url is not the apex host (${og[1]})`);
  }

  // JSON-LD blocks must parse.
  for (const ld of html.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(ld[1]);
    } catch (error) {
      problems.push(`${routePath}: invalid JSON-LD (${error.message})`);
    }
  }

  // No www URLs in any machine-readable URL field.
  for (const url of html.matchAll(/(?:href|content)="(https?:\/\/www\.focusarx\.site[^"]*)"/g)) {
    problems.push(`${routePath}: www URL in metadata (${url[1]})`);
  }
}

// ── The prerender manifest, before the clamp hides it ──────────────────
// prerender.mjs runs every manifest string through composeTitle/clampText, so a
// too-long entry would still emit valid HTML — the copy would just be quietly cut.
// The manifest is the crawler-facing source of truth (it is what a scraper and a
// JS-less crawl receive), so it is checked at the source instead.
{
  const pageBudget = PAGE_TITLE_BUDGET;
  for (const entry of manifestRoutes) {
    const label = `prerender manifest ${entry.path || "/"}`;
    const stripped = String(entry.title ?? "").replace(/\s*[|—–]\s*FocusArx\s*$/, "").trim();
    if (clampText(stripped, pageBudget, { fullStop: false }) !== stripped) {
      problems.push(`${label}: title is ${stripped.length} chars, over the ${pageBudget}-char page budget — write shorter copy rather than letting it be clipped: "${stripped}"`);
    }
    const desc = String(entry.description ?? "").replace(/\s+/g, " ").trim();
    if (clampText(desc, DESCRIPTION_BUDGET) !== desc) {
      problems.push(`${label}: description is ${desc.length} chars, over the ${DESCRIPTION_BUDGET}-char budget — it is clipped mid-sentence in every search result`);
    }
  }
}

// Sitemap ↔ prerendered pages diff. sitemap.xml is an index; in production
// vercel.json rewrites /sitemap.xml and /sitemap-*.xml to the API function,
// so child sitemaps usually do not exist in the static dist. When a child
// file is present locally (preview builds) merge it in; otherwise the
// page↔sitemap coverage diff is left to the seoContract test, which
// cross-checks routes against the API's sitemap segments at the source level.
const toPath = (urlOrPath) => {
  const p = urlOrPath.startsWith("/") ? urlOrPath : new URL(urlOrPath).pathname;
  return p.replace(/\/+$/, "") || "/";
};
const readSitemapLocs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const { existsSync } = await import("node:fs");

const sitemapXml = readFileSync(join(DIST, "sitemap.xml"), "utf8");
let sitemapUrls = readSitemapLocs(sitemapXml);
let apiServedChildren = 0;
if (/<sitemapindex/i.test(sitemapXml)) {
  const childUrls = [...sitemapUrls];
  sitemapUrls = [];
  for (const child of childUrls) {
    if (!child.startsWith(CANONICAL_HOST) || !/^\/sitemap-[^/]+\.xml$/.test(toPath(child))) {
      problems.push(`sitemap index entry is not an apex-host child sitemap: ${child}`);
      continue;
    }
    const childFile = join(DIST, toPath(child).replace(/^\//, ""));
    if (existsSync(childFile)) sitemapUrls.push(...readSitemapLocs(readFileSync(childFile, "utf8")));
    else apiServedChildren += 1;
  }
}
const sitemapPaths = new Set(sitemapUrls.map(toPath));
const prerenderedPaths = new Set(files.map((f) => toPath(`/${relative(DIST, f).replace(/index\.html$/, "").replace(/\.html$/, "")}`)));

for (const url of sitemapUrls) {
  if (url.includes("://www.")) problems.push(`sitemap URL uses www host: ${url}`);
  if (!url.startsWith(CANONICAL_HOST)) problems.push(`sitemap URL is not the apex host: ${url}`);
  if (!prerenderedPaths.has(toPath(url))) problems.push(`sitemap lists a page that was not prerendered: ${url}`);
}
if (apiServedChildren === 0) {
  for (const path of prerenderedPaths) {
    if (NON_SITEMAP_ALLOWLIST.has(path)) continue;
    if (!sitemapPaths.has(path)) problems.push(`prerendered page missing from sitemap: ${path}`);
  }
}

// ── Broken internal links in the app source ─────────────────────────
// Every href="/…" (or Link href) in src/ must resolve to a <Route> in
// App.tsx. Catches dead nav entries and typo'd anchors (e.g. the old
// /register and /session-replay links) before they ship.
{
  const { readdirSync: rd, statSync: st } = await import("node:fs");
  const SRC = fileURLToPath(new URL("../src", import.meta.url));
  const appTsx = readFileSync(join(SRC, "App.tsx"), "utf8");
  const routes = [...appTsx.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
  const staticRoutes = new Set(routes.filter((r) => !r.includes(":")));
  const dynamicRoutes = routes
    .filter((r) => r.includes(":"))
    .map((r) => new RegExp(`^${r.replace(/:[^/]+/g, "[^/]+")}$`));
  const matchesRoute = (p) =>
    p === "/" || staticRoutes.has(p) || dynamicRoutes.some((rx) => rx.test(p));

  const walkSrc = (dir, acc = []) => {
    for (const entry of rd(dir)) {
      const full = join(dir, entry);
      if (st(full).isDirectory()) walkSrc(full, acc);
      else if (/\.(tsx|ts|mjs)$/.test(entry) && !/\.test\./.test(entry)) acc.push(full);
    }
    return acc;
  };
  for (const file of walkSrc(SRC)) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(/(?:href|to)=\{?"(\/[a-z0-9\-/]*)"/g)) {
      const target = m[1].split("#")[0].split("?")[0];
      if (!target || target === "/") continue;
      if (target.startsWith("/api") || target.startsWith("/assets")) continue;
      if (!matchesRoute(target)) {
        problems.push(`broken internal link "${m[1]}" in ${relative(SRC, file)}`);
      }
    }
  }
}

console.log(`seo-validate: ${files.length} pages, ${sitemapUrls.length} sitemap page entries, ${apiServedChildren} child sitemap(s) served by the API in production`);
if (problems.length > 0) {
  console.error(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("PASS — titles, descriptions, canonicals, JSON-LD, sitemap and robots all consistent");
