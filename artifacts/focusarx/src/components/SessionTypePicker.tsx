import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export type SessionType = "deep_work" | "light_work" | "collaboration" | "recharge";

interface SessionTypeDef {
  id: SessionType;
  emoji: string;
  label: string;
  description: string;
  tint: string;
  glow: string;
  border: string;
}

export const SESSION_TYPES: SessionTypeDef[] = [
  {
    id: "deep_work",
    emoji: "🧠",
    label: "Deep Work",
    description: "Full focus. All distractions blocked.",
    tint: "var(--rgba-220-38-38-0_06)",
    glow: "var(--rgba-220-38-38-0_15)",
    border: "var(--rgba-220-38-38-0_25)",
  },
  {
    id: "light_work",
    emoji: "😌",
    label: "Light Work",
    description: "Softer mode. Some notifications allowed.",
    tint: "var(--rgba-59-130-246-0_06)",
    glow: "var(--rgba-59-130-246-0_15)",
    border: "var(--rgba-59-130-246-0_25)",
  },
  {
    id: "collaboration",
    emoji: "👥",
    label: "Collaboration",
    description: "Meeting mode. Communication apps whitelisted.",
    tint: "var(--rgba-22-163-74-0_06)",
    glow: "var(--rgba-22-163-74-0_15)",
    border: "var(--rgba-22-163-74-0_25)",
  },
  {
    id: "recharge",
    emoji: "😴",
    label: "Recharge",
    description: "Guided break with breathing + ambient sound.",
    tint: "var(--rgba-124-58-237-0_08)",
    glow: "var(--rgba-124-58-237-0_2)",
    border: "var(--rgba-124-58-237-0_3)",
  },
];

export const SESSION_TYPE_TINTS: Record<SessionType, { bg: string; accent: string; text: string }> = {
  deep_work:     { bg: "var(--rgba-220-38-38-0_04)",    accent: "var(--color-error)", text: "var(--palette-fca5a5)" },
  light_work:    { bg: "var(--rgba-59-130-246-0_04)",   accent: "var(--color-info)", text: "var(--palette-93c5fd)" },
  collaboration: { bg: "var(--rgba-22-163-74-0_04)",    accent: "var(--palette-16a34a)", text: "var(--palette-86efac)" },
  recharge:      { bg: "var(--rgba-124-58-237-0_06)",   accent: "var(--brand-600)", text: "var(--brand-400)" },
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (type: SessionType) => void;
  selected: SessionType;
}

export default function SessionTypePicker({ open, onClose, onSelect, selected }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-modal)] bg-[var(--palette-black)]/50 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="fixed inset-x-4 bottom-8 mx-auto max-w-sm rounded-3xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--rgba-12-17-40-0_97)] p-6 shadow-[0_24px_80px_var(--rgba-0-0-0-0_6)] backdrop-blur-2xl sm:static sm:mx-0 sm:w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--foreground-subtle)]">Session mode</p>
                <h2 className="text-base font-bold text-[var(--foreground)]">Choose focus type</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl border border-[var(--rgba-124-58-237-0_15)] p-1.5 text-[var(--foreground-subtle)] hover:text-[var(--foreground-muted)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-2">
              {SESSION_TYPES.map((type) => (
                <motion.button
                  key={type.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { onSelect(type.id); onClose(); }}
                  className="w-full rounded-2xl border p-4 text-left transition-all"
                  style={{
                    background: selected === type.id ? type.tint : "var(--rgba-124-58-237-0_03)",
                    borderColor: selected === type.id ? type.border : "var(--rgba-124-58-237-0_1)",
                    boxShadow: selected === type.id ? `0 0 20px ${type.glow}` : "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{type.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{type.label}</p>
                      <p className="text-[11px] text-[var(--foreground-subtle)] mt-0.5">{type.description}</p>
                    </div>
                    {selected === type.id && (
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: type.border }}
                      />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
