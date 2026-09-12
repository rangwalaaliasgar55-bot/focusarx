/**
 * Google Analytics 4 (GA4) event helpers.
 *
 * The GA4 loader and configuration are installed exactly once in the global
 * Vite HTML entry point (`artifacts/focusarx/index.html`). Every prerendered
 * route inherits that document head, and the inline bootstrap creates
 * `window.gtag` synchronously so events can safely queue while gtag.js loads.
 *
 * This module deliberately never injects a script tag. It only forwards SPA
 * page views and product events to the global Google tag, preventing duplicate
 * GA4 loaders while preserving client-side route tracking.
 *
 * Page-view accounting (verified against the entry document):
 *   • `index.html` configures the tag with `send_page_view: false`, so gtag.js
 *     does not emit its own view on load;
 *   • `SiteAnalyticsTracker` is mounted once inside the router and emits exactly
 *     one `page_view` per route, including the first one;
 *   ⇒ one view per route, never two.
 *
 * Key events (mark these as Key events in GA4 Admin → Data display → Events):
 *   sign_up                email registration (pages/signup.tsx)
 *   session_complete       any focus session completed (lib/analytics.ts)
 *   first_session_complete first-ever completion per browser (lib/analytics.ts)
 */

type Gtag = (command: "config" | "event" | "js" | "set" | "consent", ...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

function getGtag(): Gtag | undefined {
  if (typeof window === "undefined") return undefined;
  return window.gtag;
}

/**
 * Query params that must never reach GA4.
 *
 * Two reasons, both real:
 *
 *   1. **Secrets.** The OAuth callback lands on `/auth/callback?code=…&state=…`.
 *      Sending that as `page_location` puts a live authorization code into an
 *      analytics property — and into anyone's dashboard URL drill-down.
 *   2. **Report fragmentation.** The reload coordinator's cache-busting params
 *      (`?_v=<timestamp>&_skew=1`) are unique per reload, so every recovery
 *      invented a brand-new "page" in GA4. Users who refreshed during a deploy
 *      showed up as dozens of one-hit pages, which corrupts the very funnel
 *      metrics this file exists to feed.
 *
 * Attribution params (`utm_*`, `gclid`, `fbclid`) and FocusArx's own `ref` /
 * `src` are deliberately kept — GA4 reads campaign data from `page_location`,
 * so stripping those would break acquisition reporting.
 */
const STRIPPED_PARAMS = new Set([
  // reload / cache-busting internals
  "_v",
  "_skew",
  // OAuth / IdP round-trip
  "code",
  "state",
  "session_state",
  "nonce",
  "error",
  "error_description",
  // anything that looks like a credential
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "otp",
  "password",
  "secret",
  "sig",
  "signature",
]);

/**
 * Canonical URL reported to GA4: origin + pathname + only meaningful query
 * params + hash. Exported so the SEO/analytics gates can assert on it.
 */
export function canonicalPageLocation(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }

  for (const key of [...url.searchParams.keys()]) {
    if (STRIPPED_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();

  const search = url.searchParams.toString();
  return `${url.origin}${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

/** Send a page view for an SPA route. */
export function trackPageView(path: string): void {
  const gtag = getGtag();
  if (!gtag) return;

  gtag("event", "page_view", {
    page_path: path,
    // document.title is set per route by <PageSEO>, so this is the real page
    // title rather than the SPA default.
    page_title: document.title,
    page_location: canonicalPageLocation(window.location.href),
  });
}

/** Send a custom event (for example, sign-up or session start). */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  const gtag = getGtag();
  if (!gtag) return;

  gtag("event", name, params ?? {});
}
