/**
 * Heading anchors — one slugger, two renderers.
 *
 * The jump-link table of contents has to point at ids that exist in BOTH the
 * prerendered HTML (scripts/prerender.mjs) and the hydrated page
 * (components/ContentTOC.tsx). If the two derived ids differently, every
 * "on this page" link would work for a crawler reading the static document and
 * jump nowhere for the person who clicked it — or the reverse. So the slug rule
 * lives here and nothing else implements it.
 */

/**
 * "The pattern, precisely" → "the-pattern-precisely".
 *
 * Lowercase, drop anything that is not a letter, number, combining mark or
 * space (apostrophes, commas, em dashes, parentheses), collapse runs of spaces
 * and hyphens to a single hyphen.
 *
 * Deliberately NOT NFKD-normalised: decomposition would turn "पढ़ाई टाइमर" into
 * "पढई-टइमर" and "Café" into "cafe", so an anchor would stop matching the
 * heading a reader can see. Keeping letters (`\p{L}`) and marks (`\p{M}`)
 * intact means an Indian-language heading slugs to itself.
 *
 * @param {string} text
 * @returns {string}
 */
export function headingId(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug a list of headings, de-duplicating as we go: two sections called
 * "Strategy" become `strategy` and `strategy-2`, which is what a browser does
 * with duplicate ids anyway except that ours are deterministic.
 *
 * @param {string[]} headings
 * @returns {{id: string, label: string}[]}
 */
export function headingAnchors(headings) {
  const seen = new Map();
  return headings.map((label) => {
    const base = headingId(label) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { id: count === 0 ? base : `${base}-${count + 1}`, label };
  });
}
