import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Lock, Sparkles, Target, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { usePremium } from "@/hooks/usePremium";

export type RitualTemplate = {
  id: string;
  name: string;
  description: string;
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  icon: string;
  premium: boolean;
};

export const RITUAL_TEMPLATES: RitualTemplate[] = [
  { id: "quick", name: "Quick Sprint", description: "15m focus burst", focusMin: 15, breakMin: 5, longBreakMin: 15, icon: "⚡", premium: false },
  { id: "pomodoro", name: "Classic Pomodoro", description: "25m focus, 5m break", focusMin: 25, breakMin: 5, longBreakMin: 15, icon: "🍅", premium: false },
  { id: "deep50", name: "Deep 50", description: "50m deep work", focusMin: 50, breakMin: 10, longBreakMin: 20, icon: "🎯", premium: false },
  { id: "deep90", name: "Deep 90", description: "90m ultradian rhythm", focusMin: 90, breakMin: 15, longBreakMin: 30, icon: "🧠", premium: true },
  { id: "flow120", name: "Flow 120", description: "2h flow state", focusMin: 120, breakMin: 20, longBreakMin: 30, icon: "🌊", premium: true },
  { id: "marathon", name: "Marathon 180", description: "3h deep dive", focusMin: 180, breakMin: 25, longBreakMin: 40, icon: "🏔️", premium: true },
  { id: "study", name: "Study Session", description: "50m study, 10m review", focusMin: 50, breakMin: 10, longBreakMin: 30, icon: "📚", premium: true },
  { id: "creative", name: "Creative Sprint", description: "45m create, 15m reflect", focusMin: 45, breakMin: 15, longBreakMin: 30, icon: "🎨", premium: true },
];

export function TimerRitualsPanel({
  onSelectTemplate,
  currentFocusMin,
  onCustomDuration,
}: {
  onSelectTemplate: (t: RitualTemplate) => void;
  currentFocusMin: number;
  onCustomDuration: (mins: number) => void;
}) {
  const { isPremium } = usePremium();
  const [showCustom, setShowCustom] = useState(false);
  const [customVal, setCustomVal] = useState(currentFocusMin);
  const [intention, setIntention] = useState("");

  return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
          <Sparkles size={12} /> Rituals
        </h3>
        {!isPremium && (
          <Link href="/premium" className="inline-flex items-center gap-1 rounded-full bg-[var(--palette-amber-500)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--palette-amber-400)]">
            <Crown size={10} /> Premium
          </Link>
        )}
      </div>

      {/* Intention — free */}
      <div className="mb-4">
        <label htmlFor="timer-rituals-intention" className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
          <Target size={10} /> Session intention
        </label>
        <input
          id="timer-rituals-intention"
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          placeholder="What will you focus on? (e.g. Write chapter 3)"
          className="w-full rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--brand-400)]/40"
        />
        <p className="mt-1 text-[10px] text-[var(--foreground-subtle)]">Visible during focus for accountability.</p>
      </div>

      {/* Templates */}
      <div className="mb-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Templates</p>
        <div className="grid grid-cols-2 gap-2">
          {RITUAL_TEMPLATES.map((t) => {
            const locked = t.premium && !isPremium;
            return (
              <button
                key={t.id}
                onClick={() => {
                  if (locked) return;
                  onSelectTemplate(t);
                }}
                className={`relative rounded-xl border p-2.5 text-left transition-all ${locked ? "border-[var(--palette-amber-500)]/15 bg-[var(--palette-amber-950)]/10 opacity-70" : "border-[var(--forge-border)] bg-[var(--surface-1)] hover:border-[var(--brand-400)]/30"}`}
              >
                {locked && (
                  <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--palette-amber-500)]/20 text-[var(--palette-amber-400)]">
                    <Lock size={10} />
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{t.icon}</span>
                  <span className="text-[11px] font-bold">{t.name}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-[var(--foreground-subtle)]">{t.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom duration — premium 10-180 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Custom duration</p>
          <button
            onClick={() => setShowCustom((v) => !v)}
            className="rounded-full border border-[var(--forge-border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--foreground-muted)] hover:bg-[var(--surface-2)]"
          >
            {showCustom ? "Hide" : "Set custom"}
          </button>
        </div>

        <AnimatePresence>
          {showCustom && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold">{customVal}m</span>
                  {!isPremium && customVal > 50 && customVal !== 25 && customVal !== 15 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--palette-amber-500)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--palette-amber-400)]">
                      <Lock size={10} /> Premium 10-180m
                    </span>
                  )}
                </div>
                <input
                  type="range"
                  min={10}
                  max={180}
                  step={5}
                  value={customVal}
                  onChange={(e) => setCustomVal(parseInt(e.target.value))}
                  className="w-full accent-[var(--brand-600)]"
                />
                <div className="mt-2 flex justify-between text-[10px] text-[var(--foreground-subtle)]">
                  <span>10m</span><span>60m</span><span>120m</span><span>180m</span>
                </div>
                <button
                  onClick={() => {
                    if (!isPremium && ![15, 25, 50].includes(customVal)) {
                      window.location.href = "/premium";
                      return;
                    }
                    onCustomDuration(customVal);
                  }}
                  className="mt-3 w-full rounded-xl bg-[var(--brand-600)] py-2 text-xs font-bold text-white hover:bg-[var(--brand-700)]"
                >
                  Apply {customVal}m
                </button>
                {!isPremium && (
                  <p className="mt-2 text-center text-[10px] text-[var(--foreground-subtle)]">
                    Free: 15, 25, 50 min. <Link href="/premium" className="font-bold text-[var(--palette-amber-400)]">Unlock 10-180m with Premium</Link>
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Premium benefits teaser */}
      {!isPremium && (
        <div className="mt-4 rounded-xl border border-[var(--palette-amber-500)]/20 bg-gradient-to-br from-[var(--palette-amber-950)]/20 to-[var(--surface-1)] p-3">
          <p className="flex items-center gap-1 text-[11px] font-bold"><Crown size={12} className="text-[var(--palette-amber-400)]" /> Premium rituals</p>
          <ul className="mt-1.5 space-y-1 text-[10px] text-[var(--foreground-muted)]">
            <li>• Sequences (focus → break chains)</li>
            <li>• Fullscreen zen with animations</li>
            <li>• Sound mixing + ambient layers</li>
            <li>• Reflections & templates history</li>
          </ul>
          <Link href="/premium" className="mt-2 inline-flex w-full justify-center rounded-full bg-[var(--palette-amber-500)] py-1.5 text-[11px] font-bold text-white">
            Unlock with Focus Tokens
          </Link>
        </div>
      )}
    </div>
  );
}

export function ReflectionModal({
  open,
  durationSeconds,
  onClose,
  onSubmit,
}: {
  open: boolean;
  durationSeconds: number;
  onClose: () => void;
  onSubmit: (reflection: string) => void;
}) {
  const [text, setText] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 shadow-2xl">
        <h3 className="flex items-center gap-2 text-sm font-bold"><BookOpen size={16} /> Session reflection</h3>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">You focused for {Math.floor(durationSeconds / 60)}m. What did you accomplish? (Premium saves history)</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I completed... Next I will..."
          className="mt-3 min-h-[80px] w-full rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] p-3 text-sm outline-none focus:border-[var(--brand-400)]/40"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-[var(--forge-border)] px-4 py-2 text-xs font-semibold">Skip</button>
          <button onClick={() => { onSubmit(text); setText(""); }} className="rounded-xl bg-[var(--brand-600)] px-4 py-2 text-xs font-bold text-white">Save reflection</button>
        </div>
      </motion.div>
    </div>
  );
}
