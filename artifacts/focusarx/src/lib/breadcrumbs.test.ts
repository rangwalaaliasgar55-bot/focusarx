import { describe, expect, it } from "vitest";
import {
  breadcrumbListSchema,
  breadcrumbTrail,
  LINKABLE_SEGMENTS,
} from "./breadcrumbs.mjs";
import { headingAnchors, headingId } from "./heading-id.mjs";

/**
 * The breadcrumb trail and the heading anchors are each derived once and
 * consumed by three renderers: the prerendered static document
 * (scripts/prerender.mjs), the hydrated page (components/Breadcrumbs.tsx,
 * components/ContentTOC.tsx) and the JSON-LD written on client-side navigation
 * (components/PageSEO.tsx).
 *
 * These tests pin the derivation itself. If a crumb label or an anchor id
 * changes here, the visible trail and the structured data change together —
 * which is the whole point. A drift between them is how a breadcrumb rich
 * result gets dropped, and a dead `#anchor` is how a jump link starts lying.
 */

const BASE = "https://www.focusarx.site";

describe("breadcrumbTrail", () => {
  it("starts at Home and labels known hubs", () => {
    expect(breadcrumbTrail("/exam/gre", { title: "GRE guide" })).toEqual([
      { name: "Home", path: "/", linkable: true },
      { name: "Exam guides", path: "/exam", linkable: true },
      { name: "GRE guide", path: "/exam/gre", linkable: false },
    ]);
  });

  it("never links the current page", () => {
    const trail = breadcrumbTrail("/blog/why-25-minutes-works", { title: "Why 25 minutes works" });
    expect(trail.at(-1)).toMatchObject({ linkable: false, name: "Why 25 minutes works" });
    expect(trail.at(-2)).toMatchObject({ name: "Blog", path: "/blog", linkable: true });
  });

  it("leaves a crumb unlinked when that hub route does not exist", () => {
    // /comparison and /pomodoro-timer-for have no index page yet. A crumb that
    // links to a 404 is worse than plain text — the gate in scripts/seo-validate.mjs
    // fails the build on it, so the trail has to know which hubs are real.
    for (const path of ["/comparison/focusarx-vs-anki", "/pomodoro-timer-for/clat"]) {
      const trail = breadcrumbTrail(path, { title: "T" });
      expect(trail[1].linkable).toBe(false);
      expect(LINKABLE_SEGMENTS.has(path.split("/")[1]!)).toBe(false);
    }
  });

  it("falls back to a sentence-cased slug and strips the brand suffix", () => {
    const trail = breadcrumbTrail("/15-minute-timer", {
      title: "15 minute timer for revision sprints | FocusArx",
    });
    expect(trail.map((c) => c.name)).toEqual(["Home", "15 minute timer for revision sprints"]);
    expect(breadcrumbTrail("/deep-work-timer")[1]!.name).toBe("Deep work timer");
  });

  it("gives the homepage nothing to trail", () => {
    expect(breadcrumbTrail("/", { title: "FocusArx" })).toHaveLength(1);
  });

  it("ignores trailing slashes and query-ish noise in the path", () => {
    expect(breadcrumbTrail("/exam/gre/", { title: "GRE" })).toHaveLength(3);
    expect(breadcrumbTrail("//exam//gre", { title: "GRE" })!.map((c) => c.path)).toEqual([
      "/",
      "/exam",
      "/exam/gre",
    ]);
  });
});

describe("breadcrumbListSchema", () => {
  it("numbers crumbs from 1 and points at absolute URLs", () => {
    const schema = breadcrumbListSchema(
      breadcrumbTrail("/exam/gre", { title: "GRE guide" }),
      BASE,
    ) as { "@type": string; itemListElement: { position: number; name: string; item?: string }[] };

    expect(schema["@type"]).toBe("BreadcrumbList");
    expect(schema.itemListElement.map((c) => c.position)).toEqual([1, 2, 3]);
    expect(schema.itemListElement[0]!.item).toBe(`${BASE}/`);
    expect(schema.itemListElement[1]!.item).toBe(`${BASE}/exam`);
  });

  it("omits item for crumbs that do not resolve, and for the current page", () => {
    const schema = breadcrumbListSchema(
      breadcrumbTrail("/pomodoro-timer-for/clat", { title: "Pomodoro timer for CLAT" }),
      `${BASE}/`,
    ) as { itemListElement: { name: string; item?: string }[] };

    expect(schema.itemListElement.map((c) => c.item)).toEqual([
      `${BASE}/`,
      undefined,
      undefined,
    ]);
    // A ListItem without `item` is valid; a ListItem pointing at a 404 is not.
    expect(schema.itemListElement[1]).toEqual({ "@type": "ListItem", position: 2, name: "Pomodoro timers" });
  });
});

describe("headingId", () => {
  it("slugs punctuation, case and spaces the way a reader would expect", () => {
    expect(headingId("The shortened format, precisely")).toBe("the-shortened-format-precisely");
    expect(headingId("NDA & NA: the exam that starts at 16")).toBe("nda-na-the-exam-that-starts-at-16");
    expect(headingId("What's the 25/5 rule?")).toBe("whats-the-255-rule");
    expect(headingId("  Spaced   out  ")).toBe("spaced-out");
  });

  it("keeps non-ASCII letters and marks, so the anchor matches the heading", () => {
    // NFKD decomposition would mangle both of these into something a reader
    // could not find on the page again.
    expect(headingId("पढ़ाई टाइमर")).toBe("पढ़ाई-टाइमर");
    expect(headingId("Café study plan")).toBe("café-study-plan");
  });

  it("is empty for a heading made only of punctuation", () => {
    expect(headingId("— · —")).toBe("");
  });
});

describe("headingAnchors", () => {
  it("de-duplicates repeats deterministically", () => {
    const anchors = headingAnchors(["Strategy", "Timing", "Strategy", "strategy"]);
    expect(anchors.map((a) => a.id)).toEqual(["strategy", "timing", "strategy-2", "strategy-3"]);
    expect(anchors.map((a) => a.label)).toEqual(["Strategy", "Timing", "Strategy", "strategy"]);
  });

  it("gives an unusable heading a placeholder id rather than dropping it", () => {
    expect(headingAnchors(["—", "—"])[0]!.id).toBe("section");
    expect(headingAnchors(["—", "—"])[1]!.id).toBe("section-2");
  });

  it("preserves order, because the TOC is read as an outline", () => {
    const headings = ["How to run it", "Why fifteen minutes", "Frequently asked questions"];
    expect(headingAnchors(headings).map((a) => a.label)).toEqual(headings);
  });
});
