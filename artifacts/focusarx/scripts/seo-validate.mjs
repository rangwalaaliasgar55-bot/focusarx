/**
 * Post-build SEO validation over the prerendered pages in dist/public.
 *
 * Complements the route/sitemap/robots contract tests (seoContract,
 * regressionGuard) by checking the actual emitted HTML: every page needs a
 * unique title and description, a www-host canonical, parseable JSON-LD,
 * and the sitemap must not reference pages that were never prerendered.
 *
 * Run after `vite build && node scripts/prerender.mjs`:
 *   node scripts/seo-validate.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { isDisallowed, parseRobots } from "../src/lib/robots-parse.mjs";
import { clampText, DESCRIPTION_BUDGET, HREFLANG_LOCALES, MIN_SNIPPET, PAGE_TITLE_BUDGET } from "../src/lib/seo-text.mjs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/public", import.meta.url));
const CANONICAL_HOST = "https://www.focusarx.site";

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
else if (!sitemapDirective.startsWith(CANONICAL_HOST)) problems.push(`robots.txt sitemap is not the www host (${sitemapDirective})`);

for (const file of files) {
  const route = relative(DIST, file).replace(/index\.html$/, "").replace(/\.html$/, "");
  // A directory-style page (`search/index.html`) yields "/search/" — with the
  // trailing slash it never matches the manifest's "/search", the robots group
  // or NON_INDEXABLE, so every check below silently skipped it. Normalise.
  const routePath = route ? `/${route}`.replace(/\/+$/, "") : "/";
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
    if (/^https?:\/\/focusarx\.site(\/|$)/.test(canonical[1])) {
      problems.push(`${routePath}: canonical points at the apex host (${canonical[1]}) — canonical host is www`);
    }
    if (!canonical[1].startsWith(CANONICAL_HOST)) {
      problems.push(`${routePath}: canonical is not the www host (${canonical[1]})`);
    }
  }

  for (const og of html.matchAll(/<meta\s+property="og:url"\s+content="([^"]*)"/g)) {
    if (!og[1].startsWith(CANONICAL_HOST)) problems.push(`${routePath}: og:url is not the www host (${og[1]})`);
  }

  {
    // ── Hreflang + lang attribute ────────────────────────────────────
    // One English edition, four audience annotations (x-default, en, en-IN,
    // en-GB), all resolving to this page's own canonical. Two ways this breaks
    // in practice, both silent:
    //   • a page keeps the homepage's cluster because prerender did not rewrite
    //     it — then Google is told four languages of the homepage live at this
    //     URL, and the page competes with itself;
    //   • a page that is not indexable (the 404, /search) still declares a
    //     cluster, and every alternate in a cluster is supposed to be live and
    //     indexable.
    // The locale list is imported from src/lib/seo-text.mjs — the same list
    // index.html, prerender.mjs and PageSEO.tsx use — so this gate cannot drift
    // from what the build emits.
    const canonicalHref = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/)?.[1] ?? null;
    const alternates = [...html.matchAll(/<link\s+rel="alternate"\s+hreflang="([^"]*)"\s+href="([^"]*)"/g)]
      .map((m) => ({ locale: m[1], href: m[2] }));
    const robotsMetaHreflang = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/)?.[1] ?? "";
    const isNoindex = /noindex/i.test(robotsMetaHreflang) || routePath === "/404";

    if (isNoindex) {
      if (alternates.length > 0) {
        problems.push(`${routePath}: not indexable but declares ${alternates.length} hreflang alternate(s) — every alternate in a cluster must be indexable`);
      }
    } else {
      const locales = alternates.map((a) => a.locale);
      const missing = HREFLANG_LOCALES.filter((l) => !locales.includes(l));
      const unexpected = locales.filter((l) => !HREFLANG_LOCALES.includes(l));
      if (missing.length > 0 || unexpected.length > 0) {
        problems.push(`${routePath}: hreflang cluster is [${locales.join(", ")}], expected [${HREFLANG_LOCALES.join(", ")}]${missing.length ? ` — missing ${missing.join(", ")}` : ""}${unexpected.length ? ` — unexpected ${unexpected.join(", ")}` : ""}`);
      }
      for (const alt of alternates) {
        if (alt.href !== canonicalHref) {
          problems.push(`${routePath}: hreflang="${alt.locale}" points at ${alt.href}, not this page's canonical (${canonicalHref}) — a cluster must be self-consistent`);
        }
      }
    }

    // Consistent language declaration: one English edition, so every document
    // says `lang="en"`. Screen readers and translate prompts read this, and a
    // page whose lang disagrees with its hreflang is a signal conflict.
    const langAttr = html.match(/<html[^>]*\slang="([^"]*)"/)?.[1] ?? null;
    if (langAttr !== "en") {
      problems.push(`${routePath}: <html lang> is ${langAttr === null ? "missing" : `"${langAttr}"`}, expected "en"`);
    }
  }

  // JSON-LD blocks must parse.
  for (const ld of html.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(ld[1]);
    } catch (error) {
      problems.push(`${routePath}: invalid JSON-LD (${error.message})`);
    }
  }

  // No apex URLs in any machine-readable URL field (canonical host is www).
  for (const url of html.matchAll(/(?:href|content)="(https?:\/\/focusarx\.site[^"]*)"/g)) {
    problems.push(`${routePath}: apex URL in metadata (${url[1]})`);
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
      problems.push(`sitemap index entry is not a www-host child sitemap: ${child}`);
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
  if (/^https?:\/\/focusarx\.site(\/|$)/.test(url)) problems.push(`sitemap URL uses the apex host: ${url}`);
  if (!url.startsWith(CANONICAL_HOST)) problems.push(`sitemap URL is not the www host: ${url}`);
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

// ══════════════════════════════════════════════════════════════════
// Growth gates (workstream 9)
// ══════════════════════════════════════════════════════════════════
// Everything above checks that a page is *well formed*. Everything below checks
// that the site is *coherent as a site*: pages are reachable, pages do not
// compete with each other, machine-readable URLs are clean, crawlers we want are
// explicitly welcome, and the AI-facing manifest agrees with what we ship.
//
// These are build gates, not lint: they run on the emitted HTML in dist/public
// (what a crawler that does not execute JavaScript actually sees), so they catch
// the difference between "the React component links it" and "the prerendered
// document links it".

const SRC_ROOT = fileURLToPath(new URL("../src", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Paths that are assets, not pages. */
const NON_PAGE_HREF = /^(\/assets\/|\/favicon|\/manifest\.json|\/feed\.xml|\/brand\/|\/icon-|\/logo|\/opengraph|\/sw\.js|\/robots\.txt|\/sitemap|\/llms\.txt|\/site\.webmanifest)/;

