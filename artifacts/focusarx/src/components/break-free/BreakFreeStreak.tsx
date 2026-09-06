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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rgba-124-58-237-0_2)] border-t-[var(--brand-600)]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center py-16 px-4 text-center gap-3">
        <p className="text-sm text-[var(--brand-400)]">{breakFreeErrorMessage(error, "Could not load streak")}</p>
        <button
          onClick={() => refetch()}
          className="rounded-xl border border-[var(--rgba-124-58-237-0_3)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--rgba-124-58-237-0_1)]"
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
          className="text-[88px] font-semibold leading-none tabular-nums"
          style={{
            background: "linear-gradient(135deg, var(--brand-400) 0%, var(--brand-600) 50%, var(--palette-4f46e5) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 24px var(--rgba-124-58-237-0_35))",
          }}
        >
          {days}
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-600)] mt-1">
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
            className="flex items-center gap-2.5 rounded-2xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--rgba-124-58-237-0_1)] px-5 py-3 mb-8 shadow-[0_0_24px_var(--rgba-124-58-237-0_15)]"
          >
            <span className="text-2xl">{milestone.icon}</span>
            <p className="text-sm text-[var(--foreground)] font-medium">{milestone.label}</p>
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
                className={`w-9 h-9 rounded-full flex items-center justify-center text-lg border transition-all duration-[var(--duration-slow)] ${
                  reached
                    ? "border-[var(--rgba-124-58-237-0_4)] bg-[var(--rgba-124-58-237-0_15)] shadow-[0_0_12px_var(--rgba-124-58-237-0_3)]"
                    : "border-[var(--palette-1e2a2a)] bg-[var(--palette-0d1515)] opacity-40"
                }`}
              >
                {m.icon}
              </div>
              <span className={`text-[11px] font-mono ${reached ? "text-[var(--brand-600)]" : "text-[var(--palette-2a3a3a)]"}`}>
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
          className="rounded-2xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-8 py-3.5 text-sm font-bold text-[var(--palette-white)] shadow-lg shadow-[var(--rgba-124-58-237-0_4)] hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {startMutation.isPending ? "Starting…" : "Start My Journey"}
        </button>
      ) : (
        <div className="flex gap-4 text-center mb-4">
          <div className="rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--palette-0d0f1c)] px-5 py-3">
            <p className="text-lg font-bold text-[var(--brand-400)]">{streak.longestStreak}</p>
            <p className="text-[11px] text-[var(--foreground-subtle)] uppercase tracking-wider">Longest</p>
          </div>
          <div className="rounded-xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--palette-0d0f1c)] px-5 py-3">
            <p className="text-lg font-bold text-[var(--brand-400)]">{streak.relapseCount}</p>
            <p className="text-[11px] text-[var(--foreground-subtle)] uppercase tracking-wider">Restarts</p>
          </div>
        </div>
      )}

      {/* Relapse button — subtle */}
      {streak && (
        <button
          onClick={() => setRelapseDialog(true)}
          className="mt-6 text-xs text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors underline underline-offset-2"
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
            className="fixed inset-0 z-[var(--z-toast)] flex items-center justify-center p-4 bg-[var(--palette-black)]/60 backdrop-blur-sm"
            onClick={() => setRelapseDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="w-full max-w-sm rounded-2xl border border-[var(--rgba-124-58-237-0_2)] bg-[var(--palette-0d0f1c)] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xl font-bold text-[var(--foreground)] mb-2">That's okay. 💙</p>
              <p className="text-sm text-[var(--brand-400)] leading-relaxed mb-6">
                Every restart is strength. Day 1 again — you've got this. Most people restart
                several times before it sticks. What matters is that you came back.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => relapseMutation.mutate(undefined)}
                  disabled={relapseMutation.isPending}
                  className="flex-1 rounded-xl bg-[var(--rgba-124-58-237-0_15)] border border-[var(--rgba-124-58-237-0_3)] py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--rgba-124-58-237-0_25)] transition-colors disabled:opacity-60"
                >
                  {relapseMutation.isPending ? "Saving…" : "Start Day 1 again"}
                </button>
                <button
                  onClick={() => setRelapseDialog(false)}
                  className="rounded-xl border border-[var(--palette-1e2a2a)] px-4 py-2.5 text-sm text-[var(--foreground-subtle)] hover:text-[var(--brand-400)] transition-colors"
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
