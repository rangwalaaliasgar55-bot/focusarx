import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

const REASONS = [
  { id: "Boredom", emoji: "😴", label: "Boredom" },
  { id: "Anxiety", emoji: "😰", label: "Anxiety" },
  { id: "Hunger", emoji: "🍕", label: "Hunger" },
  { id: "Notification", emoji: "📱", label: "Notification" },
  { id: "Habit", emoji: "🔄", label: "Habit" },
  { id: "Other", emoji: "💭", label: "Other" },
];

interface Props {
  sessionId?: string | null;
  onDone: () => void;
  onSkip: () => void;
}

export default function DistractionModal({ sessionId, onDone, onSkip }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (worthIt: boolean) => {
    setSaving(true);
    try {
      const token = getToken();
      await fetch("/api/distractions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason, worthIt, sessionId }),
      });
    } catch {}
    setSaving(false);
    onDone();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/60 px-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.93, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-[var(--rgba-124-58-237-0_25)] bg-[var(--rgba-8-12-28-0_98)] p-6 shadow-2xl"
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">📓</span>
          <p className="text-[11px] uppercase tracking-widest text-[var(--foreground-subtle)]">Distraction Journal</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <h3 className="mb-4 text-base font-bold text-[var(--foreground)]">What pulled you away?</h3>
              <div className="grid grid-cols-2 gap-2">
                {REASONS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setReason(r.id); setStep(2); }}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-all ${
                      reason === r.id
                        ? "border-[var(--brand-600)] bg-[var(--rgba-124-58-237-0_15)]"
                        : "border-[var(--rgba-124-58-237-0_12)] hover:border-[var(--rgba-124-58-237-0_3)]"
                    }`}
                  >
                    <span>{r.emoji}</span>
                    <span className="text-sm text-[var(--foreground)]">{r.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <h3 className="mb-2 text-base font-bold text-[var(--foreground)]">Was it worth it?</h3>
              <p className="mb-5 text-sm text-[var(--foreground-subtle)]">
                You left for: <span className="text-[var(--brand-400)]">{reason}</span>
              </p>
              <div className="flex gap-3">
                <button
                  disabled={saving}
                  onClick={() => void submit(false)}
                  className="flex-1 rounded-xl border border-[var(--rgba-239-68-68-0_3)] bg-[var(--rgba-239-68-68-0_05)] py-3 text-sm font-semibold text-[var(--palette-red-400)] transition hover:bg-[var(--rgba-239-68-68-0_15)] disabled:opacity-50"
                >
                  😞 No
                </button>
                <button
                  disabled={saving}
                  onClick={() => void submit(true)}
                  className="flex-1 rounded-xl border border-[var(--rgba-74-222-128-0_3)] bg-[var(--rgba-74-222-128-0_05)] py-3 text-sm font-semibold text-[var(--palette-emerald-400)] transition hover:bg-[var(--rgba-74-222-128-0_15)] disabled:opacity-50"
                >
                  😌 Yes
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={onSkip} className="mt-4 w-full text-center text-xs text-[var(--foreground-subtle)] hover:text-[var(--palette-6b7280)] transition-colors">
          Skip reflection
        </button>
      </motion.div>
    </motion.div>
  );
}
