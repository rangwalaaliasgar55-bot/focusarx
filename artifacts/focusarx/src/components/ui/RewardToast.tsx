import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, createContext, useContext, useCallback } from "react";
import { cn } from "@/lib/utils";

type RewardType = "xp" | "coins" | "badge" | "delight" | "lootbox";

interface Reward {
  id: string;
  type: RewardType;
  message: string;
  amount?: number;
}

interface RewardToastContextValue {
  showReward: (type: RewardType, message: string, amount?: number) => void;
}

const RewardToastContext = createContext<RewardToastContextValue>({ showReward: () => {} });

export function useRewardToast() {
  return useContext(RewardToastContext);
}

const TYPE_STYLES: Record<RewardType, { bg: string; emoji: string }> = {
  xp:      { bg: "from-violet-600/90 to-violet-800/90", emoji: "⚡" },
  coins:   { bg: "from-yellow-500/90 to-amber-700/90",   emoji: "🪙" },
  badge:   { bg: "from-pink-500/90 to-purple-700/90",    emoji: "🏅" },
  delight: { bg: "from-teal-500/90 to-cyan-700/90",      emoji: "🎉" },
  lootbox: { bg: "from-indigo-500/90 to-blue-700/90",    emoji: "📦" },
};

export function RewardToastProvider({ children }: { children: React.ReactNode }) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const counterRef = useRef(0);

  const showReward = useCallback((type: RewardType, message: string, amount?: number) => {
    const id = `r-${++counterRef.current}`;
    setRewards(prev => [...prev.slice(-2), { id, type, message, amount }]);
    setTimeout(() => {
      setRewards(prev => prev.filter(r => r.id !== id));
    }, 3000);
  }, []);

  return (
    <RewardToastContext.Provider value={{ showReward }}>
      {children}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
        <AnimatePresence>
          {rewards.map(r => {
            const style = TYPE_STYLES[r.type];
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={cn(
                  "flex items-center gap-2 rounded-2xl px-4 py-2.5 shadow-2xl bg-gradient-to-r text-white text-sm font-semibold backdrop-blur-sm",
                  style.bg
                )}
              >
                <span className="text-base">{style.emoji}</span>
                <span>{r.message}</span>
                {r.amount !== undefined && (
                  <span className="font-bold ml-1">
                    {r.amount > 0 ? "+" : ""}{r.amount}
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </RewardToastContext.Provider>
  );
}
