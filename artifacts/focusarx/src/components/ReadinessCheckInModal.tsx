import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { getToken } from "@/lib/auth";
import { isOnboarded, tryAcquireModal, releaseModal } from "@/lib/onboarding";

const SKIP_KEY = () => `focusarx-readiness-skipped-${new Date().toISOString().split("T")[0]}`;

type ReadinessLog = { score: number; sessionLengthRec: number };

function Slider({ label, emoji, value, onChange, lowLabel, highLabel }: {
  label: string;
  emoji: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--foreground-muted)]">{emoji} {label}</span>
        <span className="font-bold text-[var(--brand-400)]">{value}/5</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-8 flex-1 rounded-lg border text-xs font-semibold transition-all ${
              n <= value
                ? "border-[var(--brand-600)] bg-[var(--rgba-124-58-237-0_25)] text-[var(--brand-400)]"
                : "border-[var(--rgba-124-58-237-0_15)] bg-transparent text-[var(--foreground-subtle)] hover:border-[var(--rgba-124-58-237-0_4)]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-[var(--foreground-subtle)]">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

export default function ReadinessCheckInModal() {
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ReadinessLog | null>(null);
  const [form, setForm] = useState({ sleep: 3, stress: 3, energy: 3 });

  useEffect(() => {
    if (localStorage.getItem(SKIP_KEY())) return;
    if (!isOnboarded()) return;

    const token = getToken();
    if (!token) return;

    const timer = setTimeout(() => {
      fetch("/api/readiness/today", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then((d: { log?: ReadinessLog | null } | null) => {
          // Respect the shared modal lock so this never stacks on top of
          // another full-screen dialog (e.g. missed-task review).
          if (!d?.log && tryAcquireModal()) setVisible(true);
        })
        .catch(() => {});
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(SKIP_KEY(), "1");
    setVisible(false);
    releaseModal();
  };

  const handleSave = async () => {
    setSaving(true);
    const token = getToken();
    try {
      const r = await fetch("/api/readiness", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      });
      const d = await r.json() as { log?: ReadinessLog };
      if (d.log) {
        setResult(d.log);
        setDone(true);
        setTimeout(() => { setVisible(false); releaseModal(); }, 2800);
      }
    } finally {
      setSaving(false);
    }
  };

  const scoreColor =
    result && result.score >= 80 ? "var(--palette-4ade80)" :
    result && result.score >= 50 ? "var(--color-warning)" : "var(--palette-f97316)";

  const scoreMessage =
    result && result.score >= 80 ? "Peak mode — push hard today 🔥" :
    result && result.score >= 50 ? "Solid — structured blocks will work well" :
    "Low energy — go gentle, short sessions";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/60 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.93, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full max-w-sm rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-8-10-24-0_98)] p-6 shadow-2xl"
          >
            <AnimatePresence mode="wait">
              {done && result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-4 gap-3"
                >
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-black"
                    style={{ background: `color-mix(in srgb, ${scoreColor} 9%, transparent)`, color: scoreColor, border: `2px solid color-mix(in srgb, ${scoreColor} 27%, transparent)` }}
                  >
                    {result.score}
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)] text-center">{scoreMessage}</p>
                  <p className="text-xs text-[var(--foreground-subtle)] text-center">
                    Recommended: <span className="text-[var(--brand-400)] font-semibold">{result.sessionLengthRec}-min sessions</span>
                  </p>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mb-5 flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">Good morning</p>
                      <h3 className="mt-0.5 text-base font-bold text-[var(--foreground)]">How are you feeling?</h3>
                      <p className="mt-1 text-xs text-[var(--foreground-subtle)]">A quick check-in personalises your Focus Forecast.</p>
                    </div>
                    <button onClick={dismiss} className="text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors mt-0.5">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <Slider
                      label="Sleep quality" emoji="😴"
                      value={form.sleep} onChange={v => setForm(f => ({ ...f, sleep: v }))}
                      lowLabel="Terrible" highLabel="Excellent"
                    />
                    <Slider
                      label="Stress level" emoji="🧠"
                      value={form.stress} onChange={v => setForm(f => ({ ...f, stress: v }))}
                      lowLabel="Very calm" highLabel="Very stressed"
                    />
                    <Slider
                      label="Energy level" emoji="⚡"
                      value={form.energy} onChange={v => setForm(f => ({ ...f, energy: v }))}
                      lowLabel="Drained" highLabel="Fully charged"
                    />
                  </div>

                  <button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="mt-6 w-full rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--palette-4f46e5)] py-3 text-sm font-semibold text-[var(--palette-white)] transition hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Get my focus score"}
                  </button>
                  <button
                    onClick={dismiss}
                    className="mt-3 w-full text-[11px] text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors"
                  >
                    Skip for today
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
