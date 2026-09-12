// Bundle budgets (Phase 10 quality gates).
// Run after `vite build`: node scripts/check-bundle-budget.mjs
// Fails CI when the entry shell grows past the Instagram-funnel budget or
// when three.js leaks into the initial preload graph.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const DIST = join(here, "..", "dist", "public");
const ASSETS = join(DIST, "assets");

// gzip budgets (bytes)
const BUDGETS = {
  // SPA shell shared by every route — the funnel-critical number.
  entryJsGzip: 55 * 1024,
  // Any single lazy route chunk.
  routeChunkGzip: 75 * 1024,
  // Shared vendor chunks (cached across routes, loaded once).
  vendorChunkGzip: 95 * 1024,
  // Total initial JS for the marketing shell (entry + vendor-react + router).
  initialJsGzip: 140 * 1024,
};

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`bundle-budget FAIL: ${msg}`);
};
const ok = (msg) => console.log(`bundle-budget ok: ${msg}`);

const gz = (file) => gzipSync(readFileSync(file)).length;

const files = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));
// The live entry is whatever dist/index.html actually loads — never guess
// by filename sort (stale hashed files can linger next to the current one).
const indexHtmlEarly = readFileSync(join(DIST, "index.html"), "utf8");
const entryMatch = indexHtmlEarly.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
const entry = entryMatch?.[1] ?? files.filter((f) => /^index-.*\.js$/.test(f)).sort().at(-1);
if (!entry) {
  fail("no entry chunk (index-*.js) found");
} else {
  const size = gz(join(ASSETS, entry));
  if (size > BUDGETS.entryJsGzip) fail(`entry ${entry} gzip ${size} > ${BUDGETS.entryJsGzip}`);
  else ok(`entry ${entry} gzip ${(size / 1024).toFixed(1)}kb`);
}

for (const f of files) {
  if (f === entry) continue;
  if (/vendor-three/.test(f)) continue; // lazy 3D, never initial
  const size = gz(join(ASSETS, f));
  const budget = /^vendor-/.test(f) ? BUDGETS.vendorChunkGzip : BUDGETS.routeChunkGzip;
  if (size > budget) fail(`chunk ${f} gzip ${size} > ${budget}`);
}
ok("route chunks within budget");

const initialCandidates = files.filter((f) => f === entry || /vendor-react|vendor-router/.test(f));
const initialTotal = initialCandidates.reduce((sum, f) => sum + gz(join(ASSETS, f)), 0);
if (initialTotal > BUDGETS.initialJsGzip) {
  fail(`initial JS gzip ${initialTotal} > ${BUDGETS.initialJsGzip}`);
} else {
  ok(`initial JS gzip ${(initialTotal / 1024).toFixed(1)}kb`);
}

// ── Per-page document budgets ─────────────────────────────────────────
// The JS budgets above only cover the shared shell. Every prerendered route —
// including the programmatic ones (/exam/*, /pomodoro-timer-for/*,
// /comparison/*) — ships its own static HTML, and that document is what a
// crawler and a first-time visitor on a slow phone actually download before
// anything else. A page that grows a 400kb inline blob passes every JS budget
// and still wrecks LCP, so the documents are gated too.
{
  const HTML_BUDGET_BYTES = 120 * 1024; // one prerendered document
  const MIN_PRERENDERED_PAGES = 89; // manifest size; guards silent regressions

  const walkHtml = (dir, acc = []) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walkHtml(full, acc);
      else if (entry.endsWith(".html")) acc.push(full);
    }
    return acc;
  };

  const pages = walkHtml(DIST);
  if (pages.length < MIN_PRERENDERED_PAGES) {
    fail(`only ${pages.length} prerendered pages, expected at least ${MIN_PRERENDERED_PAGES}`);
  } else {
    ok(`${pages.length} prerendered pages`);
  }

  const oversized = [];
  let total = 0;
  for (const file of pages) {
    const bytes = statSync(file).size;
    total += bytes;
    if (bytes > HTML_BUDGET_BYTES) oversized.push([relative(DIST, file), bytes]);
  }
  if (oversized.length > 0) {
    for (const [name, bytes] of oversized) {
      fail(`document ${name} is ${(bytes / 1024).toFixed(1)}kb, over the ${(HTML_BUDGET_BYTES / 1024).toFixed(0)}kb prerendered-page budget`);
    }
  } else {
    ok(`prerendered documents within budget (avg ${(total / Math.max(pages.length, 1) / 1024).toFixed(1)}kb)`);
  }

  // Every page must boot from the same budgeted entry: a route that quietly
  // pulls an extra blocking script or stylesheet is a per-page regression the
  // aggregate numbers hide.
  const extraBlocking = [];
  for (const file of pages) {
    const html = readFileSync(file, "utf8");
    const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    const styles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    const unexpectedScripts = scripts.filter((src) => !/\/assets\/index-[^/]+\.js$/.test(src) && !/^https:\/\//.test(src));
    const unexpectedStyles = styles.filter((href) => !/\/assets\/index-[^/]+\.css$/.test(href));
    if (unexpectedScripts.length || unexpectedStyles.length) {
      extraBlocking.push([relative(DIST, file), [...unexpectedScripts, ...unexpectedStyles]]);
    }
  }
  if (extraBlocking.length > 0) {
    for (const [name, assets] of extraBlocking.slice(0, 10)) {
      fail(`${name} loads non-entry blocking assets: ${assets.join(", ")}`);
    }
  } else {
    ok("every page boots from the single budgeted entry chunk");
  }
}

// three.js must stay out of the entry preload graph (Moto G4 funnel).
const indexHtml = readFileSync(join(DIST, "index.html"), "utf8");
const threePreload = [...indexHtml.matchAll(/modulepreload[^>]*three[^>]*>/g)];
if (threePreload.length > 0) fail(`three.js in entry preloads (${threePreload.length} hits)`);
else ok("three.js not preloaded by entry");

if (failures > 0) {
  console.error(`bundle-budget: ${failures} failure(s)`);
  process.exit(1);
}
console.log("bundle-budget: PASS");