const normPath = (p) => (p === "/" ? "/" : p.replace(/\/+$/, ""));
const routeOf = (file) => {
  const rel = relative(DIST, file).replace(/index\.html$/, "").replace(/\.html$/, "");
  return normPath(rel ? `/${rel}` : "/");
};

/** Every prerendered document, read once and reused by the gates below. */
const documents = files.map((file) => ({
  path: routeOf(file),
  html: readFileSync(file, "utf8"),
}));
const documentPaths = new Set(documents.map((d) => d.path));

/** App routes, so a link to a client-rendered screen is not called dead. */
const appRoutes = (() => {
  const appTsx = readFileSync(join(SRC_ROOT, "App.tsx"), "utf8");
  const all = [...appTsx.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
  return {
    static: new Set(all.filter((r) => !r.includes(":"))),
    dynamic: all.filter((r) => r.includes(":")).map((r) => new RegExp(`^${r.replace(/:[^/]+/g, "[^/]+")}$`)),
  };
})();
const isAppRoute = (p) =>
  p === "/" || appRoutes.static.has(p) || appRoutes.dynamic.some((rx) => rx.test(p));

// ── 1. Orphan gate: every indexable page needs real inbound links ──────────
// A page whose only inbound link is a sitemap entry gets crawled rarely and
// ranks as though it were optional. Google's own guidance is that internal links
// (not the sitemap) are how importance is discovered and passed. Three distinct
// source pages is the floor: one hub link plus two contextual ones.
{
  const inbound = new Map([...documentPaths].map((p) => [p, new Set()]));
  for (const doc of documents) {
    for (const m of doc.html.matchAll(/href="(\/[^"#?]*)"/g)) {
      const target = normPath(m[1]);
      if (target === doc.path || NON_PAGE_HREF.test(target)) continue;
      inbound.get(target)?.add(doc.path);
    }
  }

  const MIN_INBOUND = 3;
  // App screens and noindex pages are not in the sitemap, so they cannot be
  // orphans in the SEO sense — nothing should be linking to /login from a guide.
  const exempt = (p) => NON_SITEMAP_ALLOWLIST.has(p) || manifestNoindex.has(p) || p === "/404";

  const orphans = [...inbound.entries()]
    .filter(([p, sources]) => !exempt(p) && sources.size < MIN_INBOUND)
    .sort((a, b) => a[1].size - b[1].size);
  for (const [p, sources] of orphans) {
    problems.push(
      `${p}: orphan page — only ${sources.size} internal inbound link(s) in the prerendered HTML ` +
        `(needs ${MIN_INBOUND})${sources.size ? ` [${[...sources].join(", ")}]` : ""}. ` +
        `Add it to a hub, a related block or the footer; a sitemap entry alone is not discovery.`,
    );
  }
}

// ── 2. Structured data: at least one JSON-LD block per page ────────────────
{
  for (const doc of documents) {
    const blocks = [...doc.html.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/g)];
    if (blocks.length === 0) {
      problems.push(`${doc.path}: no JSON-LD structured data — rich results and entity understanding need at least one block`);
      continue;
    }
    const types = new Set();
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block[1]);
        for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
          const t = node?.["@type"];
          if (Array.isArray(t)) t.forEach((x) => types.add(x));
          else if (t) types.add(t);
          if (node?.["@graph"]) {
            for (const child of node["@graph"]) {
              const ct = child?.["@type"];
              if (Array.isArray(ct)) ct.forEach((x) => types.add(x));
              else if (ct) types.add(ct);
            }
          }
        }
      } catch {
        /* invalid JSON-LD is reported by the parse gate above */
      }
    }
    // Organization/WebSite sit in the shared head; a route page must also say
    // something about itself.
    const routeTypes = [...types].filter((t) => t !== "Organization" && t !== "WebSite");
    if (doc.path !== "/404" && routeTypes.length === 0) {
      problems.push(`${doc.path}: JSON-LD describes only the site (${[...types].join(", ")}) — add a route-level type (Article, FAQPage, SoftwareApplication, BreadcrumbList, …)`);
    }
  }
}

