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
 */

type Gtag = (command: "config" | "event" | "js" | "set", ...args: unknown[]) => void;

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

/** Send a page view for an SPA route. */
export function trackPageView(path: string): void {
  const gtag = getGtag();
  if (!gtag) return;

  gtag("event", "page_view", {
    page_path: path,
    page_title: document.title,
    page_location: window.location.href,
  });
}

/** Send a custom event (for example, sign-up or session start). */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  const gtag = getGtag();
  if (!gtag) return;

  gtag("event", name, params ?? {});
}
