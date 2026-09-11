import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Soft-404 contract — the routing rules that decide what an unknown URL is.
 * ══════════════════════════════════════════════════════════════════
 * Verified in production before this test existed:
 *
 *     GET https://www.focusarx.site/totally-fake-page-xyz
 *     → 200, homepage prerender, <link rel="canonical" href="…/">
 *
 * That is a soft-404. Google indexes the junk URL, sees content identical to
 * the homepage, and files it as "Duplicate, Google chose different canonical"
 * — which is exactly the state two URLs were in inside Search Console. The
 * client-side `<meta name="robots" content="noindex">` on pages/not-found.tsx
 * never helped, because a crawler that does not execute JS (and the HTTP
 * status itself) only ever saw the homepage document.
 *
 * The fix is a routing change in vercel.json, and routing changes are invisible
 * to the compiler: the failure mode of getting them wrong is that real pages
 * start answering 404, or junk URLs go back to answering 200. Both are silent
 * until traffic drops. These assertions make the routing table mutually
 * assertive with `src/App.tsx` and the prerender manifest, so:
 *
 *   • every real route answers 200 — from disk when it is prerendered, from the
 *     SPA allowlist when it is a login-walled app screen;
 *   • everything else answers 404 with the dedicated 404 document;
 *   • a missing build asset answers 404 with NO body, never HTML (an HTML body
 *     under an asset URL is what poisoned the service-worker cache and made
 *     stale-chunk failures survive a reload — see lib/chunkRecovery.ts).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../../..");
const FRONTEND = path.resolve(here, "../../../focusarx");
const VERCEL_JSON = path.join(ROOT, "vercel.json");
const APP_TSX = path.join(FRONTEND, "src/App.tsx");
const PRERENDER_MJS = path.join(FRONTEND, "scripts/prerender-data.mjs");

interface RouteEntry {
  src?: string;
  dest?: string;
  status?: number;
  handle?: string;
  headers?: Record<string, string>;
}

function vercelConfig(): { routes: RouteEntry[]; trailingSlash?: boolean } {
  return JSON.parse(fs.readFileSync(VERCEL_JSON, "utf8"));
}

/** Static `<Route path>` values from App.tsx (no `:param` families). */
function appStaticRoutes(): Set<string> {
  const src = fs.readFileSync(APP_TSX, "utf8");
  return new Set(
    [...src.matchAll(/path="([^"]+)"/g)]
      .map((m) => m[1]!)
      .filter((p) => !p.includes(":")),
  );
}

