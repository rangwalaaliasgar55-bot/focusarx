import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { POP } from "@/lib/animations";

interface AchievementModalProps {
  open: boolean;
  onClose: () => void;
  badge: {
    icon: string;
    name: string;
    description: string;
    rarity?: string;
  } | null;
}

const RARITY_COLORS: Record<string, string> = {
  common:    "#9CA3AF",
  rare:      "#3B82F6",
  epic:      "#8B5CF6",
  legendary: "#F59E0B",
};

function Particle({ index }: { index: number }) {
  const angle = (index / 16) * 360;
  const distance = 80 + Math.random() * 60;
  const x = Math.cos((angle * Math.PI) / 180) * distance;
  const y = Math.sin((angle * Math.PI) / 180) * distance;
  const colors = ["#7C3AED", "#06D6A0", "#FFB800", "#F59E0B", "#EC4899"];
  const color = colors[index % colors.length]!;
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{ backgroundColor: color, left: "50%", top: "50%", marginLeft: -4, marginTop: -4 }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      animate={{ x, y, opacity: 0, scale: 0 }}
      transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
    />
  );
}

export function AchievementModal({ open, onClose, badge }: AchievementModalProps) {
  const [typed, setTyped] = useState("");
  const rColor = badge?.rarity ? (RARITY_COLORS[badge.rarity] ?? "#7C3AED") : "#7C3AED";

  useEffect(() => {
    if (!open || !badge) return;
    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      setTyped(badge.name.slice(0, ++i));
      if (i >= badge.name.length) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [open, badge?.name]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && badge && (
        <motion.div
          className="fixed inset-0 z-[9998] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <motion.div
            className="relative z-10 flex flex-col items-center gap-6 p-10 rounded-3xl"
            style={{ background: `radial-gradient(ellipse at center, ${rColor}20, transparent 70%)` }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="relative">
              {Array.from({ length: 16 }).map((_, i) => <Particle key={i} index={i} />)}
              <motion.div
                className="w-28 h-28 rounded-full flex items-center justify-center text-6xl border-4"
                style={{ borderColor: rColor, boxShadow: `0 0 32px ${rColor}60` }}
                {...POP}
              >
                {badge.icon}
              </motion.div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: rColor }}>
                Achievement Unlocked!
              </p>
              <h2 className="text-3xl font-bold text-white">{typed}</h2>
              <p className="text-sm text-slate-300 max-w-xs">{badge.description}</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={onClose}>
                Share
              </Button>
              <Button size="sm" onClick={onClose} style={{ backgroundColor: rColor, borderColor: rColor }}>
                Awesome! 🎉
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
