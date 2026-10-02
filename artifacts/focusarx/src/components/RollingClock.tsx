import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * One glyph that slides vertically when its value changes — the iOS Clock
 * idiom. Fixed advance width so the string never jitters as digits change.
 *
 * The cell is `inline-flex` + `items-center` rather than a baseline-aligned
 * `inline-block` wrapping a `grid place-items-center` child. Two boxes with two
 * centring rules is what let the digits and the separator drift apart; one box
 * with one rule cannot.
 */
export function RollingDigit({ value, reduced }: { value: string; reduced: boolean }) {
  return (
    <span className="relative inline-flex h-[1em] w-[0.62em] items-center justify-center overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="absolute inset-0 grid place-items-center"
          initial={reduced ? false : { y: "0.55em", opacity: 0, filter: "blur(2px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0 } : { y: "-0.55em", opacity: 0, filter: "blur(2px)" }}
          transition={{ duration: 0.25, ease: EASE }}
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
 *
 * **One vertical system for every cell.** The row used to be a baseline-aligned
 * flex line, so each cell was placed by its own baseline: the digit cells are
 * `h-[1em]` and internally `grid place-items-center`, so their glyphs land
 * 2.5px *above* the row's centre, while the separator — a plain inline-block
 * with no height — took the full line box and sat exactly on the row's centre.
 * Measured in the browser at the shipped 15px clock: digits centred at
 * `midOffset -2.5`, the colon at `0`. That is the colon hanging visibly low
 * between the digits, and it is what made the number read as misaligned.
 *
 * `items-center` on the row plus a flex cell for every glyph (including the
 * separator) means one rule centres everything, whatever its natural height.
 */
export function RollingClock({ value, className = "" }: { value: string; className?: string }) {
  const reduced = !!useReducedMotion();
  return (
    <span className={`inline-flex items-center ${className}`} role="timer" aria-live="off" aria-label={value}>
      <span aria-hidden className="inline-flex items-center">
        {value.split("").map((ch, i) =>
          /\d/.test(ch) ? (
            <RollingDigit key={i} value={ch} reduced={reduced} />
          ) : (
            // Same cell geometry as a digit, minus the roll: the separator has
            // no height of its own, so it is stretched to the digit cell's
            // 1em line and centred with it.
            <span
              key={i}
              className="mx-[0.02em] flex h-[1em] w-[0.32em] items-center justify-center opacity-70"
            >
              {ch}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
