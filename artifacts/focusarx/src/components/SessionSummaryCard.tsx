"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

const QUOTES = [
  "Small steps every day lead to giant leaps over time.",
  "You don't have to be great to start, but you have to start to be great.",
  "Discipline is choosing between what you want now and what you want most.",
  "The secret of getting ahead is getting started.",
  "Focus is the gateway to all thinking: memory, learning, reasoning, problem-solving.",
  "Excellence is not a destination but a continuous journey that never ends.",
  "Don't watch the clock; do what it does. Keep going.",
  "The expert in anything was once a beginner.",
  "Your future self is proud of you for showing up today.",
  "Every session you complete is one your past self could only wish for.",
];

interface Props {
  open: boolean;
  durationSeconds: number;
  completedTaskCount: number;
  focusScore?: number | null;
  onStartBreak: () => void;
  onKeepGoing: () => void;
  onClose: () => void;
}

export default function SessionSummaryCard({
  open,
  durationSeconds,
  completedTaskCount,
  focusScore,
  onStartBreak,
  onKeepGoing,
  onClose,
}: Props) {
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]!);
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setShowCheck(true), 200);
      return () => clearTimeout(t);
    } else {
      setShowCheck(false);
    }
  }, [open]);

  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  const timeLabel = mins > 0 ? `${mins}m ${secs > 0 ? `${secs}s` : ""}`.trim() : `${secs}s`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 backdrop-blur-sm sm:items-center sm:pb-0"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full max-w-sm rounded-3xl border border-emerald-500/20 bg-[rgba(8,12,28,0.98)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Celebration checkmark */}
            <div className="mb-5 flex justify-center">
              <AnimatePresence>
                {showCheck && (
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/30"
                  >
                    <span className="text-3xl">✅</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-emerald-400/70">
              Session Complete
            </p>
            <h2 className="mb-5 text-center text-lg font-bold text-[#E2E8F0]">
              Great work! 🎉
            </h2>

            {/* Stats row */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/5 bg-white/3 p-3 text-center">
                <p className="text-lg font-bold text-emerald-400">{timeLabel}</p>
                <p className="mt-0.5 text-[9px] text-[#4B5563]">Focused</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/3 p-3 text-center">
                <p className="text-lg font-bold text-violet-400">{completedTaskCount}</p>
                <p className="mt-0.5 text-[9px] text-[#4B5563]">Tasks done</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/3 p-3 text-center">
                <p className="text-lg font-bold text-sky-400">
                  {focusScore != null ? `${focusScore}%` : "—"}
                </p>
                <p className="mt-0.5 text-[9px] text-[#4B5563]">Focus score</p>
              </div>
            </div>

            {/* Motivational quote */}
            <p className="mb-6 rounded-xl border border-white/5 bg-white/3 px-4 py-3 text-center text-xs italic leading-relaxed text-[#94A3B8]">
              "{quote}"
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onStartBreak}
                className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                Start break
              </button>
              <button
                onClick={onKeepGoing}
                className="flex-1 rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 text-sm font-semibold text-violet-400 transition-colors hover:bg-violet-500/20"
              >
                Keep going
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
