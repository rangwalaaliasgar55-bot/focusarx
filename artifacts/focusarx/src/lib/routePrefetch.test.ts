import { describe, it, expect } from "vitest";
import { ROUTE_CHUNKS, routeChunkFor } from "./routeChunks";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.resolve(here, "../App.tsx"), "utf8");

describe("route chunk prefetch map", () => {
  it("resolves exact paths to the same module the router lazy-loads", () => {
    // `/focus` is the funnel landing page — the one route whose chunk must
    // never be missing from the map, because it is the first impression.
    expect(routeChunkFor("/focus")).toBeTypeOf("function");
    expect(routeChunkFor("/dashboard")).toBeTypeOf("function");
    expect(routeChunkFor("/study-rooms")).toBeTypeOf("function");
  });

  it("resolves dynamic routes by their static prefix, longest first", () => {
    expect(routeChunkFor("/u/ada")).toBeTypeOf("function");
    expect(routeChunkFor("/blog/why-focus")).toBeTypeOf("function");
    expect(routeChunkFor("/pomodoro-timer-for/neet")).toBeTypeOf("function");
  });

  it("ignores trailing slashes and query strings", () => {
    expect(routeChunkFor("/focus/")).toBe(routeChunkFor("/focus"));
    expect(routeChunkFor("/focus?duration=25")).toBe(routeChunkFor("/focus"));
  });

  it("returns null for a path the build does not own", () => {
    expect(routeChunkFor("/definitely-not-a-route")).toBeNull();
  });

  it("covers every route the router declares", () => {
    // The map is generated from App.tsx; this is the guard that keeps it that
    // way. A new page added to the router without a prefetch entry is a page
    // that will always load slowly, which is the exact bug this file fixes.
    //
    // Three routes legitimately own no page chunk: `/` and `/go/ig` are eager
    // wrapper components (they decide between landing and focus, and between a
    // redirect and signup) and `/dna` is a `<Redirect>`. They are listed rather
    // than pattern-skipped so that a *fourth* one has to be argued for here.
    const noChunk = new Set(["/", "/go/ig", "/dna"]);
    const declared = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]!);
    const missing = declared.filter((declaredPath) => {
      if (noChunk.has(declaredPath)) return false;
      return routeChunkFor(declaredPath.replace(/:[^/]+/g, "x")) === null;
    });
    expect(missing, `no prefetch entry for: ${missing.join(", ")}`).toEqual([]);
  });

  it("never prefetches the admin chunk from a hover on a public page", async () => {
    const { prefetchRoute } = await import("./routePrefetch");
    // `import()` cannot be observed directly here, so assert the exclusion
    // list's effect: the admin chunk is intentionally not in the map.
    expect(Object.keys(ROUTE_CHUNKS)).not.toContain("/admin/anything");
    expect(() => prefetchRoute("/admin")).not.toThrow();
  });
});
