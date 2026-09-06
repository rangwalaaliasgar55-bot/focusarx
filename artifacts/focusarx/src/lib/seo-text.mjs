/**
 * The text budget for search results, in one place for both renderers.
 *
 * Two code paths write the same tags: components/PageSEO.tsx at runtime (client
 * navigation) and scripts/prerender.mjs at build time (the HTML crawlers and social
 * scrapers actually see). Before this module they each composed titles their own
 * way, so a page could look fine in the app and ship a clipped title — and a fix
 * applied to one file silently left the other behind.
 */

/** The brand mark every title ends with. Never authored in a page again. */
export const BRAND = "FocusArx";
export const SEPARATOR = " | ";

/**
 * Google renders about 580px of title before clipping mid-word — roughly 60
 * characters at the sizes this site uses — and about 160 for the description.
 */
export const TITLE_BUDGET = 60;
export const DESCRIPTION_BUDGET = 160;

/**
 * Below this a snippet reads as boilerplate, so clampText prefers a word-boundary
 * cut that keeps more text over a short complete sentence. The same floor is what
 * scripts/seo-validate.mjs fails the build on.
 */
export const MIN_SNIPPET = 60;

/** Characters the brand mark costs when composeTitle re-appends it. */
const BRAND_COST = SEPARATOR.length + BRAND.length;

/**
 * What is left for the page's own words once the brand mark is attached. Content
 * that cannot know its length ahead of time — the generated /pomodoro-timer-for/:exam
 * funnels — clamps to this; hand-authored copy is expected to fit it without help,
 * which is what scripts/seo-validate.mjs enforces.
 */
export const PAGE_TITLE_BUDGET = Math.max(10, TITLE_BUDGET - BRAND_COST);

/**
 * Cut `text` down to `limit` characters on something that still reads.
 *
 * Programmatic pages (the /pomodoro-timer-for/:exam funnel, guide indexes, any copy
 * that comes from a content file) cannot know their composed length at authoring
 * time. Google clips those itself — mid-word, with an ellipsis, keeping the least
 * useful tail. Clamping here means the sentence that ships is a sentence we wrote.
 *
 * @param {string} text
 * @param {number} limit
 * @param {{ fullStop?: boolean }} [options] `fullStop: false` for titles, which do
 *   not end in punctuation.
 */
export function clampText(text, limit, { fullStop = true } = {}) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;

  const window = clean.slice(0, limit + 1);
  // A whole sentence that fits beats a truncated one — but only if it is long
  // enough to describe the page on its own.
  for (const mark of [". ", "! ", "? "]) {
    const end = window.lastIndexOf(mark);
    if (end + 1 >= MIN_SNIPPET && end + 1 <= limit) return window.slice(0, end + 1).trim();
  }

  const space = window.lastIndexOf(" ");
  let cut = (space > 0 ? window.slice(0, space) : window).trim().replace(/[,;:.\-–—]+$/, "");
  if (fullStop && !/[.!?]$/.test(cut)) cut = `${cut}.`;
  return cut.slice(0, limit);
}

/**
 * The one canonical form of a page title.
 *
 * Titles used to embed `| FocusArx` (or `— FocusArx`) themselves, and a
 * `title.includes("FocusArx")` check then skipped the suffix — so the brand had
 * three spellings and the length budget was unpredictable. Any trailing brand mark
 * is stripped and the canonical one re-appended after the page part is clamped to
 * the remaining budget: both authoring styles render identically, and no title can
 * be emitted over budget.
 */
export function composeTitle(raw) {
  const stripped = String(raw ?? "").replace(new RegExp(`\\s*[|—–]\\s*${BRAND}\\s*$`), "");
  const page = clampText(stripped, PAGE_TITLE_BUDGET, { fullStop: false });
  if (import.meta.env?.DEV && stripped.trim() !== page) {
    console.warn(`[seo] title was too long for search results and got clipped: "${stripped}"`);
  }
  // An empty page part happens on a route that never set a title; a bare
  // " | FocusArx" is worse than the brand on its own.
  return page ? `${page}${SEPARATOR}${BRAND}` : BRAND;
}
