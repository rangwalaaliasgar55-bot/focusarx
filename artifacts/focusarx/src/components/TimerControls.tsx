"use client";

import { motion } from "framer-motion";
import type { TimerMode, TimerStatus } from "@/types/timer";

interface TimerControlsProps {
  status: TimerStatus;
  mode: TimerMode;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
}

const MODE_COLORS: Record<TimerMode, { from: string; to: string; shadow: string; ring: string }> = {
  focus:     { from: "#f43f5e", to: "#ec4899", shadow: "rgba(244,63,94,0.45)", ring: "rgba(244,63,94,0.3)" },
  break:     { from: "#22c55e", to: "#10b981", shadow: "rgba(34,197,94,0.45)",  ring: "rgba(34,197,94,0.3)" },
  longBreak: { from: "#8b5cf6", to: "#6366f1", shadow: "rgba(139,92,246,0.45)", ring: "rgba(139,92,246,0.3)" },
};

export function TimerControls({ status, mode, onToggle, onReset, onSkip }: TimerControlsProps) {
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const mc = MODE_COLORS[mode];

  return (
    <div className="mt-8 flex items-center justify-center gap-5">
      <motion.button
        type="button"
        onClick={onReset}
        aria-label="Reset timer"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700/60 bg-zinc-900/60 text-zinc-400 backdrop-blur-sm transition-all hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-zinc-200"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </motion.button>

      <motion.button
        type="button"
        onClick={onToggle}
        aria-label={isRunning ? "Pause" : isPaused ? "Resume" : "Start focus session"}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.93 }}
        className="relative flex h-20 w-20 items-center justify-center rounded-[1.4rem] font-bold text-white shadow-2xl"
        style={{
          background: `linear-gradient(135deg, ${mc.from}, ${mc.to})`,
          boxShadow: `0 0 0 6px ${mc.ring}, 0 12px 32px ${mc.shadow}`,
        }}
      >
        {isRunning ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="3" width="5" height="18" rx="1.5" />
            <rect x="14" y="3" width="5" height="18" rx="1.5" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="ml-1">
            <path d="M5 3l14 9-14 9V3z" />
          </svg>
        )}
        {isRunning && (
          <motion.span
            className="absolute inset-0 rounded-[1.4rem]"
            animate={{ boxShadow: [`0 0 0 0px ${mc.shadow}`, `0 0 0 12px transparent`] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
          />
        )}
      </motion.button>

      <motion.button
        type="button"
        onClick={onSkip}
        aria-label="Skip to next session"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-700/60 bg-zinc-900/60 text-zinc-400 backdrop-blur-sm transition-all hover:border-zinc-600 hover:bg-zinc-800/70 hover:text-zinc-200"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      </motion.button>
    </div>
  );
}
