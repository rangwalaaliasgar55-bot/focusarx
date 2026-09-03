import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";
import { Link } from "wouter";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("focusarx-cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("focusarx-cookie-consent", "true");
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
        >
          <div className="rounded-2xl border border-[var(--palette-white)]/10 bg-[var(--palette-zinc-950)]/90 p-6 shadow-2xl backdrop-blur-xl md:flex md:items-center md:justify-between md:gap-8">
            <div className="flex items-start gap-4 md:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--palette-purple-500)]/10">
                <ShieldCheck className="text-[var(--palette-purple-400)]" size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--palette-white)]">We value your focus (and your privacy)</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--palette-zinc-400)]">
                  FocusArx uses cookies to enhance your experience and analyze platform performance.
                  Vision data for attention tracking never leaves your browser.
                  By continuing, you agree to our <Link href="/cookie-policy" className="text-[var(--palette-purple-400)] underline hover:underline">Cookie Policy</Link>.
                </p>
              </div>
            </div>
            <div className="mt-6 flex shrink-0 gap-3 md:mt-0">
              <button
                onClick={accept}
                className="flex-1 rounded-xl bg-[var(--palette-white)] px-6 py-2.5 text-xs font-bold text-[var(--palette-black)] hover:bg-[var(--palette-zinc-200)] transition-colors md:flex-none"
              >
                Accept All
              </button>
              <button
                onClick={() => setShow(false)}
                aria-label="Dismiss cookie notice"
                className="rounded-xl border border-[var(--palette-white)]/10 bg-[var(--palette-white)]/5 p-2.5 text-[var(--palette-zinc-400)] hover:text-[var(--palette-white)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
