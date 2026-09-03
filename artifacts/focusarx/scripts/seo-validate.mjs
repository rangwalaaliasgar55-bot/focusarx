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

function walkHtml(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, acc);
    else if (entry.endsWith(".html")) acc.push(full);
  }
  return acc;
}

const files = walkHtml(DIST);
const problems = [];
const titles = new Map();
const descriptions = new Map();

for (const file of files) {
  const route = relative(DIST, file).replace(/index\.html$/, "").replace(/\.html$/, "");
  const routePath = route ? `/${route}` : "/";
  const html = readFileSync(file, "utf8");

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim();
  if (!title) problems.push(`${routePath}: missing <title>`);
  else if (titles.has(title)) problems.push(`${routePath}: duplicate title "${title}" (also on ${titles.get(title)})`);
  else titles.set(title, routePath);

  const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1]?.trim();
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

const robots = readFileSync(join(DIST, "robots.txt"), "utf8");
const sitemapDirective = robots.match(/^Sitemap:\s*(\S+)$/m)?.[1];
if (!sitemapDirective) problems.push("robots.txt: missing Sitemap directive");
else if (!sitemapDirective.startsWith(CANONICAL_HOST)) problems.push(`robots.txt sitemap is not the apex host (${sitemapDirective})`);

console.log(`seo-validate: ${files.length} pages, ${sitemapUrls.length} sitemap page entries, ${apiServedChildren} child sitemap(s) served by the API in production`);
if (problems.length > 0) {
  console.error(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("PASS — titles, descriptions, canonicals, JSON-LD, sitemap and robots all consistent");
