import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetBreakFreeMoodsQueryKey,
  getGetBreakFreeMoodsQueryOptions,
  useLogBreakFreeMood,
} from "@workspace/api-client-react";
import { useToast } from "@/components/Toast";
import { useBreakFreeAuthReady } from "@/hooks/useBreakFreeAuthReady";
import { breakFreeErrorMessage } from "@/lib/break-free-errors";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";

const EMOJIS = [
  { value: 1, emoji: "😔", label: "Rough" },
  { value: 2, emoji: "😐", label: "Okay" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 4, emoji: "😊", label: "Great" },
  { value: 5, emoji: "😄", label: "Amazing" },
];

function moodColor(mood: number) {
  const colors = ["var(--color-error)", "var(--palette-f97316)", "var(--palette-eab308)", "var(--color-success)", "var(--palette-10b981)"];
  return colors[mood - 1] ?? "var(--palette-2a4040)";
}

export default function MoodCheckin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { ready } = useBreakFreeAuthReady();

  const { data } = useQuery({
    ...getGetBreakFreeMoodsQueryOptions(),
    enabled: ready,
  });
  const moods = data?.moods ?? [];
  const todayMood = data?.todayMood ?? null;

  const logMutation = useLogBreakFreeMood({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetBreakFreeMoodsQueryKey() });
        toast("Mood logged ✓", "success");
      },
      onError: (err) => toast(breakFreeErrorMessage(err, "Could not log mood"), "error"),
    },
  });

  function handleMood(value: number) {
    if (!ready) {
      toast("Still signing you in — try again in a moment.", "info");
      return;
    }
    logMutation.mutate({ data: { mood: value } });
  }

  // Build last 7 days chart data
  const last7: Array<{ date: string; label: string; mood: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;
    const entry = moods.find((m) => m.date === dateStr);
    last7.push({
      date: dateStr,
      label: d.toLocaleDateString("en", { weekday: "short" }).slice(0, 3),
      mood: entry?.mood ?? 0,
    });
  }

  return (
    <div className="px-4 py-4">
      {/* Check-in row */}
      {todayMood === null ? (
        <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--palette-0d0f1c)] p-4 mb-4">
          <p className="text-xs font-semibold text-[var(--brand-400)] mb-3">How are you feeling today?</p>
          <div className="flex gap-2 justify-between">
            {EMOJIS.map(({ value, emoji, label }) => (
              <motion.button
                key={value}
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleMood(value)}
                disabled={!ready || logMutation.isPending}
                className="flex flex-col items-center gap-1 flex-1 rounded-xl border border-[var(--rgba-124-58-237-0_1)] bg-[var(--rgba-124-58-237-0_05)] py-2 hover:border-[var(--rgba-124-58-237-0_3)] hover:bg-[var(--rgba-124-58-237-0_1)] transition-all disabled:opacity-60"
              >
                <span className="text-xl">{emoji}</span>
                <span className="text-[11px] text-[var(--foreground-subtle)]">{label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--palette-0d0f1c)] px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-2xl">{EMOJIS.find(e => e.value === todayMood)?.emoji}</span>
          <div>
            <p className="text-xs font-semibold text-[var(--brand-400)]">Today's mood logged ✓</p>
            <p className="text-[11px] text-[var(--foreground-subtle)]">{EMOJIS.find(e => e.value === todayMood)?.label}</p>
          </div>
        </div>
      )}

      {/* 7-day chart */}
      <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_15)] bg-[var(--palette-0d0f1c)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground-subtle)] mb-3">
          7-day mood
        </p>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={last7} barSize={20} margin={{ top: 0, right: 0, bottom: 0, left: -30 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--foreground-subtle)" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 5]} hide />
            <Tooltip
              contentStyle={{ background: "var(--palette-0d0f1c)", border: "1px solid var(--rgba-124-58-237-0_15)", borderRadius: "8px", fontSize: "11px" }}
              labelStyle={{ color: "var(--brand-400)" }}
              formatter={(v: number) => [EMOJIS.find(e => e.value === v)?.emoji ?? "—", "Mood"]}
            />
            <Bar dataKey="mood" radius={[4, 4, 0, 0]}>
              {last7.map((entry, i) => (
                <Cell key={i} fill={entry.mood > 0 ? moodColor(entry.mood) : "var(--palette-1a2a2a)"} opacity={entry.mood > 0 ? 0.85 : 0.3} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
