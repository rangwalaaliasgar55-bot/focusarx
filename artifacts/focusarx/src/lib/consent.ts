/**
 * Consent Mode v2 — one place that talks to `gtag("consent", …)`.
 *
 * There is no analytics tag in `index.html`: optional third-party code is
 * loaded only after this module observes an explicit preference. This module
 * owns reading a stored choice on boot and applying a new one from the banner.
 *
 * Why a shared module instead of calling gtag from CookieConsent.tsx directly:
 * two files writing consent state is how a site ends up granting analytics in
 * one path and denying it in another, which is both a compliance problem and
 * an unexplainable dip in GA4. `consent.test.ts` pins the mapping so the
 * banner cannot quietly change what a button means.
 *
 * The GA4 library is not in index.html. It is installed only after an explicit
 * analytics choice, so third-party work never competes with first paint.
 *
 * Categories:
 *   necessary  → security_storage / functionality_storage. Never optional;
 *                these cover the session cookie, the theme and the timer.
 *   analytics  → analytics_storage. First-party measurement, GA4 and optional
 *                Plausible. All remain denied until an explicit opt-in.
 *   advertising→ ad_storage / ad_user_data / ad_personalization. Denied by
 *                default: FocusArx runs no Google Ads tag today, and granting
 *                ad consent nobody asked for is what gets a property flagged
 *                in Google's EEA/UK compliance checks.
 */

import { ensureAnalyticsLoaded } from "@/lib/analyticsLoader";

export type ConsentCategory = "necessary" | "analytics" | "advertising";

export type ConsentState = Record<ConsentCategory, boolean>;

/** The gtag consent field for each Google consent type we set. */
const CONSENT_FIELDS = {
  ad_storage: "advertising",
  ad_user_data: "advertising",
  ad_personalization: "advertising",
  analytics_storage: "analytics",
  functionality_storage: "necessary",
  personalization_storage: "advertising",
  security_storage: "necessary",
} as const satisfies Record<string, ConsentCategory>;

export type GoogleConsentField = keyof typeof CONSENT_FIELDS;

/** Storage key for the visitor's choice. `"true"` (legacy) means "accepted all". */
export const CONSENT_STORAGE_KEY = "focusarx-cookie-consent";

/** What a brand-new visitor starts with — necessary storage only. */
export const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  // Measurement and advertising are optional. Loading either before the
  // visitor has made a choice costs mobile users bytes and violates the
  // principle behind the banner itself, so the initial state is essential-only.
  analytics: false,
  advertising: false,
};

function gtag(): ((...args: unknown[]) => void) | undefined {
  if (typeof window === "undefined") return undefined;
  const fn = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  return typeof fn === "function" ? fn : undefined;
}

/** Translate our three categories into the fields Google expects. */
export function toGoogleConsent(state: ConsentState): Record<GoogleConsentField, "granted" | "denied"> {
  const out = {} as Record<GoogleConsentField, "granted" | "denied">;
  for (const [field, category] of Object.entries(CONSENT_FIELDS)) {
    out[field as GoogleConsentField] = state[category] ? "granted" : "denied";
  }
  return out;
}

/** Send a `consent update` to gtag. Safe to call before gtag.js has loaded. */
export function applyConsent(state: ConsentState): void {
  gtag()?.("consent", "update", toGoogleConsent(state));
}

/** True only after an explicit stored preference permits measurement. */
export function hasAnalyticsConsent(): boolean {
  return readStoredConsent()?.analytics === true;
}

/** True only after an explicit stored preference permits advertising. */
export function hasAdvertisingConsent(): boolean {
  return readStoredConsent()?.advertising === true;
}

function notifyConsentChange(state: ConsentState): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ConsentState>("focusarx:consent-change", { detail: state }));
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeRaw(value: string): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
    /* private mode — the choice still applies for this page view */
  }
}

/**
 * The stored choice, or null when the visitor has never answered.
 *
 * `"true"` / `"false"` are the values older builds wrote (Accept All / dismiss);
 * `"essential"` is the explicit opt-out this banner added. Unknown values are
 * treated as "no answer" rather than as consent.
 */
export function readStoredConsent(): ConsentState | null {
  const raw = readRaw();
  if (raw === null) return null;
  if (raw === "true") return { necessary: true, analytics: true, advertising: true };
  // `false` was the old "analytics only" value. Keep it readable so a deploy
  // does not silently revoke a choice an existing visitor already made.
  if (raw === "false" || raw === "analytics") return { necessary: true, analytics: true, advertising: false };
  if (raw === "essential") return { necessary: true, analytics: false, advertising: false };
  return null;
}

/**
 * Re-apply a previously stored choice on boot.
 *
 * A returning visitor who opted in is restored before the route tracker runs;
 * this installs GA4 once and re-applies the stored Google consent fields.
 */
export function restoreConsent(): ConsentState {
  const stored = readStoredConsent();
  if (!stored) return { ...DEFAULT_CONSENT };
  if (stored.analytics) ensureAnalyticsLoaded();
  applyConsent(stored);
  return stored;
}

/** Record a choice, load optional analytics if allowed, and notify listeners. */
export function setConsent(state: ConsentState): void {
  const next: ConsentState = { ...DEFAULT_CONSENT, ...state };
  writeRaw(next.analytics ? (next.advertising ? "true" : "analytics") : "essential");
  if (next.analytics) ensureAnalyticsLoaded();
  applyConsent(next);
  notifyConsentChange(next);
}

/** Has the visitor answered at all? Drives whether the banner shows. */
export function hasConsentChoice(): boolean {
  return readStoredConsent() !== null;
}
