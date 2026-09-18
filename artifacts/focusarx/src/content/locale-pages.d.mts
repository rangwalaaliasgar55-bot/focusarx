// Type declarations for ./locale-pages.mjs — the ten localized edition pages.
// Shared with the build scripts, which run as plain Node ESM (same convention
// as ./authors.d.mts).

/**
 * One edition page, in the shape scripts/prerender-data.mjs expects of a
 * RouteEntry plus the two keys the prerenderer needs to set <html lang> and
 * og:locale. Deliberately a superset of the manifest's RouteEntry: the same
 * object drives the static HTML and this React page, which is what stops the
 * crawler's copy and the visitor's copy from drifting apart.
 */
export interface LocaleRouteEntry {
  /** Canonical path, no trailing slash: "/in", "/hi/pricing". */
  path: string;
  /** BCP-47 tag for <html lang>, from src/content/locales.mjs. */
  lang: string;
  /** Open Graph locale, underscore form. */
  ogLocale: string;
  /** Edition key: "in" | "us" | "hi" | "es" | "pt-br". */
  editionKey: string;
  /** Search-result title, before composeTitle adds the brand suffix. */
  title: string;
  description: string;
  h1: string;
  lead: string;
  lastReviewed?: string;
  sections: { h: string; p?: string | string[]; bullets?: string[] }[];
  faq?: [string, string][];
  sources?: string[];
  related?: string[];
  cta: { href: string; label: string };
  software?: { name: string; category: string; description: string };
}

/** The two routes every edition translates. */
export const EDITION_ROUTES: string[];

/** Manifest entries for all ten edition pages. */
export function localeRouteEntries(): LocaleRouteEntry[];

/** Every edition URL, for the sitemap and reachability checks. */
export const LOCALE_PATHS: string[];
