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
    tint: "rgba(220,38,38,0.06)",
    glow: "rgba(220,38,38,0.15)",
    border: "rgba(220,38,38,0.25)",
  },
  {
    id: "light_work",
    emoji: "😌",
    label: "Light Work",
    description: "Softer mode. Some notifications allowed.",
    tint: "rgba(59,130,246,0.06)",
    glow: "rgba(59,130,246,0.15)",
    border: "rgba(59,130,246,0.25)",
  },
  {
    id: "collaboration",
    emoji: "👥",
    label: "Collaboration",
    description: "Meeting mode. Communication apps whitelisted.",
    tint: "rgba(22,163,74,0.06)",
    glow: "rgba(22,163,74,0.15)",
    border: "rgba(22,163,74,0.25)",
  },
  {
    id: "recharge",
    emoji: "😴",
    label: "Recharge",
    description: "Guided break with breathing + ambient sound.",
    tint: "rgba(124,58,237,0.08)",
    glow: "rgba(124,58,237,0.2)",
    border: "rgba(124,58,237,0.3)",
  },
];

export const SESSION_TYPE_TINTS: Record<SessionType, { bg: string; accent: string; text: string }> = {
  deep_work:     { bg: "rgba(220,38,38,0.04)",    accent: "#EF4444", text: "#FCA5A5" },
  light_work:    { bg: "rgba(59,130,246,0.04)",   accent: "#3B82F6", text: "#93C5FD" },
  collaboration: { bg: "rgba(22,163,74,0.04)",    accent: "#16A34A", text: "#86EFAC" },
  recharge:      { bg: "rgba(124,58,237,0.06)",   accent: "#7C3AED", text: "#A78BFA" },
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
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="fixed inset-x-4 bottom-8 z-50 mx-auto max-w-sm rounded-3xl border border-[rgba(124,58,237,0.3)] bg-[rgba(12,17,40,0.97)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#4B5563]">Session mode</p>
                <h2 className="text-base font-bold text-[#E2E8F0]">Choose focus type</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl border border-[rgba(124,58,237,0.15)] p-1.5 text-[#4B5563] hover:text-[#94A3B8] transition-colors"
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
                    background: selected === type.id ? type.tint : "rgba(124,58,237,0.03)",
                    borderColor: selected === type.id ? type.border : "rgba(124,58,237,0.1)",
                    boxShadow: selected === type.id ? `0 0 20px ${type.glow}` : "none",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{type.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#E2E8F0]">{type.label}</p>
                      <p className="text-[11px] text-[#4B5563] mt-0.5">{type.description}</p>
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
        </>
      )}
    </AnimatePresence>
  );
}
