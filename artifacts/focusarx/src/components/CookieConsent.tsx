import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  DEFAULT_CONSENT,
  hasConsentChoice,
  restoreConsent,
  setConsent,
  type ConsentState,
} from "@/lib/consent";

/**
 * Cookie notice — the visible half of Consent Mode v2.
 *
 * This component only reads a stored choice and writes a new one through
 * `lib/consent.ts`, which is also the only module allowed to load optional
 * measurement. Keeping the decision in one place prevents a banner and a
 * tracker from silently disagreeing about what "Accept" means.
 *
 * Three answers, all of which persist:
 *   Accept all       → analytics + advertising consent
 *   Analytics only   → the default state (first-party GA4 measurement)
 *   Essential only   → analytics denied; the app still works, GA4 models the hit
 *
 * India's DPDP Act and Google's EEA/UK consent rules both want a real choice
 * that changes behaviour, not a notice with a single OK button — hence the
 * opt-out, which the previous banner only implied by letting you dismiss it.
 */
export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Restore a returning visitor's saved choice first. A new visitor sees no
    // third-party requests until they choose. The prompt itself waits for an
    // interaction (or a long fallback) so it cannot become the LCP element and
    // hide the page the visitor came to read on a slow phone.
    restoreConsent();
    if (hasConsentChoice()) return;

    let shown = false;
    const reveal = () => {
      if (shown) return;
      shown = true;
      setShow(true);
      window.removeEventListener("pointerdown", reveal, true);
      window.removeEventListener("keydown", reveal, true);
      window.removeEventListener("scroll", reveal, true);
    };
    window.addEventListener("pointerdown", reveal, { capture: true, once: true, passive: true });
    window.addEventListener("keydown", reveal, { capture: true, once: true });
    window.addEventListener("scroll", reveal, { capture: true, once: true, passive: true });
    const timer = window.setTimeout(reveal, 12_000);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", reveal, true);
      window.removeEventListener("keydown", reveal, true);
      window.removeEventListener("scroll", reveal, true);
    };
  }, []);

  const choose = (state: ConsentState) => {
    setConsent(state);
    setShow(false);
  };

  if (!show) return null;

  return (
        <div
          className="fixed bottom-6 left-6 right-6 z-[var(--z-max)] mx-auto max-w-4xl motion-safe:animate-rise-in"
          role="region"
          aria-label="Cookie and consent preferences"
        >
          <div className="rounded-2xl border border-[var(--palette-white)]/10 bg-[var(--palette-zinc-950)]/90 p-6 shadow-[var(--shadow-lg)] md:flex md:items-center md:justify-between md:gap-8">
            <div className="flex items-start gap-4 md:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--palette-purple-500)]/10">
                <span className="text-xl font-semibold text-[var(--palette-purple-400)]" aria-hidden="true">◈</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--palette-white)]">Your focus, your data</h2>
                <p className="mt-1 text-xs leading-relaxed text-[var(--palette-zinc-400)]">
                  We use first-party cookies to keep you signed in and to measure which pages help
                  (IP addresses are anonymised). Advertising cookies stay off unless you turn them on.
                  Vision data for attention tracking never leaves your browser.{" "}
                  <Link href="/cookie-policy" className="text-[var(--palette-purple-400)] underline hover:underline">
                    Cookie policy
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div className="mt-6 flex shrink-0 flex-wrap gap-2 md:mt-0 md:flex-col md:items-stretch lg:flex-row lg:items-center">
              <button
                type="button"
                className="min-h-11 rounded-[var(--radius-md)] bg-[var(--brand-600)] px-3 text-xs font-semibold text-[var(--neutral-0)] transition-colors hover:bg-[var(--brand-700)]"
                onClick={() => choose({ ...DEFAULT_CONSENT, analytics: true, advertising: true })}
              >
                Accept all
              </button>
              <button
                type="button"
                className="min-h-11 rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
                onClick={() => choose({ ...DEFAULT_CONSENT, analytics: true })}
              >
                Analytics only
              </button>
              <button
                type="button"
                className="min-h-11 rounded-[var(--radius-md)] px-3 text-xs font-semibold text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                onClick={() => choose({ necessary: true, analytics: false, advertising: false })}
              >
                Essential only
              </button>
            </div>
          </div>
        </div>
  );
}
