/**
 * Consent-gated GA4 loader.
 *
 * Analytics is deliberately not a render-critical resource: loading gtag.js in
 * the document head made every visitor parse ~176 KiB of third-party code
 * before the landing page could settle. This module installs the one GA4 tag
 * only after the visitor has explicitly enabled analytics (or after a saved
 * preference has been restored). The public API is idempotent so consent
 * changes, StrictMode, and route transitions cannot create duplicate tags.
 */

export const GA_MEASUREMENT_ID = "G-PXMVX28PL5";
const SCRIPT_ID = "focusarx-ga4";

let requested = false;

type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = { dataLayer?: unknown[]; gtag?: Gtag };

function installQueue(): Gtag {
  if (typeof window === "undefined") return () => {};
  const analyticsWindow = window as unknown as AnalyticsWindow;
  analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
  if (!analyticsWindow.gtag) {
    analyticsWindow.gtag = (...args: unknown[]) => {
      analyticsWindow.dataLayer?.push(args);
    };
  }
  return analyticsWindow.gtag;
}

/** Load and configure the GA4 library exactly once, after consent. */
export function ensureAnalyticsLoaded(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const gtag = installQueue();
  if (!requested) {
    requested = true;
    gtag("js", new Date());
    // SPA route changes are tracked by SiteAnalyticsTracker. Suppressing the
    // automatic page view preserves the one-view-per-route contract.
    gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false,
      anonymize_ip: true,
      cookie_domain: "auto",
      cookie_expires: 63072000,
      cookie_flags: "SameSite=Lax;Secure",
      cookie_update: true,
    });
  }

  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.onerror = () => {
    // A content blocker must never break navigation or cause a retry storm.
    requested = false;
  };
  document.head.appendChild(script);
}