// ── 3. Canonical hygiene: exactly one, self-referencing, parameter-free ────
// Parameterised canonicals are how one page becomes thousands of indexed URL
// variants: ?ref=, ?utm_*, and the reload coordinator's ?_v=/_skew= must all
// collapse onto the clean URL. A canonical that points somewhere else is a
// deliberate hand-off and is reported separately from a missing one.
{
  for (const doc of documents) {
    const canonicals = [...doc.html.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/g)].map((m) => m[1]);

    if (doc.path === "/404") {
      // A 404 must not canonicalise to anything — pointing it at "/" is exactly
      // what created the soft-404 duplicate-canonical signal.
      if (canonicals.length > 0) problems.push(`/404: the error document must not carry a canonical (found ${canonicals.join(", ")})`);
      continue;
    }

    if (canonicals.length === 0) {
      problems.push(`${doc.path}: missing canonical`);
      continue;
    }
    if (canonicals.length > 1) {
      problems.push(`${doc.path}: ${canonicals.length} canonical tags (${canonicals.join(", ")}) — browsers and crawlers pick arbitrarily`);
      continue;
    }

    const canonical = canonicals[0];
    let parsed;
    try {
      parsed = new URL(canonical);
    } catch {
      problems.push(`${doc.path}: canonical is not an absolute URL (${canonical})`);
      continue;
    }
    if (parsed.search) problems.push(`${doc.path}: canonical carries query parameters (${parsed.search}) — ?ref=/?utm_*/?_v must canonicalise clean`);
    if (parsed.hash) problems.push(`${doc.path}: canonical carries a fragment (${parsed.hash})`);
    const expected = `${CANONICAL_HOST}${doc.path === "/" ? "/" : doc.path}`;
    if (canonical !== expected) problems.push(`${doc.path}: canonical is ${canonical}, expected self-referencing ${expected}`);
  }

  // Source-level: the runtime canonical must be derived from a path, never from
  // window.location.href (which carries every tracking and recovery param).
  const pageSeo = readFileSync(join(SRC_ROOT, "components/PageSEO.tsx"), "utf8");
  if (/location\.href/.test(pageSeo) && !/\/\/\s*canonical-hygiene/.test(pageSeo)) {
    problems.push("components/PageSEO.tsx builds a canonical from window.location.href — it must use the route path so ?ref=/?utm_*/?_v canonicalise clean");
  }
}

