import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
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
 * The *default* consent state is declared inline in index.html before gtag's
 * `config` call; this component only reads a stored choice and writes a new
 * one, through `lib/consent.ts`. Keeping both halves in that one module is the
 * point: a banner that calls gtag directly is how a site ends up with two
 * sources of truth about what "Accept" means.
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
    // Apply a returning visitor's stored choice before the first page view is
    // measured, then only prompt people who have never answered.
    restoreConsent();
    if (hasConsentChoice()) return;
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const choose = (state: ConsentState) => {
    setConsent(state);
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed bottom-6 left-6 right-6 z-[var(--z-max)] mx-auto max-w-4xl"
          role="region"
          aria-label="Cookie and consent preferences"
        >
          <div className="rounded-2xl border border-[var(--palette-white)]/10 bg-[var(--palette-zinc-950)]/90 p-6 shadow-2xl backdrop-blur-xl md:flex md:items-center md:justify-between md:gap-8">
            <div className="flex items-start gap-4 md:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--palette-purple-500)]/10">
                <ShieldCheck className="text-[var(--palette-purple-400)]" size={24} aria-hidden />
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
              <Button size="sm" variant="default" onClick={() => choose({ ...DEFAULT_CONSENT, advertising: true })}>
                Accept all
              </Button>
              <Button size="sm" variant="outline" onClick={() => choose({ ...DEFAULT_CONSENT })}>
                Analytics only
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => choose({ necessary: true, analytics: false, advertising: false })}
              >
                Essential only
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
