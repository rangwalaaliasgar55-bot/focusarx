"use client";

import { motion } from "framer-motion";
import type { TimerStatus } from "@/types/timer";

interface TimerControlsProps {
  status: TimerStatus;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
}

const iconBtn =
  "flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700/50 bg-zinc-900/40 text-zinc-400 shadow-sm backdrop-blur-sm transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/70 active:scale-[0.97] dark:border-zinc-700/60 dark:bg-zinc-950/50 dark:hover:bg-zinc-900/80";

export function TimerControls({
  status,
  onToggle,
  onReset,
  onSkip,
}: TimerControlsProps) {
  const isRunning = status === "running";

  return (
    <div className="mt-10 flex items-center gap-4">
      <motion.button
        type="button"
        onClick={onReset}
        aria-label="Reset timer"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={iconBtn}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </motion.button>

      <motion.button
        type="button"
        onClick={onToggle}
        aria-label={isRunning ? "Pause timer" : "Start timer"}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-full bg-gradient-to-br from-zinc-100 to-zinc-300 text-zinc-900 shadow-lg shadow-black/25 ring-1 ring-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/80 dark:from-zinc-100 dark:to-zinc-400"
      >
        {isRunning ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
            <path d="M5 3l14 9-14 9V3z" />
          </svg>
        )}
      </motion.button>

      <motion.button
        type="button"
        onClick={onSkip}
        aria-label="Skip to next session"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={iconBtn}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      </motion.button>
    </div>
  );
}
