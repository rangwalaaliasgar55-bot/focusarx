/**
 * Breadcrumb trail — one derivation, three consumers.
 *
 * A nested page needs the same trail in three places and they must agree:
 *   1. the visible trail a reader can click (components/Breadcrumbs.tsx),
 *   2. the BreadcrumbList JSON-LD in the prerendered document
 *      (scripts/prerender.mjs), and
 *   3. the BreadcrumbList JSON-LD written on client-side navigation
 *      (components/PageSEO.tsx).
 *
 * Google compares the visible trail against the structured data, and a mismatch
 * is the kind of thing that quietly loses the breadcrumb rich result — so the
 * labels are computed here once and every consumer renders that.
 */

/**
 * First-path segments that actually have an index route. A crumb pointing at a
 * path the router does not serve is worse than no crumb at all — it is a dead
 * link on every page in that cluster. Such segments render as plain text until
 * their hub exists; adding the name here lights the link up everywhere at once.
 */
export const LINKABLE_SEGMENTS = new Set(["blog", "exam"]);

/** Segment labels that read better than the slug, for the hubs. */
const HUB_LABELS = {
  exam: "Exam guides",
  blog: "Blog",
  comparison: "Comparisons",
  "pomodoro-timer-for": "Pomodoro timers",
  guides: "Guides",
  focus: "Focus",
};

/** "jee-main" → "Jee main"; hub segments get their real label instead. */
function segmentLabel(segment) {
  if (HUB_LABELS[segment]) return HUB_LABELS[segment];
  // Sentence case, not Title Case — the same rule the rest of the copy follows.
  const words = segment.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Drop the brand suffix a composed <title> carries. */
function stripBrand(title) {
  return String(title).replace(/\s*\|\s*FocusArx.*$/i, "").trim();
}

/**
 * @param {string} routePath  "/exam/gre", "/", "/blog/why-25-minutes-works"
 * @param {{title?: string}} [options]  page title for the last crumb
 * @returns {{name: string, path: string, linkable: boolean}[]} trail from Home
 */
export function breadcrumbTrail(routePath, options = {}) {
  const clean = String(routePath || "/").replace(/^\/+/, "").replace(/\/+$/, "");
  // filter(Boolean): a doubled slash must not become an empty crumb.
  const segments = clean ? clean.split("/").filter(Boolean) : [];
  const trail = [{ name: "Home", path: "/", linkable: true }];

  segments.forEach((segment, i) => {
    const isLast = i === segments.length - 1;
    const name =
      isLast && options.title ? stripBrand(options.title) : segmentLabel(segment);
    trail.push({
      name,
      path: `/${segments.slice(0, i + 1).join("/")}`,
      // The current page is never a link, and an intermediate crumb is only a
      // link when that hub route exists.
      linkable: !isLast && LINKABLE_SEGMENTS.has(segment),
    });
  });

  return trail;
}

/**
 * BreadcrumbList structured data for a trail.
 *
 * @param {{name: string, path: string, linkable?: boolean}[]} trail
 * @param {string} baseUrl absolute origin, e.g. https://www.focusarx.site
 */
export function breadcrumbListSchema(trail, baseUrl) {
  const origin = String(baseUrl).replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      // `item` only for crumbs that resolve to a real page — a BreadcrumbList
      // pointing at a 404 is how a breadcrumb rich result gets withdrawn.
      ...(crumb.path === "/" || crumb.linkable
        ? { item: crumb.path === "/" ? `${origin}/` : `${origin}${crumb.path}` }
        : {}),
    })),
  };
}
