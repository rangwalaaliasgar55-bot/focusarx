/**
 * Locale foundations (i18n step 1 — formatting, not strings).
 *
 * Full UI translation (hi/es/pt/id/ar + RTL) needs native-speaker review
 * and is tracked in REMAINING.md. What ships now is the honest base layer:
 * a persisted locale preference with navigator fallback, and Intl-based
 * date/number formatting so non-US users stop seeing US-only shapes.
 * No user-visible string is machine-translated — English copy stays until
 * reviewed translations land.
 */

import { safeGet, safeSet } from "./safeStorage";

const LOCALE_KEY = "focusarx-locale";
const FALLBACK = "en-US";

function canonical(tag: string): string | null {
  try {
    const [c] = Intl.getCanonicalLocales(tag);
    return c ?? null;
  } catch {
    return null;
  }
}

/** Effective BCP 47 locale: stored preference → browser → en-US. */
export function getLocale(): string {
  try {
    const stored = safeGet(LOCALE_KEY);
    if (stored) {
      const c = canonical(stored);
      if (c) return c;
    }
    const nav = typeof navigator !== "undefined" ? navigator.language : null;
    if (nav) {
      const c = canonical(nav);
      if (c) return c;
    }
  } catch {
    /* ignore */
  }
  return FALLBACK;
}

export function setLocale(tag: string): boolean {
  const c = canonical(tag);
  if (!c) return false;
  safeSet(LOCALE_KEY, c);
  try {
    document.documentElement.lang = c;
  } catch {
    /* ignore */
  }
  return true;
}

/** Medium date in the user locale ("5 Sept 2026" / "5 sept 2026" / …). */
export function fmtDate(iso: string, locale: string = getLocale()): string {
  const t = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(t)) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(t));
  } catch {
    return iso;
  }
}

/** Grouped integer in the user locale. */
export function fmtInt(n: number, locale: string = getLocale()): string {
  if (!Number.isFinite(n)) return "0";
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.floor(n));
  } catch {
    return String(Math.floor(n));
  }
}
