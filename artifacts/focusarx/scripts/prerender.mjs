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
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTES, SITE_NAME } from "./prerender-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist", "public");
const TEMPLATE = path.join(DIST, "index.html");
const BASE_URL = (process.env.VITE_APP_URL || "https://focusarx.site").replace(/\/+$/, "");

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

function renderBody(entry, url) {
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
    const fullTitle = entry.title;

    let html = template;

    // Title & description
    html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(fullTitle)}</title>`);
    html = setMeta(html, "name", "description", entry.description);

    // Canonical + URL-bearing tags
    html = setCanonical(html, url);
    html = setMeta(html, "property", "og:url", url);
    html = setMeta(html, "property", "og:title", fullTitle);
    html = setMeta(html, "property", "og:description", entry.description);
    html = setMeta(html, "name", "twitter:title", fullTitle);
    html = setMeta(html, "name", "twitter:description", entry.description);
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
    const body = renderBody(entry, url);
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

  console.log(`prerender: wrote ${written} static pages to dist/public`);
}

main();
