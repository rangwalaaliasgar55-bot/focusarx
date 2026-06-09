import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Gift, Package, Sparkles, Star, Lock, ChevronRight } from "lucide-react";
import { PAGE, CARD, STAGGER, POP } from "@/lib/animations";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

const RARITY_STYLES: Record<string, { border: string; bg: string; glow: string; label: string; color: string }> = {
  common:    { border: "rgba(148,163,184,0.2)", bg: "rgba(148,163,184,0.05)", glow: "0 0 0 transparent",              label: "Common",    color: "#94A3B8" },
  uncommon:  { border: "rgba(16,185,129,0.25)",  bg: "rgba(16,185,129,0.06)",  glow: "0 0 12px rgba(16,185,129,0.12)",  label: "Uncommon",  color: "#10B981" },
  rare:      { border: "rgba(59,130,246,0.3)",   bg: "rgba(59,130,246,0.06)",  glow: "0 0 16px rgba(59,130,246,0.15)",  label: "Rare",      color: "#3B82F6" },
  epic:      { border: "rgba(139,92,246,0.35)",  bg: "rgba(139,92,246,0.08)",  glow: "0 0 20px rgba(139,92,246,0.2)",   label: "Epic",      color: "#8B5CF6" },
  legendary: { border: "rgba(245,158,11,0.4)",   bg: "rgba(245,158,11,0.08)",  glow: "0 0 28px rgba(245,158,11,0.25)",  label: "Legendary", color: "#F59E0B" },
};

