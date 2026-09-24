import { motion, useReducedMotion } from "framer-motion";
import type { TimerMode, TimerStatus } from "@/types/timer";

interface TimerControlsProps {
  status: TimerStatus;
  mode: TimerMode;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
  /** Optional label override for the primary button (mobile-first flows). */
  primaryLabel?: string;
}

/**
 * Mode palette for the primary control.
 *
 * These used to be hardcoded Tailwind zinc values plus a six-pixel accent halo
 * — the one part of the timer the v5 token migration missed, which left a dark
 * pre-v5 block sitting in the middle of a light, flat card. They are semantic
 * tokens now, so the buttons follow the theme (and the user's accent) like
 * everything around them.
 */
const MODE_COLORS: Record<TimerMode, { from: string; to: string; soft: string; text: string }> = {
  focus:     { from: "var(--brand-500)", to: "var(--brand-violet)", soft: "var(--brand-soft)",   text: "var(--brand-strong)" },
  break:     { from: "var(--success)",   to: "var(--palette-teal-400, var(--success))", soft: "var(--success-soft)", text: "var(--success)" },
  longBreak: { from: "var(--info)",      to: "var(--palette-sky-400, var(--info))",   soft: "var(--info-soft)",    text: "var(--info)" },
};

/**
 * Focus ring shared by all three buttons.
 *
 * The buttons previously relied on `whileHover` / `whileTap` alone, so a
 * keyboard user tabbing to Reset, Start or Skip had no indication of where the
 * focus was — the primary control of the entire product was invisible to
 * keyboard navigation. `focus-visible` keeps it off for pointer users.
 */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";

const SECONDARY =
  "flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--foreground-subtle)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]";

export function TimerControls({ status, mode, onToggle, onReset, onSkip, primaryLabel }: TimerControlsProps) {
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const reduced = !!useReducedMotion();
  const mc = MODE_COLORS[mode];
  const label = primaryLabel ?? (isRunning ? "Pause session" : isPaused ? "Resume session" : "Start session");

  return (
    <div className="mt-8 flex items-center justify-center gap-5">
      <motion.button
        type="button"
        onClick={onReset}
        aria-label="Reset timer"
        whileHover={reduced ? undefined : { scale: 1.06 }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        className={`${SECONDARY} ${FOCUS_RING}`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </motion.button>

      <div className="relative">
        {/* Idle aura — a slow, mode-coloured breath behind the primary button,
            so "press this" is legible from across the room. Paused is
            deliberately still: nothing is happening, and saying so with a
            frozen halo is the point. */}
        {isRunning && !reduced && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 0 ${mc.from}`, opacity: 0.5 }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.45, 0, 0.45] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <motion.button
          type="button"
          onClick={onToggle}
          aria-label={label}
          whileHover={reduced ? undefined : { scale: 1.04 }}
          whileTap={reduced ? undefined : { scale: 0.95 }}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full font-bold text-[var(--neutral-0)] ${FOCUS_RING}`}
          style={{
            background: `linear-gradient(140deg, ${mc.from}, ${mc.to})`,
            boxShadow: `var(--shadow-lg), 0 10px 30px -12px color-mix(in srgb, ${mc.from} 55%, transparent)`,
          }}
        >
          {isRunning ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="5" y="3" width="5" height="18" rx="1.5" />
              <rect x="14" y="3" width="5" height="18" rx="1.5" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="ml-1" aria-hidden>
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
        </motion.button>
      </div>

      <motion.button
        type="button"
        onClick={onSkip}
        aria-label="Skip to next session"
        whileHover={reduced ? undefined : { scale: 1.06 }}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        className={`${SECONDARY} ${FOCUS_RING}`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      </motion.button>
    </div>
  );
}
