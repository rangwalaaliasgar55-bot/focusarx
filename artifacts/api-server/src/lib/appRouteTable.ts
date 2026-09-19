import fs from "node:fs";
import path from "node:path";

/**
 * The frontend's route table, read out of `src/App.tsx`.
 *
 * Three contract tests need to answer "which routes exist, and which of them
 * are login-walled?" — the sitemap contract, the soft-404 contract, and the
 * regression guard. Each used to carry its own regex, and each regex was typed
 * against one particular *rendering style*:
 *
 *     <Route path="/x" component={() => <ErrorBoundary><ProtectedRoute .../>} />
 *
 * When the routes were converted to children — `<Route path="/x">…</Route>`,
 * which stops the page subtree from remounting on every parent render — all
 * three extractors silently matched nothing. The regression guard's
 * `expect(protectedPaths.size).toBeGreaterThan(20)` is what turned that into a
 * failure rather than a vacuous pass, which is the whole point of that check.
 *
 * The lesson is that a test asserting "these routes are public" should not care
 * how a route renders its component. This parser therefore keys off the two
 * things that are actually part of the contract — the path, and whether the
 * route's own markup is wrapped in `ProtectedRoute` — and is insensitive to
 * whether the body is passed as a `component` prop or as children.
 */

/** Closing `>` of an opening tag, or the end of a self-closing tag. */
const OPENING_TAG_END = "/>";

export interface AppRoute {
  /** The literal `path` attribute, e.g. `/exam/:slug`. */
  path: string;
  /** True when this route's own content is wrapped in `<ProtectedRoute>`. */
  isProtected: boolean;
  /** True when the path contains a `:param` segment and covers a URL family. */
  isParamFamily: boolean;
}

export interface AppRouteTable {
  routes: AppRoute[];
  publicRoutes: Set<string>;
  protectedRoutes: Set<string>;
  /** Public `/prefix/:param` patterns, matched segment-wise against a URL. */
  paramPatterns: string[];
}

/**
 * Read the routes from an `App.tsx` source string.
 *
 * Routes in this file are siblings, never nested, so each route runs from its
 * `<Route` to the next `<Route` and the slice boundaries are unambiguous. That
 * is what makes a single non-JSX-aware scan sufficient: no brace or tag
 * counting is needed, and both render styles fall out of the same slice.
 */
export function parseAppRoutes(src: string): AppRoute[] {
  const starts = [...src.matchAll(/<Route\b/g)].map((m) => m.index ?? 0);
  const routes: AppRoute[] = [];

  for (let i = 0; i < starts.length; i += 1) {
    const slice = src.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : src.length);

    const pathMatch = /path="([^"]+)"/.exec(slice);
    if (!pathMatch) continue;
    const routePath = pathMatch[1]!;

    // Bound the slice to this route's opening tag plus, for the children form,
    // everything up to its closing `</Route>`. Without this a trailing comment
    // mentioning ProtectedRoute would misclassify the route.
    const tagEnd = slice.indexOf(OPENING_TAG_END);
    const childrenStart = slice.includes("</Route>") ? tagEnd : -1;
    const body =
      childrenStart === -1
        ? slice
        : slice.slice(0, tagEnd) + slice.slice(tagEnd, slice.indexOf("</Route>"));

    routes.push({
      path: routePath,
      isProtected: body.includes("ProtectedRoute"),
      isParamFamily: routePath.includes(":"),
    });
  }

  return routes;
}

/** The route table with the lookups the contract tests actually want. */
export function buildAppRouteTable(src: string): AppRouteTable {
  const routes = parseAppRoutes(src);
  const publicRoutes = new Set<string>();
  const protectedRoutes = new Set<string>();
  const paramPatterns: string[] = [];

  for (const route of routes) {
    if (route.isParamFamily) {
      // A param route covers a whole family of sitemap URLs (/exam/jee-main,
      // /comparison/focusarx-vs-forest). Recording the pattern lets those URLs
      // be matched instead of being silently skipped — skipping them made the
      // test report 20 live URLs as 404s.
      if (!route.isProtected) paramPatterns.push(route.path);
      continue;
    }
    (route.isProtected ? protectedRoutes : publicRoutes).add(route.path);
  }

  return { routes, publicRoutes, protectedRoutes, paramPatterns };
}

/** Load and parse the real `App.tsx`. */
export function readAppRouteTable(appTsxPath: string): AppRouteTable {
  return buildAppRouteTable(fs.readFileSync(appTsxPath, "utf8"));
}

/** Resolve `artifacts/focusarx/src/App.tsx` from a test in `artifacts/api-server`. */
export function defaultAppTsxPath(): string {
  return path.join(process.cwd(), "..", "focusarx", "src", "App.tsx");
}
