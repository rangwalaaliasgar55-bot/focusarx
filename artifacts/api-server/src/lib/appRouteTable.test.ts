import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildAppRouteTable, parseAppRoutes, defaultAppTsxPath } from "./appRouteTable";

/**
 * The extractor behind the sitemap, soft-404 and regression-guard contracts.
 *
 * It exists because all three of those tests used to carry a regex written
 * against one rendering style, so converting the routes to children made them
 * match nothing at all. A test that asserts "these routes are public" must not
 * care how a route renders its component, so both styles are covered here
 * explicitly.
 */

const CHILDREN_STYLE = `
function RoutedContent() {
  return (
    <Switch>
      <Route path="/about"><ErrorBoundary><AboutPage /></ErrorBoundary></Route>
      <Route path="/dashboard"><ErrorBoundary><ProtectedRoute component={DashboardPage} /></ErrorBoundary></Route>
      <Route path="/exam/:slug"><ErrorBoundary><ExamGuidePage /></ErrorBoundary></Route>
    </Switch>
  );
}`;

const COMPONENT_STYLE = `
function RoutedContent() {
  return (
    <Switch>
      <Route path="/about" component={() => <ErrorBoundary><AboutPage /></ErrorBoundary>} />
      <Route path="/dashboard" component={() => <ErrorBoundary><ProtectedRoute component={DashboardPage} /></ErrorBoundary>} />
      <Route path="/exam/:slug" component={() => <ErrorBoundary><ExamGuidePage /></ErrorBoundary>} />
    </Switch>
  );
}`;

describe("parseAppRoutes", () => {
  it("reads routes rendered as children", () => {
    const routes = parseAppRoutes(CHILDREN_STYLE);
    expect(routes.map((r) => r.path)).toEqual(["/about", "/dashboard", "/exam/:slug"]);
    expect(routes.find((r) => r.path === "/dashboard")?.isProtected).toBe(true);
    expect(routes.find((r) => r.path === "/about")?.isProtected).toBe(false);
  });

  it("reads routes rendered via the component prop", () => {
    // The original form. Both must keep working — the point of the parser is
    // that a future refactor back to either style cannot break three tests at
    // once.
    const routes = parseAppRoutes(COMPONENT_STYLE);
    expect(routes.map((r) => r.path)).toEqual(["/about", "/dashboard", "/exam/:slug"]);
    expect(routes.find((r) => r.path === "/dashboard")?.isProtected).toBe(true);
  });

  it("produces the same table for both styles", () => {
    const fromChildren = buildAppRouteTable(CHILDREN_STYLE);
    const fromComponent = buildAppRouteTable(COMPONENT_STYLE);
    expect([...fromChildren.publicRoutes].sort()).toEqual([...fromComponent.publicRoutes].sort());
    expect([...fromChildren.protectedRoutes].sort()).toEqual([...fromComponent.protectedRoutes].sort());
    expect(fromChildren.paramPatterns).toEqual(["/exam/:slug"]);
  });

  it("classifies param families separately from static routes", () => {
    const table = buildAppRouteTable(CHILDREN_STYLE);
    expect(table.publicRoutes.has("/exam/:slug")).toBe(false);
    expect(table.paramPatterns).toEqual(["/exam/:slug"]);
  });

  it("does not let a trailing comment misclassify the route before it", () => {
    // Slicing route-to-route means trailing text lands inside the previous
    // route's slice; the body is bounded at the route's own close to prevent
    // a stray mention of ProtectedRoute from marking /about as login-walled.
    const src = `
      <Route path="/about"><AboutPage /></Route>
      {/* Unlike /dashboard, this one is not wrapped in ProtectedRoute */}
      <Route path="/contact"><ContactPage /></Route>
    `;
    const table = buildAppRouteTable(src);
    expect(table.publicRoutes.has("/about")).toBe(true);
    expect(table.protectedRoutes.has("/about")).toBe(false);
    expect(table.publicRoutes.has("/contact")).toBe(true);
  });

  it("finds the real route table, which is the only thing the contracts need", () => {
    // Guards against the extractor silently reading an empty file: the three
    // dependent contract tests all become vacuous if this returns nothing.
    const table = buildAppRouteTable(fs.readFileSync(defaultAppTsxPath(), "utf8"));
    expect(table.routes.length).toBeGreaterThan(80);
    expect(table.protectedRoutes.size).toBeGreaterThan(20);
    expect(table.publicRoutes.size).toBeGreaterThan(20);
  });

  it("resolves App.tsx from the API package's working directory", () => {
    expect(fs.existsSync(defaultAppTsxPath())).toBe(true);
    expect(path.basename(defaultAppTsxPath())).toBe("App.tsx");
  });
});
