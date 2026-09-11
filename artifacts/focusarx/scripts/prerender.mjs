#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
// FocusArx build-time prerenderer
// ══════════════════════════════════════════════════════════════════
// Generates a static HTML file for every public route listed in
// scripts/prerender-data.mjs, each with its own <title>, meta
// description, canonical URL, Open Graph / Twitter tags, JSON-LD
// structured data, and crawler-visible body content.
//
// Why: the app is a client-rendered SPA. Without prerendering, every
// URL shares the homepage's title/description for crawlers and social
// scrapers that don't execute JavaScript. With prerendering:
//   - Google/Bing get unique titles + snippets per URL (better CTR)
//   - Facebook/WhatsApp/X/Discord/LinkedIn previews work everywhere
//   - Content is visible even before the JS bundle hydrates
//
// The static body inside #root is replaced when React mounts, so the
// interactive app behaves exactly as before.
//
// Hosting: Vercel's `"handle": "filesystem"` route serves these files
// automatically before falling back to the SPA index.html.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { clampText, composeTitle, DESCRIPTION_BUDGET } from "../src/lib/seo-text.mjs";
import { parseRobots, robotsMetaFor } from "../src/lib/robots-parse.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTES, SITE_NAME } from "./prerender-data.mjs";
import { BLOG_POSTS } from "../src/content/blog.mjs";
import { LAST_REVIEWED } from "../src/content/seo-pages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIST = path.resolve(__dirname, "..", "dist", "public");

/**
 * The directives that ship at /robots.txt. vercel.json serves this static file (only
 * /sitemap*.xml is rewritten to the API), so it — not the app — is what a crawler
 * reads first. Prerendering must agree with it: a page that robots.txt disallows but
 * whose HTML says `index, follow` tells Google to keep an entry it cannot describe,
 * and every login-walled screen in this build did exactly that until the two were
 * wired together here.
 */
const ROBOTS_FILE = [
  path.join(__dirname, "../public/robots.txt"),
  path.join(DIST, "robots.txt"),
].find((candidate) => existsSync(candidate));
const robotsGroups = parseRobots(ROBOTS_FILE ? readFileSync(ROBOTS_FILE, "utf8") : "").groups;

const TEMPLATE = path.join(DIST, "index.html");
const BASE_URL = (process.env.VITE_APP_URL || "https://www.focusarx.site").replace(/\/+$/, "");

// ── helpers ────────────────────────────────────────────────────────
const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function replaceTag(html, regex, replacement) {
  if (!regex.test(html)) {
    throw new Error(`prerender: pattern not found: ${regex}`);
  }
  return html.replace(regex, replacement);
}

// Replace the content of a meta tag matched by an attribute selector.
function setMeta(html, attr, name, content) {
  const regex = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${name.replace(/[-:]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  return replaceTag(html, regex, `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`);
}

function setCanonical(html, url) {
  return replaceTag(
    html,
    /<link\s+[^>]*rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
  );
}

// Remove global JSON-LD blocks (FAQPage / ItemList) that only belong on
// the homepage — every route inherits the built index.html head.
function stripHomepageOnlySchemas(html) {
  return html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
    (block) => (/"@type":\s*"(FAQPage|ItemList)"/.test(block) ? "" : block),
  );
}

function breadcrumbSchema(routePath, title) {
  const parts = routePath.split("/").filter(Boolean);
  const items = [{ "@type": "ListItem", position: 1, name: "Home", item: BASE_URL }];
  parts.forEach((p, i) => {
    items.push({
      "@type": "ListItem",
      position: i + 2,
      name: p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      item: `${BASE_URL}/${parts.slice(0, i + 1).join("/")}`,
    });
  });
  // The last crumb should be labeled with the real page title.
  if (items.length > 1) items[items.length - 1].name = title.replace(/\s*\|\s*FocusArx.*$/i, "");
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

function articleSchema(entry, url) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: entry.h1,
    description: entry.description,
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
    },
    dateModified: new Date().toISOString().slice(0, 10),
    mainEntityOfPage: url,
  };
}

function faqSchema(faq) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

function softwareApplicationSchema(entry, url) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: entry.software.name,
    applicationCategory: entry.software.category,
    operatingSystem: "Web",
    url,
    description: entry.software.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    // No aggregateRating. Google's review-snippet policy bars self-serving
    // reviews, and there is no sourced rating to publish. See /evidence.
  };
}

function howToSchema(entry) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: entry.howTo.name,
    description: entry.answerFirst || entry.lead,
    step: entry.howTo.steps.map((st, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: st.name,
      text: st.text,
    })),
  };
}