// ── 4. Cannibalisation guard: near-identical titles/descriptions ───────────
// Two pages that differ only by punctuation or one word compete for the same
// query and split their signals; Google then picks one and the other sits in
// "Duplicate, Google chose different canonical". Exact duplicates are caught
// above — this catches the near misses, which are far more common once pages are
// generated from a template.
{
  const tokenize = (text) =>
    text
      .toLowerCase()
      .replace(/\s*[|—–-]\s*focusarx\s*$/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
  const jaccard = (a, b) => {
    const sa = new Set(a);
    const sb = new Set(b);
    const inter = [...sa].filter((w) => sb.has(w)).length;
    const union = new Set([...sa, ...sb]).size;
    return union === 0 ? 0 : inter / union;
  };

  const THRESHOLD = 0.85;
  for (const field of ["title", "description"]) {
    const entries = documents
      .map((doc) => {
        const raw =
          field === "title"
            ? doc.html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]
            : doc.html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1];
        return raw ? { path: doc.path, words: tokenize(raw.replace(/&amp;/g, "&").replace(/&#39;/g, "'")) } : null;
      })
      .filter(Boolean);

    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const score = jaccard(entries[i].words, entries[j].words);
        if (score >= THRESHOLD) {
          problems.push(
            `${field} cannibalisation: ${entries[i].path} and ${entries[j].path} are ${(score * 100).toFixed(0)}% the same words — ` +
              `they will compete for one query. Differentiate the ${field} (angle, audience, number, year).`,
          );
        }
      }
    }
  }
}

// ── 5. robots.txt: the AI crawlers we want are explicitly allowed ──────────
// Opting in is a decision, and it is one an edit to robots.txt can silently
// reverse. Each of these agents must appear with an explicit `Allow: /`.
{
  const REQUIRED_AGENTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];
  const groups = new Map();
  let current = [];
  for (const line of robots.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [rawField, ...rest] = trimmed.split(":");
    const field = rawField.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (field === "user-agent") {
      current = [value];
      groups.set(value, groups.get(value) ?? []);
    } else if (current.length) {
      for (const agent of current) groups.set(agent, [...(groups.get(agent) ?? []), [field, value]]);
    }
  }
  for (const agent of REQUIRED_AGENTS) {
    const rules = groups.get(agent);
    if (!rules) {
      problems.push(`robots.txt: no group for ${agent} — AI crawlers must be explicitly allowed, not left to the * default`);
      continue;
    }
    if (!rules.some(([field, value]) => field === "allow" && value === "/")) {
      problems.push(`robots.txt: ${agent} group has no explicit "Allow: /"`);
    }
    if (rules.some(([field, value]) => field === "disallow" && value === "/")) {
      problems.push(`robots.txt: ${agent} is fully disallowed — that contradicts the AI-visibility decision`);
    }
  }
}

// ── 6. Trailing slash + case canonicalisation are configured ───────────────
// /Blog/ and /blog/ are two URLs with one document. Vercel's `trailingSlash`
// setting handles the slash; the case redirect is a route into the API
// middleware (artifacts/api-server/src/middlewares/canonicalUrl.ts) because
// Vercel redirects are case-insensitive by default and cannot lowercase a path.
{
  const vercel = JSON.parse(readFileSync(join(REPO_ROOT, "vercel.json"), "utf8"));
  if (vercel.trailingSlash !== false) {
    problems.push(`vercel.json: trailingSlash must be false (found ${JSON.stringify(vercel.trailingSlash)}) so /blog/ 308s to /blog`);
  }
  const routes = vercel.routes ?? [];
  const caseRoute = routes.find((r) => typeof r.src === "string" && /A-Z/.test(r.src) && r.dest?.includes("canonicalize="));
  if (!caseRoute) {
    problems.push("vercel.json: missing the uppercase-path canonicaliser route (/[A-Z]… → /api/index.mjs?canonicalize=…) — /Blog/ would stay a duplicate of /blog");
  }
  const notFoundRoute = routes.filter((r) => r.status === 404);
  if (notFoundRoute.length === 0) {
    problems.push("vercel.json: no route returns status 404 — unknown URLs would be soft-404s again");
  }
}

