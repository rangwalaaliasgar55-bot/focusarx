import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Target, BookOpen } from "lucide-react";
import { Zap, Timer, Brain, Waves, Mountain, Palette } from "lucide-react";

export type RitualTemplate = {
  id: string;
  name: string;
  description: string;
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
  icon: React.ReactNode;
  premium: boolean;
};

export const RITUAL_TEMPLATES: RitualTemplate[] = [
  { id: "quick", name: "Quick Sprint", description: "15m focus burst", focusMin: 15, breakMin: 5, longBreakMin: 15, icon: <Zap size={16} aria-hidden="true" />, premium: false },
  { id: "pomodoro", name: "Classic Pomodoro", description: "25m focus, 5m break", focusMin: 25, breakMin: 5, longBreakMin: 15, icon: <Timer size={16} aria-hidden="true" />, premium: false },
  { id: "deep50", name: "Deep 50", description: "50m deep work", focusMin: 50, breakMin: 10, longBreakMin: 20, icon: <Target size={16} aria-hidden="true" />, premium: false },
  { id: "deep90", name: "Deep 90", description: "90m ultradian rhythm", focusMin: 90, breakMin: 15, longBreakMin: 30, icon: <Brain size={16} aria-hidden="true" />, premium: false },
  { id: "flow120", name: "Flow 120", description: "2h flow state", focusMin: 120, breakMin: 20, longBreakMin: 30, icon: <Waves size={16} aria-hidden="true" />, premium: false },
  { id: "marathon", name: "Marathon 180", description: "3h deep dive", focusMin: 180, breakMin: 25, longBreakMin: 40, icon: <Mountain size={16} aria-hidden="true" />, premium: false },
  { id: "study", name: "Study Session", description: "50m study, 10m review", focusMin: 50, breakMin: 10, longBreakMin: 30, icon: <BookOpen size={16} aria-hidden="true" />, premium: false },
  { id: "creative", name: "Creative Sprint", description: "45m create, 15m reflect", focusMin: 45, breakMin: 15, longBreakMin: 30, icon: <Palette size={16} aria-hidden="true" />, premium: false },
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
  const [showCustom, setShowCustom] = useState(false);
  const [customVal, setCustomVal] = useState(currentFocusMin || 25);
  const [intention, setIntention] = useState("");

  return (
    <div className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--foreground-muted)]">
          <Sparkles size={12} className="text-[var(--brand-400)]" /> Focus Rituals & Presets
        </h3>
      </div>

      {/* Intention */}
      <div className="mb-4">
        <label htmlFor="timer-rituals-intention" className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
          <Target size={11} /> Session intention
        </label>
        <input
          id="timer-rituals-intention"
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          placeholder="What will you focus on? (e.g. Complete chapter 4 problems)"
          className="w-full rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--brand-400)]/40"
        />
        <p className="mt-1 text-[11px] text-[var(--foreground-subtle)]">Helps keep your mind aligned on the target.</p>
      </div>

      {/* Templates */}
      <div className="mb-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Suggested Rituals</p>
        <div className="grid grid-cols-2 gap-2">
          {RITUAL_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectTemplate(t)}
              className="relative rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] p-2.5 text-left transition-all hover:border-[var(--brand-400)]/40 hover:bg-[var(--surface-hover)]"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-[var(--brand-400)]">{t.icon}</span>
                <span className="text-[11px] font-bold text-[var(--foreground)]">{t.name}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--foreground-subtle)]">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom duration */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Custom duration</p>
          <button
            onClick={() => setShowCustom((v) => !v)}
            className="rounded-full border border-[var(--forge-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--foreground-muted)] hover:bg-[var(--surface-2)]"
          >
            {showCustom ? "Hide" : "Set custom"}
          </button>
        </div>

        <AnimatePresence>
          {showCustom && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--brand-400)]">{customVal} min</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={180}
                  step={5}
                  value={customVal}
                  onChange={(e) => setCustomVal(parseInt(e.target.value))}
                  className="w-full accent-[var(--brand-600)]"
                />
                <div className="mt-2 flex justify-between text-[11px] text-[var(--foreground-subtle)]">
                  <span>5m</span><span>45m</span><span>90m</span><span>180m</span>
                </div>
                <button
                  onClick={() => onCustomDuration(customVal)}
                  className="mt-3 w-full rounded-xl bg-[var(--brand-600)] py-2 text-xs font-bold text-white hover:bg-[var(--brand-500)] shadow-md transition-colors"
                >
                  Apply {customVal}m duration
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
    <div className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-black/70 p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-5 shadow-[var(--shadow-lg)]">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]"><BookOpen size={16} className="text-[var(--brand-400)]" /> Session reflection</h3>
        <p className="mt-1 text-xs text-[var(--foreground-muted)]">You focused for {Math.floor(durationSeconds / 60)}m. What did you accomplish?</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="I completed... Next I will..."
          className="mt-3 min-h-[80px] w-full rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] p-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand-400)]/40"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-[var(--forge-border)] px-4 py-2 text-xs font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)]">Skip</button>
          <button onClick={() => { onSubmit(text); setText(""); }} className="rounded-xl bg-[var(--brand-600)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-500)]">Save reflection</button>
        </div>
      </motion.div>
    </div>
  );
}
