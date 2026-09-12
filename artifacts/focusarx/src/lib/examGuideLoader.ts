import { use } from "react";
import type { ExamGuide } from "@/content/exam/index.mjs";
import { EXAM_SLUG_ORDER, decorateExamGuide } from "@/content/exam/derive.mjs";

/**
 * ══════════════════════════════════════════════════════════════════
 * Per-slug exam guide loading
 * ══════════════════════════════════════════════════════════════════
 * One exam guide is ~15kb of prose; the cluster is 23 of them. Importing the
 * cluster index from a page put every guide body into a single route chunk
 * (~88kb gzip), so a visitor reading /exam/gre downloaded the CTET and IBPS PO
 * guides too — and the chunk broke the 75kb route budget in
 * scripts/check-bundle-budget.mjs.
 *
 * This module gives each guide its own chunk via `import.meta.glob` and hands
 * pages the guide they asked for. Two details matter:
 *
 *  1. The cluster index, the shared link list and the derived-data module are
 *     excluded from the glob. Including them would put every guide body back
 *     into one chunk as a possible dynamic target, defeating the split.
 *  2. Promises are cached at module scope and consumed through React 19's
 *     `use()` inside a Suspense boundary. That is not a stylistic choice: a
 *     `useState`/`useEffect` loader renders a fallback on the first client
 *     render, which throws away the prerendered HTML React is hydrating and
 *     flashes an empty page on exactly the SEO pages we prerender. With
 *     `use()`, React keeps the server-rendered content on screen and defers
 *     hydration of the boundary until the chunk arrives.
 *
 * Loaded guides go through `decorateExamGuide()`, the same function
 * src/content/exam/index.mjs applies when the prerenderer builds the static
 * HTML — so the rendered page and the crawled page carry identical copy and
 * identical internal links (derive.test.mjs asserts it).
 */

type GuideModule = Record<string, unknown>;

const guideModules = import.meta.glob<GuideModule>([
  "../content/exam/*.mjs",
  "!../content/exam/index.mjs",
  "!../content/exam/links.mjs",
  "!../content/exam/derive.mjs",
]);

/** Each guide file exports exactly one guide object; find it by slug. */
function pickGuide(mod: GuideModule, slug: string): ExamGuide | null {
  for (const value of Object.values(mod)) {
    if (value && typeof value === "object" && (value as ExamGuide).slug === slug) {
      return value as ExamGuide;
    }
  }
  return null;
}

const guideCache = new Map<string, Promise<ExamGuide | null>>();

/**
 * Resolve one decorated guide, or null when the slug has no guide file.
 * Cached: `use()` must see the same promise identity across renders.
 */
export function loadExamGuide(slug: string): Promise<ExamGuide | null> {
  const cached = guideCache.get(slug);
  if (cached) return cached;

  const loader = guideModules[`../content/exam/${slug}.mjs`];
  const promise: Promise<ExamGuide | null> = loader
    ? loader()
        .then((mod) => {
          const guide = pickGuide(mod, slug);
          return guide ? decorateExamGuide(guide) : null;
        })
        .catch(() => null)
    : Promise.resolve(null);

  guideCache.set(slug, promise);
  return promise;
}

let allGuidesPromise: Promise<ExamGuide[]> | null = null;

/**
 * Every guide, in cluster order, for the /exam hub grid. Loads the per-slug
 * chunks in parallel — the hub genuinely needs all of them, and each chunk is
 * then cached for the guide page a reader clicks through to.
 */
export function loadAllExamGuides(): Promise<ExamGuide[]> {
  if (allGuidesPromise) return allGuidesPromise;
  allGuidesPromise = Promise.all(EXAM_SLUG_ORDER.map(loadExamGuide)).then((guides) =>
    guides.filter((g): g is ExamGuide => g !== null),
  );
  return allGuidesPromise;
}

/** Suspense-friendly single-guide read. */
export function useExamGuide(slug: string): ExamGuide | null {
  return use(loadExamGuide(slug));
}

/** Suspense-friendly whole-cluster read (hub only). */
export function useAllExamGuides(): ExamGuide[] {
  return use(loadAllExamGuides());
}
