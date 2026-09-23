import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil } from "lucide-react";
import type { TimerMode } from "@/types/timer";

interface FlipClockDisplayProps {
  secondsLeft: number;
  mode: TimerMode;
  isRunning: boolean;
  onEditClick?: () => void;
  sessionType?: string;
}

/**
 * One digit of the countdown.
 *
 * The split-flap is kept because it is the honest part of this component: the
 * digit that changed is the digit that moves, so the motion carries the
 * information. What went was the scenery around it — a simulated hinge, a
 * glare strip, a crease line and two side clips, all hardcoded to near-black
 * hexes, which meant the clock stayed dark in Daylight. Everything here reads
 * the surface tokens, so the flap works in both themes.
 */
function FlipDigit({ digit, label }: { digit: string; label?: string }) {
  const [current, setCurrent] = useState(digit);
  const [previous, setPrevious] = useState(digit);
  const [flipping, setFlipping] = useState(false);

  // A changed digit is a render-time fact, not an effect: adjust during the
  // render that sees the new prop (React re-runs this component immediately
  // and never paints the stale digit).
  if (digit !== current) {
    setPrevious(current);
    setCurrent(digit);
    setFlipping(true);
  }

  useEffect(() => {
    if (!flipping) return;
    const timer = setTimeout(() => setFlipping(false), 240);
    return () => clearTimeout(timer);
  }, [flipping]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex h-20 w-14 flex-col items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-1)] sm:h-28 sm:w-20 md:h-32 md:w-24"
        style={{ perspective: "800px" }}
      >
        {/* Upper half: the incoming digit, clipped at the crease. */}
        <div className="relative flex h-1/2 w-full items-end justify-center overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--surface-2)]">
          <span className="font-display translate-y-1/2 select-none text-3xl font-semibold tabular-nums tracking-tight text-[var(--foreground)] sm:text-5xl md:text-6xl">
            {current}
          </span>
        </div>

        {/* Lower half: the outgoing digit finishes folding into it. */}
        <div className="relative flex h-1/2 w-full items-start justify-center overflow-hidden">
          <span className="font-display -translate-y-1/2 select-none text-3xl font-semibold tabular-nums tracking-tight text-[var(--foreground)] sm:text-5xl md:text-6xl">
            {flipping ? previous : current}
          </span>
        </div>

        <AnimatePresence>
          {flipping && (
            <motion.div
              key={`top-flap-${previous}-${digit}`}
              initial={{ rotateX: 0 }}
              animate={{ rotateX: -90 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.37, 0, 0.63, 1] }}
              style={{ transformOrigin: "bottom center", backfaceVisibility: "hidden" }}
              className="absolute inset-x-0 top-0 z-20 flex h-1/2 items-end justify-center overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--surface-2)]"
            >
              <span className="font-display translate-y-1/2 select-none text-3xl font-semibold tabular-nums tracking-tight text-[var(--foreground-muted)] sm:text-5xl md:text-6xl">
                {previous}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {label && (
        <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-subtle)]">
          {label}
        </span>
      )}
    </div>
  );
}

export function FlipClockDisplay({
  secondsLeft,
  mode,
  isRunning,
  onEditClick,
  sessionType,
}: FlipClockDisplayProps) {
  const safeSeconds = Math.max(0, Math.floor(secondsLeft));
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;

  const m1 = String(Math.floor(m / 10));
  const m2 = String(m % 10);
  const s1 = String(Math.floor(s / 10));
  const s2 = String(s % 10);

  const modeAccent =
    mode === "focus" ? "var(--brand-strong)" : mode === "break" ? "var(--success)" : "var(--info)";

  const modeLabel = sessionType
    ? sessionType.replace(/_/g, " ")
    : mode === "focus"
      ? "Focus"
      : mode === "break"
        ? "Break"
        : "Long break";

  return (
    <div className="relative flex flex-col items-center justify-center py-3">
      {/* One quiet status line: what this block is, and whether it is moving.
          The breathing radial backlight that used to sit behind the digits
          looped forever and said nothing the dot on the left does not. */}
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--foreground-muted)]">
          <span
            className={isRunning ? "live-pill-dot h-1.5 w-1.5" : "h-1.5 w-1.5 rounded-full bg-[var(--foreground-subtle)]"}
            aria-hidden="true"
          />
          <span style={{ color: modeAccent }}>{modeLabel}</span>
        </span>
        {onEditClick && !isRunning && (
          <button
            type="button"
            onClick={onEditClick}
            title="Edit duration"
            className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground-subtle)] transition-colors hover:text-[var(--foreground)]"
          >
            <Pencil size={11} /> Edit
          </button>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <FlipDigit digit={m1} />
          <FlipDigit digit={m2} label="min" />
        </div>

        {/* The separator is two dots, not a light source: the running state is
            already stated by the dot above and the ticking digits. */}
        <div className="flex flex-col items-center justify-center gap-2.5 pb-4 sm:gap-3.5 sm:pb-5" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--foreground-subtle)] sm:h-2 sm:w-2" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--foreground-subtle)] sm:h-2 sm:w-2" />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <FlipDigit digit={s1} />
          <FlipDigit digit={s2} label="sec" />
        </div>
      </div>
    </div>
  );
}
