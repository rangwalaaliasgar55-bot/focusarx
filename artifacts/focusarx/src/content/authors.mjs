// ══════════════════════════════════════════════════════════════════
// Authorship — who is responsible for what FocusArx publishes
// ══════════════════════════════════════════════════════════════════
// E-E-A-T is not a widget. A reader (and Google's quality raters) want to know
// who wrote a page, what qualifies them, and how to check their work. So every
// long-form page carries an author block, the Article schema names the same
// author, and the claims in the copy are traceable to /evidence.
//
// This file is the single place authorship is defined. The prerenderer, the
// blog and guide templates, and the JSON-LD all read it, so a byline cannot
// drift from the structured data that describes it.
//
// ── Adding a named author ─────────────────────────────────────────────────
// The site currently publishes under its editorial team. To put a person on the
// byline, add an entry to PEOPLE and set `author` on the post or guide:
//
//   {
//     id: "jane-doe",
//     name: "Jane Doe",
//     role: "Reviewer",
//     credentials: "MBBS, MD — ten years in clinical practice",  // only what is true
//     photo: "/brand/authors/jane-doe.webp",                     // 96x96 minimum
//     sameAs: ["https://www.linkedin.com/in/…"],
//   }
//
// Do not invent credentials or a photo. A fabricated expert is worse for E-E-A-T
// than an honest team byline, and it is the kind of thing that gets a site
// manually reviewed.

export const TEAM_AUTHOR = {
  id: "focusarx-editorial",
  name: "FocusArx editorial team",
  role: "Written and maintained by the people who build the product",
  credentials:
    "We build FocusArx and write about what we measure while building it: interval length, task initiation, interruption cost and review scheduling.",
  bio: "FocusArx is built by a small independent team. Everything we publish here is either something we measured in the product or something we sourced — and every metric we quote is on the claim ledger with its definition, source, sample and date.",
  photo: null,
  url: "https://www.focusarx.site/about",
  sameAs: ["https://www.focusarx.site/evidence"],
};

/** Named authors, keyed by id. Empty until a real person is willing to be named. */
export const PEOPLE = {};

/**
 * Resolve an author reference: an id from PEOPLE, an object, or nothing at all
 * (which means the editorial team).
 *
 * @param {string | Partial<import("./authors.d.mts").Author> | null | undefined} ref
 */
export function resolveAuthor(ref) {
  if (!ref) return TEAM_AUTHOR;
  if (typeof ref === "string") return PEOPLE[ref] ?? TEAM_AUTHOR;
  if (ref.id && PEOPLE[ref.id]) return PEOPLE[ref.id];
  return { ...TEAM_AUTHOR, ...ref };
}

/**
 * schema.org author for Article/BlogPosting.
 *
 * A Person when the byline is a person, otherwise the Organization with the
 * team named in it — Google accepts either, but it has to match what is
 * visibly on the page.
 *
 * @param {ReturnType<typeof resolveAuthor>} author
 */
export function authorSchema(author) {
  const a = author ?? TEAM_AUTHOR;
  if (PEOPLE[a.id]) {
    return {
      "@type": "Person",
      name: a.name,
      jobTitle: a.role,
      url: a.url ?? "https://www.focusarx.site/about",
      ...(a.photo ? { image: a.photo } : {}),
      ...(a.sameAs?.length ? { sameAs: a.sameAs } : {}),
    };
  }
  return {
    "@type": "Organization",
    name: "FocusArx",
    url: "https://www.focusarx.site/about",
    description: a.credentials,
  };
}
