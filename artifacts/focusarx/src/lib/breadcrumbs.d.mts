// Type declarations for ./breadcrumbs.mjs. Same convention as ./seo-text.d.mts —
// the module is shared with the build scripts, which run as plain Node ESM.

export interface BreadcrumbCrumb {
  name: string;
  path: string;
  /** False when the crumb must not be a link (current page, or no hub route). */
  linkable: boolean;
}

/** First-path segments with a real index route; other crumbs stay unlinked. */
export declare const LINKABLE_SEGMENTS: ReadonlySet<string>;

export function breadcrumbTrail(
  routePath: string,
  options?: { title?: string },
): BreadcrumbCrumb[];

export function breadcrumbListSchema(trail: BreadcrumbCrumb[], baseUrl: string): object;
