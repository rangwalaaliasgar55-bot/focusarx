import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { ShoppingBag, Coins, CheckCircle, Filter, Package, Sparkles, Zap } from "lucide-react";

const RARITY_STYLES: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  common:    { label: "Common",    color: "#94A3B8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)", glow: "0 0 0 transparent" },
  uncommon:  { label: "Uncommon",  color: "#10B981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", glow: "0 0 12px rgba(16,185,129,0.15)" },
  rare:      { label: "Rare",      color: "#3B82F6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.3)",  glow: "0 0 16px rgba(59,130,246,0.2)" },
  epic:      { label: "Epic",      color: "#8B5CF6", bg: "rgba(139,92,246,0.1)",   border: "rgba(139,92,246,0.35)", glow: "0 0 20px rgba(139,92,246,0.25)" },
  legendary: { label: "Legendary", color: "#F59E0B", bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.4)",  glow: "0 0 24px rgba(245,158,11,0.3)" },
};

const TYPE_FILTERS = [
  { id: "all",       label: "All",        icon: "🛒" },
  { id: "frame",     label: "Frames",     icon: "🖼️" },
  { id: "avatar",    label: "Avatars",    icon: "👤" },
  { id: "effect",    label: "Effects",    icon: "✨" },
  { id: "accessory", label: "Accessories",icon: "👑" },
  { id: "decoration",label: "City Decor", icon: "🏙️" },
  { id: "booster",   label: "Boosters",   icon: "⚡" },
];

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

export default function MarketplacePage() {
  const [items, setItems] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [itemsRes, walletRes] = await Promise.all([
        fetch("/api/marketplace", { headers: authHeaders() }),
        fetch("/api/gamification", { headers: authHeaders() }),
      ]);
      const itemsData = await itemsRes.json();
      const walletData = await walletRes.json();
      setItems(itemsData.items ?? []);
      setWallet(walletData.wallet ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function purchase(itemId: string) {
    setPurchasing(itemId);
    setError(null);
    try {
      const r = await fetch(`/api/marketplace/${itemId}/purchase`, { method: "POST", headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Purchase failed"); return; }
      setJustBought(itemId);
      setTimeout(() => setJustBought(null), 2000);
      await load();
    } finally {
      setPurchasing(null);
    }
  }

  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);
  const owned = items.filter(i => i.owned).length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7C3AED] border-t-transparent" />
    </div>
  );

  return (
    <PageTransition>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(124,58,237,0.3)] bg-[rgba(124,58,237,0.1)] px-4 py-1.5 mb-3">
                <ShoppingBag size={14} className="text-[#A78BFA]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">Focus Marketplace</span>
              </div>
              <h1 className="text-3xl font-bold text-white">Marketplace</h1>
              <p className="text-[#64748B] text-sm mt-1">Everything earned through effort. No pay-to-win.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] px-4 py-2.5 flex items-center gap-2">
                <span className="text-lg">🪙</span>
                <div>
                  <div className="text-lg font-bold text-[#F59E0B]">{wallet?.coins?.toLocaleString() ?? 0}</div>
                  <div className="text-[10px] text-[#92400E] uppercase tracking-wider">Focus Coins</div>
                </div>
              </div>
              <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-2.5 flex items-center gap-2">
                <Package size={14} className="text-[#64748B]" />
                <div>
                  <div className="text-lg font-bold text-white">{owned}</div>
                  <div className="text-[10px] text-[#4B5563] uppercase tracking-wider">Owned</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] p-3 text-sm text-[#FCA5A5]">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TYPE_FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === f.id
                  ? "bg-[rgba(124,58,237,0.2)] border border-[rgba(124,58,237,0.4)] text-[#A78BFA]"
                  : "border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-[#64748B] hover:text-[#94A3B8]"
              }`}>
              <span>{f.icon}</span> {f.label}
            </button>
          ))}
        </div>

        {/* Items grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item, i) => {
            const rarity = RARITY_STYLES[item.rarity ?? "common"] ?? RARITY_STYLES.common!;
            const canAfford = (wallet?.coins ?? 0) >= item.costCoins;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="rounded-2xl border p-4 flex flex-col gap-3 relative transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: rarity.bg, borderColor: rarity.border, boxShadow: rarity.glow }}>
                {/* Rarity badge */}
                <div className="flex items-center justify-between">
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: rarity.color, background: rarity.bg + "80", border: `1px solid ${rarity.border}` }}>
                    {rarity.label}
                  </span>
                  {item.owned && <CheckCircle size={14} className="text-[#22D387]" />}
                </div>

                <div className="text-4xl text-center">{item.emoji}</div>
                <div>
                  <div className="text-sm font-semibold text-white leading-tight">{item.name}</div>
                  <div className="text-[10px] text-[#64748B] mt-0.5 leading-relaxed">{item.description}</div>
                </div>

                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm font-bold text-[#F59E0B]">
                    🪙 {item.costCoins.toLocaleString()}
                  </div>
                  {item.owned ? (
                    <span className="text-[10px] font-semibold text-[#22D387]">Owned</span>
                  ) : (
                    <button
                      onClick={() => purchase(item.id)}
                      disabled={purchasing === item.id || !canAfford}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        !canAfford
                          ? "bg-[rgba(255,255,255,0.04)] text-[#4B5563] cursor-not-allowed"
                          : justBought === item.id
                          ? "bg-[rgba(34,211,135,0.2)] text-[#22D387]"
                          : "bg-[rgba(124,58,237,0.2)] text-[#A78BFA] hover:bg-[rgba(124,58,237,0.35)] border border-[rgba(124,58,237,0.3)]"
                      }`}>
                      {purchasing === item.id ? "..." : justBought === item.id ? "Bought!" : !canAfford ? "Need coins" : "Buy"}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-[#4B5563]">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No items in this category yet.</p>
          </div>
        )}

        {/* How to earn */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-8 rounded-xl border border-[rgba(124,58,237,0.15)] bg-[rgba(124,58,237,0.05)] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-[#A78BFA]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">How to earn Focus Coins</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-[#64748B]">
            <div>🎯 Complete focus sessions</div>
            <div>🔥 Maintain daily streaks</div>
            <div>🏆 Unlock achievements</div>
            <div>📋 Complete missions</div>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
