// Type declarations for ./authors.mjs — authorship for every long-form page.
// Shared with the build scripts, which run as plain Node ESM (same convention
// as ./clusters.d.mts).

export interface Author {
  id: string;
  name: string;
  role: string;
  credentials?: string;
  bio?: string;
  photo?: string | null;
  url?: string;
  sameAs?: string[];
}

/**
 * How a page names its author: an id from PEOPLE, a full or partial author
 * object (merged over the team author), or nothing at all — which means the
 * editorial team. A partial object is what a content file uses when it wants a
 * different byline without registering a person in PEOPLE.
 */
export type AuthorRef = string | Partial<Author> | null | undefined;

export const TEAM_AUTHOR: Author;
export const PEOPLE: Record<string, Author>;

export function resolveAuthor(ref?: AuthorRef): Author;
export function authorSchema(author?: Author): object;
