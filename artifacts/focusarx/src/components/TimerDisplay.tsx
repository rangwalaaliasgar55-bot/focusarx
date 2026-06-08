"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState, useEffect } from "react";
import { formatTime } from "@/lib/timerUtils";
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

const SIZE = 280;
const STROKE = 10;
const RADIUS = (SIZE - STROKE * 2) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const OUTER_SIZE = SIZE + 24;
const OUTER_STROKE = 3;
const OUTER_RADIUS = (OUTER_SIZE - OUTER_STROKE * 2) / 2;
const OUTER_CIRCUMFERENCE = 2 * Math.PI * OUTER_RADIUS;

const MODE_CONFIG: Record<TimerMode, { label: string; icon: string; color: string; glow: string; gradient: [string, string] }> = {
  focus:     { label: "FOCUS", icon: "⚔️", color: "#f43f5e", glow: "rgba(244,63,94,0.5)", gradient: ["#f43f5e", "#ec4899"] },
  break:     { label: "BREAK", icon: "☕", color: "#22c55e", glow: "rgba(34,197,94,0.5)",  gradient: ["#22c55e", "#10b981"] },
  longBreak: { label: "REST",  icon: "🌙", color: "#8b5cf6", glow: "rgba(139,92,246,0.5)", gradient: ["#8b5cf6", "#6366f1"] },
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
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const cfg = MODE_CONFIG[mode];
  const reduceMotion = useReducedMotion();

  const prevSecondsRef = useRef(secondsLeft);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (!isRunning || reduceMotion) return;
    if (prevSecondsRef.current !== secondsLeft) {
      prevSecondsRef.current = secondsLeft;
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 280);
      return () => clearTimeout(t);
    }
  }, [secondsLeft, isRunning, reduceMotion]);

  const xpEarned = Math.floor(activeSecondsEarned / 60) * 20;
  const coinsEarned = Math.floor(activeSecondsEarned / 300) * 10;

  return (
    <div className="relative flex items-center justify-center" style={{ width: OUTER_SIZE, height: OUTER_SIZE }}>
      <svg
        width={OUTER_SIZE}
        height={OUTER_SIZE}
        className="absolute inset-0 -rotate-90 opacity-30"
        aria-hidden
      >
        <circle
          cx={OUTER_SIZE / 2}
          cy={OUTER_SIZE / 2}
          r={OUTER_RADIUS}
          fill="none"
          stroke={cfg.color}
          strokeWidth={OUTER_STROKE}
          strokeDasharray="4 8"
          strokeLinecap="round"
        />
      </svg>

      <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          className="absolute inset-0 -rotate-90"
          aria-hidden
        >
          <defs>
            <filter id={`glow-${mode}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={isRunning ? "6" : "3"} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={`grad-${mode}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={cfg.gradient[0]} />
              <stop offset="100%" stopColor={cfg.gradient[1]} />
            </linearGradient>
          </defs>

          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#1e2130"
            strokeWidth={STROKE}
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={`url(#grad-${mode})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={false}
            animate={{ strokeDashoffset: dashOffset }}
            transition={reduceMotion ? { duration: 0 } : { duration: isRunning ? 0.9 : 0.5, ease: [0.22, 0.61, 0.36, 1] }}
            filter={`url(#glow-${mode})`}
          />
        </svg>

        <motion.div
          className="relative flex flex-col items-center justify-center gap-1"
          initial={false}
          animate={{ scale: pulsing ? 1.03 : 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: cfg.color }} />
              {sessionType ? sessionType.replace("_", " ") : cfg.label}
            </motion.div>
          )}

          <div className="relative group flex items-center justify-center">
            <span
              className={`font-mono text-[3.6rem] font-black tabular-nums leading-none tracking-tight select-none ${onEditClick ? "cursor-pointer" : ""}`}
              style={{
                backgroundImage: `linear-gradient(135deg, ${cfg.gradient[0]}, ${cfg.gradient[1]})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: `drop-shadow(0 0 18px ${cfg.glow})`,
              }}
              onClick={onEditClick}
              title={onEditClick ? "Click to edit duration" : undefined}
            >
              {minutes}:{seconds}
            </span>
            {onEditClick && (
              <button
                onClick={onEditClick}
                className="absolute -right-7 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-zinc-300"
                title="Edit time"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>

          <span
            className="text-[11px] font-bold uppercase tracking-[0.25em]"
            style={{ color: cfg.color, opacity: 0.7 }}
          >
            {isRunning ? "in progress" : "ready"}
          </span>

          {isRunning && mode === "focus" && activeSecondsEarned > 30 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-1 flex items-center gap-2 text-[10px] font-semibold"
            >
              <span className="text-violet-400">+{xpEarned} XP</span>
              <span className="text-yellow-400">+{coinsEarned} 🪙</span>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
