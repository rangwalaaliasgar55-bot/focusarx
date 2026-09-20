import { useEffect, useRef, useState } from "react";
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

interface FlipCardProps {
  digit: string;
  label?: string;
  accentColor?: string;
}

/**
 * Individual mechanical Flip Digit Card with realistic split-flap folding physics.
 */
function FlipDigit({ digit, label, accentColor = "var(--brand-400)" }: FlipCardProps) {
  const [current, setCurrent] = useState(digit);
  const [previous, setPrevious] = useState(digit);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (digit !== current) {
      setPrevious(current);
      setCurrent(digit);
      setFlipping(true);
      const timer = setTimeout(() => {
        setFlipping(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [digit, current]);

  return (
    <div className="flex flex-col items-center">
      {/* 3D Flip Box */}
      <div
        className="relative flex h-20 w-14 flex-col items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[#0c0f1d] shadow-[0_12px_32px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.12)] sm:h-28 sm:w-20 md:h-32 md:w-24"
        style={{ perspective: "800px" }}
      >
        {/* Top Half Static (Current target digit) */}
        <div className="relative flex h-1/2 w-full items-end justify-center overflow-hidden rounded-t-xl border-b border-[#05070e] bg-gradient-to-b from-[#181c2e] to-[#121524]">
          <span
            className="font-display translate-y-1/2 select-none text-3xl font-extrabold tracking-tight tabular-nums text-[var(--foreground)] sm:text-5xl md:text-6xl"
            style={{
              fontFeatureSettings: '"tnum" 1',
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            {current}
          </span>
          {/* Top highlight glare */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </div>

        {/* Bottom Half Static (Previous/Current digit revealed after fold) */}
        <div className="relative flex h-1/2 w-full items-start justify-center overflow-hidden rounded-b-xl bg-gradient-to-b from-[#0f1220] to-[#0a0c16]">
          <span
            className="font-display -translate-y-1/2 select-none text-3xl font-extrabold tracking-tight tabular-nums text-[var(--foreground)] sm:text-5xl md:text-6xl"
            style={{
              fontFeatureSettings: '"tnum" 1',
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            {flipping ? previous : current}
          </span>
          {/* Bottom subtle shadow */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        </div>

        {/* Top Flipping Flap (Folds down from 0deg to -90deg) */}
        <AnimatePresence>
          {flipping && (
            <motion.div
              key={`top-flap-${previous}-${digit}`}
              initial={{ rotateX: 0 }}
              animate={{ rotateX: -90 }}
              transition={{ duration: 0.25, ease: [0.37, 0, 0.63, 1] }}
              style={{ transformOrigin: "bottom center", backfaceVisibility: "hidden" }}
              className="absolute inset-x-0 top-0 z-20 flex h-1/2 items-end justify-center overflow-hidden rounded-t-xl border-b border-[#05070e] bg-gradient-to-b from-[#181c2e] to-[#121524]"
            >
              <span
                className="font-display translate-y-1/2 select-none text-3xl font-extrabold tracking-tight tabular-nums text-[var(--foreground)] sm:text-5xl md:text-6xl"
                style={{ fontFeatureSettings: '"tnum" 1' }}
              >
                {previous}
              </span>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Flipping Flap (Unfolds from 90deg to 0deg) */}
        <AnimatePresence>
          {flipping && (
            <motion.div
              key={`bot-flap-${current}-${digit}`}
              initial={{ rotateX: 90 }}
              animate={{ rotateX: 0 }}
              transition={{ duration: 0.25, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: "top center", backfaceVisibility: "hidden" }}
              className="absolute inset-x-0 bottom-0 z-30 flex h-1/2 items-start justify-center overflow-hidden rounded-b-xl bg-gradient-to-b from-[#0f1220] to-[#0a0c16]"
            >
              <span
                className="font-display -translate-y-1/2 select-none text-3xl font-extrabold tracking-tight tabular-nums text-[var(--foreground)] sm:text-5xl md:text-6xl"
                style={{ fontFeatureSettings: '"tnum" 1' }}
              >
                {current}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center horizontal split crease line */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-40 h-[2px] -translate-y-1/2 bg-[#05060b] shadow-[0_1px_1px_rgba(255,255,255,0.06)]" />

        {/* Mechanical Hinge Notches (Left and Right side clips) */}
        <div className="pointer-events-none absolute left-[-2px] top-1/2 z-50 h-2.5 w-1 -translate-y-1/2 rounded-r-[2px] bg-[#22273d]" />
        <div className="pointer-events-none absolute right-[-2px] top-1/2 z-50 h-2.5 w-1 -translate-y-1/2 rounded-l-[2px] bg-[#22273d]" />
      </div>

      {label && (
        <span className="mt-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--foreground-subtle)]">
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
    mode === "focus"
      ? "var(--brand-500)"
      : mode === "break"
      ? "var(--success)"
      : "var(--info)";

  return (
    <div className="relative flex flex-col items-center justify-center py-3">
      {/* Ambient Breathing Backlight */}
      <motion.div
        className="pointer-events-none absolute -inset-6 rounded-3xl opacity-30 blur-2xl"
        style={{
          background: `radial-gradient(ellipse at center, ${modeAccent} 0%, transparent 70%)`,
        }}
        animate={isRunning ? { scale: [0.95, 1.05, 0.95], opacity: [0.25, 0.45, 0.25] } : { scale: 1, opacity: 0.15 }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
      />

      {/* Mode Tag */}
      <div className="mb-4 flex items-center gap-2">
        <span
          className="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
          style={{
            color: modeAccent,
            borderColor: `color-mix(in srgb, ${modeAccent} 35%, transparent)`,
            background: `color-mix(in srgb, ${modeAccent} 12%, transparent)`,
          }}
        >
          {sessionType ? sessionType.replace(/_/g, " ") : mode === "focus" ? "Focus Flow" : mode === "break" ? "Rest Break" : "Long Break"}
        </span>
        {onEditClick && !isRunning && (
          <button
            type="button"
            onClick={onEditClick}
            title="Edit duration"
            className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
          >
            <Pencil size={11} /> Edit
          </button>
        )}
      </div>

      {/* The 4-Digit Flip Face */}
      <div className="relative z-10 flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
        {/* Minutes Pair */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <FlipDigit digit={m1} accentColor={modeAccent} />
          <FlipDigit digit={m2} label="MIN" accentColor={modeAccent} />
        </div>

        {/* Pulsing Mechanical Separator Colon */}
        <div className="flex flex-col items-center justify-center gap-2.5 pb-4 sm:gap-3.5 sm:pb-5">
          <motion.div
            animate={isRunning ? { opacity: [1, 0.2, 1] } : { opacity: 0.8 }}
            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
            className="h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
            style={{
              backgroundColor: modeAccent,
              boxShadow: `0 0 10px ${modeAccent}`,
            }}
          />
          <motion.div
            animate={isRunning ? { opacity: [1, 0.2, 1] } : { opacity: 0.8 }}
            transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
            className="h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
            style={{
              backgroundColor: modeAccent,
              boxShadow: `0 0 10px ${modeAccent}`,
            }}
          />
        </div>

        {/* Seconds Pair */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <FlipDigit digit={s1} accentColor={modeAccent} />
          <FlipDigit digit={s2} label="SEC" accentColor={modeAccent} />
        </div>
      </div>
    </div>
  );
}
