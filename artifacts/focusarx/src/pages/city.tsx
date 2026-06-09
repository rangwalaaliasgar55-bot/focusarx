import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Building2, Zap, Users, Star, Lock, ShoppingBag, RefreshCw } from "lucide-react";
import { PAGE, CARD, STAGGER } from "@/lib/animations";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

const TIER_CONFIG: Record<string, { label: string; color: string; icon: string; popMin: number; popMax: number }> = {
  hamlet:       { label: "Study Hamlet",       color: "#10B981", icon: "🏘️",  popMin: 0,    popMax: 100   },
  village:      { label: "Focus Village",      color: "#06B6D4", icon: "🏙️",  popMin: 100,  popMax: 500   },
  town:         { label: "Learning Town",      color: "#3B82F6", icon: "🌆",  popMin: 500,  popMax: 1000  },
  city:         { label: "Knowledge City",     color: "#8B5CF6", icon: "🏙️",  popMin: 1000, popMax: 5000  },
  metropolis:   { label: "Wisdom Metropolis",  color: "#EC4899", icon: "🌃",  popMin: 5000, popMax: 10000 },
  civilization: { label: "Enlightened Civilization", color: "#F59E0B", icon: "✨", popMin: 10000, popMax: 50000 },
};

const WEATHER_EMOJI: Record<string, string> = {
  clear: "☀️", cloudy: "☁️", rain: "🌧️", storm: "⛈️", snow: "❄️",
  fog: "🌫️", wind: "💨", rainbow: "🌈",
};

function BuildingCard({ building, owned, onBuy, wallet }: {
  building: any; owned: boolean; onBuy: (b: any) => void; wallet: any;
}) {
  const canAfford = wallet ? wallet.coins >= building.coinCost : false;
  const meetsLevel = wallet ? wallet.level >= building.unlockLevel : false;
  const meetsSession = true; // simplified check

  return (
    <motion.div
      variants={CARD}
      className={`relative rounded-2xl border p-4 transition-all cursor-pointer ${
        owned
          ? "border-[rgba(124,58,237,0.4)] bg-[rgba(124,58,237,0.08)]"
          : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(124,58,237,0.2)]"
      }`}
      onClick={() => !owned && meetsLevel && meetsSession && onBuy(building)}
    >
      {owned && (
        <div className="absolute top-2 right-2 rounded-full bg-[#10B981] px-1.5 py-0.5 text-[9px] font-bold text-white">BUILT</div>
      )}
      {!meetsLevel && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-[#4B5563]">
          <Lock size={9} /> Lv{building.unlockLevel}
        </div>
      )}
      <div className="text-3xl mb-2">{building.icon}</div>
      <h3 className="text-sm font-semibold text-[#E2E8F0] mb-1">{building.name}</h3>
      <p className="text-[10px] text-[#4B5563] mb-3 leading-relaxed">{building.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {building.populationBonus > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.25)] px-1.5 py-0.5 text-[9px] text-[#10B981]">
            <Users size={8} /> +{building.populationBonus} pop
          </span>
        )}
        {building.xpBonusPerSession > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[rgba(124,58,237,0.12)] border border-[rgba(124,58,237,0.25)] px-1.5 py-0.5 text-[9px] text-[#A78BFA]">
            <Zap size={8} /> +{building.xpBonusPerSession} XP/session
          </span>
        )}
        {building.coinBonusPerSession > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.25)] px-1.5 py-0.5 text-[9px] text-[#F59E0B]">
            🪙 +{building.coinBonusPerSession}/session
          </span>
        )}
      </div>

      {!owned && (
        <button
          onClick={(e) => { e.stopPropagation(); meetsLevel && meetsSession && onBuy(building); }}
          disabled={!canAfford || !meetsLevel || !meetsSession}
          className="w-full rounded-xl py-1.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: canAfford && meetsLevel ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
            color: canAfford && meetsLevel ? "#A78BFA" : "#4B5563",
            border: "1px solid",
            borderColor: canAfford && meetsLevel ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.06)",
          }}
        >
          {building.coinCost === 0 ? "Build Free" : `🪙 ${building.coinCost.toLocaleString()}`}
        </button>
      )}
    </motion.div>
  );
}

