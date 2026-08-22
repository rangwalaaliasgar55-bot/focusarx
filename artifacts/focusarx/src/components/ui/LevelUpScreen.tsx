import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { Button } from "./button";

interface LevelUpScreenProps {
  open: boolean;
  onClose: () => void;
  newLevel: number;
  newRank?: string;
  unlocks?: string[];
}

function ConfettiPiece({ index }: { index: number }) {
  const colors = ["var(--brand-600)", "var(--brand-teal)", "var(--brand-gold)", "var(--color-warning)", "var(--palette-ec4899)", "var(--color-info)", "var(--palette-10b981)"];
  const color = colors[index % colors.length]!;
  const x = (Math.random() - 0.5) * window.innerWidth * 1.5;
  const y = -(Math.random() * 600 + 200);
  const rotate = Math.random() * 720 - 360;
  const size = Math.random() * 10 + 6;
  const delay = Math.random() * 0.5;

  return (
    <motion.div
      className="absolute rounded-sm"
      style={{ backgroundColor: color, width: size, height: size * 0.5, top: "50%", left: "50%" }}
      initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
      animate={{ x, y, opacity: 0, rotate }}
      transition={{ duration: 1.5, ease: "easeOut", delay }}
    />
  );
}

export function LevelUpScreen({ open, onClose, newLevel, newRank, unlocks = [] }: LevelUpScreenProps) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--z-focus-overlay)] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, var(--palette-0a0f1e) 0%, var(--palette-1a0540) 50%, var(--palette-0a0f1e) 100%)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {Array.from({ length: 50 }).map((_, i) => <ConfettiPiece key={i} index={i} />)}

          <div className="relative z-[var(--z-content)] flex flex-col items-center gap-8 text-center px-6">
            <motion.p
              className="text-lg font-semibold tracking-[0.3em] uppercase text-[var(--palette-violet-300)]"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Level Up!
            </motion.p>

            <motion.div
              className="text-[120px] font-black leading-none"
              style={{ color: "var(--brand-600)", textShadow: "0 0 60px var(--rgba-124-58-237-0_8), 0 0 120px var(--rgba-124-58-237-0_4)" }}
              initial={{ y: -80, opacity: 0, scale: 1.5 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.1 }}
            >
              {newLevel}
            </motion.div>

            {newRank && (
              <motion.div
                className="px-6 py-2 rounded-full bg-[var(--palette-violet-600)]/30 border border-[var(--palette-violet-500)]/50 text-[var(--palette-violet-200)] font-semibold text-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                🏅 {newRank} unlocked!
              </motion.div>
            )}

            {unlocks.length > 0 && (
              <motion.div
                className="flex flex-col gap-2 items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                {unlocks.map((u, i) => (
                  <motion.div
                    key={u}
                    className="text-sm text-[var(--palette-slate-300)] flex items-center gap-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + i * 0.12 }}
                  >
                    <span className="text-[var(--palette-teal-400)]">✓</span> {u}
                  </motion.div>
                ))}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              onClick={e => e.stopPropagation()}
            >
              <Button
                size="lg"
                onClick={onClose}
                className="px-10 bg-[var(--palette-violet-600)] hover:bg-[var(--palette-violet-500)] text-[var(--palette-white)] font-bold text-lg"
              >
                Awesome! 🚀
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
