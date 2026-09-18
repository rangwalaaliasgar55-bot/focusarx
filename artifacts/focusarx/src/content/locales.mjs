// ══════════════════════════════════════════════════════════════════
// Editions, languages and the hreflang clusters that bind them
// ══════════════════════════════════════════════════════════════════
//
// Until this file existed the site declared four hreflang alternates —
// x-default, en, en-IN, en-GB — and every one of them resolved to the *same*
// URL. That is legal but it is a statement about intent, not a locale: it told
// Google "we mean to serve India, Britain and everyone else" while serving all
// three the identical American-English homepage. The comment in index.html
// said so plainly: "if locale-specific URLs are ever added (a real /in/
// edition, not a query parameter), these must be repointed at them". This file
// is that repointing.
//
// ── The rule this file enforces ────────────────────────────────────
// An hreflang alternate is a promise that a *different* document exists for
// that audience. Google's guidance is unambiguous that translations must be
// real translations and that an alternate must point at a page in that
// language, not at an English page wearing a flag. So:
//
//   • a cluster only ever lists editions that actually shipped a page;
//   • every URL in a cluster is a page this build prerenders (gate-checked);
//   • clusters are reciprocal — if /in/ lists `hi`, then /hi/ lists `en-IN`
//     (gate-checked, because a one-way cluster is ignored by Google);
//   • `x-default` is always present and always points at the English page.
//
// ── Why these five ─────────────────────────────────────────────────
// The product is India-first in its code, not in its marketing: 21 of the 23
// exam guides under src/content/exam/ are Indian exams (JEE Main and Advanced,
// NEET-UG, UPSC CSE, CA Foundation, GATE, CLAT, CTET, CUET-UG, SSC CGL, IBPS
// PO, NDA, CAT, BITSAT, KCET, MHT-CET, WBJEE, CBSE 10 and 12), the AI coach's
// system prompt is written for Indian exam aspirants (api-server/src/lib/
// aiTemplates.ts:41), and IST is the legacy default calendar
// (api-server/src/lib/istDate.ts). Yet the only two US exams the site has
// pages for are GRE and GMAT, and the homepage says nothing about either
// market. So the editions are: India and the US in English (different exam
// sets, different calendars — genuinely different documents), then Hindi,
// Spanish and Brazilian Portuguese, which put the timer's highest-intent query
// in the language people actually type it in.
//
// Not shipped: a `ru`, `de`, `fr`, `id`, `ja`, `ko`, `ar`, `tr`, `vi`, `th`,
// `bn`, `ta`, `te`, `mr`, `gu` edition. Adding a language means committing to
// writing real copy in it — see the note at the top of locale-pages.mjs about
// why a machine-translated edition is worse than no edition.

/**
 * @typedef {Object} Edition
 * @property {string} key       — stable id used in the switcher and in analytics
 * @property {string} path      — URL prefix of this edition's pages
 * @property {string} hreflang  — BCP-47 tag this edition advertises
 * @property {string} lang      — value for the document's <html lang>
 * @property {string} ogLocale  — Open Graph locale (underscore form)
 * @property {string} endonym   — what the edition calls itself, in its own language
 * @property {string} label     — English gloss for the switcher's title attribute
 * @property {string} market    — one line on who this edition is for
 * @property {string} currency  — the currency this edition's pricing page speaks
 */

/** @type {Edition[]} */
export const EDITIONS = [
  {
    key: "in",
    path: "/in/",
    hreflang: "en-IN",
    lang: "en-IN",
    ogLocale: "en_IN",
    endonym: "भारत · English",
    label: "India",
    market: "Indian exam aspirants — JEE, NEET, UPSC, CA, GATE, boards",
    currency: "INR",
  },
  {
    key: "us",
    path: "/us/",
    hreflang: "en-US",
    lang: "en-US",
    ogLocale: "en_US",
    endonym: "United States",
    label: "United States",
    market: "US students and remote workers — GRE, GMAT, MCAT, finals",
    currency: "USD",
  },
  {
    key: "hi",
    path: "/hi/",
    hreflang: "hi",
    lang: "hi",
    ogLocale: "hi_IN",
    endonym: "हिन्दी",
    label: "Hindi",
    market: "Hindi-first readers in India",
    currency: "INR",
  },
  {
    key: "es",
    path: "/es/",
    hreflang: "es",
    lang: "es",
    ogLocale: "es_ES",
    endonym: "Español",
    label: "Spanish",
    market: "Spanish-speaking students in Spain and Latin America",
    currency: "EUR",
  },
  {
    key: "pt-br",
    path: "/pt-br/",
    hreflang: "pt-BR",
    lang: "pt-BR",
    ogLocale: "pt_BR",
    endonym: "Português (Brasil)",
    label: "Brazil",
    market: "Brazilian students — ENEM, vestibular, concursos",
    currency: "BRL",
  },
];

/** The English pages every cluster falls back to. */
export const DEFAULT_EDITION_KEY = "en";

/**
 * Every hreflang tag the site emits, in a stable order. index.html carries the
 * same list for the homepage; scripts/prerender.mjs rewrites the cluster per
 * page; scripts/seo-validate.mjs fails the build if a page's cluster is not a
 * subset of this list. Derived, not repeated, so the four cannot drift apart.
 */
