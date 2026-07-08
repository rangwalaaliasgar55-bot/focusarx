"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Share2, Check } from "lucide-react";

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
  earnedXp?: number;
  earnedCoins?: number;
  completedEarly?: boolean;
  completionPercentage?: number | null;
  onStartBreak: () => void;
  onKeepGoing: () => void;
  onClose: () => void;
}

export default function SessionSummaryCard({
  open,
  durationSeconds,
  completedTaskCount,
  focusScore,
  earnedXp = 0,
  earnedCoins = 0,
  completedEarly = false,
  completionPercentage,
  onStartBreak,
  onKeepGoing,
  onClose,
}: Props) {
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]!);
  const [showCheck, setShowCheck] = useState(false);
  const [animatedXp, setAnimatedXp] = useState(0);
  const [animatedCoins, setAnimatedCoins] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setShowCheck(true), 200);
      // Animate XP and coins count up
      if (earnedXp > 0) {
        const step = Math.ceil(earnedXp / 30);
        let cur = 0;
        const iv = setInterval(() => {
          cur = Math.min(cur + step, earnedXp);
          setAnimatedXp(cur);
          if (cur >= earnedXp) clearInterval(iv);
        }, 40);
      }
      if (earnedCoins > 0) {
        const step = Math.ceil(earnedCoins / 30);
        let cur = 0;
        const iv = setInterval(() => {
          cur = Math.min(cur + step, earnedCoins);
          setAnimatedCoins(cur);
          if (cur >= earnedCoins) clearInterval(iv);
        }, 40);
      }
      return () => clearTimeout(t);
    } else {
      setShowCheck(false);
      setAnimatedXp(0);
      setAnimatedCoins(0);
    }
  }, [open, earnedXp, earnedCoins]);

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
                    <span className="text-3xl">{completedEarly ? "⚡" : "✅"}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-emerald-400/70">
              {completedEarly ? "Early Completion" : "Session Complete"}
            </p>
            <h2 className="mb-1 text-center text-lg font-bold text-[#E2E8F0]">
              {completedEarly ? "Progress saved! ⚡" : "Great work! 🎉"}
            </h2>
            {completedEarly && completionPercentage != null && (
              <p className="mb-4 text-center text-xs text-[#4B5563]">
                Completed {Math.round(completionPercentage)}% of planned session
              </p>
            )}

            {/* Stats row */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/5 bg-white/3 p-3 text-center">
                <p className="text-base font-bold text-emerald-400">{timeLabel}</p>
                <p className="mt-0.5 text-[9px] text-[#4B5563]">Focused</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/3 p-3 text-center">
                <p className="text-base font-bold text-violet-400">{completedTaskCount}</p>
                <p className="mt-0.5 text-[9px] text-[#4B5563]">Tasks done</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/3 p-3 text-center">
                <p className="text-base font-bold text-sky-400">
                  {focusScore != null ? `${focusScore}%` : "—"}
                </p>
                <p className="mt-0.5 text-[9px] text-[#4B5563]">Focus score</p>
              </div>
            </div>

            {/* XP + Coins rewards */}
            {(earnedXp > 0 || earnedCoins > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-4 flex gap-2"
              >
                {earnedXp > 0 && (
                  <div className="flex-1 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-center">
                    <p className="text-sm font-bold text-violet-400">+{animatedXp}</p>
                    <p className="text-[9px] text-violet-400/60">XP earned</p>
                  </div>
                )}
                {earnedCoins > 0 && (
                  <div className="flex-1 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center">
                    <p className="text-sm font-bold text-amber-400">+{animatedCoins}</p>
                    <p className="text-[9px] text-amber-400/60">Coins earned</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Motivational quote */}
            <p className="mb-5 rounded-xl border border-white/5 bg-white/3 px-4 py-3 text-center text-xs italic leading-relaxed text-[#94A3B8]">
              "{quote}"
            </p>

            {/* Share button */}
            <button
              onClick={async () => {
                const scoreText = focusScore != null ? ` · ${focusScore}% focus score` : "";
                const xpText = earnedXp > 0 ? ` · +${earnedXp} XP` : "";
                const text = `🎯 Just completed a ${timeLabel} focus session on FocusArx${scoreText}${xpText} 🔥\nBuilding the deep work habit one block at a time. focusarx.app`;
                if (navigator.share) {
                  try { await navigator.share({ text, url: "https://focusarx.app" }); } catch { /* cancelled */ }
                } else {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="mb-3 w-full flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/4 py-2 text-xs font-semibold text-[#64748B] transition-colors hover:border-white/12 hover:text-[#94A3B8]"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Share2 size={12} />}
              {copied ? "Copied to clipboard!" : "Share session"}
            </button>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onStartBreak}
                className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                {completedEarly ? "Take a break" : "Start break"}
              </button>
              <button
                onClick={onKeepGoing}
                className="flex-1 rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 text-sm font-semibold text-violet-400 transition-colors hover:bg-violet-500/20"
              >
                {completedEarly ? "New session" : "Keep going"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
