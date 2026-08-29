/**
 * Resolve a `?redirect=` parameter to a path that is safe to navigate to.
 *
 * Why this exists: `navigate(valueFromTheURL)` is an open redirect. A link like
 *   https://focusarx.app/login?redirect=https://evil.example
 * looks completely legitimate — the host is ours — but after a successful
 * sign-in it sends the freshly authenticated user to the attacker's site,
 * which is a standard credential-phishing setup.
 *
 * The rule is simple: only ever return a same-origin absolute path.
 */

const DEFAULT_FALLBACK = "/dashboard";

/** C0 control characters and DEL. Written as code points, not escapes. */
const DEL = 0x7f;
const FIRST_PRINTABLE = 0x20;

/**
 * Return `raw` only if it is a safe in-app path; otherwise return `fallback`.
 *
 * Rejects, in order:
 *  - anything that is not an absolute in-app path (`https:`, `javascript:`,
 *    `data:`, or a relative path that could resolve somewhere unexpected)
 *  - protocol-relative `//evil.example` and its backslash twin `/\evil.example`,
 *    which several browsers normalise to a cross-origin URL
 *  - control characters, which can be used to smuggle a scheme past a naive
 *    `startsWith("/")` check
 *  - the auth pages themselves, which would produce a redirect loop
 */
export function safeRedirect(
  raw: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (!raw) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Malformed percent-encoding — not something we should try to guess at.
    return fallback;
  }

  if (!decoded.startsWith("/")) return fallback;
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return fallback;

  for (let index = 0; index < decoded.length; index += 1) {
    const code = decoded.charCodeAt(index);
    if (code < FIRST_PRINTABLE || code === DEL) return fallback;
  }

  if (decoded === "/login" || decoded.startsWith("/login?") || decoded.startsWith("/login#")) {
    return fallback;
  }
  if (decoded === "/signup" || decoded.startsWith("/signup?")) return fallback;
  if (decoded === "/forgot-password" || decoded.startsWith("/forgot-password?")) return fallback;

  return decoded;
}

/** Read and sanitise the `redirect` query parameter from a query string. */
export function redirectFromSearch(
  search: string = typeof window === "undefined" ? "" : window.location.search,
  fallback: string = DEFAULT_FALLBACK,
): string {
  return safeRedirect(new URLSearchParams(search).get("redirect"), fallback);
}
