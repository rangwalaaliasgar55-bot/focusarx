import { describe, expect, it } from "vitest";
import { EXAM_GUIDES, findExamGuide } from "@/content/exam/index.mjs";
import { EXAM_NAMES, EXAM_SLUG_ORDER, decorateExamGuide, examDisplayName, examTimerLabel } from "@/content/exam/derive.mjs";
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

  it("keeps the short timer label for the two universal guides", () => {
    // Those two have no exam factbox, so their display name is a full headline.
    expect(examTimerLabel("exam-anxiety")).toBe("exam-anxiety");
    expect(examTimerLabel("last-minute-revision")).toBe("last-minute-revision");
    expect(examTimerLabel("jee-main")).toBe("JEE Main");
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
