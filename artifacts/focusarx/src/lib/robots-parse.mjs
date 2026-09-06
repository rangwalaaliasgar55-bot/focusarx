/**
 * A minimal, strict robots.txt reader — shared by everything that has to agree with
 * this file.
 *
 * Three places parse robots.txt in this repo: scripts/prerender.mjs (which must
 * `noindex` what the file disallows, so the HTML and the directives cannot tell
 * crawlers different stories), scripts/seo-validate.mjs (which fails the build on
 * drift), and the API's own generated robots.txt. Each one used its own regex.
 *
 * The strictness is the point. A robots file is a list of `field: value` lines, and
 * a merged line such as
 *
 *   Disallow: /adminDisallow: /onboarding
 *
 * — which is what the checked-in file actually shipped after an edit dropped the
 * newline — is *valid syntax* to a lenient parser: it becomes one path that can
 * never match, silently un-disallowing two private areas. `parseDirectiveLines`
 * reports that shape as a problem instead of absorbing it.
 *
 * Run as plain Node ESM by the build scripts, so it is JavaScript with JSDoc rather
 * than TypeScript, like the other shared `src/content/*.mjs` modules.
 */

const FIELDS = ["user-agent", "allow", "disallow", "sitemap", "crawl-delay", "host", "sitemap-index", "noindex"];

/**
 * @typedef {Object} RobotsLine
 * @property {number} line        1-based line number, for the error message
 * @property {string} raw         the trimmed source line
 * @property {string} [field]     lowercased directive name
 * @property {string} [value]     the value after the colon
 * @property {string} [error]     set when the line is not a single `field: value`
 */

/**
 * Split a robots file into validated directive lines.
 * @param {string} text
 * @returns {RobotsLine[]}
 */
export function parseDirectiveLines(text) {
  const out = [];
  const lines = String(text ?? "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    if (!raw || raw.startsWith("#")) continue;
    // A second colon means a second directive got glued onto this line; a value with
    // whitespace in it means the same thing.
    const match = raw.match(/^([A-Za-z-]+)\s*:\s*(\S+)\s*$/);
    if (!match || !FIELDS.includes(match[1].toLowerCase())) {
      out.push({ line: index + 1, raw, error: `not a single \`field: value\` ${FIELDS.join("/")} directive` });
      continue;
    }
    out.push({ line: index + 1, raw, field: match[1].toLowerCase(), value: match[2] });
  }
  return out;
}

/**
 * The groups a robots file describes, keyed by user-agent.
 * @param {string} text
 * @returns {{ groups: Map<string, { allow: string[], disallow: string[] }>, errors: RobotsLine[] }}
 */
export function parseRobots(text) {
  const groups = new Map();
  const errors = [];
  let current = null;
  for (const entry of parseDirectiveLines(text)) {
    if (entry.error) {
      errors.push(entry);
      continue;
    }
    if (entry.field === "user-agent") {
      current = entry.value;
      if (!groups.has(current)) groups.set(current, { allow: [], disallow: [] });
      continue;
    }
    if (!current) continue;
    const group = groups.get(current);
    if (entry.field === "allow") group.allow.push(entry.value);
    else if (entry.field === "disallow") group.disallow.push(entry.value);
  }
  return { groups, errors };
}

/**
 * Does a `Disallow` from the default group block this path?
 *
 * Robots matching is prefix-based, and a `Disallow` with no trailing slash covers
 * everything below it (`/admin` blocks `/admin/anything`). Longer patterns win when
 * both an `Allow` and a `Disallow` match, which is how `/api/` stays blocked while
 * `/api/sitemap.xml` is allowed.
 *
 * @param {string} routePath   must start with "/"
 * @param {{ allow: string[], disallow: string[] }} group
 */
export function isDisallowed(routePath, group) {
  if (!group) return false;
  // Google matches a Disallow as a literal prefix, with `*` for "anything" and a
  // trailing `$` for "ends here". `/admin` therefore blocks `/admin/users` *and*
  // `/administrative`, and `/*.map$` blocks any source map — both are deliberate
  // in the shipped file, so the matcher implements them rather than approximating.
  const matcher = (pattern) => {
    if (!pattern) return null;
    const anchored = pattern.endsWith("$") ? pattern.slice(0, -1) : null;
    const body = (anchored ?? pattern).split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    const source = anchored !== null ? `^${body}$` : `^${body}`;
    const route = routePath.replace(/\/$/, "") === "" ? "/" : routePath.replace(/\/$/, "");
    return new RegExp(source).test(anchored !== null ? route : routePath) || (anchored === null && routePath === route && false);
  };
  const matches = (pattern) => {
    if (!pattern) return false;
    const hit = matcher(pattern);
    return hit === null ? false : hit;
  };
  const blocked = group.disallow.filter(matches);
  if (blocked.length === 0) return false;
  const allowed = group.allow.filter(matches);
  const longest = (list) => list.reduce((max, pattern) => Math.max(max, pattern.length), 0);
  return longest(blocked) >= longest(allowed);
}

/**
 * The `robots` meta content a page should carry, given the directives that apply to
 * it. Kept as one expression so the prerendered HTML, the client render and the file
 * cannot drift into three different answers.
 * @param {string} routePath
 * @param {Map<string, { allow: string[], disallow: string[] }>} groups
 */
export function robotsMetaFor(routePath, groups) {
  const indexable = !isDisallowed(routePath, groups.get("*"));
  return indexable
    ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    : "noindex, nofollow";
}
