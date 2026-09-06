import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";
import { Building2, Zap, Users, Lock, Crown, Sun, Moon, Sparkles, Camera } from "lucide-react";
import { usePremium } from "@/hooks/usePremium";
import { Link } from "wouter";
import { PAGE, CARD, STAGGER } from "@/lib/animations";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
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
/** The sky mirrors recent focus (see api-server routes/city.ts deriveCityWeather). */
const WEATHER_MEANING: Record<string, string> = {
  rainbow: "Studied today on a 7-day streak",
  clear: "You focused today",
  wind: "Yesterday's momentum — focus today to keep it",
  cloudy: "A few quiet days",
  rain: "No focus in a while — one session clears the sky",
};

function BuildingCard({ building, owned, onBuy, wallet, busy }: {
  building: Building; owned: boolean; onBuy: (b: Building) => void; wallet: Wallet | null; busy?: boolean;
}) {
  const canAfford = wallet ? wallet.coins >= building.coinCost : false;
  const meetsLevel = wallet ? wallet.level >= building.unlockLevel : false;
  const meetsSession = true; // simplified check

  // The whole card used to be clickable *and* contain a Buy button: a nested
  // interactive control that keyboard users could never reach. The button owns it.
  return (
    <motion.div
      variants={CARD}
      className={`relative rounded-2xl border p-4 transition-all ${
        owned
          ? "border-[var(--rgba-124-58-237-0_4)] bg-[var(--rgba-124-58-237-0_08)]"
          : "border-[var(--border-subtle)] bg-[var(--muted)]"
      } ${busy ? "opacity-70" : ""}`}
    >
      {owned && (
        <div className="absolute top-2 right-2 rounded-full bg-[var(--palette-10b981)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--palette-white)]">BUILT</div>
      )}
      {!meetsLevel && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[11px] text-[var(--foreground-subtle)]">
          <Lock size={9} /> Lv{building.unlockLevel}
        </div>
      )}
      <div className="text-3xl mb-2">{building.icon}</div>
      <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">{building.name}</h3>
      <p className="text-[11px] text-[var(--foreground-subtle)] mb-3 leading-relaxed">{building.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {building.populationBonus > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--rgba-16-185-129-0_12)] border border-[var(--rgba-16-185-129-0_25)] px-1.5 py-0.5 text-[11px] text-[var(--palette-10b981)]">
            <Users size={8} /> +{building.populationBonus} pop
          </span>
        )}
        {building.xpBonusPerSession > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--rgba-124-58-237-0_12)] border border-[var(--rgba-124-58-237-0_25)] px-1.5 py-0.5 text-[11px] text-[var(--brand-400)]">
            <Zap size={8} /> +{building.xpBonusPerSession} XP/session
          </span>
        )}
        {building.coinBonusPerSession > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--rgba-245-158-11-0_12)] border border-[var(--rgba-245-158-11-0_25)] px-1.5 py-0.5 text-[11px] text-[var(--color-warning)]">
            🪙 +{building.coinBonusPerSession}/session
          </span>
        )}
      </div>

      {!owned && (
        <button
          type="button"
          onClick={() => { if (meetsLevel && meetsSession && !busy) onBuy(building); }}
          disabled={!canAfford || !meetsLevel || !meetsSession || busy}
          aria-label={
            !meetsLevel ? `${building.name} — unlocks at level ${building.unlockLevel}`
              : !canAfford ? `${building.name} — costs ${building.coinCost.toLocaleString()} coins, you need ${(building.coinCost - (wallet?.coins ?? 0)).toLocaleString()} more`
              : `Build ${building.name} for ${building.coinCost.toLocaleString()} coins`
          }
          className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: canAfford && meetsLevel ? "var(--rgba-124-58-237-0_2)" : "var(--rgba-255-255-255-0_04)",
            color: canAfford && meetsLevel ? "var(--brand-400)" : "var(--foreground-subtle)",
            border: "1px solid",
            borderColor: canAfford && meetsLevel ? "var(--rgba-124-58-237-0_3)" : "var(--rgba-255-255-255-0_06)",
          }}
        >
          {busy ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" aria-hidden="true" />
              Building…
            </>
          ) : building.coinCost === 0 ? (
            "Build Free"
          ) : (
            `🪙 ${building.coinCost.toLocaleString()}`
          )}
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
  /** Distinguishes "city failed to load" from "city legitimately has no buildings". */
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [building, setBuilding] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const { isPremium } = usePremium();
  const [selectedWeather, setSelectedWeather] = useState<string>("clear");
  const [selectedTime, setSelectedTime] = useState<string>("day");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadFailed(false);
      try {
        const [cr, br, wr] = await Promise.all([
          fetch("/api/city", { headers: authHeaders() }),
          fetch("/api/city/buildings", { headers: authHeaders() }),
          fetch("/api/gamification/wallet", { headers: authHeaders() }),
        ]);
        if (cancelled) return;
        // A failed /api/city used to leave `city` null, which renders identically
        // to a brand-new account instead of surfacing an error.
        if (!cr.ok && !br.ok) throw new Error("city-unavailable");
        if (cr.ok) setCity(await cr.json());
        if (br.ok) setBuildings(await br.json());
        if (wr.ok) setWallet(await wr.json());
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  /** Keeps toast timers from stacking — an older timer used to clear a newer message. */
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  /** Reads a JSON body safely: `res.json()` throws on an empty or HTML error body. */
  const readBody = async (res: Response): Promise<Record<string, unknown>> => {
    try { return (await res.json()) as Record<string, unknown>; } catch { return {}; }
  };

  const handleBuy = async (b: Building) => {
    if (building) return;
    setBuilding(b.slug);
    try {
      const res = await fetch(`/api/city/buildings/${b.slug}/build`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await readBody(res);
      if (!res.ok) { showToast(typeof data.error === "string" ? data.error : "Failed to build"); return; }
      setCity(data.city as CityView);
      setWallet((w) => w ? { ...w, coins: (data.newCoins as number) ?? w.coins } : w);
      setBuildings(prev => prev.map(x => x.slug === b.slug ? { ...x, _owned: true } : x));
      showToast(`${b.icon} ${b.name} built!`);
    } catch {
      showToast("Couldn't reach the city service — try again");
    } finally {
      setBuilding(null);
    }
  };

  const selectSkin = async (skin: CitySkin) => {
    if (skin.locked) { showToast("Premium unlocks this city skin"); return; }
    try {
      const response = await fetch("/api/city/skin", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ skinId: skin.id }) });
      const data = await readBody(response);
      if (!response.ok) { showToast(typeof data.error === "string" ? data.error : "Could not change city skin"); return; }
      setCity((current) => current ? { ...current, ...(data.city as CityView) } : (data.city as CityView));
      showToast(`${skin.emoji} ${skin.name} applied`);
    } catch {
      showToast("Couldn't reach the city service — try again");
    }
  };

  const tier = city ? TIER_CONFIG[city.tier] ?? TIER_CONFIG.hamlet : TIER_CONFIG.hamlet;
  const selectedSkin = city?.skins?.find((skin) => skin.id === city.selectedSkin) ?? city?.skins?.[0];
  const categories = ["all", ...Array.from(new Set(buildings.map((b: any) => b.category)))];
  const displayed = filter === "all" ? buildings : buildings.filter((b: any) => b.category === filter);
  const owned = city?.buildings ?? {};

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-52 rounded-2xl" />
          ))}
        </div>
        <span className="sr-only" role="status">Loading your city…</span>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ErrorState
          title="Your city didn't load"
          message="We couldn't reach the city service. Your progress is safe — try again in a moment."
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

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
                <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase" style={{ color: tier.color, borderColor: `color-mix(in srgb, ${tier.color} 25%, transparent)`, background: `color-mix(in srgb, ${tier.color} 7%, transparent)` }}>
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
                <div className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]" title={WEATHER_MEANING[city?.weather ?? "clear"]}>
                  <span className="text-lg" aria-hidden>{WEATHER_EMOJI[city?.weather ?? "clear"]}</span>
                  <span className="capitalize">{city?.weather ?? "Clear"}</span>
                  <span className="hidden text-[var(--foreground-subtle)] sm:inline">· {WEATHER_MEANING[city?.weather ?? "clear"]}</span>
                </div>
              </div>
            </div>
            {wallet && (
              <div className="text-right">
                <p className="text-xs text-[var(--foreground-subtle)]">Your coins</p>
                <p className="text-2xl font-bold text-[var(--color-warning)]">🪙 {wallet.coins.toLocaleString()}</p>
                <p className="text-[11px] text-[var(--foreground-subtle)]">Level {wallet.level}</p>
              </div>
            )}
          </div>
        </div>

        {/* Premium City Modes */}
        <section className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Sparkles size={14} /> City appearance & modes</h2>
            {!isPremium && <Link href="/premium" className="inline-flex items-center gap-1 rounded-full bg-[var(--palette-amber-500)]/15 px-2.5 py-1 text-[11px] font-bold text-[var(--palette-amber-400)]"><Crown size={10} /> Premium unlocks night/sunset/weather</Link>}
          </div>

          {/* Time of day */}
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Time of day</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "day", label: "Day", icon: Sun, emoji: "☀️", premium: false },
                { id: "sunset", label: "Sunset", icon: Sun, emoji: "🌅", premium: true },
                { id: "night", label: "Night", icon: Moon, emoji: "🌙", premium: true },
              ].map(({ id, label, emoji, premium }) => (
                <button key={id} onClick={() => { if (premium && !isPremium) { showToast("Premium unlocks sunset & night modes"); return; } setSelectedTime(id); }}
                  className={`rounded-xl border p-3 text-center ${selectedTime===id ? "border-[var(--brand-400)] bg-[var(--brand-soft)]" : "border-[var(--border)]"} ${premium && !isPremium ? "opacity-60" : ""}`}>
                  <span className="text-xl">{emoji}</span>
                  <span className="mt-1 block text-xs font-semibold">{label}</span>
                  {premium && !isPremium && <span className="text-[11px] text-[var(--palette-amber-400)] flex items-center justify-center gap-1"><Lock size={8}/> Premium</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Weather */}
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">Weather & seasons</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "clear", label: "Clear", emoji: "☀️", premium: false },
                { id: "cloudy", label: "Cloudy", emoji: "☁️", premium: false },
                { id: "rain", label: "Rain", emoji: "🌧️", premium: true },
                { id: "snow", label: "Snow", emoji: "❄️", premium: true },
                { id: "sunset_rain", label: "Sunset Rain", emoji: "🌦️", premium: true },
                { id: "aurora", label: "Aurora", emoji: "🌌", premium: true },
                { id: "cherry", label: "Cherry Blossom", emoji: "🌸", premium: true },
                { id: "autumn", label: "Autumn", emoji: "🍂", premium: true },
              ].map((w) => (
                <button key={w.id} onClick={() => { if (w.premium && !isPremium) { showToast("Premium weather requires Premium"); return; } setSelectedWeather(w.id); }}
                  className={`rounded-xl border p-2 text-center ${selectedWeather===w.id ? "border-[var(--brand-400)] bg-[var(--brand-soft)]" : "border-[var(--border)]"} ${w.premium && !isPremium ? "opacity-60" : ""}`}>
                  <span className="text-lg">{w.emoji}</span>
                  <span className="mt-1 block text-[11px] font-semibold">{w.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Skins from server */}
          {city?.skins?.length ? (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">City skins</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {city.skins.map((skin) => <button key={skin.id} type="button" onClick={() => void selectSkin(skin)} aria-pressed={city.selectedSkin === skin.id}
                  className={`min-h-20 rounded-xl border p-3 text-left ${city.selectedSkin === skin.id ? "border-[var(--brand-400)] bg-[var(--brand-soft)]" : "border-[var(--border)]"} ${skin.locked ? "opacity-55" : ""}`}>
                  <span className="text-2xl">{skin.emoji}</span><span className="mt-1 block text-xs font-semibold">{skin.name}</span>{skin.locked && <span className="text-[11px] text-[var(--color-warning)] flex items-center gap-1"><Lock size={8}/> Premium</span>}
                </button>)}
              </div>
            </div>
          ) : null}

          {/* Shareable snapshot — premium */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--forge-border)] bg-[var(--surface-1)] p-3">
            <div>
              <p className="text-xs font-bold flex items-center gap-1"><Camera size={12}/> Shareable snapshot</p>
              <p className="text-[11px] text-[var(--foreground-subtle)]">Export your city as image (Premium)</p>
            </div>
            <button onClick={() => { if (!isPremium) { showToast("Premium unlocks shareable snapshots"); return; } showToast("Snapshot feature — premium skybox captured!"); }}
              className={`rounded-full px-4 py-1.5 text-xs font-bold ${isPremium ? "bg-[var(--brand-600)] text-white" : "bg-[var(--palette-amber-500)]/15 text-[var(--palette-amber-400)]"}`}>
              {isPremium ? "Capture" : "Unlock Premium"}
            </button>
          </div>
        </section>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition-all ${filter === c ? "bg-[var(--rgba-124-58-237-0_2)] text-[var(--brand-400)] border border-[var(--rgba-124-58-237-0_3)]" : "bg-[var(--muted)] text-[var(--muted-fg)] border border-transparent hover:border-[var(--border-subtle)]"}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Buildings grid */}
        <motion.div variants={STAGGER} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map((b: any) => (
            <BuildingCard key={b.slug} building={b} owned={!!owned[b.slug]} onBuy={handleBuy} wallet={wallet} busy={building === b.slug} />
          ))}
        </motion.div>

        {/* Empty states — "no buildings at all" and "this category has none" are different messages */}
        {displayed.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Building2 size={40} className="text-[var(--foreground-subtle)]" />
            {buildings.length === 0 ? (
              <p className="text-sm text-[var(--foreground-subtle)]">No buildings available yet</p>
            ) : (
              <>
                <p className="text-sm text-[var(--foreground-subtle)]">No buildings in “{filter}” yet</p>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Show all buildings
                </button>
              </>
            )}
          </div>
        )}

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              role="status" aria-live="polite"
              className="pointer-events-none fixed bottom-6 left-1/2 z-[var(--z-modal)] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-[var(--rgba-124-58-237-0_3)] bg-[var(--palette-0d0f1c)] px-5 py-3 text-center text-sm font-semibold text-[var(--brand-400)] shadow-lg">
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PageTransition>
  );
}
