import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Building2, Zap, Users, Star, Lock, ShoppingBag, RefreshCw } from "lucide-react";
import { PAGE, CARD, STAGGER } from "@/lib/animations";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import type { Building, City, Wallet } from "@/types/gamification";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

const TIER_CONFIG: Record<string, { label: string; color: string; icon: string; popMin: number; popMax: number }> = {
  hamlet:       { label: "Study Hamlet",       color: "var(--palette-10b981)", icon: "🏘️",  popMin: 0,    popMax: 100   },
  village:      { label: "Focus Village",      color: "var(--palette-06b6d4)", icon: "🏙️",  popMin: 100,  popMax: 500   },
  town:         { label: "Learning Town",      color: "var(--color-info)", icon: "🌆",  popMin: 500,  popMax: 1000  },
  city:         { label: "Knowledge City",     color: "var(--brand-500)", icon: "🏙️",  popMin: 1000, popMax: 5000  },
  metropolis:   { label: "Wisdom Metropolis",  color: "var(--palette-ec4899)", icon: "🌃",  popMin: 5000, popMax: 10000 },
  civilization: { label: "Enlightened Civilization", color: "var(--color-warning)", icon: "✨", popMin: 10000, popMax: 50000 },
};

const WEATHER_EMOJI: Record<string, string> = {
  clear: "☀️", cloudy: "☁️", rain: "🌧️", storm: "⛈️", snow: "❄️",
  fog: "🌫️", wind: "💨", rainbow: "🌈",
};

function BuildingCard({ building, owned, onBuy, wallet }: {
  building: Building; owned: boolean; onBuy: (b: Building) => void; wallet: Wallet | null;
}) {
  const canAfford = wallet ? wallet.coins >= building.coinCost : false;
  const meetsLevel = wallet ? wallet.level >= building.unlockLevel : false;
  const meetsSession = true; // simplified check

  return (
    <motion.div
      variants={CARD}
      className={`relative rounded-2xl border p-4 transition-all cursor-pointer ${
        owned
          ? "border-[var(--rgba-124-58-237-0_4)] bg-[var(--rgba-124-58-237-0_08)]"
          : "border-[var(--rgba-255-255-255-0_06)] bg-[var(--rgba-255-255-255-0_02)] hover:border-[var(--rgba-124-58-237-0_2)]"
      }`}
      onClick={() => !owned && meetsLevel && meetsSession && onBuy(building)}
    >
      {owned && (
        <div className="absolute top-2 right-2 rounded-full bg-[var(--palette-10b981)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--palette-white)]">BUILT</div>
      )}
      {!meetsLevel && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-[var(--foreground-subtle)]">
          <Lock size={9} /> Lv{building.unlockLevel}
        </div>
      )}
      <div className="text-3xl mb-2">{building.icon}</div>
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">{building.name}</h3>
      <p className="text-[10px] text-[var(--foreground-subtle)] mb-3 leading-relaxed">{building.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {building.populationBonus > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--rgba-16-185-129-0_12)] border border-[var(--rgba-16-185-129-0_25)] px-1.5 py-0.5 text-[9px] text-[var(--palette-10b981)]">
            <Users size={8} /> +{building.populationBonus} pop
          </span>
        )}
        {building.xpBonusPerSession > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--rgba-124-58-237-0_12)] border border-[var(--rgba-124-58-237-0_25)] px-1.5 py-0.5 text-[9px] text-[var(--brand-400)]">
            <Zap size={8} /> +{building.xpBonusPerSession} XP/session
          </span>
        )}
        {building.coinBonusPerSession > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--rgba-245-158-11-0_12)] border border-[var(--rgba-245-158-11-0_25)] px-1.5 py-0.5 text-[9px] text-[var(--color-warning)]">
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
            background: canAfford && meetsLevel ? "var(--rgba-124-58-237-0_2)" : "var(--rgba-255-255-255-0_04)",
            color: canAfford && meetsLevel ? "var(--brand-400)" : "var(--foreground-subtle)",
            border: "1px solid",
            borderColor: canAfford && meetsLevel ? "var(--rgba-124-58-237-0_3)" : "var(--rgba-255-255-255-0_06)",
          }}
        >
          {building.coinCost === 0 ? "Build Free" : `🪙 ${building.coinCost.toLocaleString()}`}
        </button>
      )}
    </motion.div>
  );
}

type CitySkin = { id: string; name: string; emoji: string; gradient: string; premiumOnly: boolean; locked: boolean };
type CityView = City & { selectedSkin?: string; skins?: CitySkin[]; premium?: boolean };

