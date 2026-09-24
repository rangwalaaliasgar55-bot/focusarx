// Type declarations for ./policy-pages.mjs — the six policy documents in one
// source of truth (same convention as ./locale-pages.d.mts and ./authors.d.mts).
//
// These exist because the module is consumed from two places with different
// compilers: `scripts/prerender-data.mjs` runs under plain Node ESM (no types
// needed), while `src/components/PolicyBody.tsx` and the policy pages are
// TypeScript, and without this file `tsc --noEmit` fails with
// "Could not find a declaration file for module '@/content/policy-pages.mjs'".

/** One section of a policy document — the prerenderer's section contract. */
export interface PolicySection {
  /** Heading text, rendered as `<h2>` in the static HTML and on the page. */
  h: string;
  /** Paragraph, or several, in reading order. */
  p?: string | string[];
  /** Optional bullet list rendered after the prose. */
  bullets?: string[];
}

export interface PolicyPage {
  /** Human-readable "last updated" label shown under the H1. */
  updated: string;
  sections: PolicySection[];
}

/** Footer links shared by every policy page (`{href, label}`). */
export interface PolicyLink {
  href: string;
  label: string;
}

/**
 * The legal link set rendered at the foot of each policy page. Also used by the
 * prerenderer for "keep reading" links, so a policy page can never link to a
 * page that does not exist.
 */
export const LEGAL_FOOTER_LINKS: PolicyLink[];

/** Keyed by canonical path: "/privacy", "/terms", "/cookie-policy", … */
export const POLICY_PAGES: Record<string, PolicyPage>;

/** Sections for a policy path, or an empty array when the page is not here. */
export function policySections(path: string): PolicySection[];

export default POLICY_PAGES;
