/**
 * Google Analytics 4 (GA4) integration.
 *
 * Loads gtag.js lazily and only when a measurement ID is configured via
 * VITE_GA_MEASUREMENT_ID — so there is zero cost (no extra request, no console
 * noise) when analytics isn't set up. Tracks SPA page views and custom events.
 *
 * Setup:
 *   1. Create a GA4 property at https://analytics.google.com
 *   2. Add VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX to your deployment env
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

type Gtag = (command: "config" | "event" | "js" | "set", ...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let initialized = false;

export function isGAConfigured(): boolean {
  return Boolean(MEASUREMENT_ID);
}

export function initGtag(): void {
  if (!MEASUREMENT_ID || initialized) return;
  initialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    send_page_view: false, // SPA — we send page views manually on route change.
    anonymize_ip: true,
  });
}

/** Send a page view for an SPA route. */
export function trackPageView(path: string): void {
  if (!MEASUREMENT_ID || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: document.title,
    page_location: window.location.href,
  });
}

/** Send a custom event (e.g. signup, session_start). */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!MEASUREMENT_ID || !window.gtag) return;
  window.gtag("event", name, params ?? {});
}