// ── 7. llms.txt is in sync with the site ───────────────────────────────────
// llms.txt is a hand-maintained manifest for AI assistants. It drifts the moment
// a page is added or renamed, and a stale entry is worse than none: an assistant
// that cites a dead FocusArx URL is a lost referral and a trust problem.
{
  const llmsPath = join(DIST, "llms.txt");
  if (!existsSync(llmsPath)) {
    problems.push("llms.txt is missing from the build output");
  } else {
    const llms = readFileSync(llmsPath, "utf8");
    const listed = new Set(
      [...llms.matchAll(/https:\/\/www\.focusarx\.site(\/[^\s)\]]*)/g)].map((m) => normPath(m[1] || "/")),
    );
    if (!listed.has("/")) problems.push("llms.txt does not list the homepage");

    // (a) no dead links — every URL must be a prerendered page or a real app route
    for (const p of listed) {
      if (!documentPaths.has(p) && !isAppRoute(p)) problems.push(`llms.txt links a page that does not exist: ${p}`);
      if (!/^\/$/.test(p) && p !== normPath(p)) problems.push(`llms.txt URL is not canonical (trailing slash): ${p}`);
    }

    // (b) every indexable page is listed, directly or through its cluster hub.
    //     A cluster hub entry is enough for generated pages: nobody should have
    //     to remember 14 exam timer pages, but a brand-new top-level page must be
    //     added here or this gate names it.
    const CLUSTER_HUBS = [
      ["/exam/", "/exam"],
      ["/blog/", "/blog"],
      ["/pomodoro-timer-for/", "/pomodoro-timer-for"],
      ["/comparison/", "/comparison"],
    ];
    const coveredByHub = (p) => CLUSTER_HUBS.some(([prefix, hub]) => p.startsWith(prefix) && listed.has(hub));
    const missingFromLlms = [...documentPaths]
      .filter((p) => !NON_SITEMAP_ALLOWLIST.has(p) && !manifestNoindex.has(p) && p !== "/404")
      .filter((p) => !listed.has(p) && !coveredByHub(p))
      .sort();
    for (const p of missingFromLlms) {
      problems.push(`llms.txt does not list ${p} (and no cluster hub covers it) — AI assistants cannot cite a page they do not know about`);
    }
  }
}

