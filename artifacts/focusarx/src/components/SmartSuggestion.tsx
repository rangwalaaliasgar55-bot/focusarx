import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb, X } from "lucide-react";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type AnalyticsPayload = {
  hourDist: Array<{ hour: number; minutes: number }>;
};

const DISMISS_KEY = "focusarx-smart-tip-dismissed";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hourLabel(h: number) {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Personalization engine lite (audit M5): derives one actionable insight from
 * the user's real hour-of-day focus distribution — peak window, chronotype,
 * or a nudge when there isn't enough signal yet.
 */
export default function SmartSuggestion() {
  const { status } = useAuth();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === todayKey());

  const query = useQuery<AnalyticsPayload>({
    queryKey: ["stats-analytics"],
    queryFn: () => apiJson<AnalyticsPayload>("/api/analytics"),
    enabled: status === "authenticated",
    staleTime: 10 * 60_000,
  });

  const tip = useMemo(() => {
    const dist = query.data?.hourDist;
    if (!dist) return null;
    const total = dist.reduce((sum, d) => sum + d.minutes, 0);
    if (total < 60) return "Focus a few more sessions and I'll learn your best hours.";

    const best = [...dist].sort((a, b) => b.minutes - a.minutes)[0];
    if (!best || best.minutes < 20) return null;

    const morning = dist.filter((d) => d.hour < 12).reduce((sum, d) => sum + d.minutes, 0);
    const morningShare = morning / total;

    if (best.minutes / total > 0.25) return `Your peak window is around ${hourLabel(best.hour)} — protect it for deep work.`;
    if (morningShare >= 0.6) return `You complete ${Math.round(morningShare * 100)}% of your focus in the morning. Front-load tomorrow.`;
    if (morningShare <= 0.35) return `You're an evening focuser — ${Math.round((1 - morningShare) * 100)}% of your minutes land after noon.`;
    return null;
  }, [query.data]);

  if (status !== "authenticated" || dismissed || !tip) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, todayKey());
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="smart-suggestion"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto flex w-full max-w-md items-center gap-2.5 rounded-xl border border-[var(--palette-violet-500)]/20 bg-[var(--palette-violet-500)]/6 px-4 py-2"
      >
        <Lightbulb size={14} className="shrink-0 text-[var(--brand-400)]" />
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--foreground-muted)]" title={tip}>
          {tip}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss suggestion"
          className="shrink-0 text-[var(--foreground-subtle)] transition-colors hover:text-[var(--foreground-muted)]"
        >
          <X size={12} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
