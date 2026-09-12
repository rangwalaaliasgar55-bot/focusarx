// Type declarations for ./heading-id.mjs. Same convention as ./seo-text.d.mts.

export interface HeadingAnchor {
  id: string;
  label: string;
}

export function headingId(text: string): string;
export function headingAnchors(headings: string[]): HeadingAnchor[];
