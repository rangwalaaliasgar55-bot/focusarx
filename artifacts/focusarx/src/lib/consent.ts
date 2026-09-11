/**
 * Consent Mode v2 — one place that talks to `gtag("consent", …)`.
 *
 * The default state is declared inline in `index.html` *before* the gtag
 * `config` call (it has to be, or the first hit carries no consent signal at
 * all). This module owns everything that happens after that: reading a
 * previously stored choice on boot, and applying a new one from the banner.
 *
 * Why a shared module instead of calling gtag from CookieConsent.tsx directly:
 * two files writing consent state is how a site ends up granting analytics in
 * one path and denying it in another, which is both a compliance problem and
 * an unexplainable dip in GA4. `consent.test.ts` pins the mapping so the
 * banner cannot quietly change what a button means.
 *
 * Categories:
 *   necessary  → security_storage / functionality_storage. Never optional;
 *                these cover the session cookie, the theme and the timer.
 *   analytics  → analytics_storage. First-party GA4 measurement with
 *                anonymize_ip. Declared "granted" by default with a visible
 *                notice and an opt-out, which is what DPDP's notice-and-choice
 *                model asks for.
 *   advertising→ ad_storage / ad_user_data / ad_personalization. Denied by
 *                default: FocusArx runs no Google Ads tag today, and granting
 *                ad consent nobody asked for is what gets a property flagged
 *                in Google's EEA/UK compliance checks.
 */

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

/** What a brand-new visitor starts with — must match the inline default. */
export const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  analytics: true,
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
  if (raw === "false") return { ...DEFAULT_CONSENT };
  if (raw === "essential") return { necessary: true, analytics: false, advertising: false };
  return null;
}

/**
 * Re-apply a previously stored choice on boot.
 *
 * The inline default in index.html runs before any storage is read, so a
 * returning visitor who opted out would get one page view measured with
 * analytics granted. gtag merges this `update` into the same session, and
 * `wait_for_update` on the default holds the very first hit briefly so the
 * correction lands before it is sent.
 */
export function restoreConsent(): ConsentState {
  const stored = readStoredConsent();
  if (!stored) return { ...DEFAULT_CONSENT };
  applyConsent(stored);
  return stored;
}

/** Record a choice and tell Google about it. */
export function setConsent(state: ConsentState): void {
  const next: ConsentState = { ...DEFAULT_CONSENT, ...state };
  writeRaw(next.analytics ? (next.advertising ? "true" : "false") : "essential");
  applyConsent(next);
}

/** Has the visitor answered at all? Drives whether the banner shows. */
export function hasConsentChoice(): boolean {
  return readStoredConsent() !== null;
}