function BoxTypeCard({ boxType, myBoxes, wallet, onBuy, onOpen }: {
  boxType: any; myBoxes: any[]; wallet: any; onBuy: (id: string) => void; onOpen: (id: string) => void;
}) {
  const style = RARITY_STYLES[boxType.rarity] ?? RARITY_STYLES.common;
  const owned = myBoxes.filter((b: any) => b.boxTypeId === boxType.id && b.status === "unopened");
  const canAfford = wallet && wallet.coins >= boxType.coinCost;

  return (
    <motion.div variants={CARD}
      className="rounded-2xl border p-5 transition-all"
      style={{ border: `1px solid ${style.border}`, background: style.bg, boxShadow: style.glow }}>
      <div className="text-center mb-4">
        <motion.div
          animate={{ rotateY: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="text-5xl mb-3 cursor-pointer"
          onClick={() => owned.length > 0 && onOpen(owned[0].id)}
        >
          {boxType.icon}
        </motion.div>
        <h3 className="text-sm font-bold text-[#E2E8F0]">{boxType.name}</h3>
        <span className="inline-block mt-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
          {style.label}
        </span>
      </div>

      <p className="text-[10px] text-[#4B5563] text-center mb-4 leading-relaxed">{boxType.description}</p>

      {owned.length > 0 && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[rgba(6,214,160,0.08)] border border-[rgba(6,214,160,0.2)] py-2">
          <Package size={12} className="text-[#06D6A0]" />
          <span className="text-xs font-semibold text-[#06D6A0]">You own {owned.length}</span>
        </div>
      )}

      <div className="space-y-2">
        {owned.length > 0 && (
          <button onClick={() => onOpen(owned[0].id)}
            className="w-full rounded-xl py-2 text-xs font-bold text-white transition-all"
            style={{ background: `linear-gradient(135deg, ${style.color}aa, ${style.color}66)` }}>
            ✨ Open Now!
          </button>
        )}
        {boxType.coinCost > 0 && (
          <button onClick={() => onBuy(boxType.id)}
            disabled={!canAfford}
            className="w-full rounded-xl border py-2 text-xs font-semibold transition-all disabled:opacity-40"
            style={{ borderColor: style.border, color: style.color }}>
            🪙 {boxType.coinCost.toLocaleString()} coins
          </button>
        )}
        {boxType.sessionsRequired > 0 && boxType.coinCost === 0 && (
          <div className="flex items-center justify-center gap-1 text-[10px] text-[#4B5563]">
            <Star size={10} /> Earn by completing {boxType.sessionsRequired} sessions
          </div>
        )}
      </div>
    </motion.div>
  );
}

function OpeningAnimation({ reward, onClose }: { reward: any; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        variants={POP}
        initial="initial"
        animate="animate"
        className="rounded-3xl border border-[rgba(124,58,237,0.4)] bg-[#0d0f1c] p-8 text-center max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.6 }}
          className="text-7xl mb-4"
        >
          {reward.emoji ?? "🎁"}
        </motion.div>
        <h2 className="text-xl font-bold text-[#E2E8F0] mb-2">You got a reward!</h2>
        <p className="text-[#A78BFA] font-semibold mb-1">{reward.label}</p>
        <p className="text-sm text-[#4B5563] mb-6">{reward.description}</p>
        <button onClick={onClose} className="w-full rounded-xl bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.3)] py-2.5 text-sm font-semibold text-[#A78BFA]">
          Claim
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function LootBoxesPage() {
  const [boxTypes, setBoxTypes] = useState<any[]>([]);
  const [myBoxes, setMyBoxes] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openedReward, setOpenedReward] = useState<any | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [tr, mr, wr] = await Promise.all([
        fetch("/api/lootboxes/types", { headers: authHeaders() }),
        fetch("/api/lootboxes/mine", { headers: authHeaders() }),
        fetch("/api/gamification/wallet", { headers: authHeaders() }),
      ]);
      if (tr.ok) setBoxTypes(await tr.json());
      if (mr.ok) setMyBoxes(await mr.json());
      if (wr.ok) setWallet(await wr.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleBuy = async (typeId: string) => {
    if (processing) return;
    setProcessing(typeId);
    try {
      const res = await fetch("/api/lootboxes/buy", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ typeId }),
      });
      const data = await res.json();
      if (!res.ok) { setToast(data.error || "Failed to buy"); setTimeout(() => setToast(null), 3000); return; }
      setWallet((w: any) => w ? { ...w, coins: data.newCoins } : w);
      setMyBoxes(prev => [data.box, ...prev]);
      setToast("📦 Box added to your collection!");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setProcessing(null);
    }
  };

  const handleOpen = async (boxId: string) => {
    if (processing) return;
    setProcessing(boxId);
    try {
      const res = await fetch(`/api/lootboxes/${boxId}/open`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) { setToast(data.error || "Failed to open"); setTimeout(() => setToast(null), 3000); return; }
      setOpenedReward(data.reward);
      setMyBoxes(prev => prev.filter(b => b.id !== boxId));
      if (data.newCoins !== undefined) setWallet((w: any) => w ? { ...w, coins: data.newCoins } : w);
    } finally {
      setProcessing(null);
    }
  };

  const totalOwned = myBoxes.filter(b => b.status === "unopened").length;

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#7C3AED]" />
    </div>
  );

  return (
    <PageTransition>
      <motion.div variants={PAGE} initial="initial" animate="animate" className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#E2E8F0] mb-2">Loot Boxes <span className="text-[#F59E0B]">📦</span></h1>
          <p className="text-sm text-[#4B5563]">Earn boxes from sessions, open them for exciting rewards</p>
          {totalOwned > 0 && (
            <motion.div variants={POP} initial="initial" animate="animate"
              className="inline-flex items-center gap-2 mt-3 rounded-full border border-[rgba(6,214,160,0.3)] bg-[rgba(6,214,160,0.08)] px-4 py-1.5 text-sm text-[#06D6A0]">
              <Package size={14} /> {totalOwned} unopened box{totalOwned !== 1 ? "es" : ""}
            </motion.div>
          )}
        </div>

        {wallet && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 rounded-xl border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.07)] px-4 py-2">
              <span className="text-lg">🪙</span>
              <span className="text-sm font-bold text-[#F59E0B]">{wallet.coins.toLocaleString()} coins</span>
            </div>
          </div>
        )}

        {/* Box types grid */}
        <motion.div variants={STAGGER} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {boxTypes.map((bt: any) => (
            <BoxTypeCard key={bt.id} boxType={bt} myBoxes={myBoxes} wallet={wallet} onBuy={handleBuy} onOpen={handleOpen} />
          ))}
        </motion.div>

        {boxTypes.length === 0 && (
          <div className="py-16 text-center">
            <Gift size={40} className="mx-auto mb-3 text-[#2D3748]" />
            <p className="text-sm text-[#4B5563]">Loot boxes coming soon!</p>
          </div>
        )}

        {/* Reward popup */}
        <AnimatePresence>
          {openedReward && <OpeningAnimation reward={openedReward} onClose={() => setOpenedReward(null)} />}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-[rgba(124,58,237,0.3)] bg-[#0d0f1c] px-5 py-3 text-sm font-semibold text-[#A78BFA] shadow-lg">
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PageTransition>
  );
}