/** The `dest: "/index.html"` alternation that keeps app screens alive. */
function spaAllowlist(): string[] {
  const route = vercelConfig().routes.find((r) => typeof r.src === "string" && r.dest === "/index.html" && r.src.includes("|"));
  expect(route, "vercel.json must keep a SPA allowlist route for non-prerendered app screens").toBeDefined();
  const body = route!.src!.replace(/^\//, "").replace(/^\(/, "").replace(/\)$/, "");
  return body.split("|").map((entry) => `/${entry}`);
}

async function prerenderPaths(): Promise<Set<string>> {
  const mod = (await import(PRERENDER_MJS)) as { ROUTES: Array<{ path: string }> };
  return new Set(mod.ROUTES.map((r) => (r.path === "" ? "/" : r.path)));
}

describe("soft-404: unknown URLs answer 404 with a dedicated document", () => {
  it("the final route serves the 404 document with a 404 status", () => {
    const routes = vercelConfig().routes;
    const last = routes[routes.length - 1]!;
    expect(last.src, "the last route must be the catch-all").toBe("/(.*)");
    expect(last.status, "the catch-all must answer 404 — 200 here is the soft-404 bug").toBe(404);
    expect(last.dest, "the catch-all must serve the dedicated 404 document, not index.html").toBe("/404.html");
  });

  it("no earlier route rewrites everything to index.html", () => {
    // The old catch-all. If it comes back ahead of the 404 rule, every unknown
    // URL is a homepage duplicate again.
    const offenders = vercelConfig().routes.filter(
      (r) => r.dest === "/index.html" && (r.src === "/(.*)" || r.src === "/.*" || r.src === "/(.+)"),
    );
    expect(offenders, `catch-all SPA rewrite is back: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it("prerender.mjs writes the 404 document the catch-all points at", () => {
    const prerender = fs.readFileSync(path.join(FRONTEND, "scripts/prerender.mjs"), "utf8");
    expect(prerender).toContain('path.join(DIST, "404.html")');

    const notFoundBlock = prerender.slice(prerender.indexOf("function buildNotFoundPage"));
    expect(notFoundBlock, "buildNotFoundPage is missing from prerender.mjs").not.toBe("");
    // A 404 that canonicalises to a live URL recreates the duplicate signal —
    // the canonical must be *removed*, not pointed at "/".
    expect(notFoundBlock).toContain('rel=["\']canonical["\']');
    expect(notFoundBlock).toMatch(/replace\(\s*\/<link\\s\+\[\^>\]\*rel=\["'\]canonical/);
    expect(notFoundBlock).toContain("noindex, nofollow");
  });

  it("the 404 route pattern is the only one that can match a junk URL", () => {
    const routes = vercelConfig().routes;
    const catchAllIndex = routes.findIndex((r) => r.src === "/(.*)");
    // `/totally-fake-page-xyz` must not be swallowed by a rule before it.
    const swallowedBy = routes
      .slice(0, catchAllIndex)
      .filter((r) => typeof r.src === "string")
      .filter((r) => new RegExp(`^${r.src}$`).test("/totally-fake-page-xyz"));
    expect(swallowedBy, `junk URL matched an earlier route: ${JSON.stringify(swallowedBy)}`).toEqual([]);
  });
});

describe("soft-404: real routes still answer 200", () => {
  it("every App.tsx route is prerendered or in the SPA allowlist", async () => {
    const prerendered = await prerenderPaths();
    const allowed = new Set(spaAllowlist());
    const missing = [...appStaticRoutes()]
      .filter((route) => !prerendered.has(route) && !allowed.has(route))
      .sort();
    expect(
      missing,
      `Routes that would now answer 404 — add them to scripts/prerender-data.mjs (public pages) ` +
        `or to the vercel.json SPA allowlist (login-walled screens): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("the SPA allowlist has no entry that is already prerendered", async () => {
    // A prerendered page served by the allowlist instead of its own file loses
    // its title, description, canonical and JSON-LD — the exact regression the
    // prerenderer exists to prevent.
    const prerendered = await prerenderPaths();
    const dead = spaAllowlist().filter((entry) => prerendered.has(entry)).sort();
    expect(dead, `Prerendered pages shadowed by the SPA fallback: ${dead.join(", ")}`).toEqual([]);
  });

  it("the SPA allowlist matches only whole paths, never sub-paths of junk", () => {
    const route = vercelConfig().routes.find((r) => r.dest === "/index.html" && r.src?.includes("|"))!;
    const rx = new RegExp(`^${route.src}$`);
    expect(rx.test("/dashboard")).toBe(true);
    expect(rx.test("/tasks")).toBe(true);
    expect(rx.test("/dashboardnonsense")).toBe(false);
    expect(rx.test("/dash")).toBe(false);
  });

  it("public profiles keep their own noindex fallback route", () => {
    const route = vercelConfig().routes.find((r) => r.src === "/u/[^/]+");
    expect(route, "the /u/<name> route must survive — it is a real product surface").toBeDefined();
    expect(route!.dest).toBe("/index.html");
    expect(route!.headers?.["X-Robots-Tag"]).toMatch(/noindex/);
  });
});

describe("soft-404: missing build assets never answer with HTML", () => {
  it("a missing /assets/* file answers 404 with no destination body", () => {
    const routes = vercelConfig().routes;
    const filesystemIndex = routes.findIndex((r) => r.handle === "filesystem");
    const assets = routes.find((r) => r.src === "/assets/.*");
    expect(assets, "missing hashed assets need an explicit 404 route").toBeDefined();
    expect(assets!.status).toBe(404);
    expect(assets!.dest, "an HTML body under a JS URL is what poisoned the SW cache").toBeUndefined();
    // It must come after `handle: filesystem` or real assets would 404 too.
    expect(routes.indexOf(assets!)).toBeGreaterThan(filesystemIndex);
  });

  it("any other missing file with an extension answers 404, not the SPA", () => {
    const route = vercelConfig().routes.find((r) => typeof r.src === "string" && r.src.includes("\\.[A-Za-z0-9]"));
    expect(route, "extension-based 404 rule missing").toBeDefined();
    expect(route!.status).toBe(404);
    expect(route!.dest).toBeUndefined();
    const rx = new RegExp(`^${route!.src}$`);
    expect(rx.test("/favicon-missing.ico")).toBe(true);
    expect(rx.test("/old/logo.png")).toBe(true);
    expect(rx.test("/pomodoro-timer")).toBe(false);
  });
});

describe("canonical URL hygiene is enforced by routing", () => {
  it("uppercase paths are routed to the API 301 before the 404 catch-all", () => {
    const routes = vercelConfig().routes;
    const canonicalizer = routes.find((r) => typeof r.dest === "string" && r.dest.includes("canonicalize="));
    expect(canonicalizer, "the case-canonicalising route must exist (301 /Blog/ → /blog)").toBeDefined();
    expect(canonicalizer!.dest).toContain("/api/index.mjs");
    const rx = new RegExp(`^${canonicalizer!.src}$`);
    expect(rx.test("/Blog")).toBe(true);
    expect(rx.test("/BLOG/")).toBe(true);
    // Lowercase canonicals must NOT match, or every page redirects to itself.
    expect(rx.test("/blog")).toBe(false);
    expect(rx.test("/exam/jee-main")).toBe(false);
    // And it must run before the catch-all, after the filesystem.
    const filesystem = routes.findIndex((r) => r.handle === "filesystem");
    expect(routes.indexOf(canonicalizer!)).toBeGreaterThan(filesystem);
    expect(routes.indexOf(canonicalizer!)).toBeLessThan(routes.findIndex((r) => r.src === "/(.*)"));
  });

  it("trailing slashes are folded to one spelling by the platform", () => {
    // Vercel answers /blog/ with a permanent redirect to /blog when this is
    // false, which is what keeps `/blog` and `/blog/` from being two URLs.
    expect(vercelConfig().trailingSlash, "trailingSlash must be false so /blog/ 308s to /blog").toBe(false);
  });

  it("the apex host still redirects to www", () => {
    const redirect = (JSON.parse(fs.readFileSync(VERCEL_JSON, "utf8")) as {
      redirects: Array<{ has?: Array<{ value?: string }>; destination?: string; permanent?: boolean }>;
    }).redirects.find((r) => r.has?.some((h) => h.value === "focusarx.site"));
    expect(redirect, "apex → www redirect must stay").toBeDefined();
    expect(redirect!.destination).toContain("https://www.focusarx.site");
    expect(redirect!.permanent).toBe(true);
  });
});
