import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSessionHistory } from "@/hooks/useSessionHistory";

type StreakInfo = { currentStreak: number; lastStudyDate: string | null };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dismissKey() {
  return `focusarx-streak-nudge-${todayKey()}`;
}

/**
 * In-app nudge (audit M2): "Quick session to keep your streak?" — shows on
 * the focus page when the user has a live streak but hasn't focused today.
 * Dismisses per day and auto-hides once a session is logged.
 */
export default function StreakNudge() {
  const { status } = useAuth();
  const { focusSessionsToday } = useSessionHistory();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey()) === "1");

  const query = useQuery<StreakInfo>({
    queryKey: ["stats-streak"],
    queryFn: async () => (await apiJson<{ streak: StreakInfo }>("/api/stats/streak")).streak,
    enabled: status === "authenticated",
    staleTime: 60_000,
  });

  if (status !== "authenticated" || dismissed || focusSessionsToday > 0) return null;
  const streak = query.data;
  if (!streak || streak.currentStreak <= 0 || streak.lastStudyDate === todayKey()) return null;

  const start = () => window.dispatchEvent(new CustomEvent("focusarx:start-focus"));
  const dismiss = () => {
    localStorage.setItem(dismissKey(), "1");
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="streak-nudge"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="mx-auto mb-2 flex w-full max-w-md items-center gap-3 rounded-xl border border-[var(--palette-orange-500)]/25 bg-[var(--palette-orange-500)]/8 px-4 py-2.5"
        role="status"
      >
        <span className="text-lg" aria-hidden="true">🔥</span>
        <p className="min-w-0 flex-1 text-xs text-[var(--foreground)]">
          Your <span className="font-bold text-[var(--palette-orange-400)]">{streak.currentStreak}-day streak</span> needs
          a session today. Even 5 minutes keeps it alive.
        </p>
        <button
          type="button"
          onClick={start}
          className="shrink-0 rounded-lg border border-[var(--palette-orange-500)]/40 bg-[var(--palette-orange-500)]/15 px-3 py-1.5 text-xs font-bold text-[var(--palette-orange-400)] transition-colors hover:bg-[var(--palette-orange-500)]/25 active:scale-95"
        >
          Start
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss streak reminder for today"
          className="shrink-0 text-[var(--foreground-subtle)] transition-colors hover:text-[var(--foreground-muted)]"
        >
          <X size={14} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
