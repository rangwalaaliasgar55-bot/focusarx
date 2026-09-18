// Type declarations for ./locales.mjs — editions, languages and the hreflang
// clusters that bind them. Shared with the build scripts, which run as plain
// Node ESM (same convention as ./authors.d.mts and ./clusters.d.mts).

export interface Edition {
  /** Stable id used in the switcher and in analytics. */
  key: string;
  /** URL prefix of this edition's pages, e.g. "/in/". */
  path: string;
  /** BCP-47 tag this edition advertises. */
  hreflang: string;
  /** Value for the document's <html lang>. */
  lang: string;
  /** Open Graph locale, underscore form. */
  ogLocale: string;
  /** What the edition calls itself, in its own language. */
  endonym: string;
  /** English gloss for the switcher. */
  label: string;
  /** One line on who this edition is for. */
  market: string;
  /** The currency this edition's pricing page speaks. */
  currency: string;
}

export const EDITIONS: Edition[];

/** Every hreflang tag the site emits, in a stable order. */
export const HREFLANG_TAGS: string[];

export interface SwitcherEdition {
  key: string;
  path: string;
  label: string;
  sublabel: string;
  hreflang: string;
}

/** Switcher rows: the global English site first, then the five editions. */
export const SWITCHER_EDITIONS: SwitcherEdition[];

/** Routes each edition has really written, as `<editionKey><englishRoute>`. */
export const TRANSLATED: Set<string>;

/** Lookup by URL prefix: "/in/pricing" → the India edition. */
export function editionForPath(path: string): Edition | null;

export interface HreflangAlternate {
  locale: string;
  href: string;
}

/**
 * The hreflang cluster for one canonical route path. Reciprocal by
 * construction: scripts/seo-validate.mjs fails the build otherwise.
 */
export function clusterFor(routePath: string): HreflangAlternate[];
