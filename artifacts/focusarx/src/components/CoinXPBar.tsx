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

function getLevel(totalXp: number) {
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}
function xpForLevel(level: number) {
  return (level - 1) ** 2 * 100;
}
function xpForNextLevel(level: number) {
  return level ** 2 * 100;
}

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

  const level = getLevel(wallet.totalXp);
  const xpStart = xpForLevel(level);
  const xpEnd = xpForNextLevel(level);
  const levelProgress = (wallet.totalXp - xpStart) / (xpEnd - xpStart);

  return (
    <div className="relative flex items-center gap-2.5">
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
      <div
        className="flex items-center gap-1.5 rounded-full border border-[var(--rgba-255-184-0-0_25)] bg-[var(--rgba-255-184-0-0_08)] px-2.5 py-1.5"
        title={`${wallet.coins.toLocaleString()} coins`}
      >
        <span className="text-sm leading-none" aria-hidden>🪙</span>
        <span className="text-xs font-bold text-[var(--brand-gold)]">{wallet.coins.toLocaleString()}</span>
      </div>

      {/* Level badge + XP bar */}
      <div className="flex items-center gap-2" title={`Level ${level} — ${wallet.totalXp.toLocaleString()} XP total`}>
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-600)] to-[var(--palette-4f46e5)] text-[11px] font-semibold text-[var(--palette-white)]"
          style={{ boxShadow: "0 0 8px var(--rgba-124-58-237-0_55)" }}
          aria-label={`Level ${level}`}
        >
          {level}
        </div>
        <div className="hidden sm:flex flex-col gap-0.5">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--rgba-124-58-237-0_15)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)]"
              style={{ boxShadow: "0 0 6px var(--rgba-124-58-237-0_5)" }}
              animate={{ width: `${Math.min(100, levelProgress * 100)}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <p className="text-[11px] text-[var(--foreground-subtle)]">{wallet.weeklyXp.toLocaleString()} XP / week</p>
        </div>
      </div>

      {/* Rank badge */}
      {wallet.rank && (
        <div
          className="hidden sm:flex items-center gap-1 rounded-full border border-[var(--rgba-6-214-160-0_25)] bg-[var(--rgba-6-214-160-0_08)] px-2.5 py-1"
          title="Your leaderboard rank this week"
        >
          <span className="text-[11px] font-semibold text-[var(--brand-teal)]">#{wallet.rank}</span>
        </div>
      )}
    </div>
  );
}