export default function CityPage() {
  const [city, setCity] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [cr, br, wr] = await Promise.all([
          fetch("/api/city", { headers: authHeaders() }),
          fetch("/api/city/buildings", { headers: authHeaders() }),
          fetch("/api/gamification/wallet", { headers: authHeaders() }),
        ]);
        if (cr.ok) setCity(await cr.json());
        if (br.ok) setBuildings(await br.json());
        if (wr.ok) setWallet(await wr.json());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleBuy = async (b: any) => {
    if (building) return;
    setBuilding(b.slug);
    try {
      const res = await fetch(`/api/city/buildings/${b.slug}/build`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) { setToast(data.error || "Failed to build"); setTimeout(() => setToast(null), 3000); return; }
      setCity(data.city);
      setWallet((w: any) => w ? { ...w, coins: data.newCoins } : w);
      setBuildings(prev => prev.map(x => x.slug === b.slug ? { ...x, _owned: true } : x));
      setToast(`${b.icon} ${b.name} built!`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBuilding(null);
    }
  };

  const tier = city ? TIER_CONFIG[city.tier] ?? TIER_CONFIG.hamlet : TIER_CONFIG.hamlet;
  const categories = ["all", ...Array.from(new Set(buildings.map((b: any) => b.category)))];
  const displayed = filter === "all" ? buildings : buildings.filter((b: any) => b.category === filter);
  const owned = city?.buildings ?? {};

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-[#7C3AED]" />
    </div>
  );

  return (
    <PageTransition>
      <motion.div variants={PAGE} initial="initial" animate="animate" className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="rounded-2xl border border-[rgba(124,58,237,0.2)] bg-gradient-to-br from-[rgba(124,58,237,0.08)] to-[rgba(6,214,160,0.04)] p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-5xl">{tier.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-[#E2E8F0]">{tier.label}</h1>
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase" style={{ color: tier.color, borderColor: tier.color + "40", background: tier.color + "12" }}>
                  {city?.tier ?? "hamlet"}
                </span>
              </div>
              <p className="text-sm text-[#64748B]">Build your academic city — each session adds to your civilization</p>
              <div className="flex flex-wrap gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                  <Users size={12} className="text-[#10B981]" />
                  <span><strong className="text-[#10B981]">{city?.population?.toLocaleString() ?? 0}</strong> citizens</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                  <Building2 size={12} className="text-[#A78BFA]" />
                  <span><strong className="text-[#A78BFA]">{city?.totalBuildings ?? 0}</strong> buildings</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                  <span className="text-lg">{WEATHER_EMOJI[city?.weather ?? "clear"]}</span>
                  <span className="capitalize">{city?.weather ?? "Clear"}</span>
                </div>
              </div>
            </div>
            {wallet && (
              <div className="text-right">
                <p className="text-xs text-[#4B5563]">Your coins</p>
                <p className="text-2xl font-bold text-[#F59E0B]">🪙 {wallet.coins.toLocaleString()}</p>
                <p className="text-[10px] text-[#4B5563]">Level {wallet.level}</p>
              </div>
            )}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition-all ${filter === c ? "bg-[rgba(124,58,237,0.2)] text-[#A78BFA] border border-[rgba(124,58,237,0.3)]" : "bg-[rgba(255,255,255,0.04)] text-[#64748B] border border-transparent hover:border-[rgba(255,255,255,0.08)]"}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Buildings grid */}
        <motion.div variants={STAGGER} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map((b: any) => (
            <BuildingCard key={b.slug} building={b} owned={!!owned[b.slug]} onBuy={handleBuy} wallet={wallet} />
          ))}
        </motion.div>

        {/* Empty state */}
        {buildings.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Building2 size={40} className="text-[#2D3748]" />
            <p className="text-sm text-[#4B5563]">No buildings available yet</p>
          </div>
        )}

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
