"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { formatTime } from "@/lib/timerUtils";
import type { TimerMode } from "@/types/timer";

interface TimerDisplayProps {
  secondsLeft: number;
  progress: number;
  mode: TimerMode;
  isRunning: boolean;
  onEditClick?: () => void;
}

const SIZE = 260;
const STROKE = 8;
const RADIUS = (SIZE - STROKE * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const MODE_COLORS: Record<TimerMode, string> = {
  focus: "#f43f5e",
  break: "#22c55e",
  longBreak: "#3b82f6",
};

const MODE_GRADIENTS: Record<TimerMode, string> = {
  focus: "linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)",
  break: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)",
  longBreak: "linear-gradient(135deg, #3b82f6 0%, #0ea5e9 100%)",
};

const MODE_GLOW: Record<TimerMode, string> = {
  focus: "0_0_40px_rgba(244,63,94,0.4), 0_0_80px_rgba(236,72,153,0.2)",
  break: "0_0_40px_rgba(34,197,94,0.4), 0_0_80px_rgba(16,185,129,0.2)",
  longBreak: "0_0_40px_rgba(59,130,246,0.4), 0_0_80px_rgba(14,165,233,0.2)",
};

export function TimerDisplay({
  secondsLeft,
  progress,
  mode,
  isRunning,
  onEditClick,
}: TimerDisplayProps) {
  const { minutes, seconds } = formatTime(secondsLeft);
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const color = MODE_COLORS[mode];
  const reduceMotion = useReducedMotion();

  const transition = useMemo(
    () =>
      reduceMotion
        ? { duration: 0 }
        : {
            duration: isRunning ? 0.85 : 0.45,
            ease: [0.22, 0.61, 0.36, 1] as const,
          },
    [isRunning, reduceMotion]
  );

  const glowColor = MODE_GLOW[mode];

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <defs>
            <linearGradient id={`gradient-${mode}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: mode === "focus" ? "#f43f5e" : mode === "break" ? "#22c55e" : "#3b82f6", stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: mode === "focus" ? "#ec4899" : mode === "break" ? "#10b981" : "#0ea5e9", stopOpacity: 1 }} />
            </linearGradient>
          </defs>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-zinc-700/50 dark:text-zinc-800/60"
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={`url(#gradient-${mode})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={transition}
          filter="url(#glow)"
          style={{ boxShadow: glowColor }}
        />
      </svg>

      <motion.div
        className="relative flex select-none flex-col items-center"
        initial={false}
        animate={{ opacity: 1 }}
      >
        <div className="relative group flex items-center justify-center">
          <span
            className={`font-mono text-[3.35rem] font-bold tabular-nums leading-none tracking-tight transition-all duration-300 sm:text-[3.5rem] bg-clip-text text-transparent ${onEditClick ? 'cursor-pointer hover:scale-105' : ''}`}
            style={{
              backgroundImage: MODE_GRADIENTS[mode],
              filter: `drop-shadow(0 0 20px ${color}40)`,
            }}
            onClick={onEditClick}
            title={onEditClick ? "Click to edit duration" : undefined}
          >
            {minutes}:{seconds}
          </span>
          {onEditClick && (
            <button 
              onClick={onEditClick}
              className="absolute -right-8 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300 hover:scale-110"
              title="Edit time"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          )}
        </div>
        <span className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] bg-clip-text text-transparent" style={{ backgroundImage: MODE_GRADIENTS[mode] }}>
          {isRunning ? "Running" : "Ready"}
        </span>
      </motion.div>
    </div>
  );
}
