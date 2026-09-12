// Type declarations for ./citations.mjs. Same convention as ./seo-text.d.mts —
// the module is shared with the build scripts, which run as plain Node ESM.

/** Where a prose citation can be checked, or null when it cannot. */
export function citationUrl(text: string): string | null;

/**
 * Normalise a source entry: a plain string, or a [text, url] pair when the
 * author already knows the link. An explicit pair wins over the registry.
 */
export function citationParts(source: string | [string, string]): {
  text: string;
  url: string | null;
};