export default function CityPage() {
  const [city, setCity] = useState<CityView | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
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

  const handleBuy = async (b: Building) => {
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
      setWallet((w) => w ? { ...w, coins: data.newCoins } : w);
      setBuildings(prev => prev.map(x => x.slug === b.slug ? { ...x, _owned: true } : x));
      setToast(`${b.icon} ${b.name} built!`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBuilding(null);
    }
  };

  const selectSkin = async (skin: CitySkin) => {
    if (skin.locked) { setToast("Premium unlocks this city skin"); return; }
    const response = await fetch("/api/city/skin", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ skinId: skin.id }) });
    const data = await response.json();
    if (!response.ok) { setToast(data.error ?? "Could not change city skin"); return; }
    setCity((current) => current ? { ...current, ...data.city } : data.city);
  };

  const tier = city ? TIER_CONFIG[city.tier] ?? TIER_CONFIG.hamlet : TIER_CONFIG.hamlet;
  const selectedSkin = city?.skins?.find((skin) => skin.id === city.selectedSkin) ?? city?.skins?.[0];
  const categories = ["all", ...Array.from(new Set(buildings.map((b: any) => b.category)))];
  const displayed = filter === "all" ? buildings : buildings.filter((b: any) => b.category === filter);
  const owned = city?.buildings ?? {};

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--palette-zinc-700)] border-t-[var(--brand-600)]" />
    </div>
  );

  return (
    <PageTransition>
      <PageSEO {...PAGE_SEO.city} />
      <motion.div variants={PAGE} initial="initial" animate="animate" className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="rounded-2xl border border-[var(--rgba-124-58-237-0_2)] p-6" style={{ background: selectedSkin ? `linear-gradient(135deg, ${selectedSkin.gradient})` : undefined }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-5xl">{tier.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-[var(--foreground)]">{tier.label}</h1>
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase" style={{ color: tier.color, borderColor: `color-mix(in srgb, ${tier.color} 25%, transparent)`, background: `color-mix(in srgb, ${tier.color} 7%, transparent)` }}>
                  {city?.tier ?? "hamlet"}
                </span>
              </div>
              <p className="text-sm text-[var(--muted-fg)]">Build your academic city — each session adds to your civilization</p>
              <div className="flex flex-wrap gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                  <Users size={12} className="text-[var(--palette-10b981)]" />
                  <span><strong className="text-[var(--palette-10b981)]">{city?.population?.toLocaleString() ?? 0}</strong> citizens</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                  <Building2 size={12} className="text-[var(--brand-400)]" />
                  <span><strong className="text-[var(--brand-400)]">{city?.totalBuildings ?? 0}</strong> buildings</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
                  <span className="text-lg">{WEATHER_EMOJI[city?.weather ?? "clear"]}</span>
                  <span className="capitalize">{city?.weather ?? "Clear"}</span>
                </div>
              </div>
            </div>
            {wallet && (
              <div className="text-right">
                <p className="text-xs text-[var(--foreground-subtle)]">Your coins</p>
                <p className="text-2xl font-bold text-[var(--color-warning)]">🪙 {wallet.coins.toLocaleString()}</p>
                <p className="text-[10px] text-[var(--foreground-subtle)]">Level {wallet.level}</p>
              </div>
            )}
          </div>
        </div>

        {city?.skins?.length ? (
          <section aria-labelledby="city-skins-title" className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4">
            <h2 id="city-skins-title" className="mb-3 text-sm font-semibold">City appearance</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {city.skins.map((skin) => <button key={skin.id} type="button" onClick={() => void selectSkin(skin)} aria-pressed={city.selectedSkin === skin.id}
                className={`min-h-20 rounded-xl border p-3 text-left ${city.selectedSkin === skin.id ? "border-[var(--brand-400)] bg-[var(--brand-soft)]" : "border-[var(--border)]"} ${skin.locked ? "opacity-55" : ""}`}>
                <span className="text-2xl">{skin.emoji}</span><span className="mt-1 block text-xs font-semibold">{skin.name}</span>{skin.locked && <span className="text-[10px] text-[var(--color-warning)]">Premium</span>}
              </button>)}
            </div>
          </section>
        ) : null}

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition-all ${filter === c ? "bg-[var(--rgba-124-58-237-0_2)] text-[var(--brand-400)] border border-[var(--rgba-124-58-237-0_3)]" : "bg-[var(--rgba-255-255-255-0_04)] text-[var(--muted-fg)] border border-transparent hover:border-[var(--rgba-255-255-255-0_08)]"}`}>
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
            <Building2 size={40} className="text-[var(--foreground-subtle)]" />
            <p className="text-sm text-[var(--foreground-subtle)]">No buildings available yet</p>
          </div>
        )}

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
