import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Gift, Package, Star, Lock } from "lucide-react";
import { PAGE, CARD, STAGGER, POP } from "@/lib/animations";
import { ErrorState } from "@/components/ErrorState";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

const RARITY_STYLES: Record<string, { border: string; bg: string; glow: string; label: string; color: string }> = {
  common:    { border: "var(--rgba-148-163-184-0_2)", bg: "var(--rgba-148-163-184-0_05)", glow: "0 0 0 transparent",              label: "Common",    color: "var(--foreground-muted)" },
  uncommon:  { border: "var(--rgba-16-185-129-0_25)",  bg: "var(--rgba-16-185-129-0_06)",  glow: "0 0 12px var(--rgba-16-185-129-0_12)",  label: "Uncommon",  color: "var(--palette-10b981)" },
  rare:      { border: "var(--rgba-59-130-246-0_3)",   bg: "var(--rgba-59-130-246-0_06)",  glow: "0 0 16px var(--rgba-59-130-246-0_15)",  label: "Rare",      color: "var(--color-info)" },
  epic:      { border: "var(--rgba-139-92-246-0_35)",  bg: "var(--rgba-139-92-246-0_08)",  glow: "0 0 20px var(--rgba-139-92-246-0_2)",   label: "Epic",      color: "var(--brand-500)" },
  legendary: { border: "var(--rgba-245-158-11-0_4)",   bg: "var(--rgba-245-158-11-0_08)",  glow: "0 0 28px var(--rgba-245-158-11-0_25)",  label: "Legendary", color: "var(--color-warning)" },
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
        <h3 className="text-sm font-bold text-[var(--foreground)]">{boxType.name}</h3>
        <span className="inline-block mt-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase" style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
          {style.label}
        </span>
        {boxType.premiumOnly && (
          <span className="inline-block mt-1 ml-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase bg-[var(--brand-gold)]/10 text-[var(--brand-gold)] border border-[var(--brand-gold)]/30">
            <Lock size={8} className="inline -mt-px" /> Premium
          </span>
        )}
      </div>

      <p className="text-[11px] text-[var(--foreground-subtle)] text-center mb-4 leading-relaxed">{boxType.description}</p>

      {owned.length > 0 && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--rgba-6-214-160-0_08)] border border-[var(--rgba-6-214-160-0_2)] py-2">
          <Package size={12} className="text-[var(--brand-teal)]" />
          <span className="text-xs font-semibold text-[var(--brand-teal)]">You own {owned.length}</span>
        </div>
      )}

      <div className="space-y-2">
        {owned.length > 0 && (
          <button onClick={() => onOpen(owned[0].id)}
            className="w-full rounded-xl py-2 text-xs font-bold text-[var(--palette-white)] transition-all"
            style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${style.color} 67%, transparent), color-mix(in srgb, ${style.color} 40%, transparent))` }}>
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
          <div className="flex items-center justify-center gap-1 text-[11px] text-[var(--foreground-subtle)]">
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
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-[var(--palette-black)]/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        variants={POP}
        initial="initial"
        animate="animate"
        className="rounded-3xl border border-[var(--rgba-124-58-237-0_4)] bg-[var(--palette-0d0f1c)] p-8 text-center max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.4 }}
          className="text-7xl mb-4"
        >
          {reward.emoji ?? "🎁"}
        </motion.div>
        <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">You got a reward!</h2>
        <p className="text-[var(--brand-400)] font-semibold mb-1">{reward.label}</p>
        <p className="text-sm text-[var(--foreground-subtle)] mb-6">{reward.description}</p>
        <button onClick={onClose} className="w-full rounded-xl bg-[var(--rgba-124-58-237-0_2)] border border-[var(--rgba-124-58-237-0_3)] py-2.5 text-sm font-semibold text-[var(--brand-400)]">
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
  const [loadError, setLoadError] = useState(false);
  const [openedReward, setOpenedReward] = useState<any | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [tr, mr, wr] = await Promise.all([
        fetch("/api/lootboxes/types", { headers: authHeaders() }),
        fetch("/api/lootboxes/mine", { headers: authHeaders() }),
        fetch("/api/gamification/wallet", { headers: authHeaders() }),
      ]);
      if (!tr.ok || !mr.ok || !wr.ok) throw new Error("Unable to load loot boxes");
      setBoxTypes(await tr.json());
      setMyBoxes(await mr.json());
      setWallet(await wr.json());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, []);

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
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--palette-zinc-700)] border-t-[var(--brand-600)]" />
    </div>
  );
  if (loadError) return <ErrorState title="Loot boxes unavailable" onRetry={() => { void load(); }} />;

  return (
    <PageTransition>
      <motion.div variants={PAGE} initial="initial" animate="animate" className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Loot Boxes <span className="text-[var(--color-warning)]">📦</span></h1>
          <p className="text-sm text-[var(--foreground-subtle)]">Earn boxes from sessions, open them for exciting rewards</p>
          {totalOwned > 0 && (
            <motion.div variants={POP} initial="initial" animate="animate"
              className="inline-flex items-center gap-2 mt-3 rounded-full border border-[var(--rgba-6-214-160-0_3)] bg-[var(--rgba-6-214-160-0_08)] px-4 py-1.5 text-sm text-[var(--brand-teal)]">
              <Package size={14} /> {totalOwned} unopened box{totalOwned !== 1 ? "es" : ""}
            </motion.div>
          )}
        </div>

        {wallet && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--rgba-245-158-11-0_2)] bg-[var(--rgba-245-158-11-0_07)] px-4 py-2">
              <span className="text-lg">🪙</span>
              <span className="text-sm font-bold text-[var(--color-warning)]">{wallet.coins.toLocaleString()} coins</span>
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
            <Gift size={40} className="mx-auto mb-3 text-[var(--foreground-subtle)]" />
            <p className="text-sm text-[var(--foreground-subtle)]">No loot box types are configured.</p>
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
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[var(--z-modal)] rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--palette-0d0f1c)] px-5 py-3 text-sm font-semibold text-[var(--brand-400)] shadow-lg">
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PageTransition>
  );
}
