// ══════════════════════════════════════════════════════════════════
// Citation links — where a reader can check our work
// ══════════════════════════════════════════════════════════════════
// Visible citations are only half of E-E-A-T; a citation nobody can follow is a
// decoration. Pages already name their sources in prose ("Cepeda et al.,
// 'Distributed Practice in Verbal Recall Tasks' (2006)"), and that copy lives in
// about twenty content files. Rather than rewriting every one of them, the
// works are recognised here by name and linked at render time — the prerenderer
// and the page component both call `citationUrl()`, so the static document and
// the hydrated page carry the same outbound links.
//
// Two rules for anything added here:
//   1. Link somewhere that resolves. Publisher and author sites for books and
//      standards; an index search (PubMed, ACM, Scholar) for papers. A deep link
//      guessed from memory is worse than a search that always lands.
//   2. Never mark these nofollow. Citing a source is exactly the kind of link
//      that should pass trust.

const scholar = (query) =>
  `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;

const pubmed = (query) =>
  `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`;

/**
 * @typedef {{match: RegExp, url: string}} CitationRule
 */

/** @type {CitationRule[]} */
const RULES = [
  // ── Books and their authors ────────────────────────────────────────────
  { match: /Cirillo/i, url: "https://francescocirillo.com/" },
  { match: /Cal Newport|Deep Work \(2016\)|Newport, Deep Work/i, url: "https://www.calnewport.com/" },
  { match: /David Allen|Getting Things Done/i, url: "https://gettingthingsdone.com/" },
  { match: /BJ Fogg|Tiny Habits/i, url: "https://www.bjfogg.com/" },
  { match: /Pychyl|Sirois/i, url: "https://www.procrastination.ca/" },
  { match: /Barkley/i, url: "https://chadd.org/" },

  // ── Standards, guidelines and exam bodies ──────────────────────────────
  { match: /WCAG|Web Content Accessibility/i, url: "https://www.w3.org/TR/WCAG22/" },
  {
    match: /Google Search Central|review snippet/i,
    url: "https://developers.google.com/search/docs/appearance/review-snippets",
  },
  { match: /American Academy of Pediatrics/i, url: "https://www.aap.org/" },
  { match: /\bNTA\b/i, url: "https://nta.ac.in/" },
  { match: /\bCBSE\b/i, url: "https://www.cbse.gov.in/" },

  // ── Papers, via an index that will not 404 ─────────────────────────────
  {
    match: /Volkow/i,
    url: pubmed("Volkow dopamine transporter densities attention deficit hyperactivity"),
  },
  {
    match: /Fabiano/i,
    url: pubmed("Fabiano meta-analysis behavioral treatments attention-deficit hyperactivity"),
  },
  {
    match: /Dunlosky/i,
    url: scholar("Improving Students' Learning With Effective Learning Techniques Dunlosky 2013"),
  },
  {
    match: /Critical Importance of Retrieval/i,
    url: scholar("The Critical Importance of Retrieval for Learning Karpicke Roediger 2008"),
  },
  {
    match: /Test-Enhanced Learning|Roediger & Karpicke/i,
    url: scholar("Test-Enhanced Learning Roediger Karpicke 2006"),
  },
  {
    match: /Cepeda|Distributed Practice/i,
    url: scholar("Distributed Practice in Verbal Recall Tasks Cepeda 2006"),
  },
  {
    match: /Leroy|attention residue/i,
    url: scholar("Why is it so hard to do my work Leroy attention residue 2009"),
  },
  {
    match: /Brain Drain|Ward et al/i,
    url: scholar("Brain Drain: The Mere Presence of One's Own Smartphone Ward 2017"),
  },
  {
    match: /Cost of Interrupted Work|Mark, Gudith/i,
    url: "https://dl.acm.org/action/doSearch?AllField=The+Cost+of+Interrupted+Work+More+Speed+and+Stress",
  },
  {
    match: /Ericsson|Deliberate Practice/i,
    url: scholar("The Role of Deliberate Practice in the Acquisition of Expert Performance Ericsson 1993"),
  },
  { match: /Ebbinghaus|forgetting curve/i, url: scholar("Ebbinghaus forgetting curve memory 1885") },
  {
    match: /Skinner|variable-ratio/i,
    url: scholar("Skinner variable ratio schedule of reinforcement"),
  },
];

/**
 * Where a prose citation can be checked, or null when it cannot.
 *
 * A source that is a disclaimer rather than a reference ("FocusArx makes no
 * clinical claims on this page") correctly matches nothing.
 *
 * @param {string} text
 * @returns {string | null}
 */
export function citationUrl(text) {
  const value = String(text ?? "");
  for (const rule of RULES) {
    if (rule.match.test(value)) return rule.url;
  }
  return null;
}

/**
 * Normalise a source entry: content files may write a plain string or a
 * `[text, url]` pair when the author already knows the link. An explicit pair
 * always wins over the registry.
 *
 * @param {string | [string, string]} source
 * @returns {{text: string, url: string | null}}
 */
export function citationParts(source) {
  const [text, url] = Array.isArray(source) ? source : [source, null];
  return { text, url: url ?? citationUrl(text) };
}
