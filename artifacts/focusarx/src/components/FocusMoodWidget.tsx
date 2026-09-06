import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

const MOODS = [
  { emoji: "😴", label: "Low energy", value: 1, color: "var(--foreground-muted)" },
  { emoji: "😐", label: "Neutral",    value: 2, color: "var(--foreground-muted)" },
  { emoji: "🙂", label: "OK",         value: 3, color: "var(--info)" },
  { emoji: "😊", label: "Good",       value: 4, color: "var(--success)" },
  { emoji: "🔥", label: "On fire",    value: 5, color: "var(--warning)" },
];

const ENERGY_TIPS: Record<number, string> = {
  1: "Try a 2-minute breathing exercise before starting.",
  2: "A short stretch can reset your focus.",
  3: "You've got this — start with the easiest task.",
  4: "Great energy! Tackle your hardest task first.",
  5: "Elite mode unlocked. Maximize this session! 🚀",
};

interface FocusMoodWidgetProps {
  onSelect?: (mood: number) => void;
  compact?: boolean;
}

export function FocusMoodWidget({ onSelect, compact = false }: FocusMoodWidgetProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = async (value: number) => {
    setSelected(value);
    setSubmitted(true);
    onSelect?.(value);
    try {
      const token = getToken();
      await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ mood: value, timestamp: new Date().toISOString() }),
      });
    } catch { /* fallback: mood stored locally */ }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {MOODS.map((m) => (
          <motion.button
            key={m.value}
            whileHover={{ scale: 1.25, y: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSelect(m.value)}
            className={`rounded-lg p-1.5 text-base transition-all ${selected === m.value ? "bg-[var(--brand-soft-hover)] ring-1 ring-[var(--brand-400)]" : "hover:bg-[var(--surface-hover)]"}`}
            title={m.label}
          >
            {m.emoji}
          </motion.button>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4 backdrop-blur-xl"
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-[var(--foreground-subtle)] mb-3">Energy Check-in</p>
      <AnimatePresence mode="wait">
        {!submitted ? (
          <motion.div key="picker" exit={{ opacity: 0, scale: 0.95 }} className="flex items-center justify-around gap-0.5">
            {MOODS.map((m) => (
              <motion.button
                key={m.value}
                whileHover={{ scale: 1.2, y: -4 }}
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                onClick={() => handleSelect(m.value)}
                className="flex flex-col items-center gap-1 rounded-xl px-1.5 py-2 min-w-0 hover:bg-[var(--surface-hover)] transition-colors"
              >
                <span className="text-xl leading-none">{m.emoji}</span>
                <span className="text-[11px] text-[var(--foreground-subtle)] whitespace-nowrap">{m.label}</span>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex items-start gap-2.5"
          >
            <span className="text-2xl shrink-0">{MOODS[selected! - 1]?.emoji}</span>
            <div>
              <p className="text-xs font-medium text-[var(--foreground)]">{MOODS[selected! - 1]?.label}</p>
              <p className="text-xs text-[var(--foreground-muted)] mt-0.5 leading-relaxed">{ENERGY_TIPS[selected!]}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