// ── 8. Consent Mode v2 is actually wired ───────────────────────────────────
// The default block lives in index.html (it must run before `config`); the
// visitor's choice is applied from the banner. Both halves have to exist and
// they have to share one implementation, or the banner silently stops updating
// consent while the defaults keep applying.
{
  const consentLib = readFileSync(join(SRC_ROOT, "lib/consent.ts"), "utf8");
  const banner = readFileSync(join(SRC_ROOT, "components/CookieConsent.tsx"), "utf8");
  const indexHtml = readFileSync(join(REPO_ROOT, "artifacts/focusarx/index.html"), "utf8");

  if (!/gtag\(\)?\s*\(?"consent",\s*"update"/.test(consentLib) && !/"consent",\s*"update"/.test(consentLib)) {
    problems.push("lib/consent.ts never calls gtag(\"consent\", \"update\") — the banner choice would not reach Google");
  }
  const importsConsentLib =
    banner.includes('"@/lib/consent"') ||
    banner.includes('"../lib/consent"') ||
    banner.includes('"./consent"');
  if (!importsConsentLib) {
    problems.push("components/CookieConsent.tsx does not import lib/consent.ts — two consent implementations will drift");
  }
  for (const signal of ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage"]) {
    if (!indexHtml.includes(signal)) problems.push(`index.html consent defaults are missing ${signal} (Consent Mode v2 requires all four)`);
  }
  if (!/wait_for_update/.test(indexHtml)) {
    problems.push("index.html consent defaults are missing wait_for_update — the update can race the first hit");
  }
}

// ── jump links (featured-snippet TOC) + visible breadcrumbs ────────────────
// Two on-page ranking mechanics fail silently, so both are gated:
//   1. An "On this page" jump link whose heading has no id scrolls nowhere. The
//      ids come from the same slugger in the static document and in the React
//      tree, but a page that renders headings differently would never notice —
//      so every href="#x" must resolve to an id in the same document.
//   2. BreadcrumbList structured data with no visible trail on the page, or a
//      trail whose crumbs disagree with the schema. Google compares the two and
//      drops the rich result when they differ, which is why the labels are
//      derived once (lib/breadcrumbs.mjs) and checked here per document.
const sitemapPathSet = new Set(sitemapUrls);
// Route matcher for crumb links: a <Route> in App.tsx, or a document that
// actually ships in dist/public. Same derivation the broken-link gate uses.
const breadcrumbRouteSet = (() => {
  const appTsx = readFileSync(fileURLToPath(new URL("../src/App.tsx", import.meta.url)), "utf8");
  const routes = [...appTsx.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
  const staticRoutes = new Set(routes.filter((r) => !r.includes(":")));
  const dynamicRoutes = routes
    .filter((r) => r.includes(":"))
    .map((r) => new RegExp(`^${r.replace(/:[^/]+/g, "[^/]+")}$`));
  return (target) =>
    target === "/" ||
    staticRoutes.has(target) ||
    dynamicRoutes.some((rx) => rx.test(target)) ||
    existsSync(join(DIST, target.replace(/^\//, ""), "index.html"));
})();

for (const file of files) {
  const route = relative(DIST, file).replace(/index\.html$/, "").replace(/\.html$/, "");
  const routePath = route ? `/${route}`.replace(/\/+$/, "") : "/";
  const html = readFileSync(file, "utf8");

  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/href="#([^"]+)"/g)) {
    if (!ids.has(m[1])) problems.push(`${routePath}: jump link "#${m[1]}" has no matching heading id in the document`);
  }

  const navMatch = html.match(/<nav[^>]*aria-label="Breadcrumb"[^>]*>([\s\S]*?)<\/nav>/);
  const isNested = routePath.split("/").filter(Boolean).length > 1;
  if (sitemapPathSet.has(routePath) && isNested && !navMatch) {
    problems.push(`${routePath}: nested indexable page has no visible breadcrumb trail — BreadcrumbList in the head alone is not enough`);
  }
  if (!navMatch) continue;

  // A crumb that links must land on a route the app actually serves; a trail
  // full of 404s is worse than no trail.
  for (const m of navMatch[1].matchAll(/<a[^>]+href="([^"]+)"/g)) {
    const target = m[1].split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
    if (!breadcrumbRouteSet(target)) problems.push(`${routePath}: breadcrumb links to ${m[1]}, which is neither a route in App.tsx nor a prerendered page`);
  }

  // Crumb text is HTML-escaped in the document ("NDA &amp; NA") but plain in
  // the schema, so decode before comparing — otherwise every ampersand fails.
  const decodeEntities = (t) =>
    t
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&nbsp;/g, " ");
  const visibleCrumbs = [...navMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const breadcrumbSchema = [...html.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .filter(Boolean)
    .flat()
    .find((o) => o && o["@type"] === "BreadcrumbList");
  if (!breadcrumbSchema) {
    problems.push(`${routePath}: visible breadcrumb trail has no BreadcrumbList structured data`);
    continue;
  }
  const schemaCrumbs = (breadcrumbSchema.itemListElement || []).map((c) => String(c.name ?? "").trim());
  const shown = visibleCrumbs.join(" > ").replace(/\s+/g, " ");
  const declared = schemaCrumbs.join(" > ").replace(/\s+/g, " ");
  if (shown !== declared) {
    problems.push(`${routePath}: breadcrumb trail "${shown}" does not match BreadcrumbList "${declared}"`);
  }
  const rootItem = String(breadcrumbSchema.itemListElement?.[0]?.item ?? "");
  if (schemaCrumbs.length > 1 && !rootItem.endsWith("/")) {
    problems.push(`${routePath}: BreadcrumbList root item should be the site root with a trailing slash (got "${rootItem}")`);
  }
}

console.log(`seo-validate: ${files.length} pages, ${sitemapUrls.length} sitemap page entries, ${apiServedChildren} child sitemap(s) served by the API in production`);
if (problems.length > 0) {
  console.error(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  "PASS — titles, descriptions, canonicals, JSON-LD, sitemap, robots, internal-link depth, cannibalisation, llms.txt and consent wiring, breadcrumb trails and jump links all consistent",
);