// ── prerendered body ───────────────────────────────────────────────
const SHELL_CSS = `
/* ── Static SEO shell (seen ONLY by crawlers without JavaScript) ──
   Every rule is scoped: nothing here can affect the React app's styles.
   The inline <head> script adds .fa-js before first paint, which hides
   this whole shell from every real browser and from Googlebot (which
   renders JS) — they get the real app instead. */
html.fa-js .fa-seo,html.fa-js .fa-noscript{display:none}
html:not(.fa-js){color-scheme:dark}
html:not(.fa-js) body{background:#0b0d13}
.fa-seo{max-width:760px;margin:0 auto;padding:72px 24px 96px;color:#e7e9ee;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.65}
.fa-seo *{margin:0;padding:0;box-sizing:border-box}
.fa-seo .badge{display:inline-block;border:1px solid rgba(124,58,237,.35);background:rgba(124,58,237,.12);color:#a78bfa;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:600;margin-bottom:20px}
.fa-seo h1{font-size:34px;font-weight:700;line-height:1.2;letter-spacing:-.02em;margin-bottom:14px}
.fa-seo h2{font-size:21px;font-weight:600;margin:32px 0 8px}
.fa-seo h3{font-size:16px;font-weight:600;margin:20px 0 6px}
.fa-seo .lead{font-size:17px;color:#b9bdca;margin-bottom:28px}
.fa-seo p{color:#b9bdca;font-size:15px;margin-bottom:14px}
.fa-seo a{color:#a78bfa}
.fa-seo .related{margin-top:44px;border-top:1px solid rgba(255,255,255,.08);padding-top:24px}
.fa-seo .related strong{display:block;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#8b90a0;margin-bottom:10px}
.fa-seo .related ul{list-style:none;display:grid;gap:6px}
.fa-seo .answer{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.03);border-radius:14px;padding:18px;color:#e7e9ee;font-size:15px;margin-bottom:22px}
.fa-seo ol.steps{list-style:decimal inside;margin:10px 0 18px;color:#b9bdca;font-size:15px}
.fa-seo ol.steps li{margin-bottom:8px}
.fa-seo .sources{margin-top:28px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02);border-radius:14px;padding:16px}
.fa-seo .sources strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#8b90a0;margin-bottom:8px}
.fa-seo .sources ul{list-style:none;color:#8b90a0;font-size:13px}
.fa-seo .sources p{color:#8b90a0;font-size:12px;margin-top:8px}
.fa-seo .cta{display:inline-block;margin-top:40px;background:linear-gradient(90deg,#7c3aed,#4f46e5);color:#fff;font-weight:700;padding:13px 24px;border-radius:12px;text-decoration:none}
.fa-noscript{max-width:760px;margin:0 auto;padding:16px 24px;color:#8b90a0;font-size:14px}
`;

// ── the 404 document ───────────────────────────────────────────────
/**
 * Emit `dist/public/404.html` — the document vercel.json serves (with a real
 * HTTP 404 status) for every URL that is not a file and not a known SPA route.
 *
 * Why a dedicated file instead of the SPA shell:
 *   Before this existed the catch-all route rewrote *any* unknown path to
 *   `/index.html` with status 200, so `/totally-fake-page-xyz` answered with
 *   the homepage prerender — homepage title, homepage description and
 *   `<link rel="canonical" href="https://www.focusarx.site/">`. That is the
 *   textbook soft-404: Google indexes the garbage URL as a duplicate of the
 *   homepage and then picks the homepage as canonical, which is exactly the
 *   "Duplicate, Google chose different canonical" state in Search Console.
 *
 * The document therefore:
 *   - carries `noindex, nofollow` (so a crawler that ignores the status still
 *     drops it),
 *   - has NO canonical at all — a 404 must not point at any live URL, and
 *     pointing it at "/" is what created the duplicate-canonical signal,
 *   - has NO og:url for the same reason,
 *   - keeps its own unique title/description (the build gate rejects a page
 *     that borrows another page's copy),
 *   - ships real, useful navigation: a search box that works without
 *     JavaScript (`GET /search?q=`) plus links to the highest-value pages.
 *
 * React still mounts on top of it (same bundle, same `#root`), so a human
 * lands on the interactive `pages/not-found.tsx` — the static body is only
 * what a no-JS crawler sees, and it is hidden by `.fa-js` the moment any
 * browser starts executing scripts.
 */
const NOT_FOUND_TITLE = "Page not found";
const NOT_FOUND_DESCRIPTION =
  "That FocusArx page does not exist. Search the site, or jump to the Pomodoro timer, study guides, exam plans and the blog.";
