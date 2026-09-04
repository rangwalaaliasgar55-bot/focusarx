// Bundle budgets (Phase 10 quality gates).
// Run after `vite build`: node scripts/check-bundle-budget.mjs
// Fails CI when the entry shell grows past the Instagram-funnel budget or
// when three.js leaks into the initial preload graph.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
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
const entry = files.filter((f) => /^index-.*\.js$/.test(f)).sort().at(-1);
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
