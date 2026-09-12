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
  /** Author id from src/content/authors.mjs; defaults to the editorial team. */
  author?: string;
  h1: string;
  lead: string;
  sections: BlogSection[];
  faq?: [string, string][];
  /**
   * "path|Label" internal links to the tools, guides and exam pages the essay
   * argues for. Rendered by src/pages/blog-post.tsx and mirrored into the
   * prerender manifest, so a post is an entry point rather than a dead end.
   */
  related?: string[];
}

export const BLOG_POSTS: BlogPost[];
export const BLOG_PATHS: string[];
export function getBlogPost(slug: string): BlogPost | null;
