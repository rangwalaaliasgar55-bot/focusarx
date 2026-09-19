import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every route needs a door.
 *
 * `artifacts/focusarx/src/pages/groups.tsx` is a complete, working 364-line
 * Study Groups feature — create a group, join one, see members, see rooms. It
 * shipped with **zero inbound links anywhere in the application**. Not in the
 * desktop nav, not in the mobile "More" sheet, not in the command palette, not
 * in the feature compass, not from the community page. The only way to reach it
 * was to already know the URL.
 *
 * Nothing caught it, because every existing test asks "does this page work?"
 * and none asked "can anyone get to it?". The route table and the link graph
 * were only ever checked separately.
 *
 * This gate joins them up: each declared route must be named by *some* link in
 * the app. A route that is deliberately unreachable has to be written down
 * below with a reason, which turns an accident into a decision.
 */

const SRC = join(process.cwd(), "src");
const APP = join(SRC, "App.tsx");

/** Where a route may be declared as a destination, beyond an `href`/`to`. */
const DESTINATION_SOURCES = [
  join(SRC, "components/AppShell.tsx"), // desktop + mobile nav groups
  join(SRC, "components/CommandPalette.tsx"),
  join(SRC, "components/mobile/MobileMoreMenu.tsx"),
  join(SRC, "components/FeatureCompassModal.tsx"),
  join(SRC, "components/mobile/MobileBottomNav.tsx"),
];

/**
 * Routes with no link, and why that is correct.
 *
 * Each entry is a claim about how the route is reached instead. Adding one is a
 * deliberate edit that a reviewer can disagree with — which is the whole point.
 */
const INTENTIONALLY_UNLINKED: Record<string, string> = {
  "/welcome": "post-signup destination; reached by redirect, never by a link",
  "/reset-password": "reached from a tokenised link in a password-reset email",
  "/auth/callback": "OAuth redirect target; the provider sends the user here",
  "/go/ig": "public redirect shortlink for Instagram bio traffic",
  "/search": "opened by the global search control, not by a URL link",
  "/changelog": "release history; linked from the footer of the marketing site",
  "/dna": "legacy alias for /focus-dna; renders a Redirect, so it is never a destination",
};

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(p));
    if (entry.name.includes(".test.")) continue;
    // `.mjs` matters: the pillar/cluster map — the site's actual
    // internal-linking architecture — lives in `content/clusters.mjs`.
    if (/\.(tsx|ts|mjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}

/** Every `<Route path="…">` in App.tsx, in file order. */
function declaredRoutes(): string[] {
  const src = readFileSync(APP, "utf8");
  return [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]!);
}

/** Every path the app can navigate to, from any link or nav declaration. */
function linkedPaths(): Set<string> {
  const linked = new Set<string>();
  // `path:` matters as much as `href:`: the pillar/cluster map in
  // content/clusters.mjs declares a spoke's destination as a `path`, and
  // ClusterLinks turns those into real anchors. Scanning only `href` reported
  // all four timer lengths as orphaned when two of them are linked on every
  // cluster page — a false positive that would have sent me off adding links
  // that already existed.
  const patterns = [
    /(?:href|to)=["'](\/[^"'{}]*)["']/g,
    /\bhref:\s*["'](\/[^"']*)["']/g,
    /\bpath:\s*["'](\/[^"']*)["']/g,
    // The content layer writes destinations as `"path|Label"` pairs and turns
    // them into links with `.map(pair)`. Without this pattern the whole
    // internal-linking architecture is invisible to the scan, and every SEO
    // spoke it links looks like an orphan. It sent me off adding two timer
    // pages to clusters.mjs that were already there, generated from
    // MINUTE_TIMER_DURATIONS — the duplicate then broke ClusterLinks' sibling
    // count. Read the convention instead of re-declaring its output.
    /["'`](\/[A-Za-z0-9/_-]+)\|/g,
  ];
  for (const file of tsxFiles(SRC)) {
    if (file === APP) continue;
    const src = readFileSync(file, "utf8");
    for (const re of patterns) {
      for (const m of src.matchAll(re)) linked.add(m[1]!.split("?")[0]!.split("#")[0]!);
    }
  }
  // `/5-minute-timer` … are generated as `/${m}-minute-timer` from a literal
  // array, so no pattern can see the finished path. Read the array and build
  // them, so a route for a duration that is *not* in the list still shows up
  // as the orphan it would be.
  const durations = readFileSync(join(SRC, "content/minute-timers.mjs"), "utf8").match(
    /MINUTE_TIMER_DURATIONS\s*=\s*\[([^\]]*)\]/,
  );
  for (const n of (durations?.[1] ?? "").split(",")) {
    const minutes = Number(n.trim());
    if (Number.isFinite(minutes)) linked.add(`/${minutes}-minute-timer`);
  }

  return linked;
}