export const HREFLANG_TAGS = [
  "x-default",
  // The English edition is not in EDITIONS — it is the site itself — but it is
  // a tag every cluster emits, so it belongs in the list the gate checks.
  // Deriving this from EDITIONS alone silently dropped `en` and failed 119 pages.
  "en",
  ...EDITIONS.map((e) => e.hreflang),
].sort((a, b) => (a === "x-default" ? -1 : b === "x-default" ? 1 : a.localeCompare(b)));

/** Lookup by URL prefix. `/in/` → the India edition. */
export function editionForPath(path) {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return EDITIONS.find((e) => normalised === e.path || normalised.startsWith(e.path)) ?? null;
}

/**
 * The hreflang cluster for one prerendered route.
 *
 * Every English page advertises itself plus the five editions that exist for
 * the pages those editions translated — and only those. A page with no
 * translations gets a single-entry cluster (itself as x-default and en), which
 * is the correct signal; padding it with alternates that resolve to the same
 * English URL is the thing this file replaced.
 *
 * The map is expressed as "which routes each edition translated", so adding a
 * translated page means adding it in one place and every cluster on the site
 * picks it up — including the reciprocal links, which is what makes the
 * clusters valid.
 *
 * @param {string} routePath — e.g. "/", "/pricing", "/in/", "/hi/"
 * @returns {{locale: string, href: string}[]} locale tags and their paths
 */
export function clusterFor(routePath) {
  const normalised = routePath.startsWith("/") ? routePath : `/${routePath}`;

  // Which edition, if any, owns this URL — and the English route underneath it.
  // Deriving it from EDITIONS rather than naming the prefixes matters: a
  // hard-coded /^\/(in|us)/ silently left /hi/, /es/ and /pt-br/ pointing at
  // themselves, which is a cluster of one wearing a language tag.
  // Compared on the slash-stripped prefix: EDITIONS stores "/in/" while a
  // canonical route path is "/in", and a bare startsWith() quietly matched
  // neither — leaving every edition homepage in a cluster with itself.
  const owner =
    EDITIONS.find((e) => {
      const prefix = e.path.replace(/\/$/, "");
      return normalised === prefix || normalised.startsWith(`${prefix}/`);
    }) ?? null;
  // Strip the edition prefix off the front: "/in/pricing" → "/pricing",
  // "/in" → "/". Computed from the slash-stripped prefix so the length is
  // right in both cases — using owner.path.length here produced "//pricing".
  const prefix = owner ? owner.path.replace(/\/$/, "") : "";
  const rest = owner ? normalised.slice(prefix.length) : normalised;
  const englishRaw = owner ? (rest === "" ? "/" : rest) : normalised;
  // Canonical form. The prerenderer strips trailing slashes from routePath, so
  // the canonical for an edition homepage is "/in", not "/in/" — and an
  // alternate that carries a slash the canonical does not is an alternate to a
  // URL that 308-redirects, which is the quiet way to lose a hreflang cluster.
  const english = englishRaw === "/" ? "/" : englishRaw.replace(/\/+$/, "");

  // Which editions carry this page. The switcher shows all five everywhere,
  // but hreflang only lists the ones that actually exist for *this* route —
  // an alternate that 404s invalidates the whole cluster. `translatedRoute`
  // exists because TRANSLATED is written with the readable homepage form
  // ("in/") while canonical paths have no trailing slash ("in").
  const translatedRoute = (key) =>
    TRANSLATED.has(`${key}${english}`) || (english === "/" && TRANSLATED.has(`${key}/`));
  const carriers = EDITIONS.filter((e) => translatedRoute(e.key));

  return [
    // x-default: the English original. For an edition page that is the page it
    // translates, so a reader's crawler is always shown the way back.
    { locale: "x-default", href: english },
    { locale: "en", href: english },
    ...carriers.map((e) => ({
      locale: e.hreflang,
      href: english === "/" ? e.path.replace(/\/$/, "") : `${e.path}${english.slice(1)}`,
    })),
  ];
}

/**
 * Routes each edition has really written, as `<editionKey><englishRoute>`.
 * This is the only list that needs editing when an edition gains a page — and
 * it is checked at build time against the prerender manifest, so a row here
 * with no page behind it fails the build instead of emitting a dead alternate.
 */
export const TRANSLATED = new Set([
  "in/", "in/pricing",
  "us/", "us/pricing",
  "hi/", "hi/pricing",
  "es/", "es/pricing",
  "pt-br/", "pt-br/pricing",
]);

/**
 * Edition switcher rows, in the order the switcher shows them: the global
 * English site first (it is the x-default), then the editions by market size
 * for this product. Every prerendered page renders this list.
 */
export const SWITCHER_EDITIONS = [
  { key: "en", path: "/", label: "English", sublabel: "Global", hreflang: "en" },
  ...EDITIONS.map((e) => ({
    key: e.key,
    path: e.path,
    label: e.endonym,
    sublabel: e.label,
    hreflang: e.hreflang,
  })),
];
