#!/usr/bin/env node
// Emits Lighthouse category scores + key metrics as GitHub `::notice::`
// annotations. Annotations are retrievable via the check-runs API even when the
// raw job log and uploaded artifacts are served from storage that isn't
// reachable from every environment — this is how the measured numbers get
// published. Reads the raw LHR result files `lhci collect` writes to
// `.lighthouseci/` (a local manifest.json is only produced by the filesystem
// upload target, which we don't use).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const dir = resolve(".lighthouseci");
if (!existsSync(dir)) {
  console.log("::warning::No .lighthouseci/ — LHCI collect did not run");
  process.exit(0);
}
const lhrFiles = readdirSync(dir).filter((f) => /^lhr-.*\.json$/.test(f));
if (lhrFiles.length === 0) {
  console.log("::warning::No lhr-*.json in .lighthouseci/ — nothing to publish");
  process.exit(0);
}

const pct = (n) => (n == null ? "n/a" : Math.round(n * 100));
const ms = (n) => (n == null ? "n/a" : `${Math.round(n)}ms`);
const kb = (n) => (n == null ? "n/a" : `${(n / 1024).toFixed(0)}kb`);
const median = (arr) => {
  const s = [...arr].filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor((s.length - 1) / 2)];
};

// Group every run by the page path it measured.
const byPath = new Map();
for (const f of lhrFiles) {
  let lhr;
  try {
    lhr = JSON.parse(readFileSync(join(dir, f), "utf8"));
  } catch {
    continue;
  }
  const url = lhr.finalDisplayedUrl || lhr.finalUrl || lhr.requestedUrl || "";
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    /* keep raw */
  }
  const c = lhr.categories ?? {};
  const a = lhr.audits ?? {};
  const items = a["resource-summary"]?.details?.items ?? [];
  const run = {
    performance: c.performance?.score,
    accessibility: c.accessibility?.score,
    "best-practices": c["best-practices"]?.score,
    seo: c.seo?.score,
    lcp: a["largest-contentful-paint"]?.numericValue,
    cls: a["cumulative-layout-shift"]?.numericValue,
    tti: a["interactive"]?.numericValue,
    tbt: a["total-blocking-time"]?.numericValue,
    script: items.find((i) => i.resourceType === "script")?.transferSize,
  };
  if (!byPath.has(path)) byPath.set(path, []);
  byPath.get(path).push(run);
}

const rows = [];
for (const [path, runs] of [...byPath.entries()].sort()) {
  const m = (k) => median(runs.map((r) => r[k]));
  const line =
    `perf=${pct(m("performance"))} a11y=${pct(m("accessibility"))} ` +
    `best-practices=${pct(m("best-practices"))} seo=${pct(m("seo"))} | ` +
    `LCP=${ms(m("lcp"))} CLS=${m("cls") == null ? "n/a" : m("cls").toFixed(3)} ` +
    `TTI=${ms(m("tti"))} TBT=${ms(m("tbt"))} script=${kb(m("script"))} ` +
    `(median of ${runs.length})`;
  console.log(`::notice title=Lighthouse ${path}::${line}`);
  const cls = m("cls");
  rows.push(
    `| \`${path}\` | ${pct(m("performance"))} | ${pct(m("accessibility"))} | ${pct(m("best-practices"))} | ${pct(m("seo"))} | ${ms(m("lcp"))} | ${cls == null ? "n/a" : cls.toFixed(3)} | ${ms(m("tti"))} | ${ms(m("tbt"))} | ${kb(m("script"))} |`,
  );
}

if (process.env.GITHUB_STEP_SUMMARY && rows.length) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Lighthouse (desktop, simulated, median run)\n\n` +
      `| URL | Perf | A11y | Best-pr | SEO | LCP | CLS | TTI | TBT | Script |\n` +
      `|---|---|---|---|---|---|---|---|---|---|\n${rows.join("\n")}\n`,
  );
}
