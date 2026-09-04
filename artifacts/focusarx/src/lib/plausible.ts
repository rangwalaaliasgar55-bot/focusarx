/**
 * Privacy-first analytics (Plausible).
 *
 * Optional and env-gated: without VITE_PLAUSIBLE_DOMAIN nothing loads, no
 * request fires, and the existing first-party /api/track pipeline is the
 * only telemetry. With it, a 1 KB script counts pageviews — no cookies, no
 * cross-site tracking, IN/EU-hostable. Never an ad-tech SDK.
 */

let installed = false;

export function initPlausible(): void {
  if (installed || typeof window === "undefined" || typeof document === "undefined") return;
  const domain = (import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined)?.trim();
  if (!domain) return;
  try {
    installed = true;
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = domain;
    script.src = "https://plausible.io/js/script.js";
    document.head.appendChild(script);
  } catch {
    installed = false;
  }
}

export function trackPlausiblePageview(path: string): void {
  try {
    (window as unknown as { plausible?: (event: string, opts?: { u?: string }) => void }).plausible?.(
      "pageview",
      { u: path },
    );
  } catch {
    /* analytics must never break the app */
  }
}