/** `/comparison/:slug` renders `/comparison/focusarx-vs-forest`. */
function routePatternMatches(pattern: string, path: string): boolean {
  const re = new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:[A-Za-z_]\w*/g, "[^/]+") + "$");
  return re.test(path);
}

describe("route reachability", () => {
  const routes = declaredRoutes();
  const linked = linkedPaths();

  it("finds a plausible number of routes and links", () => {
    // Both sides of the comparison must be non-trivial, or every assertion
    // below passes for the wrong reason (an empty route list has no orphans).
    expect(routes.length).toBeGreaterThan(80);
    expect(linked.size).toBeGreaterThan(60);
  });

  it("never serves one page from two URLs", () => {
    // `/dna` and `/focus-dna` both rendered FocusDnaPage. Because the prerender
    // step writes a self-referential canonical per URL, that is two indexable
    // copies of one page, each claiming to be the original.
    const src = readFileSync(APP, "utf8");
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const m of src.matchAll(/<Route\s+path="([^"]+)"\s*>([\s\S]*?)<\/Route>/g)) {
      const [, path, body] = m;
      const comps = [...(body!.matchAll(/component=\{(\w+)\}/g) || [])].map((c) => c[1]!);
      const inline = [...(body!.matchAll(/<(\w+)\s*\/>/g) || [])]
        .map((c) => c[1]!)
        .filter((c) => c !== "PageLoader" && c !== "Redirect");
      const comp = (comps.length ? comps : inline).pop();
      if (!comp) continue;
      const previous = seen.get(comp);
      if (previous) duplicates.push(`${comp} served from both ${previous} and ${path}`);
      else seen.set(comp, path!);
    }
    expect(duplicates, `one page behind two URLs:\n${duplicates.join("\n")}`).toEqual([]);
  });

  it("gives every route a way in", () => {
    const orphans: string[] = [];
    for (const route of routes) {
      if (route.endsWith("*") || route.includes(":")) continue; // 404 + param routes
      if (route in INTENTIONALLY_UNLINKED) continue;
      const reachable =
        linked.has(route) || [...linked].some((l) => l !== route && routePatternMatches(route, l));
      if (!reachable) orphans.push(route);
    }
    expect(
      orphans,
      `routes nothing links to — give them a door, or add them to INTENTIONALLY_UNLINKED with a reason:\n${orphans.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the exemptions honest", () => {
    // An exemption for a route that no longer exists is stale permission
    // waiting to be reused by a future orphan.
    const stale = Object.keys(INTENTIONALLY_UNLINKED).filter((r) => !routes.includes(r));
    expect(stale, `INTENTIONALLY_UNLINKED names routes that do not exist: ${stale.join(", ")}`).toEqual([]);
    for (const [route, reason] of Object.entries(INTENTIONALLY_UNLINKED)) {
      expect(reason.length, `${route} needs a real reason`).toBeGreaterThan(20);
    }
  });

  it("puts every primary destination in the nav or the palette", () => {
    // The named discovery surfaces are what a user actually browses. A route
    // reachable only from a deep in-page link is still effectively hidden.
    const surfaces = DESTINATION_SOURCES.map((f) => readFileSync(f, "utf8")).join("\n");
    // The mutable "More"-style lists live here; a page that belongs to the
    // product's core loop should appear on one of them.
    const missing = ["/groups", "/study-rooms", "/pets", "/battle-pass", "/quests"].filter(
      (r) => !surfaces.includes(`"${r}"`),
    );
    expect(missing, `core destinations absent from every discovery surface: ${missing.join(", ")}`).toEqual([]);
  });
});