const NOT_FOUND_LINKS = [
  ["/pomodoro-timer", "Pomodoro timer"],
  ["/focus-timer", "Focus timer"],
  ["/study-timer", "Study timer"],
  ["/guides", "All study and focus guides"],
  ["/exam", "Exam study plans"],
  ["/blog", "Blog"],
  ["/pricing", "Pricing"],
  ["/support", "Help center"],
];

function renderNotFoundBody() {
  const links = NOT_FOUND_LINKS.map(
    ([href, label]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`,
  ).join("");
  return `<div class="fa-seo"><span class="badge">${SITE_NAME}</span><h1>Page not found</h1><p class="lead">Nothing lives at this address. The page may have moved, or the link may have a typo in it.</p>` +
    `<form class="answer" action="/search" method="get" role="search">` +
    `<label for="fa-404-q"><strong>Search FocusArx</strong></label>` +
    `<input id="fa-404-q" name="q" type="search" placeholder="Try “pomodoro”, “JEE”, “deep work”" autocomplete="off" />` +
    `<button class="cta" type="submit">Search</button></form>` +
    `<div class="related"><strong>Popular pages</strong><ul>${links}</ul></div>` +
    `<a class="cta" href="/">Back to the homepage</a></div>`;
}

function buildNotFoundPage(template) {
  let html = template;

  html = setMeta(html, "name", "robots", "noindex, nofollow");
  html = replaceTag(
    html,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(composeTitle(NOT_FOUND_TITLE))}</title>`,
  );
  html = setMeta(html, "name", "description", NOT_FOUND_DESCRIPTION);

  // A 404 must not canonicalize to anything — pointing it at "/" is what made
  // Google treat every unknown URL as a homepage duplicate.
  html = html.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>\s*/gi, "");
  html = html.replace(/<meta\s+[^>]*property=["']og:url["'][^>]*>\s*/gi, "");
  html = html.replace(/<meta\s+[^>]*property=["']al:web:url["'][^>]*>\s*/gi, "");

  html = setMeta(html, "property", "og:title", composeTitle(NOT_FOUND_TITLE));
  html = setMeta(html, "property", "og:description", NOT_FOUND_DESCRIPTION);
  html = setMeta(html, "name", "twitter:title", composeTitle(NOT_FOUND_TITLE));
  html = setMeta(html, "name", "twitter:description", NOT_FOUND_DESCRIPTION);

  // Drop every route-scoped and homepage-only schema. What stays is the
  // site-wide Organization/WebSite block (the search box on this page is a
  // real sitelinks search target), so the document still carries JSON-LD.
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g,
    (block) => (/"@type":\s*"(FAQPage|ItemList|BreadcrumbList|Article|HowTo|SoftwareApplication)"/.test(block) ? "" : block),
  );

  html = html.replace(/<div id="root"\s*><\/div>/i, `<div id="root">${renderNotFoundBody()}</div>`);
  html = html.replace("</head>", `  <style>${SHELL_CSS}${NOT_FOUND_CSS}</style>\n</head>`);
  html = html.replace(
    "<head>",
    `<head>\n    <script>document.documentElement.classList.add("fa-js")</script>`,
  );
  return html;
}

const NOT_FOUND_CSS = `
.fa-seo form.answer{display:grid;gap:10px}
.fa-seo form.answer label strong{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#8b90a0}
.fa-seo form.answer input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:12px 14px;color:#e7e9ee;font-size:15px}
.fa-seo form.answer .cta{margin-top:4px;justify-self:start;border:0;cursor:pointer;font-size:15px}
`;

// ── RSS feed ───────────────────────────────────────────────────────
/**
 * Build `/feed.xml` at compile time.
 *
 * Generated here rather than by the API for the same reason the pages are
 * prerendered: every item is a page this build already knows about, so the
 * feed can never list a URL that 404s, never needs a database, and costs one
 * static file instead of a cold function invocation. The `lastBuildDate` is
 * genuinely the build time, which is the honest value for a static site.
 *
 * Items come from two sources that both live in the prerender manifest:
 *   - blog posts   (`category: blog`)   — dated, by slug
 *   - article pages (`category: guide`) — the evergreen guides, dated by their
 *     visible "last reviewed" value so the feed agrees with the page.
 */
function buildFeedXml({ posts, articles, buildDate }) {
  const escapeXml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  const rfc822 = (iso) => {
    const at = new Date(`${iso}T00:00:00Z`);
    return Number.isFinite(at.getTime()) ? at.toUTCString() : buildDate;
  };
  const item = ({ url, title, description, date, category }) => [
    "    <item>",
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(`${BASE_URL}${url}`)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(`${BASE_URL}${url}`)}</guid>`,
    `      <description>${escapeXml(description)}</description>`,
    `      <pubDate>${rfc822(date)}</pubDate>`,
    `      <category>${escapeXml(category)}</category>`,
    "    </item>",
  ].join("\n");

  const items = [
    ...posts.map((p) => ({
      url: `/blog/${p.slug}`,
      title: p.title,
      description: p.description,
      date: p.date,
      category: "blog",
    })),
    ...articles.map((a) => ({ ...a, category: "guide" })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(`${SITE_NAME} — focus and study articles`)}</title>`,
    `    <link>${escapeXml(`${BASE_URL}/blog`)}</link>`,
    `    <atom:link href="${escapeXml(`${BASE_URL}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    "    <description>Science-backed articles on focus, deep work, revision and exam preparation from FocusArx.</description>",
    "    <language>en-in</language>",
    `    <lastBuildDate>${buildDate}</lastBuildDate>`,
    `    <copyright>© ${new Date(buildDate).getUTCFullYear()} ${SITE_NAME}</copyright>`,
    "    <ttl>360</ttl>",
    ...items.map(item),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

function renderBody(entry) {
  const sections = (entry.sections || [])
    .map((s) => {
      const paras = (Array.isArray(s.p) ? s.p : [s.p])
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("\n");
      return `<h2>${escapeHtml(s.h)}</h2>${paras}`;
    })
    .join("\n");
  const related = (entry.related || [])
    .map((pair) => {
      const [href, label] = pair.split("|");
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(label || href)}</a></li>`;
    })
    .join("");
  const relatedBlock = related
    ? `<div class="related"><strong>Keep reading</strong><ul>${related}</ul></div>`
    : "";

  // Answer-first block: a self-contained answer that still makes sense if an
  // AI Overview or featured snippet quotes it out of context.
  const answerBlock = entry.answerFirst
    ? `<p class="answer">${escapeHtml(entry.answerFirst)}</p>`
    : "";

  // Ordered steps, when the page carries a HowTo.
  const stepsBlock = entry.howTo
    ? `<h2>${escapeHtml(entry.howTo.name)}</h2><ol class="steps">${entry.howTo.steps
        .map((st) => `<li><strong>${escapeHtml(st.name)}</strong> — ${escapeHtml(st.text)}</li>`)
        .join("")}</ol>`
    : "";

  // Visible FAQ. FAQPage JSON-LD must describe content the reader can see,
  // so every FAQ pair is rendered into the static body too.
  const faqBlock = entry.faq?.length
    ? `<h2>Frequently asked questions</h2>${entry.faq
        .map(([q, a]) => `<h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p>`)
        .join("")}`
    : "";

  // Visible attribution. Structured data must describe content the reader can
  // actually see, so sources are rendered, not just declared.
  const sourcesBlock = entry.sources?.length
    ? `<div class="sources"><strong>Sources and attribution</strong><ul>${entry.sources
        .map((src) => `<li>${escapeHtml(src)}</li>`)
        .join("")}</ul>${
          entry.lastReviewed
            ? `<p>Last reviewed ${escapeHtml(entry.lastReviewed)}.</p>`
            : ""
        }</div>`
    : "";

  const cta = entry.cta || { href: "/signup", label: "Start focusing free" };
  return `<div class="fa-seo"><span class="badge">${SITE_NAME}</span><h1>${escapeHtml(entry.h1)}</h1><p class="lead">${escapeHtml(entry.lead)}</p>${answerBlock}${stepsBlock}${sections}${faqBlock}${sourcesBlock}${relatedBlock}<a class="cta" href="${escapeHtml(cta.href)}">${escapeHtml(cta.label)}</a></div>`;
}

// ── main ───────────────────────────────────────────────────────────
function main() {
  if (!existsSync(TEMPLATE)) {
    console.error("prerender: dist/public/index.html not found — run `vite build` first.");
    process.exit(1);
  }

  const template = readFileSync(TEMPLATE, "utf8");
  let written = 0;

  for (const entry of ROUTES) {
    const url =
      entry.path === ""
        ? `${BASE_URL}/`
        : `${BASE_URL}${entry.path.startsWith("/") ? entry.path : `/${entry.path}`}`;
    // Composed here, not in the manifest: the runtime (components/PageSEO.tsx) uses
    // the same helpers, so the prerendered HTML and the client-rendered head cannot
    // disagree about the brand suffix or the search-result text budget.
    const fullTitle = composeTitle(entry.title);
    const metaDescription = clampText(entry.description, DESCRIPTION_BUDGET);

    let html = template;

    // Indexability: derived from robots.txt so the two can never disagree, and
    // overridable per route in the manifest with `noindex: true`.
    const routePath = entry.path === "" ? "/" : `/${String(entry.path).replace(/^\/+/, "").replace(/\/+$/, "")}`;
    const robotsMeta = entry.noindex === true ? "noindex, nofollow" : robotsMetaFor(routePath, robotsGroups);
    html = setMeta(html, "name", "robots", robotsMeta);

    // Title & description
    html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(fullTitle)}</title>`);
    html = setMeta(html, "name", "description", metaDescription);

    // Canonical + URL-bearing tags
    html = setCanonical(html, url);
    html = setMeta(html, "property", "og:url", url);
    html = setMeta(html, "property", "og:title", fullTitle);
    html = setMeta(html, "property", "og:description", metaDescription);
    html = setMeta(html, "name", "twitter:title", fullTitle);
    html = setMeta(html, "name", "twitter:description", metaDescription);
    if (entry.ogImage) {
      html = setMeta(html, "property", "og:image", entry.ogImage);
      html = setMeta(html, "property", "og:image:secure_url", entry.ogImage);
      html = setMeta(html, "name", "twitter:image", entry.ogImage);
    }
    html = replaceTag(
      html,
      /<meta\s+property=["']al:web:url["'][^>]*>/i,
      `<meta property="al:web:url" content="${escapeHtml(url)}" />`,
    );

    // Route-scoped structured data + strip homepage-only global schemas
    // on non-home routes (FAQ/ItemList belong to the landing page).
    const schemas = [breadcrumbSchema(entry.path, fullTitle)];
    if (entry.article) schemas.push(articleSchema(entry, url));
    if (entry.software) schemas.push(softwareApplicationSchema(entry, url));
    if (entry.howTo) schemas.push(howToSchema(entry));
    if (entry.faq) schemas.push(faqSchema(entry.faq));
    const ld = schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n");
    if (entry.path !== "") html = stripHomepageOnlySchemas(html);
    html = html.replace("</head>", `  <!-- Route-scoped structured data (prerendered) -->\n  ${ld}\n</head>`);

    // Static body content injected into #root (replaced on React mount)
    const body = renderBody(entry);
    html = html.replace(
      /<div id="root"\s*><\/div>/i,
      `<div id="root">${body}</div>`,
    );

    // Minimal critical CSS so the prerendered shell looks intentional
    // before the app bundle loads.
    html = html.replace("</head>", `  <style>${SHELL_CSS}</style>\n</head>`);

    // Inline head script — runs synchronously BEFORE the body paints, so
    // any browser executing JavaScript never sees the static SEO shell
    // (CSS above hides .fa-seo when this class is present). No-JS
    // crawlers never run this, so they still see the full content.
    html = html.replace(
      "<head>",
      `<head>\n    <script>document.documentElement.classList.add("fa-js")</script>`,
    );

    // noscript notice (content above is already visible without JS)
    html = html.replace(
      "</body>",
      `<noscript><p class="fa-noscript">${SITE_NAME} is an interactive app — content above is a static summary. Enable JavaScript for the full experience.</p></noscript>\n  </body>`,
    );

    const outDir = path.join(DIST, entry.path);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "index.html"), html);
    written++;
  }

  // The unknown-URL document. Written last so it can never be mistaken for a
  // manifest route, and skipped when the template is missing (same guard as
  // the loop above).
  writeFileSync(path.join(DIST, "404.html"), buildNotFoundPage(template));
  written++;

  // /feed.xml — RSS for the blog and the evergreen guides. Every item is a URL
  // this build also prerendered, so the feed cannot advertise a dead link.
  const feedArticles = ROUTES.filter((entry) => entry.article === true)
    .slice(0, 20)
    .map((entry) => ({
      url: entry.path.startsWith("/") ? entry.path : `/${entry.path}`,
      title: String(entry.title).replace(/\s*[|—–]\s*FocusArx\s*$/i, "").trim(),
      description: entry.description,
      date: entry.lastReviewed || LAST_REVIEWED,
    }));
  writeFileSync(
    path.join(DIST, "feed.xml"),
    buildFeedXml({
      posts: BLOG_POSTS,
      articles: feedArticles,
      buildDate: new Date().toUTCString(),
    }),
  );

  console.log(
    `prerender: wrote ${written} static pages to dist/public (incl. 404.html and feed.xml)`,
  );
}

main();
