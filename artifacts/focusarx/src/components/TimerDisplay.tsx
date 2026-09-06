import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { formatTime } from "@/lib/timerUtils";
import { RollingClock } from "@/components/RollingClock";
import type { TimerMode } from "@/types/timer";

interface TimerDisplayProps {
  secondsLeft: number;
  progress: number;
  mode: TimerMode;
  isRunning: boolean;
  onEditClick?: () => void;
  sessionType?: string;
  activeSecondsEarned?: number;
}

/**
 * Timer face — Apple Clock / Fitness ring idiom.
 *
 * One ring, drawn with a rounded cap and a soft trailing shadow, over a quiet
 * inner disc. The digits use the display face with tabular figures and roll
 * per-glyph as they change (the way iOS's clock does), rather than a whole
 * string that re-renders and flashes. Everything that moves is transform or
 * opacity only, and every animation collapses under `prefers-reduced-motion`.
 */
const SIZE = 300;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const EASE = [0.32, 0.72, 0, 1] as const;

const MODE_CONFIG: Record<TimerMode, { label: string; ring: string; ringSoft: string }> = {
  focus:     { label: "Focus",      ring: "var(--brand-500)",  ringSoft: "var(--brand-soft)" },
  break:     { label: "Break",      ring: "var(--success)",    ringSoft: "var(--success-soft)" },
  longBreak: { label: "Long break", ring: "var(--info)",       ringSoft: "var(--info-soft)" },
};

export function TimerDisplay({
  secondsLeft,
  progress,
  mode,
  isRunning,
  onEditClick,
  sessionType,
  activeSecondsEarned = 0,
}: TimerDisplayProps) {
  const { minutes, seconds } = formatTime(secondsLeft);
  const cfg = MODE_CONFIG[mode];
  const reduced = !!useReducedMotion();
  const dashOffset = CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));

  // A single soft breath when the timer starts, not a per-second pulse.
  const wasRunning = useRef(isRunning);
  const [breathe, setBreathe] = useState(false);
  useEffect(() => {
    if (isRunning && !wasRunning.current && !reduced) {
      setBreathe(true);
      const t = setTimeout(() => setBreathe(false), 700);
      return () => clearTimeout(t);
    }
    wasRunning.current = isRunning;
  }, [isRunning, reduced]);

  const xpEarned = Math.floor(activeSecondsEarned / 60) * 20;
  const coinsEarned = Math.floor(activeSecondsEarned / 300) * 10;
  const label = sessionType ? sessionType.replace(/_/g, " ") : cfg.label;

  return (
    <motion.div
      className="relative grid place-items-center"
      style={{ width: SIZE, height: SIZE }}
      initial={false}
      animate={{ scale: breathe ? 1.02 : 1 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      {/* Ambient halo — breathes slowly only while running */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-[-12%] rounded-full"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${cfg.ring} 22%, transparent) 0%, transparent 62%)`, filter: "blur(24px)" }}
        animate={isRunning && !reduced ? { opacity: [0.55, 0.9, 0.55], scale: [0.98, 1.03, 0.98] } : { opacity: isRunning ? 0.7 : 0.35, scale: 1 }}
        transition={isRunning && !reduced ? { duration: 4.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.6 }}
      />

      {/* Inner disc */}
      <div
        aria-hidden
        className="absolute rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-md),inset_0_1px_0_color-mix(in_srgb,var(--neutral-0)_10%,transparent)]"
        style={{ inset: STROKE + 8 }}
      />

      {/* Ring */}
      <svg width={SIZE} height={SIZE} className="absolute inset-0 -rotate-90" aria-hidden>
        <defs>
          <filter id={`ring-shadow-${mode}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={cfg.ring} floodOpacity="0.45" />
          </filter>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={cfg.ringSoft} strokeWidth={STROKE} />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={cfg.ring}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={reduced ? { duration: 0 } : { duration: isRunning ? 1 : 0.6, ease: isRunning ? "linear" : EASE }}
          filter={`url(#ring-shadow-${mode})`}
        />
      </svg>

      {/* Face */}
      <div className="relative z-[var(--z-content)] flex flex-col items-center text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${isRunning}-${label}`}
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="mb-2 inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em]"
            style={{ color: cfg.ring }}
          >
            {isRunning && (
              <motion.span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: cfg.ring }}
                animate={reduced ? {} : { opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {label}
          </motion.span>
        </AnimatePresence>

        <div className="group relative flex items-center">
          <button
            type="button"
            onClick={onEditClick}
            disabled={!onEditClick || isRunning}
            aria-label={onEditClick ? `${minutes} minutes ${seconds} seconds remaining. Edit duration.` : `${minutes} minutes ${seconds} seconds remaining`}
            className="font-display text-[4.25rem] font-semibold leading-none tracking-[-0.055em] text-[var(--foreground)] tabular-nums outline-none transition-opacity disabled:cursor-default enabled:hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--brand-500)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface)] rounded-md"
            style={{ fontFeatureSettings: '"tnum" 1, "ss01" 1' }}
          >
            <RollingClock value={`${minutes}:${seconds}`} />
          </button>
          {onEditClick && !isRunning && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <Pencil size={14} />
            </span>
          )}
        </div>

        <span className="mt-2 text-xs font-medium text-[var(--foreground-subtle)]">
          {isRunning ? "In progress" : "Ready"}
        </span>

        <AnimatePresence>
          {isRunning && mode === "focus" && activeSecondsEarned > 30 && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="mt-2 flex items-center gap-2 text-[0.6875rem] font-semibold tabular-nums"
            >
              <span className="text-[var(--brand-strong)]">+{xpEarned} XP</span>
              <span className="text-[var(--foreground-subtle)]">·</span>
              <span className="text-[var(--brand-gold)]">+{coinsEarned} coins</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
