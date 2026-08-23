import { useEffect } from "react";
import { motion } from "framer-motion";
import { Pause, Play, X } from "lucide-react";
import type { TimerMode } from "@/types/timer";

interface ZenOverlayProps {
  secondsLeft: number;
  progress: number;
  mode: TimerMode;
  isRunning: boolean;
  accent: string;
  onToggle: () => void;
  onExit: () => void;
}

function fmt(totalSec: number) {
  const m = Math.floor(Math.max(0, totalSec) / 60).toString().padStart(2, "0");
  const s = Math.max(0, totalSec) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const MODE_LABELS: Record<TimerMode, string> = {
  focus: "Deep Focus",
  break: "Break",
  longBreak: "Long Break",
};

/**
 * Full-screen immersive zen view of the running timer (audit H3). Mirrors
 * the live usePomodoro state passed down from Timer — no separate timer
 * instance, so it can never drift. Space toggles via Timer's global handler;
 * Escape exits.
 */
export default function ZenOverlay({ secondsLeft, progress, mode, isRunning, accent, onToggle, onExit }: ZenOverlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const size = 320;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[var(--z-modal)] flex flex-col items-center justify-center bg-[var(--palette-080b14)]"
      role="dialog"
      aria-label="Zen focus mode"
    >
      {/* Ambient breathing glow */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute h-[36rem] w-[36rem] rounded-full blur-3xl"
        style={{ background: accent, opacity: 0.07 }}
        animate={{ scale: isRunning ? [1, 1.12, 1] : 1, opacity: isRunning ? [0.05, 0.1, 0.05] : 0.04 }}
        transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
      />

      <button
        type="button"
        onClick={onExit}
        aria-label="Exit zen mode (Escape)"
        className="absolute right-5 top-5 rounded-full border border-[var(--palette-white)]/8 p-2.5 text-[var(--foreground-subtle)] transition-colors hover:border-[var(--palette-white)]/20 hover:text-[var(--foreground-muted)]"
      >
        <X className="size-4" />
      </button>

      <p className="mb-8 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--foreground-subtle)]">
        {MODE_LABELS[mode]}
      </p>

      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--palette-white)" strokeOpacity={0.06} strokeWidth={stroke} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={false}
            animate={{ strokeDashoffset: circ - progress * circ }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <motion.span
            key={isRunning ? "running" : "paused"}
            initial={{ opacity: 0.85 }}
            animate={{ opacity: isRunning ? [0.75, 1, 0.75] : 0.55 }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="font-mono text-7xl font-semibold tabular-nums tracking-tight text-[var(--foreground)] sm:text-8xl"
          >
            {fmt(secondsLeft)}
          </motion.span>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label={isRunning ? "Pause timer (Space)" : "Start timer (Space)"}
        className="mt-10 flex h-16 w-16 items-center justify-center rounded-full border transition-transform active:scale-95"
        style={{ borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`, background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}
      >
        {isRunning ? <Pause className="size-6" /> : <Play className="ml-1 size-6" />}
      </button>

      <p className="mt-6 text-[11px] text-[var(--foreground-subtle)]">Space to pause · Esc to exit</p>
    </motion.div>
  );
}
