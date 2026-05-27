import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "@/lib/auth";

interface Wallet {
  coins: number;
  totalXp: number;
  weeklyXp: number;
  rank: number | null;
}

interface FloatItem {
  id: number;
  text: string;
  color: string;
}

let floatCounter = 0;

export function useCoinXP() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [floats, setFloats] = useState<FloatItem[]>([]);

  const fetchWallet = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch("/api/gamification/wallet", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setWallet(await res.json() as Wallet);
    } catch {}
  };

  useEffect(() => {
    void fetchWallet();
    const id = setInterval(fetchWallet, 30000);
    return () => clearInterval(id);
  }, []);

  const showFloat = (text: string, color: string) => {
    const id = floatCounter++;
    setFloats((prev) => [...prev, { id, text, color }]);
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 1000);
  };

  return { wallet, floats, showFloat, refresh: fetchWallet };
}

export default function CoinXPBar() {
  const { wallet, floats } = useCoinXP();

  if (!wallet) return null;

  const xpForNextLevel = 1000;
  const currentLevel = Math.floor(wallet.totalXp / xpForNextLevel) + 1;
  const xpInCurrentLevel = wallet.totalXp % xpForNextLevel;
  const levelProgress = xpInCurrentLevel / xpForNextLevel;

  return (
    <div className="relative flex items-center gap-3">
      {/* Float animations */}
      <div className="pointer-events-none absolute -top-8 left-0 right-0">
        <AnimatePresence>
          {floats.map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -32 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 -translate-x-1/2 text-xs font-bold"
              style={{ color: f.color }}
            >
              {f.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Coins */}
      <div className="flex items-center gap-1.5 rounded-full border border-[rgba(255,184,0,0.25)] bg-[rgba(255,184,0,0.08)] px-3 py-1.5">
        <span className="text-sm">🪙</span>
        <span className="text-xs font-bold text-[#FFB800]">{wallet.coins.toLocaleString()}</span>
      </div>

      {/* XP + Level */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] text-[10px] font-black text-white shadow-[0_0_8px_rgba(124,58,237,0.5)]">
          {currentLevel}
        </div>
        <div className="hidden sm:flex flex-col gap-0.5">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[rgba(124,58,237,0.15)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
              style={{ boxShadow: "0 0 6px rgba(124,58,237,0.5)" }}
              animate={{ width: `${levelProgress * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-[9px] text-[#4B5563]">{wallet.weeklyXp} XP this week</p>
        </div>
      </div>

      {/* Rank */}
      {wallet.rank && (
        <div className="hidden sm:flex items-center gap-1 rounded-full border border-[rgba(6,214,160,0.25)] bg-[rgba(6,214,160,0.08)] px-2.5 py-1">
          <span className="text-[10px] text-[#06D6A0]">#{wallet.rank}</span>
        </div>
      )}
    </div>
  );
}
