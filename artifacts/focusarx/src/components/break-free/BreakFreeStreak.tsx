import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetBreakFreeStreakQueryKey,
  getGetBreakFreeStreakQueryOptions,
  useStartBreakFreeStreak,
  useReportBreakFreeRelapse,
} from "@workspace/api-client-react";
import { useToast } from "@/components/Toast";
import { useBreakFreeAuthReady } from "@/hooks/useBreakFreeAuthReady";
import { breakFreeErrorMessage } from "@/lib/break-free-errors";

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
  const { toast } = useToast();
  const { ready } = useBreakFreeAuthReady();
  const [relapseDialog, setRelapseDialog] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    ...getGetBreakFreeStreakQueryOptions(),
    enabled: ready,
  });
  const streak = data?.streak ?? null;
  const days = streak?.currentStreak ?? 0;
  const milestone = getMilestone(days);

  const startMutation = useStartBreakFreeStreak({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetBreakFreeStreakQueryKey() });
        toast("Journey started — day 1 begins now!", "success");
      },
      onError: (err) => toast(breakFreeErrorMessage(err, "Could not start streak"), "error"),
    },
  });

  const relapseMutation = useReportBreakFreeRelapse({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetBreakFreeStreakQueryKey() });
        setRelapseDialog(false);
        toast("Day 1 again — you've got this.", "success");
      },
      onError: (err) => toast(breakFreeErrorMessage(err, "Could not save relapse"), "error"),
    },
  });

  function handleStart() {
    if (!ready) {
      toast("Still signing you in — try again in a moment.", "info");
      return;
    }
    const today = new Date().toISOString().split("T")[0]!;
    startMutation.mutate({ data: { startDate: today } });
  }

  if (!ready || isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(124,58,237,0.2)] border-t-[#7C3AED]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center py-16 px-4 text-center gap-3">
        <p className="text-sm text-[#A78BFA]">{breakFreeErrorMessage(error, "Could not load streak")}</p>
        <button
          onClick={() => refetch()}
          className="rounded-xl border border-[rgba(124,58,237,0.3)] px-4 py-2 text-xs font-semibold text-[#E2E8F0] hover:bg-[rgba(124,58,237,0.1)]"
        >
          Retry
        </button>
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
            background: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 50%, #4F46E5 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 24px rgba(124,58,237,0.35))",
          }}
        >
          {days}
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#7C3AED] mt-1">
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
            className="flex items-center gap-2.5 rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.1)] px-5 py-3 mb-8 shadow-[0_0_24px_rgba(124,58,237,0.15)]"
          >
            <span className="text-2xl">{milestone.icon}</span>
            <p className="text-sm text-[#E2E8F0] font-medium">{milestone.label}</p>
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
                    ? "border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.15)] shadow-[0_0_12px_rgba(124,58,237,0.3)]"
                    : "border-[#1e2a2a] bg-[#0d1515] opacity-40"
                }`}
              >
                {m.icon}
              </div>
              <span className={`text-[9px] font-mono ${reached ? "text-[#7C3AED]" : "text-[#2a3a3a]"}`}>
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
          className="rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-[rgba(124,58,237,0.4)] hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {startMutation.isPending ? "Starting…" : "Start My Journey"}
        </button>
      ) : (
        <div className="flex gap-4 text-center mb-4">
          <div className="rounded-xl border border-[rgba(124,58,237,0.2)] bg-[#0d0f1c] px-5 py-3">
            <p className="text-lg font-bold text-[#A78BFA]">{streak.longestStreak}</p>
            <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">Longest</p>
          </div>
          <div className="rounded-xl border border-[rgba(124,58,237,0.2)] bg-[#0d0f1c] px-5 py-3">
            <p className="text-lg font-bold text-[#A78BFA]">{streak.relapseCount}</p>
            <p className="text-[10px] text-[#4B5563] uppercase tracking-wider">Restarts</p>
          </div>
        </div>
      )}

      {/* Relapse button — subtle */}
      {streak && (
        <button
          onClick={() => setRelapseDialog(true)}
          className="mt-6 text-xs text-[#4B5563] hover:text-[#A78BFA] transition-colors underline underline-offset-2"
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
              className="w-full max-w-sm rounded-2xl border border-[rgba(124,58,237,0.2)] bg-[#0d0f1c] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xl font-bold text-[#E2E8F0] mb-2">That's okay. 💙</p>
              <p className="text-sm text-[#A78BFA] leading-relaxed mb-6">
                Every restart is strength. Day 1 again — you've got this. Most people restart
                several times before it sticks. What matters is that you came back.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => relapseMutation.mutate(undefined)}
                  disabled={relapseMutation.isPending}
                  className="flex-1 rounded-xl bg-[rgba(124,58,237,0.15)] border border-[rgba(124,58,237,0.3)] py-2.5 text-sm font-semibold text-[#E2E8F0] hover:bg-[rgba(124,58,237,0.25)] transition-colors disabled:opacity-60"
                >
                  {relapseMutation.isPending ? "Saving…" : "Start Day 1 again"}
                </button>
                <button
                  onClick={() => setRelapseDialog(false)}
                  className="rounded-xl border border-[#1e2a2a] px-4 py-2.5 text-sm text-[#4B5563] hover:text-[#A78BFA] transition-colors"
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
