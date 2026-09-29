#!/usr/bin/env node
// Emits Lighthouse category scores + key metrics as GitHub `::notice::`
// annotations. Annotations are retrievable via the check-runs API even when the
// raw job log and uploaded artifacts are served from storage that isn't
// reachable from every environment — this is how the measured numbers get
// published. Reads LHCI's local run manifest written by `lhci autorun`.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve(".lighthouseci/manifest.json");
if (!existsSync(manifestPath)) {
  console.log("::warning::No .lighthouseci/manifest.json — LHCI collect did not run");
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
// One representative run per URL (LHCI marks the median run).
const runs = manifest.filter((r) => r.isRepresentativeRun);

const pct = (n) => (n == null ? "n/a" : Math.round(n * 100));
const ms = (n) => (n == null ? "n/a" : `${Math.round(n)}ms`);
const kb = (n) => (n == null ? "n/a" : `${(n / 1024).toFixed(0)}kb`);

const rows = [];
for (const run of runs) {
  const s = run.summary ?? {};
  let lcp, cls, tti, tbt, script;
  try {
    const lhr = JSON.parse(readFileSync(run.jsonPath, "utf8"));
    const a = lhr.audits ?? {};
    lcp = a["largest-contentful-paint"]?.numericValue;
    cls = a["cumulative-layout-shift"]?.numericValue;
    tti = a["interactive"]?.numericValue;
    tbt = a["total-blocking-time"]?.numericValue;
    const items = a["resource-summary"]?.details?.items ?? [];
    script = items.find((i) => i.resourceType === "script")?.transferSize;
  } catch {
    /* metrics best-effort */
  }
  const path = new URL(run.url).pathname;
  const line =
    `perf=${pct(s.performance)} a11y=${pct(s.accessibility)} ` +
    `best-practices=${pct(s["best-practices"])} seo=${pct(s.seo)} | ` +
    `LCP=${ms(lcp)} CLS=${cls == null ? "n/a" : cls.toFixed(3)} ` +
    `TTI=${ms(tti)} TBT=${ms(tbt)} script=${kb(script)}`;
  console.log(`::notice title=Lighthouse ${path}::${line}`);
  rows.push(`| \`${path}\` | ${pct(s.performance)} | ${pct(s.accessibility)} | ${pct(s["best-practices"])} | ${pct(s.seo)} | ${ms(lcp)} | ${cls == null ? "n/a" : cls.toFixed(3)} | ${ms(tti)} | ${ms(tbt)} | ${kb(script)} |`);
}

// Also write a Markdown table to the job summary for humans.
if (process.env.GITHUB_STEP_SUMMARY && rows.length) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Lighthouse (desktop, simulated, representative run)\n\n` +
      `| URL | Perf | A11y | Best-pr | SEO | LCP | CLS | TTI | TBT | Script |\n` +
      `|---|---|---|---|---|---|---|---|---|---|\n${rows.join("\n")}\n`,
  );
}
