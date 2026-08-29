// Type declarations for the intent-page content data (./seo-pages.mjs).
// Same convention as src/content/exam/index.d.mts.

export interface SeoSection {
  h: string;
  p: string | string[];
}

export interface SeoHowTo {
  name: string;
  steps: { name: string; text: string }[];
}

export interface SeoSoftware {
  name: string;
  category: string;
  description: string;
}

export interface SeoPage {
  kind: "tool" | "guide" | "trust";
  title: string;
  description: string;
  h1: string;
  lead: string;
  answerFirst: string;
  sections: SeoSection[];
  faq?: [string, string][];
  howTo?: SeoHowTo;
  software?: SeoSoftware;
  article?: boolean;
  cta: { href: string; label: string };
  related: string[];
  lastReviewed?: string;
  sources?: string[];
}

export interface ComparisonRow {
  0: string;
  1: boolean | string;
  2: boolean | string;
}

export interface Comparison {
  slug: string;
  name: string;
  title: string;
  description: string;
  lead: string;
  ours: string[];
  theirs: string[];
  rows: [string, boolean | string, boolean | string][];
  whenOurs: string;
  whenTheirs: string;
}

export const LAST_REVIEWED: string;
export const SEO_PAGES: Record<string, SeoPage>;
export const COMPARISONS: Record<string, Comparison>;
export const COMPARISON_PATHS: string[];
