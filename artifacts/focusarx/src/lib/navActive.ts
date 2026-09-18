/**
 * "Am I on this page?", answered the same way everywhere.
 *
 * Navigation active state is the app's only answer to "where am I?", and it
 * was being computed three different ways:
 *
 *   • `AppShell`'s sidebar used a bare `location === href`;
 *   • `MobileBottomNav` used `location === href || (href === "/" && location === "/focus")`,
 *     a hard-coded special case because exact matching cannot express that two
 *     URLs are the same place;
 *   • `AppShell`'s own no-shell check used the nested-aware form.
 *
 * Exact matching has two failure modes, both silent:
 *
 *   1. **Query strings.** Wouter's location carries `?tab=…`. A user who
 *      deep-links to `/dashboard?range=week` sees the Dashboard page with no
 *      sidebar item highlighted, so the navigation looks broken rather than
 *      the highlight.
 *   2. **Nested routes.** `/messages/42` is a child of `/messages`, but a bare
 *      equality check leaves the parent unlit. This is latent today and will
 *      fire the first time a detail route is added under a nav section.
 *
 * The root path is the exception that must stay exact — `"/"` is a prefix of
 * every route in the app, so a prefix match would light the timer up on every
 * page.
 */

/**
 * URLs that render the same destination.
 *
 * `/` and `/focus` are both the timer (one for signed-in users, one for the
 * guest funnel). They are listed here rather than special-cased at each call
 * site so the two navigation surfaces cannot drift apart.
 */
const ROUTE_ALIASES: Record<string, readonly string[]> = {
  "/": ["/focus"],
};

/** Drop the query/hash and any trailing slash so comparison is on the path alone. */
function normalizePath(value: string): string {
  const pathOnly = value.split("?")[0].split("#")[0];
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) return pathOnly.slice(0, -1);
  return pathOnly;
}

function aliasesOf(href: string): readonly string[] {
  return ROUTE_ALIASES[href] ?? [];
}

/**
 * True when `location` should light up the navigation entry pointing at `href`.
 */
export function isActiveRoute(location: string, href: string): boolean {
  const path = normalizePath(location);
  const target = normalizePath(href);

  if (path === target) return true;
  if (aliasesOf(target).includes(path)) return true;
  // And the reverse: an entry pointing at `/focus` stays lit at `/`.
  if (aliasesOf(path).includes(target)) return true;

  // Only `/` is excluded, because it prefixes everything.
  if (target !== "/" && path.startsWith(`${target}/`)) return true;

  return false;
}

export default isActiveRoute;
