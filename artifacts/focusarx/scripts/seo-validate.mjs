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
import { CLUSTERS } from "../src/content/clusters.mjs";
import { clampText, composeTitle, DESCRIPTION_BUDGET, MIN_SNIPPET, PAGE_TITLE_BUDGET, TITLE_BUDGET } from "../src/lib/seo-text.mjs";
import { EDITIONS, HREFLANG_TAGS } from "../src/content/locales.mjs";
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

/** Literal text inside a regex, for matching emitted HTML. */
function escapeRegexForHtmlText(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

/**
 * Canonical path → prerendered HTML, built once before the per-file loop.
 * The hreflang gate has to look at *other* documents — is this alternate a page
 * we actually wrote, and does that page point back here? — and re-reading the
 * tree inside the loop would do that 129 times. Built here rather than reusing
 * the `documents` array further down, which is in the temporal dead zone for
 * code running at line ~90 (a crash, not a skipped check).
 */
const htmlByPath = new Map();
for (const f of walkHtml(DIST)) {
  const rel = relative(DIST, f).replace(/index\.html$/, "").replace(/\.html$/, "");
  htmlByPath.set(rel ? `/${rel}`.replace(/\/+$/, "") : "/", readFileSync(f, "utf8"));
}

// Assigned inside the table-parity block below and read by the summary line, so
// they are deliberately declared without an initialiser (a dead `= 0` is what
// `no-useless-assignment` flags).
let tablesCheckedTotal;
let rowsCheckedTotal;

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

/**
 * Paths a crawler is meant to index. The sitemap cannot answer this locally —
 * sitemap.xml is an index whose children the API serves in production, so the
 * set built from dist is empty and every "indexable page" check below would
 * silently skip. The prerender manifest is the authority: it is what generated
 * the documents in the first place.
 */
const indexablePaths = new Set(
  manifestRoutes
    .map((entry) => (entry.path === "" ? "/" : `/${String(entry.path).replace(/^\/+/, "")}`))
    .filter((path) => !manifestNoindex.has(path) && !NON_INDEXABLE.has(path)),
);

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
    // The tag list is imported from src/content/locales.mjs — the same module
    // index.html, prerender.mjs and PageSEO.tsx build their clusters from — so
    // this gate cannot drift from what the build emits.
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
      // 1. Every tag must be one the site actually publishes.
      for (const alt of alternates) {
        if (!HREFLANG_TAGS.includes(alt.locale)) {
          problems.push(`${routePath}: hreflang="${alt.locale}" is not a tag this site publishes (${HREFLANG_TAGS.join(", ")})`);
        }
      }

      // 2. x-default must exist and must point at the English original. An
      //    edition page whose x-default points at itself is telling Google
      //    "the fallback for this page is this page", which defeats the point
      //    of the annotation and leaves the English page unreachable from the
      //    cluster.
      const xDefault = alternates.find((a) => a.locale === "x-default");
      const englishHref = alternates.find((a) => a.locale === "en")?.href ?? null;
      if (!xDefault) {
        problems.push(`${routePath}: indexable but declares no hreflang="x-default" — every cluster needs a fallback`);
      } else if (englishHref && xDefault.href !== englishHref) {
        problems.push(`${routePath}: x-default points at ${xDefault.href} but en points at ${englishHref} — the fallback and the English edition must agree`);
      }

      // 3. Every alternate must be a document this build actually wrote. This
      //    is the check that stops an edition being declared before its pages
      //    exist: a dead alternate invalidates the whole cluster, and Google
      //    resolves each href before trusting any of them.
      for (const alt of alternates) {
        if (!alt.href.startsWith(CANONICAL_HOST)) {
          problems.push(`${routePath}: hreflang="${alt.locale}" points off-site (${alt.href})`);
          continue;
        }
        const altPath = alt.href.slice(CANONICAL_HOST.length) || "/";
        if (!htmlByPath.has(altPath)) {
          problems.push(`${routePath}: hreflang="${alt.locale}" points at ${alt.href}, which this build did not prerender — an alternate must resolve to a live document`);
        }
      }

      // 4. Reciprocity: if this page says the Hindi edition lives at /hi, then
      //    /hi must say this page is its English original. Google only honours
      //    clusters where both directions are declared; a one-way link is
      //    dropped, and a half-wired edition looks like a duplicate instead.
      if (englishHref && htmlByPath.has(englishHref.slice(CANONICAL_HOST.length))) {
        const backHtml = htmlByPath.get(englishHref.slice(CANONICAL_HOST.length));
        const pointsBack = [...backHtml.matchAll(/<link\s+rel="alternate"\s+hreflang="[^"]*"\s+href="([^"]*)"/g)]
          .some((m) => m[1] === canonicalHref);
        if (!pointsBack && canonicalHref !== englishHref) {
          problems.push(`${routePath}: points at ${englishHref} as its English edition, but that page's cluster does not point back here — hreflang must be reciprocal`);
        }
      }
    }

    // Consistent language declaration. An English page says lang="en"; a
    // localized edition says its own BCP-47 tag, and the tag must agree with
    // the edition's hreflang — a page whose lang disagrees with its hreflang is
    // a signal conflict that costs it the localized ranking it was written for.
    const langAttr = html.match(/<html[^>]*\slang="([^"]*)"/)?.[1] ?? null;
    const edition = EDITIONS.find((e) => {
      const prefix = e.path.replace(/\/$/, "");
      return routePath === prefix || routePath.startsWith(`${prefix}/`);
    });
    const expectedLang = edition ? edition.lang : "en";
    if (langAttr !== expectedLang) {
      problems.push(`${routePath}: <html lang> is ${langAttr === null ? "missing" : `"${langAttr}"`}, expected "${expectedLang}"${edition ? ` (the ${edition.label} edition)` : ""}`);
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

// ── 8. Consent-gated optional measurement is actually wired ───────────────
// Analytics and advertising must not be in index.html: loading either before a
// choice creates third-party critical requests and negates the consent UI. The
// shared module owns both the Google consent mapping and one-time GA loader.
{
  const consentLib = readFileSync(join(SRC_ROOT, "lib/consent.ts"), "utf8");
  const analyticsLoader = readFileSync(join(SRC_ROOT, "lib/analyticsLoader.ts"), "utf8");
  const banner = readFileSync(join(SRC_ROOT, "components/CookieConsent.tsx"), "utf8");
  const indexHtml = readFileSync(join(REPO_ROOT, "artifacts/focusarx/index.html"), "utf8");

  if (!/"consent",\s*"update"/.test(consentLib)) {
    problems.push("lib/consent.ts never calls gtag(\"consent\", \"update\") — an opt-in would not reach Google");
  }
  const importsConsentLib =
    banner.includes('"@/lib/consent"') ||
    banner.includes('"../lib/consent"') ||
    banner.includes('"./consent"');
  if (!importsConsentLib) {
    problems.push("components/CookieConsent.tsx does not import lib/consent.ts — two consent implementations will drift");
  }
  for (const signal of ["ad_storage", "ad_user_data", "ad_personalization", "analytics_storage"]) {
    if (!consentLib.includes(signal)) problems.push(`lib/consent.ts is missing ${signal} from the Consent Mode mapping`);
  }
  if (!/analytics:\s*false/.test(consentLib) || !/advertising:\s*false/.test(consentLib)) {
    problems.push("consent defaults are not necessary-only");
  }
  if (/googletagmanager\.com\/gtag\/js|pagead2\.googlesyndication\.com|preconnect[^>]+google/i.test(indexHtml)) {
    problems.push("index.html eagerly loads optional analytics or advertising instead of using the consent gate");
  }
  if (!/ensureAnalyticsLoaded/.test(analyticsLoader) || !/send_page_view:\s*false/.test(analyticsLoader)) {
    problems.push("analyticsLoader.ts is missing the one-time manual-pageview GA4 loader");
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
  if (indexablePaths.has(routePath) && isNested && !navMatch) {
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

// ── title truncation ───────────────────────────────────────────────────────
// A title longer than the budget is not "a bit long": clampText cuts it, and
// the cut lands mid-phrase. Ten funnel pages shipped reading "Pomodoro timer
// for NDA & NA (National Defence" — an unbalanced parenthesis in a SERP is the
// visible signature of exactly that. Both are checked per manifest entry.
for (const entry of manifestRoutes) {
  const title = entry.title ?? "";
  // Measured after the brand suffix is removed: composeTitle strips it before
  // clamping, so "| FocusArx" in the source string costs nothing.
  const own = title.replace(/\s*\|\s*FocusArx\s*$/i, "").trim();
  if (own.length > PAGE_TITLE_BUDGET) {
    problems.push(`${entry.path}: title is ${own.length} chars of its own, over the ${PAGE_TITLE_BUDGET}-char page budget, so composeTitle will clamp it — "${title}"`);
  }
  const open = (own.match(/\(/g) ?? []).length;
  const close = (own.match(/\)/g) ?? []).length;
  if (open !== close) {
    problems.push(`${entry.path}: title has unbalanced parentheses, which is how a clamped title reads — "${title}"`);
  }
  const composed = composeTitle(title);
  if (composed.length > TITLE_BUDGET) {
    problems.push(`${entry.path}: composed title is ${composed.length} chars, over the ${TITLE_BUDGET}-char SERP budget — "${composed}"`);
  }
  if (/[,:\-—–]$/.test(own)) {
    problems.push(`${entry.path}: title ends on punctuation, which reads as a truncated snippet — "${title}"`);
  }
}

// ── PageSEO ↔ prerender manifest agreement ─────────────────────────────────
// Every page is titled twice: once in the prerendered document (from
// scripts/prerender-data.mjs) and once by components/PageSEO.tsx after
// hydration, from its own PAGE_SEO map. Google renders JavaScript, so the
// second title is what it ends up seeing — and the two used to disagree on 13
// pages (/pricing said "Free Forever | Deep Work Features" in one and
// "Pricing — Free, or Premium by Coins" in the other). Comparing composed
// titles catches it without caring which side omits the brand suffix.
{
  const pageSeoSrc = readFileSync(
    fileURLToPath(new URL("../src/components/PageSEO.tsx", import.meta.url)),
    "utf8",
  );
  const entryRe = /canonical:\s*"([^"]+)",\s*\n\s*title:\s*"([^"]*)",?\s*\n\s*description:\s*"([^"]*)"/g;
  const manifestByPath = new Map(manifestRoutes.map((r) => [r.path, r]));
  let compared = 0;
  for (const m of pageSeoSrc.matchAll(entryRe)) {
    const [, canonical, title, description] = m;
    const entry = manifestByPath.get(canonical);
    if (!entry) continue;
    compared += 1;
    if (composeTitle(title) !== composeTitle(entry.title ?? "")) {
      problems.push(`${canonical}: PageSEO title "${composeTitle(title)}" disagrees with the prerendered title "${composeTitle(entry.title ?? "")}"`);
    }
    if (description !== (entry.description ?? "")) {
      problems.push(`${canonical}: PageSEO description disagrees with the prerendered one — the SERP snippet changes after hydration`);
    }
  }
  if (compared === 0) {
    problems.push("PageSEO drift gate matched no entries — the PAGE_SEO map shape changed and the gate needs updating");
  }
}

// ── pillar/cluster wiring ──────────────────────────────────────────────────
// A cluster only works if the wiring is two-way: the pillar links out to every
// page in it, and every page links back to the pillar. Half of it is the common
// failure — a hub that lists 50 pages nobody lists back, or spokes that only
// ever point at the homepage. Both directions are checked per prerendered
// document, from the same map the pages render from (src/content/clusters.mjs).
{
  const docFor = (routePath) => {
    const rel = routePath.replace(/^\//, "");
    const file = join(DIST, rel, "index.html");
    if (!existsSync(file)) return existsSync(join(DIST, `${rel}.html`)) ? readFileSync(join(DIST, `${rel}.html`), "utf8") : null;
    return readFileSync(file, "utf8");
  };
  const linksIn = (html) => new Set([...html.matchAll(/<a[^>]+href="(\/[^"#?]*)"/g)].map((m) => m[1].replace(/\/+$/, "") || "/"));

  let spokesChecked = 0;
  for (const cluster of CLUSTERS) {
    const pillarHtml = docFor(cluster.pillar);
    if (pillarHtml === null) {
      problems.push(`cluster "${cluster.id}": pillar ${cluster.pillar} has no prerendered document`);
      continue;
    }
    const pillarLinks = linksIn(pillarHtml);
    for (const spoke of cluster.spokes) {
      if (!indexablePaths.has(spoke.path)) continue;
      spokesChecked += 1;
      if (!pillarLinks.has(spoke.path)) {
        problems.push(`cluster "${cluster.id}": pillar ${cluster.pillar} does not link to ${spoke.path}`);
      }
      const spokeHtml = docFor(spoke.path);
      if (spokeHtml === null) {
        problems.push(`cluster "${cluster.id}": spoke ${spoke.path} has no prerendered document`);
        continue;
      }
      if (!linksIn(spokeHtml).has(cluster.pillar)) {
        problems.push(`cluster "${cluster.id}": ${spoke.path} has no link back to its pillar ${cluster.pillar}`);
      }
    }
  }
  if (spokesChecked === 0) problems.push("cluster gate checked no spokes — src/content/clusters.mjs may be empty");
}

// ── 12. Byline, visible freshness and citation links (E-E-A-T) ───────────
// Experience, expertise, authoritativeness, trustworthiness is not a widget you
// add: it is whether a reader can tell who is responsible for a page, when the
// copy was last checked, and how to verify its claims. Three things used to be
// missing and are now gates, because each one fails silently — the build passes
// and the page simply looks anonymous and stale:
//
//   • a byline naming the author, on every page that argues something;
//   • a visible "Last updated" date that agrees with the manifest review date
//     AND with the Article/BlogPosting `dateModified` — three surfaces, one
//     value, and no build date standing in for a review date;
//   • citation links that are followable. `rel="nofollow"` on a source link
//     tells Google we do not vouch for the paper we are citing, which defeats
//     the reason for citing it.
{
  const manifest = new Map(manifestRoutes.map((e) => [e.path === "" ? "/" : e.path, e]));
  const docByPath = new Map(documents.map((d) => [d.path, d.html]));
  const NO_VOUCH = /rel="[^"]*\b(nofollow|sponsored|ugc)\b/;

  let bylines = 0;
  let citations = 0;
  let datedPages = 0;

  for (const routePath of indexablePaths) {
    const html = docByPath.get(routePath);
    if (!html) continue; // covered by the prerender-coverage gate above
    const entry = manifest.get(routePath) ?? {};

    // (a) byline on pages that make claims
    const hasByline = html.includes('class="byline"');
    const arguesSomething = entry.article === true || Array.isArray(entry.sources) || Array.isArray(entry.faq);
    if (arguesSomething && !hasByline) {
      problems.push(`${routePath}: content page with no byline — a reader cannot tell who is responsible for it`);
    }
    if (hasByline) bylines += 1;

    // (b) freshness: one date, three surfaces
    const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => {
      try {
        return JSON.parse(m[1]);
      } catch {
        problems.push(`${routePath}: JSON-LD block does not parse`);
        return null;
      }
    });
    const nodes = blocks.flat(Infinity).filter((n) => n && typeof n === "object");
    const article = nodes.find((n) => n["@type"] === "Article" || n["@type"] === "BlogPosting");
    const visible = /Last updated <time datetime="(\d{4}-\d{2}-\d{2})"/.exec(html)?.[1];

    if (entry.lastReviewed) {
      datedPages += 1;
      if (visible !== entry.lastReviewed) {
        problems.push(
          `${routePath}: visible "Last updated" is ${visible ?? "missing"} but the manifest review date is ${entry.lastReviewed}`,
        );
      }
      if (article && article.dateModified !== entry.lastReviewed) {
        problems.push(
          `${routePath}: schema dateModified is ${article.dateModified ?? "missing"} but the review date is ${entry.lastReviewed}`,
        );
      }
      // No Article node is fine — a trust page or a SoftwareApplication page can
      // carry a visible review date without pretending to be an article. What is
      // not fine is an Article node that disagrees with it (checked above).
    } else {
      if (visible) problems.push(`${routePath}: advertises "Last updated ${visible}" with no review date in the manifest`);
      if (article?.dateModified) {
        problems.push(
          `${routePath}: schema dateModified ${article.dateModified} with no review date in the manifest — a build date is not a review date`,
        );
      }
    }

    // (c) citations: outbound, followable, safe
    const sources = /<div class="sources">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
    for (const m of sources.matchAll(/<a\b([^>]*)>/g)) {
      // The whole attribute string, not just what precedes href: the prerenderer
      // emits `<a href target rel>`, so slicing at href hid the rel entirely and
      // this gate reported every citation as unsafe.
      const attrs = m[1];
      const href = /href="(https?:\/\/[^"]+)"/.exec(attrs)?.[1];
      if (!href) continue;
      citations += 1;
      if (NO_VOUCH.test(attrs)) {
        problems.push(`${routePath}: citation link to ${href} is nofollow/sponsored/ugc — we cite it, so we vouch for it`);
      }
      if (!/rel="[^"]*noopener/.test(attrs)) {
        problems.push(`${routePath}: citation link to ${href} leaves the site without rel="noopener noreferrer"`);
      }
    }
  }

  // The gates above are per-page; these fail if the machinery itself stopped
  // running, which would otherwise make every check above vacuously true.
  if (bylines < 60) problems.push(`byline gate saw only ${bylines} bylines — prerender.mjs may have stopped rendering them`);
  if (datedPages < 60) problems.push(`freshness gate saw only ${datedPages} dated pages — the review dates may have been dropped`);
  if (citations === 0) problems.push("citation gate found no outbound source links — src/lib/citations.mjs may have stopped resolving");
}

// ── 13. Images in the emitted HTML: described, ours, dimensioned ─────────
// The source-level rules live in src/images.seo.test.ts; this catches what a
// component could still get wrong at render time — an alt dropped by a
// conditional, a CDN URL assembled at runtime, a missing width that costs the
// page its CLS budget. Image search is a real channel for this site (the
// illustrations on the guides rank for their topics), and an <img> with no alt
// is invisible to it.
{
  const THIRD_PARTY = /^https?:\/\/(?!www\.focusarx\.site)/;
  for (const doc of documents) {
    const body = doc.html.replace(/<!--[\s\S]*?-->/g, "");
    for (const m of body.matchAll(/<img\b([^>]*)>/g)) {
      const attrs = m[1];
      const src = /src="([^"]+)"/.exec(attrs)?.[1] ?? "";
      const hasAlt = /\balt="/.test(attrs);
      if (!hasAlt) problems.push(`${doc.path}: <img src="${src}"> has no alt attribute at all`);
      if (/\balt=""/.test(attrs) && !/aria-hidden|role="presentation"/.test(attrs)) {
        problems.push(`${doc.path}: <img src="${src}"> has an empty alt but is not marked decorative`);
      }
      if (THIRD_PARTY.test(src)) {
        problems.push(`${doc.path}: <img src="${src}"> is served from a third-party host`);
      }
      if (!/\bwidth=/.test(attrs) || !/\bheight=/.test(attrs)) {
        problems.push(`${doc.path}: <img src="${src}"> lacks intrinsic width/height (layout shift)`);
      }
    }

    // The LCP font hint. The headline is the LCP element on nearly every page
    // and it is set in Manrope Variable, so vite.config.ts preloads the latin
    // subset at build time (the filename is content-hashed). A rewrite of the
    // <head> could drop the hint without any other symptom.
    const preload = /<link rel="preload" href="([^"]+)" as="font"/.exec(doc.html);
    if (!preload) {
      problems.push(`${doc.path}: no font preload hint — the LCP headline waits an extra round trip for its font`);
    } else {
      const href = preload[1].replace(/^\//, "");
      if (!existsSync(join(DIST, href))) {
        problems.push(`${doc.path}: font preload points at ${href}, which the build does not contain`);
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// Content-depth and table-parity gates
// ══════════════════════════════════════════════════════════════════
// Everything above checks that a page is well formed and reachable. These two
// check that the page is worth indexing at all, and that the table a crawler
// reads is the table a visitor reads.
//
// Why depth needs a gate: a prerendered document always has *some* text — the
// badge, the breadcrumb trail, the "Keep reading" links, the footer, the CTA.
// A page can therefore look complete to every check above while its own copy is
// a heading and a sentence, which is what "Crawled – currently not indexed"
// means in Search Console. Counting is the only way to see it.
//
// "Shell furniture" is stripped before counting: chrome every page carries that
// says nothing about this one (nav, breadcrumb/TOC, the byline, the related and
// cluster blocks, the CTA, the badge). What remains is the page's own words —
// h1, lead, answer, table, sections, FAQ, sources.

/** Chrome that appears on every page and must not count toward a page's depth. */
const FURNITURE_PATTERNS = [
  /<nav\b[\s\S]*?<\/nav>/gi,
  /<footer\b[\s\S]*?<\/footer>/gi,
  /<div class="related">[\s\S]*?<\/div>/gi,
  /<div class="cluster">[\s\S]*?<\/div>/gi,
  /<div class="byline">[\s\S]*?<\/div>/gi,
  /<a class="cta"[\s\S]*?<\/a>/gi,
  /<span class="badge">[\s\S]*?<\/span>/gi,
  /<script\b[\s\S]*?<\/script>/gi,
  /<style\b[\s\S]*?<\/style>/gi,
  /<head\b[\s\S]*?<\/head>/gi,
];

/**
 * A page's own copy, in words.
 *
 * Scoped to the `<main id="main-content">` the prerenderer injects so the
 * document shell cannot contribute, then stripped of furniture.
 */
function ownCopyWords(html) {
  const main = /<main id="main-content"[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  let body = main ? main[1] : html;
  for (const rx of FURNITURE_PATTERNS) body = body.replace(rx, " ");
  const text = body
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-zA-Z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  // Any script, not just Latin. The filter used to be /[a-zA-Z0-9]/, which
  // silently discarded every Devanagari word: the Hindi pages were scored on
  // the Latin fragments that happen to appear in them ("FocusArx", "JEE",
  // "10,000") and reported 51 and 37 words against a 150-word floor. A gate
  // that cannot see the copy it exists to protect is worse than no gate — it
  // would have passed a Hindi page whose prose had been deleted entirely.
  return text.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Words a page must carry to be worth a crawl.
 *
 * 150 is the depth at which a page can answer the question it was written for
 * rather than restating its own title.
 */
const MIN_OWN_WORDS = 150;

/**
 * App surfaces: screens behind the app shell, not documents. They are noindexed
 * (robots.txt disallows them, and the manifest says so), so there is nothing to
 * rank and no depth to demand — the requirement is only that the static shell is
 * not *empty*, which is what a blank `<div id="root">` would be for a crawler
 * that does not run JavaScript.
 */
const APP_SURFACE_MIN_WORDS = 5;
const APP_SURFACES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/premium",
  "/study-rooms",
  "/break-free",
  "/breathe",
  "/achievements",
  "/leaderboard",
  "/roadmap",
  "/study-calculator",
  "/study-method-quiz",
  "/search",
]);

/**
 * Thin-copy ratchet.
 *
 * These 17 pages are below MIN_OWN_WORDS today and are allowed to stay there —
 * the alternative is padding them to hit a number, which would be worse than the
 * number. The baseline is the ratchet: a page may not get *thinner* than the
 * count recorded here. Add an entry only when a page legitimately needs less
 * copy; never raise one to make a build pass, and never add one to silence a
 * page that should be rewritten.
 *
 * This list is a to-do, not an endorsement. Six entries are pages whose body is
 * client-rendered and absent from the prerendered document altogether — the
 * exact "prerendered != hydrated" failure §2.10 warns about. They are recorded
 * rather than exempted so the size of that gap is visible in the source and
 * cannot grow.
 *
 * Measured 2026-09-18 against the emitted HTML (clean `vite build` +
 * prerender). The count is the page's own words with shell furniture stripped,
 * so it will move if the furniture patterns change — re-measure with the gate's
 * own message rather than by hand.
 */
const THIN_COPY_BASELINE = new Map([
  // ── Policy and legal pages whose text is client-rendered ──────────────
  // src/pages/terms.tsx holds a full terms document, but the prerender
  // manifest declares `sections: []` — so the document a crawler receives is
  // the heading, the one-line lead and the "Keep reading" list. That is the
  // §2.10 "prerendered != hydrated" failure and it is the real follow-up here:
  // the fix is to move each policy body into the manifest, not to pad it.
  // Recorded at the measured count so they cannot get thinner in the meantime.
  ["/terms", 15],
  ["/privacy", 25],
  ["/cookie-policy", 20],
  ["/acceptable-use", 17],
  ["/ai-policy", 23],
  ["/contact", 23],
  // ── Hub and long-form pages that are genuinely short of depth ─────────
  // These render their own copy; they are simply thin. Each is a real
  // editorial task, so they are ratcheted rather than silently passed.
  ["/changelog", 70],
  ["/deep-study-guide", 73],
  ["/science-of-deep-work", 79],
  ["/two-hour-study-method", 83],
  ["/pricing", 86],
  ["/feynman-technique", 104],
  ["/guides", 131],
  ["/study-techniques", 135],
  ["/blog", 145],
  ["/focus-guide", 147],
  ["/support", 65],
]);

{
  const measured = new Map();
  for (const doc of documents) {
    measured.set(doc.path, ownCopyWords(doc.html));
  }

  for (const doc of documents) {
    if (doc.path === "/404") continue;
    const words = measured.get(doc.path) ?? 0;

    const isApp = APP_SURFACES.has(doc.path) || NON_INDEXABLE.has(doc.path) || manifestNoindex.has(doc.path);

    if (isApp) {
      if (words < APP_SURFACE_MIN_WORDS) {
        problems.push(
          `${doc.path}: app surface carries ${words} word(s) of own copy — the prerendered shell is effectively empty, ` +
            `so a crawler that does not run JavaScript sees a blank page (needs ${APP_SURFACE_MIN_WORDS})`,
        );
      }
      continue;
    }

    const floor = THIN_COPY_BASELINE.get(doc.path);
    if (floor !== undefined) {
      if (words < floor) {
        problems.push(
          `${doc.path}: own copy fell to ${words} words, below its recorded ${floor} — thin pages may not get thinner ` +
            `(lower the entry in THIN_COPY_BASELINE only if the page legitimately needs less)`,
        );
      }
      continue;
    }

    if (words < MIN_OWN_WORDS) {
      problems.push(
        `${doc.path}: only ${words} words of its own copy (needs ${MIN_OWN_WORDS}). ` +
          `Shell furniture is already excluded, so this counts the page's own prose. ` +
          `Either deepen it, or — if it is a policy or tool surface where short is correct — ` +
          `add it to THIN_COPY_BASELINE at its current count.`,
      );
    }
  }

  // The ratchet's own teeth: an entry for a page that no longer exists hides a
  // real regression once that route is reintroduced thinner.
  for (const path of THIN_COPY_BASELINE.keys()) {
    if (!documentPaths.has(path)) {
      problems.push(`THIN_COPY_BASELINE lists ${path}, which is not a prerendered page — remove the stale entry`);
    }
  }
}

// ── Table parity: every declared row must reach the emitted HTML ────────────
// §18 #20 was exactly this: src/pages/comparison.tsx drew a ten-row feature
// table from COMPARISONS, and prerender.mjs emitted only the two prose verdicts.
// A crawler saw a different page than a visitor, and every row label — the part
// that carries the comparison — was missing from the indexed HTML. Nothing
// caught it: the document was well formed, self-canonical, and had valid
// JSON-LD. Parity has to be asserted against the same source the page reads.
{
  let tablesChecked = 0;
  let rowsChecked = 0;
  for (const entry of manifestRoutes) {
    if (!entry.table) continue;
    tablesChecked += 1;
    const routePath = entry.path === "" ? "/" : `/${String(entry.path).replace(/^\/+/, "").replace(/\/+$/, "")}`;
    const doc = documents.find((d) => d.path === routePath);
    if (!doc) {
      problems.push(`${routePath}: declares a comparison table but has no prerendered document`);
      continue;
    }
    if (!/<table\b/i.test(doc.html)) {
      problems.push(
        `${routePath}: manifest declares a table ("${entry.table.caption}") but the emitted HTML has no <table> — ` +
          `the crawler sees prose where the visitor sees the comparison`,
      );
      continue;
    }
    // Column headers, as scoped `<th scope="col">`.
    for (const col of entry.table.columns ?? []) {
      if (!new RegExp(`<th[^>]*scope="col"[^>]*>\\s*${escapeRegexForHtmlText(col)}`, "i").test(doc.html)) {
        problems.push(`${routePath}: table column header "${col}" is declared but not emitted with scope="col"`);
      }
    }
    // Every row label, as a scoped row header, and every cell value as text.
    for (const row of entry.table.rows ?? []) {
      rowsChecked += 1;
      const label = String(row[0]);
      if (!new RegExp(`<th[^>]*scope="row"[^>]*>\\s*${escapeRegexForHtmlText(label)}`, "i").test(doc.html)) {
        problems.push(`${routePath}: table row "${label}" is declared but not emitted as a scoped row header`);
      }
      for (const cell of row.slice(1)) {
        if (!doc.html.includes(String(cell))) {
          problems.push(`${routePath}: row "${label}" declares cell "${cell}", absent from the emitted HTML`);
        }
      }
    }
    // A tick glyph is not content — a text extractor sees nothing and a screen
    // reader announces the SVG. Count the boolean cells and require the same
    // number of Yes/No `<td>`s: checking for *a* Yes/No would pass a table where
    // one cell is text and the rest are icons, which is the actual bug.
    const boolCells = (entry.table.rows ?? [])
      .flatMap((r) => r.slice(1))
      .filter((c) => c === "Yes" || c === "No");
    for (const word of ["Yes", "No"]) {
      const declared = boolCells.filter((c) => c === word).length;
      if (!declared) continue;
      const emitted = (doc.html.match(new RegExp(`<td>\\s*${word}\\s*<\\/td>`, "gi")) ?? []).length;
      if (emitted < declared) {
        problems.push(
          `${routePath}: ${declared} cell(s) resolve to "${word}" but only ${emitted} carry it as text — a comparison ` +
            `rendered as a tick glyph is invisible to a text extractor`,
        );
      }
    }
  }
  if (tablesChecked === 0) {
    problems.push("table-parity gate checked no tables — the comparison manifest entries may have lost their `table`");
  }
  tablesCheckedTotal = tablesChecked;
  rowsCheckedTotal = rowsChecked;
}

console.log(`seo-validate: ${files.length} pages, ${sitemapUrls.length} sitemap page entries, ${apiServedChildren} child sitemap(s) served by the API in production`);
console.log(`seo-validate: content depth checked on ${files.length} pages; table parity checked on ${tablesCheckedTotal} table(s), ${rowsCheckedTotal} row(s)`);
if (problems.length > 0) {
  console.error(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  "PASS — titles, descriptions, canonicals, JSON-LD, sitemap, robots, internal-link depth, cannibalisation, llms.txt and consent wiring, breadcrumbs, jump links, title budgets, PageSEO agreement, pillar/cluster wiring, bylines, visible freshness, citation links, image hygiene, content depth and table parity all consistent",
);
