import { describe, expect, it } from "vitest";
import { EXAM_GUIDES, findExamGuide } from "@/content/exam/index.mjs";
import { EXAM_NAMES, EXAM_SLUG_ORDER, decorateExamGuide, examDisplayName, funnelDescription, funnelHeading, funnelLabel, funnelTitle } from "@/content/exam/derive.mjs";
import { FUNNEL_ANGLES } from "@/content/exam-funnel.mjs";
import { DESCRIPTION_BUDGET, PAGE_TITLE_BUDGET } from "@/lib/seo-text.mjs";
import { loadAllExamGuides, loadExamGuide } from "@/lib/examGuideLoader";

/**
 * The exam cluster is rendered twice from one content source: the prerenderer
 * builds static HTML from `EXAM_GUIDES` (which imports every guide body), while
 * the client loads one guide chunk per slug through `examGuideLoader` and takes
 * names/order from the lightweight `derive.mjs`.
 *
 * These tests are what make that split safe. If the derived slug list, the
 * display-name map or the decoration drift from the real guides, the rendered
 * page and the crawled page would disagree — which is the cloaking failure the
 * single-content-source rule exists to prevent.
 */
describe("exam cluster derived data", () => {
  it("lists every guide slug, in cluster order", () => {
    expect(EXAM_SLUG_ORDER).toEqual(EXAM_GUIDES.map((g) => g.slug));
  });

  it("names every guide exactly as the guide names itself", () => {
    for (const guide of EXAM_GUIDES) {
      expect(
        EXAM_NAMES[guide.slug],
        `EXAM_NAMES['${guide.slug}'] must equal exam?.name ?? h1`,
      ).toBe(guide.exam?.name ?? guide.h1);
      expect(examDisplayName(guide.slug)).toBe(guide.exam?.name ?? guide.h1);
    }
    expect(Object.keys(EXAM_NAMES)).toHaveLength(EXAM_GUIDES.length);
  });

  it("gives every funnel page a label short enough to title it", () => {
    // The two universal guides have no exam factbox, so their display name is a
    // full headline; the funnel label is what a reader should see instead.
    expect(funnelLabel("exam-anxiety")).toBe("exam anxiety");
    expect(funnelLabel("last-minute-revision")).toBe("last-minute revision");
    expect(funnelLabel("jee-main")).toBe("JEE Main");
    // Parentheticals are guide-body detail and fatal in a 49-character title.
    expect(funnelLabel("nda")).toBe("NDA & NA");
    expect(funnelLabel("cat")).toBe("CAT");

    for (const slug of Object.keys(FUNNEL_ANGLES)) {
      const title = funnelTitle(slug);
      const description = funnelDescription(slug);
      expect(title.length, `funnel title for ${slug}`).toBeLessThanOrEqual(PAGE_TITLE_BUDGET);
      expect(title.endsWith(")"), `funnel title for ${slug} must keep its year`).toBe(true);
      expect(description.length, `funnel description for ${slug}`).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
      // A description cut mid-list reads as a broken page in the SERP.
      expect(description.endsWith("."), `funnel description for ${slug}`).toBe(true);
      expect(description, `funnel description for ${slug}`).not.toMatch(/(\band|\bthe|\bis|\bof|,)\.$/);
      expect(funnelHeading(slug)).toBe(`Pomodoro timer for ${funnelLabel(slug)}`);
    }
  });

  it("falls back to the slug for an unknown exam", () => {
    expect(examDisplayName("not-an-exam")).toBe("not-an-exam");
  });
});

describe("exam guide loader", () => {
  it("resolves a slug to exactly the guide the prerenderer writes", async () => {
    for (const slug of ["jee-main", "gre", "ca-foundation", "last-minute-revision"]) {
      const loaded = await loadExamGuide(slug);
      expect(loaded, `${slug} should load`).not.toBeNull();
      expect(loaded).toEqual(findExamGuide(slug));
    }
  });

  it("loads every guide, in cluster order, identical to EXAM_GUIDES", async () => {
    const all = await loadAllExamGuides();
    expect(all.map((g) => g.slug)).toEqual(EXAM_SLUG_ORDER);
    expect(all).toEqual(EXAM_GUIDES);
  });

  it("returns null for an unknown slug instead of throwing", async () => {
    expect(await loadExamGuide("exam-that-does-not-exist")).toBeNull();
  });

  it("caches, so use() sees a stable promise identity", () => {
    expect(loadExamGuide("gate")).toBe(loadExamGuide("gate"));
    expect(loadAllExamGuides()).toBe(loadAllExamGuides());
  });

  it("decorates a raw guide the same way the cluster index does", async () => {
    const mod = (await import("@/content/exam/gate.mjs")) as { gate: typeof EXAM_GUIDES[number] };
    expect(decorateExamGuide(mod.gate)).toEqual(findExamGuide("gate"));
  });
});
