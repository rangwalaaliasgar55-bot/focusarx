// Type declarations for ./blog.mjs (same convention as seo-pages.d.mts).

export interface BlogSection {
  h: string;
  p: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readMin: number;
  h1: string;
  lead: string;
  sections: BlogSection[];
  faq?: [string, string][];
}

export const BLOG_POSTS: BlogPost[];
export const BLOG_PATHS: string[];
export function getBlogPost(slug: string): BlogPost | null;
