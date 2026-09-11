import { describe, expect, it } from "vitest";
import {
  CLUSTERS,
  clustersFor,
  pillarCluster,
  pillarLinksFor,
  siblingSpokes,
} from "./clusters.mjs";

/**
 * The pillar/cluster map is the site's internal-linking architecture, and it is
 * read by four things that must agree: the prerenderer, ClusterLinks, the pillar
 * pages, and the gate in scripts/seo-validate.mjs that fails the build when a
 * spoke has no way back up.
 *
 * What these tests protect is the shape of the map. A duplicate spoke renders
 * the same link twice; a pillar listed as its own spoke produces a link to the
 * page you are on; an empty label produces an empty anchor. The gate covers the
 * rest — that every path resolves to a real document.
 */

describe("cluster map", () => {
  it("has exactly the three pillars the strategy names", () => {
    expect(CLUSTERS.map((c) => c.id)).toEqual(["pomodoro", "deep-work", "exams"]);
    expect(CLUSTERS.map((c) => c.pillar)).toEqual(["/pomodoro-guide", "/deep-work-guide", "/exam"]);
  });

  it("gives every cluster a label, a blurb and spokes worth linking", () => {
    for (const cluster of CLUSTERS) {
      expect(cluster.label.length, cluster.id).toBeGreaterThan(2);
      expect(cluster.blurb.length, `${cluster.id} blurb`).toBeGreaterThan(40);
      expect(cluster.spokes.length, `${cluster.id} spokes`).toBeGreaterThan(8);
      for (const spoke of cluster.spokes) {
        expect(spoke.path.startsWith("/"), `${cluster.id}: ${spoke.path}`).toBe(true);
        expect(spoke.label.trim().length, `${cluster.id}: ${spoke.path} label`).toBeGreaterThan(2);
      }
    }
  });

  it("never lists a pillar as its own spoke, and never a spoke twice", () => {
    for (const cluster of CLUSTERS) {
      const seen = new Set<string>();
      for (const spoke of cluster.spokes) {
        expect(spoke.path, `${cluster.id}: pillar listed as a spoke`).not.toBe(cluster.pillar);
        expect(seen.has(spoke.path), `${cluster.id}: duplicate spoke ${spoke.path}`).toBe(false);
        seen.add(spoke.path);
      }
    }
  });

  it("covers the exam cluster from derived content, not a typed-out list", () => {
    const exams = pillarCluster("/exam")!;
    const guidePaths = exams.spokes.filter((s) => s.path.startsWith("/exam/")).map((s) => s.path);
    const timerPaths = exams.spokes
      .filter((s) => s.path.startsWith("/pomodoro-timer-for/"))
      .map((s) => s.path);
    expect(guidePaths.length).toBe(23);
    // Every guide has a dedicated timer page, so the two lists match.
    expect(timerPaths.length).toBe(guidePaths.length);
    // Link text is the short label: "CAT study plan", not the factbox name.
    expect(exams.spokes.find((s) => s.path === "/exam/cat")!.label).toBe("CAT study plan");
    expect(exams.spokes.find((s) => s.path === "/exam/exam-anxiety")!.label).toBe("Beat exam anxiety");
    expect(exams.spokes.find((s) => s.path === "/pomodoro-timer-for/nda")!.label).toBe(
      "Pomodoro timer for NDA & NA",
    );
  });
});

describe("clustersFor", () => {
  it("finds every cluster a page belongs to", () => {
    expect(clustersFor("/two-hour-study-method").map((c) => c.id)).toEqual(["pomodoro", "deep-work"]);
    expect(clustersFor("/exam/gre").map((c) => c.id)).toEqual(["exams"]);
    expect(clustersFor("/comparison/focusarx-vs-anki").map((c) => c.id)).toEqual(["exams"]);
    expect(clustersFor("/comparison/focusarx-vs-notion").map((c) => c.id)).toEqual(["deep-work"]);
    expect(clustersFor("/blog/why-25-minutes-works").map((c) => c.id)).toEqual(["pomodoro"]);
  });

  it("does not treat a pillar as a spoke of itself", () => {
    expect(clustersFor("/exam")).toEqual([]);
    expect(pillarCluster("/exam")!.id).toBe("exams");
    expect(pillarCluster("/exam/gre")).toBeNull();
  });

  it("leaves pages outside the clusters alone", () => {
    for (const path of ["/privacy", "/pricing", "/dashboard", "/changelog"]) {
      expect(clustersFor(path), path).toEqual([]);
      expect(pillarLinksFor(path), path).toEqual([]);
    }
  });
});

describe("pillarLinksFor", () => {
  it("gives a spoke the way back to each of its pillars", () => {
    expect(pillarLinksFor("/two-hour-study-method")).toEqual([
      { href: "/pomodoro-guide", label: "The Pomodoro technique", cluster: "Pomodoro" },
      { href: "/deep-work-guide", label: "The deep work guide", cluster: "Deep work" },
    ]);
  });
});

describe("siblingSpokes", () => {
  it("offers neighbours from the same cluster, without the page itself", () => {
    const siblings = siblingSpokes("/5-minute-timer", 4);
    expect(siblings).toHaveLength(4);
    expect(siblings.map((s) => s.path)).not.toContain("/5-minute-timer");
    expect(siblings.every((s) => s.cluster === "Pomodoro")).toBe(true);
  });

  it("honours the exclude list, so a page never repeats a link", () => {
    const without = siblingSpokes("/5-minute-timer", 4, ["/pomodoro-timer", "/focus-timer"]);
    expect(without.map((s) => s.path)).not.toContain("/pomodoro-timer");
    expect(without.map((s) => s.path)).not.toContain("/focus-timer");
  });

  it("pulls from a second cluster once the first runs out", () => {
    const siblings = siblingSpokes("/two-hour-study-method", 60);
    expect(new Set(siblings.map((s) => s.cluster)).size).toBe(2);
    // Still de-duplicated across the two clusters.
    expect(new Set(siblings.map((s) => s.path)).size).toBe(siblings.length);
  });

  it("returns nothing for a page outside every cluster", () => {
    expect(siblingSpokes("/privacy")).toEqual([]);
  });
});
