import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { hasConsentChoice } from "@/lib/consent";

/**
 * Mobile-only sticky CTA for the landing page.
 *
 * Ported from the premium redesign proposal (`focusarx-resource`): once a
 * visitor on a small screen scrolls past the hero, a persistent
 * "Start focusing" bar rides the bottom edge, so the next action is always
 * one thumb-tap away — including during long reads of the comparison and
 * exam sections.
 *
 * Two collisions are designed out:
 *  - It hides again near the very bottom, where the page already has its
 *    final CTA panel and the above-footer ad slot; stacking a second CTA on
 *    top of either would be noise (and risks an accidental-ad-click flag).
 *  - It stays hidden while the cookie-consent banner is still open. On a
 *    narrow phone that banner stacks three buttons and can reach ~380px, so
 *    no lifted offset clears it reliably; the choice is a few seconds away
 *    and made once, which is the right trade against overlap risk.
 *
 * Both values are updated inside the scroll subscription callback (never
 * synchronously in the effect body), and the consent read is a cheap,
 * synchronous localStorage lookup.
 */

const SHOW_AFTER_PX = 640;
const HIDE_NEAR_BOTTOM_PX = 420;

export function LandingMobileCta() {
  const [scrollZone, setScrollZone] = useState(false);
  const [consentResolved, setConsentResolved] = useState(() => hasConsentChoice());
  const visible = scrollZone && consentResolved;

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      setScrollZone(y > SHOW_AFTER_PX && y < maxScroll - HIDE_NEAR_BOTTOM_PX);
      setConsentResolved(hasConsentChoice());
    };
    const onConsentChange = () => setConsentResolved(hasConsentChoice());
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("focusarx:consent-change", onConsentChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("focusarx:consent-change", onConsentChange);
    };
  }, []);

  if (!visible) return null;

  return (
        <div
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[calc(var(--z-nav)+1)] motion-safe:animate-rise-in md:hidden"
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-overlay)] p-2 pl-4 shadow-[var(--shadow-lg)]">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">Ready when you are</p>
              <p className="truncate text-[11px] text-[var(--foreground-subtle)]">Free · no account needed</p>
            </div>
            <Link
              href="/focus"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 text-sm font-semibold text-[var(--neutral-0)] transition-transform duration-[var(--duration-fast)] active:scale-[0.97] motion-reduce:active:scale-100"
            >
              Start focusing <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
  );
}
