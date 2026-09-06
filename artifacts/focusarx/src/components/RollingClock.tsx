import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * One glyph that slides vertically when its value changes — the iOS Clock
 * idiom. Fixed advance width so the string never jitters as digits change.
 */
export function RollingDigit({ value, reduced }: { value: string; reduced: boolean }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden align-baseline">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="absolute inset-0 grid place-items-center"
          initial={reduced ? false : { y: "0.55em", opacity: 0, filter: "blur(2px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0 } : { y: "-0.55em", opacity: 0, filter: "blur(2px)" }}
          transition={{ duration: 0.34, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * `MM:SS` (or `H:MM:SS`) rendered as rolling digits. Pass a preformatted
 * string; every non-digit character is rendered as a static separator.
 * The whole thing is one accessible label so screen readers read a time,
 * not eleven separate spans.
 */
export function RollingClock({ value, className = "" }: { value: string; className?: string }) {
  const reduced = !!useReducedMotion();
  return (
    <span className={`inline-flex items-baseline ${className}`} role="timer" aria-live="off" aria-label={value}>
      <span aria-hidden className="inline-flex items-baseline">
        {value.split("").map((ch, i) =>
          /\d/.test(ch)
            ? <RollingDigit key={i} value={ch} reduced={reduced} />
            : <span key={i} className="mx-[0.02em] inline-block w-[0.32em] text-center opacity-70">{ch}</span>,
        )}
      </span>
    </span>
  );
}
