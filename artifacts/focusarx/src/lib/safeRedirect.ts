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

/**
 * Where a signed-out visitor should be sent back to after signing in.
 *
 * The rule the product asked for is "sign in, land on the dashboard". The rule
 * that a shared link needs is "sign in and the thing I clicked is still there".
 * Both are true, and they only disagree on one destination: the timer itself.
 *
 *  - `/focus?duration=25&task=Revise` is somebody's link, an Instagram bio, a
 *    `/go/*` redirect or the landing preview. It carries a session in its query
 *    string, so it survives the sign-in.
 *  - A bare `/focus` is not a deep link — it is the app's home screen, reached
 *    by typing or by a stale bookmark. Sending the visitor straight into a
 *    running-timer screen after they sign up is how you get a first session
 *    abandoned at 00:25 with no task in it. They land on the dashboard and go
 *    to the timer from there, with their own data already on screen.
 */
export function postLoginDestination(
  pathWithQuery: string,
  fallback: string = DEFAULT_FALLBACK,
): string {
  const safe = safeRedirect(pathWithQuery, fallback);
  const [path, query = ""] = safe.split("?");
  if (path !== "/focus") return safe;
  return new URLSearchParams(query).has("duration") || new URLSearchParams(query).has("task")
    ? safe
    : fallback;
}
