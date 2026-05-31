import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetBreakFreeStreakQueryKey,
  getGetBreakFreeStreakQueryOptions,
  useStartBreakFreeStreak,
  useReportBreakFreeRelapse,
} from "@workspace/api-client-react";

const MILESTONES = [
  { day: 3,  icon: "🌱", label: "Your brain is already adapting." },
  { day: 7,  icon: "⚡", label: "One week — dopamine is rebalancing." },
  { day: 14, icon: "🔥", label: "Two weeks! Focus and sleep are improving." },
  { day: 30, icon: "🏆", label: "One month. You've rewired your reward system." },
  { day: 60, icon: "💎", label: "Two months. Relationships and confidence soar here." },
  { day: 90, icon: "🌟", label: "90 days. You've genuinely changed your brain." },
];

function getMilestone(days: number) {
  return [...MILESTONES].reverse().find(m => days >= m.day) ?? null;
}

export default function BreakFreeStreak() {
  const qc = useQueryClient();
  const [relapseDialog, setRelapseDialog] = useState(false);

  const { data, isLoading } = useQuery(getGetBreakFreeStreakQueryOptions());
  const streak = data?.streak ?? null;
  const days = streak?.currentStreak ?? 0;
  const milestone = getMilestone(days);

  const startMutation = useStartBreakFreeStreak({
    onSuccess: () => qc.invalidateQueries({ queryKey: getGetBreakFreeStreakQueryKey() }),
  });

  const relapseMutation = useReportBreakFreeRelapse({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetBreakFreeStreakQueryKey() });
      setRelapseDialog(false);
    },
  });

  function handleStart() {
    const today = new Date().toISOString().split("T")[0]!;
    startMutation.mutate({ startDate: today });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-900 border-t-teal-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-10 px-4">
      {/* Day counter */}
      <motion.div
        key={days}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative flex flex-col items-center mb-6"
      >
        <div
          className="text-[88px] font-black leading-none tabular-nums"
          style={{
            background: "linear-gradient(135deg, #5eead4 0%, #2dd4bf 50%, #0d9488 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 24px rgba(45,212,191,0.35))",
          }}
        >
          {days}
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-600 mt-1">
          {days === 1 ? "day free" : "days free"}
        </p>
      </motion.div>

      {/* Milestone badge */}
      <AnimatePresence mode="wait">
        {milestone && (
          <motion.div
            key={milestone.day}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2.5 rounded-2xl border border-teal-500/20 bg-teal-900/20 px-5 py-3 mb-8 shadow-[0_0_24px_rgba(45,212,191,0.15)]"
          >
            <span className="text-2xl">{milestone.icon}</span>
            <p className="text-sm text-teal-200 font-medium">{milestone.label}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestone dots */}
      <div className="flex gap-3 mb-10">
        {MILESTONES.map((m) => {
          const reached = days >= m.day;
          return (
            <div key={m.day} className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-lg border transition-all duration-500 ${
                  reached
                    ? "border-teal-400/40 bg-teal-900/40 shadow-[0_0_12px_rgba(45,212,191,0.3)]"
                    : "border-[#1e2a2a] bg-[#0d1515] opacity-40"
                }`}
              >
                {m.icon}
              </div>
              <span className={`text-[9px] font-mono ${reached ? "text-teal-500" : "text-[#2a3a3a]"}`}>
                D{m.day}
              </span>
            </div>
          );
        })}
      </div>

      {/* Start / Stats */}
      {!streak ? (
        <button
          onClick={handleStart}
          disabled={startMutation.isPending}
          className="rounded-2xl bg-gradient-to-r from-teal-600 to-teal-500 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-teal-900/40 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {startMutation.isPending ? "Starting…" : "Start My Journey"}
        </button>
      ) : (
        <div className="flex gap-4 text-center mb-4">
          <div className="rounded-xl border border-teal-900/50 bg-[#0a1a1a] px-5 py-3">
            <p className="text-lg font-bold text-teal-300">{streak.longestStreak}</p>
            <p className="text-[10px] text-teal-700 uppercase tracking-wider">Longest</p>
          </div>
          <div className="rounded-xl border border-teal-900/50 bg-[#0a1a1a] px-5 py-3">
            <p className="text-lg font-bold text-teal-300">{streak.relapseCount}</p>
            <p className="text-[10px] text-teal-700 uppercase tracking-wider">Restarts</p>
          </div>
        </div>
      )}

      {/* Relapse button — subtle */}
      {streak && (
        <button
          onClick={() => setRelapseDialog(true)}
          className="mt-6 text-xs text-[#2a4040] hover:text-teal-700 transition-colors underline underline-offset-2"
        >
          I relapsed
        </button>
      )}

      {/* Relapse dialog */}
      <AnimatePresence>
        {relapseDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setRelapseDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="w-full max-w-sm rounded-2xl border border-teal-900/40 bg-[#0a1518] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xl font-bold text-teal-100 mb-2">That's okay. 💙</p>
              <p className="text-sm text-teal-400 leading-relaxed mb-6">
                Every restart is strength. Day 1 again — you've got this. Most people restart
                several times before it sticks. What matters is that you came back.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => relapseMutation.mutate()}
                  disabled={relapseMutation.isPending}
                  className="flex-1 rounded-xl bg-teal-700/30 border border-teal-600/30 py-2.5 text-sm font-semibold text-teal-200 hover:bg-teal-700/50 transition-colors disabled:opacity-60"
                >
                  {relapseMutation.isPending ? "Saving…" : "Start Day 1 again"}
                </button>
                <button
                  onClick={() => setRelapseDialog(false)}
                  className="rounded-xl border border-[#1e2a2a] px-4 py-2.5 text-sm text-teal-700 hover:text-teal-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
