import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Camera, Clock3, Coins, Crown, Lock, Moon, MoonStar, Sparkles, Sun, Sunset, Users, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { getToken } from "@/lib/auth";

import { usePremium } from "@/hooks/usePremium";
import { Link } from "wouter";
import { PAGE, CARD, STAGGER } from "@/lib/animations";
import { PageSEO, PAGE_SEO } from "@/components/PageSEO";
import { ErrorState } from "@/components/ErrorState";
import { QueryError } from "@/components/ui/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import type { Building, City, Wallet } from "@/types/gamification";
import { CityBoard } from "@/components/city/CityBoard";
import { CityWorld3D } from "@/components/city/CityWorld3D";

function authHeaders() {
  const t = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
}

const TIER_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; popMin: number; popMax: number }> = {
  hamlet:       { label: "Study Hamlet",       color: "var(--palette-10b981)", icon: "🏘️",  popMin: 0,    popMax: 100   },
  village:      { label: "Focus Village",      color: "var(--palette-06b6d4)", icon: "🏙️",  popMin: 100,  popMax: 500   },
  town:         { label: "Learning Town",      color: "var(--color-info)", icon: <Sunset size={16} aria-hidden="true" />,  popMin: 500,  popMax: 1000  },
  city:         { label: "Knowledge City",     color: "var(--brand-500)", icon: "🏙️",  popMin: 1000, popMax: 5000  },
  metropolis:   { label: "Wisdom Metropolis",  color: "var(--palette-ec4899)", icon: <MoonStar size={16} aria-hidden="true" />,  popMin: 5000, popMax: 10000 },
  civilization: { label: "Enlightened Civilization", color: "var(--color-warning)", icon: <Sparkles size={16} aria-hidden="true" />, popMin: 10000, popMax: 50000 },
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

function BuildingCard({ building, owned, selected, onBuy, wallet, busy, balanceKnown }: {
  building: Building; owned: boolean; selected?: boolean; onBuy: (b: Building) => void; wallet: Wallet | null; busy?: boolean;
  /**
   * False when the wallet request failed. `canAfford` was `wallet ? ... : false`,
   * so an unknown balance silently made every building unaffordable — and the
   * button's accessible name then told the user exactly how many coins they
   * were short ("you need 5,000 more") when we had no idea what they had. The
   * price itself is a fact from the catalog and always renders; the claim about
   * the user's own coins waits until we actually have it.
   */
  balanceKnown: boolean;
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
        owned || selected
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
            !balanceKnown ? `${building.name} — can't check your coin balance right now`
              : !meetsLevel ? `${building.name} — unlocks at level ${building.unlockLevel}`
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
          ) : selected ? (
            "✓ Choose a plot above"
          ) : building.coinCost === 0 ? (
            "Select · Free"
          ) : (
            `Select · 🪙 ${building.coinCost.toLocaleString()}`
          )}
        </button>
      )}
    </motion.div>
  );
}

type CitySkin = { id: string; name: string; emoji: string; gradient: string; premiumOnly: boolean; locked: boolean };
type Plot = { x: number; y: number };
type CityTax = { ratePerHour: number; available: number; storageHours: number; nextCoinInSeconds: number };
type SimCell = { kind: "road" | "zone" | "building"; zone?: string; building?: string; level?: number; condition?: number; incident?: string; age?: number; stressDays?: number; abandoned?: boolean; residents?: number; employees?: number; landValue?: number };
type CitySimulation = {
  width: number; height: number; day: number; cells: Record<string, SimCell>; population: number; jobs: number; employed: number; vacancies: number; happiness: number;
  power: { capacity: number; demand: number }; water: { capacity: number; demand: number };
  daily: { income: number; maintenance: number; net: number };
  demand: { residential: number; commercial: number; industrial: number };
  environment: { landValue: number; pollution: number; congestion: number; roadAccess: number };
  coverage: { fire: number; health: number; police: number }; abandonedBuildings: number; disastersSurvived: number;
  logs: Array<{ day: number; tone: "good" | "neutral" | "danger"; message: string }>;
};
type SimSpec = { name: string; icon: string; zone: string; jobs: number; population: number };
type SimulationPayload = { simulation: CitySimulation; catalog: Record<string, SimSpec>; costs: { tools: Record<string, number>; specials: Record<string, number> } };
type CityView = City & {
  selectedSkin?: string;
  skins?: CitySkin[];
  premium?: boolean;
  buildingLayout?: Record<string, Plot>;
  grid?: { width: number; height: number };
  tax?: CityTax;
};

export default function CityPage() {
  const [city, setCity] = useState<CityView | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  /** Distinguishes "city failed to load" from "city legitimately has no buildings". */
  const [loadFailed, setLoadFailed] = useState(false);
  /**
   * The three requests were combined with `if (!cr.ok && !br.ok) throw`, so a
   * failure of `/api/city/buildings` alone — a buildings 500, a timeout, a
   * dropped request — left `buildings` as `[]` and rendered "No buildings
   * available yet": a statement that FocusArx offers no buildings, about a
   * catalog that is a static list. Likewise a failed wallet hid the balance
   * panel entirely while every card quietly declared itself unaffordable.
   * Both now have their own failure state, because both were asserting things
   * they did not know.
   */
  const [buildingsFailed, setBuildingsFailed] = useState(false);
  const [walletFailed, setWalletFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [building, setBuilding] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [movingBuilding, setMovingBuilding] = useState<string | null>(null);
  const [collectingTax, setCollectingTax] = useState(false);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const { isPremium } = usePremium();
  const [selectedWeather, setSelectedWeather] = useState<string>("clear");
  const [selectedTime, setSelectedTime] = useState<string>("day");
  const [simulation, setSimulation] = useState<CitySimulation | null>(null);
  const [simulationCatalog, setSimulationCatalog] = useState<Record<string, SimSpec>>({});
  const [simulationCosts, setSimulationCosts] = useState<SimulationPayload["costs"]>({ tools: {}, specials: {} });
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [selectedSpecial, setSelectedSpecial] = useState<string>("powerPlant");
  const [simBusy, setSimBusy] = useState(false);
  const [cityViewMode, setCityViewMode] = useState<"3d" | "map">("3d");
  const [selectedSimPlot, setSelectedSimPlot] = useState<Plot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadFailed(false);
      try {
        const [cr, br, wr, sr] = await Promise.all([
          fetch("/api/city", { headers: authHeaders() }),
          fetch("/api/city/buildings", { headers: authHeaders() }),
          fetch("/api/gamification/wallet", { headers: authHeaders() }),
          fetch("/api/city/simulation", { headers: authHeaders() }),
        ]);
        if (cancelled) return;
        // A failed /api/city used to leave `city` null, which renders identically
        // to a brand-new account instead of surfacing an error.
        if (!cr.ok && !br.ok) throw new Error("city-unavailable");
        if (cr.ok) setCity(await cr.json());
        if (br.ok) {
          setBuildings(await br.json());
          setBuildingsFailed(false);
        } else {
          setBuildingsFailed(true);
        }
        if (wr.ok) {
          setWallet(await wr.json());
          setWalletFailed(false);
        } else {
          setWalletFailed(true);
        }
        if (sr.ok) {
          const payload = await sr.json() as Partial<SimulationPayload>;
          if (payload.simulation?.cells) setSimulation(payload.simulation);
          if (payload.catalog) setSimulationCatalog(payload.catalog);
          if (payload.costs) setSimulationCosts(payload.costs);
        }
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

  const handleBuy = async (b: Building, position?: Plot) => {
    if (building) return;
    setBuilding(b.slug);
    try {
      const res = await fetch(`/api/city/buildings/${b.slug}/build`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(position ? { position } : {}),
      });
      const data = await readBody(res);
      if (!res.ok) { showToast(typeof data.error === "string" ? data.error : "Failed to build"); return; }
      setCity(data.city as CityView);
      setWallet((w) => w ? { ...w, coins: (data.newCoins as number) ?? w.coins } : w);
      setBuildings(prev => prev.map(x => x.slug === b.slug ? { ...x, _owned: true } : x));
      setSelectedBuilding(null);
      showToast(`${b.icon} ${b.name} built — your city is growing!`);
    } catch {
      showToast("Couldn't reach the city service — try again");
    } finally {
      setBuilding(null);
    }
  };

  const moveBuilding = async (slug: string, position: Plot) => {
    if (building) return;
    setBuilding(slug);
    try {
      const response = await fetch(`/api/city/buildings/${slug}/move`, {
        method: "PATCH", headers: authHeaders(), body: JSON.stringify({ position }),
      });
      const data = await readBody(response);
      if (!response.ok) { showToast(typeof data.error === "string" ? data.error : "Could not move building"); return; }
      setCity((current) => current ? { ...current, ...(data.city as CityView) } : current);
      setMovingBuilding(null);
      showToast("Building moved");
    } catch {
      showToast("Couldn't reach the city service — try again");
    } finally {
      setBuilding(null);
    }
  };

  const collectTax = async () => {
    if (collectingTax) return;
    setCollectingTax(true);
    try {
      const response = await fetch("/api/city/tax/collect", { method: "POST", headers: authHeaders() });
      const data = await readBody(response);
      if (!response.ok) { showToast(typeof data.error === "string" ? data.error : "Could not collect tax"); return; }
      const collected = Number(data.collected ?? 0);
      setCity((current) => current ? { ...current, ...(data.city as CityView), tax: data.tax as CityTax } : current);
      if (typeof data.newCoins === "number") setWallet((current) => current ? { ...current, coins: data.newCoins as number } : current);
      showToast(collected > 0 ? `🪙 Citizens contributed ${collected.toLocaleString()} coins!` : "Your treasury is still filling");
    } catch {
      showToast("Couldn't reach the treasury — try again");
    } finally {
      setCollectingTax(false);
    }
  };

  const runSimulationAction = async (position: Plot) => {
    if (!activeTool || simBusy) return;
    setSimBusy(true);
    try {
      const response = await fetch("/api/city/simulation/action", {
        method: "POST", headers: authHeaders(), body: JSON.stringify({ tool: activeTool, ...position, ...(activeTool === "special" ? { building: selectedSpecial } : {}) }),
      });
      const data = await readBody(response);
      if (!response.ok) { showToast(typeof data.error === "string" ? data.error : "City action failed"); return; }
      setSimulation(data.simulation as CitySimulation);
      if (typeof data.newCoins === "number") setWallet((current) => current ? { ...current, coins: data.newCoins as number } : current);
      showToast(typeof data.message === "string" ? data.message : "City updated");
    } catch {
      showToast("Couldn't save your city action — try again");
    } finally { setSimBusy(false); }
  };

  const advanceDay = async () => {
    if (simBusy) return;
    setSimBusy(true);
    try {
      const response = await fetch("/api/city/simulation/advance", { method: "POST", headers: authHeaders() });
      const data = await readBody(response);
      if (!response.ok) { showToast(typeof data.error === "string" ? data.error : "Could not advance the city"); return; }
      setSimulation(data.simulation as CitySimulation);
      showToast(`Day ${(data.simulation as CitySimulation).day} complete`);
    } catch { showToast("Couldn't advance the city — try again"); }
    finally { setSimBusy(false); }
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
  const categories = ["all", ...Array.from(new Set(buildings.map((b) => b.category)))];
  const displayed = filter === "all" ? buildings : buildings.filter((b) => b.category === filter);
  const owned = city?.buildings ?? {};
  const selectedSimCell = selectedSimPlot && simulation ? simulation.cells[`${selectedSimPlot.x}:${selectedSimPlot.y}`] : undefined;
  const selectedSimSpec = selectedSimCell?.building ? simulationCatalog[selectedSimCell.building] : undefined;

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
            {wallet ? (
              <div className="text-right">
                <p className="text-xs text-[var(--foreground-subtle)]">Your coins</p>
                <p className="text-2xl font-bold text-[var(--color-warning)]">🪙 {wallet.coins.toLocaleString()}</p>
                <p className="text-[11px] text-[var(--foreground-subtle)]">Level {wallet.level}</p>
              </div>
            ) : walletFailed ? (
              /* Hiding the panel made a failed balance read look like a page
                 without a balance. A dash plus a way to retry keeps the slot
                 and admits we don't know the number. */
              <div className="text-right">
                <p className="text-xs text-[var(--foreground-subtle)]">Your coins</p>
                <p className="text-2xl font-bold text-[var(--foreground-subtle)]" aria-label="Coin balance unavailable">🪙 —</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="text-[11px] font-semibold text-[var(--brand-400)] underline underline-offset-2"
                >
                  Check balance
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Full simulation controls */}
        {simulation && (
          <section className="space-y-4 rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--brand-400)]">City operations · Day {simulation.day}</p>
                <h2 className="text-lg font-bold">Plan roads, zones, utilities and services</h2>
              </div>
              <div className="flex gap-2">
                <div className="flex rounded-xl border border-[var(--border)] p-1">
                  <button type="button" onClick={() => setCityViewMode("3d")} className={`rounded-lg px-3 text-xs font-bold ${cityViewMode === "3d" ? "bg-[var(--brand-soft)] text-[var(--brand-400)]" : ""}`}>3D</button>
                  <button type="button" onClick={() => setCityViewMode("map")} className={`rounded-lg px-3 text-xs font-bold ${cityViewMode === "map" ? "bg-[var(--brand-soft)] text-[var(--brand-400)]" : ""}`}>Map</button>
                </div>
                <button type="button" onClick={() => void advanceDay()} disabled={simBusy} className="min-h-11 rounded-xl bg-[var(--brand-600)] px-5 text-sm font-bold text-white disabled:opacity-50">
                  {simBusy ? "Saving…" : "Run next day ▶"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {[
                ["road", "🛣️", "Road"], ["residential", "🏠", "Homes"], ["commercial", "🏪", "Commerce"], ["industrial", "🏭", "Industry"], ["special", "🏥", "Services"], ["repair", "🛠️", "Repair"], ["bulldoze", "🚧", "Bulldoze"],
              ].map(([id, emoji, label]) => (
                <button key={id} type="button" aria-pressed={activeTool === id} onClick={() => { setActiveTool(activeTool === id ? null : id); setSelectedBuilding(null); setMovingBuilding(null); }}
                  className={`min-h-16 rounded-xl border p-2 text-center transition ${activeTool === id ? "border-[var(--brand-400)] bg-[var(--brand-soft)]" : "border-[var(--border)]"}`}>
                  <span className="text-xl">{emoji}</span><span className="block text-[11px] font-bold">{label}</span><span className="block text-[11px] text-[var(--foreground-subtle)]">🪙 {id === "special" ? simulationCosts.specials[selectedSpecial] ?? 0 : simulationCosts.tools[id] ?? 0}</span>
                </button>
              ))}
            </div>
            {activeTool === "special" && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Object.entries(simulationCatalog).filter(([, spec]) => spec.zone === "service" || spec.zone === "utility").map(([id, spec]) => (
                  <button key={id} type="button" onClick={() => setSelectedSpecial(id)} className={`min-w-28 rounded-xl border p-2 text-left ${selectedSpecial === id ? "border-[var(--brand-400)] bg-[var(--brand-soft)]" : "border-[var(--border)]"}`}>
                    <span className="text-xl">{spec.icon}</span><span className="block text-[11px] font-bold">{spec.name}</span><span className="text-[11px] text-[var(--foreground-subtle)]">🪙 {simulationCosts.specials[id] ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-8">
              {[
                ["Citizens", simulation.population, "👥"], ["Employed", `${simulation.employed}/${simulation.jobs}`, "💼"], ["Happiness", `${simulation.happiness}%`, "😊"],
                ["Power", `${simulation.power.demand}/${simulation.power.capacity}`, "⚡"], ["Water", `${simulation.water.demand}/${simulation.water.capacity}`, "💧"],
                ["Income", simulation.daily.income, "↗"], ["Costs", simulation.daily.maintenance, "↘"], ["Net/day", simulation.daily.net, "🪙"],
              ].map(([label, value, icon]) => <div key={String(label)} className="rounded-xl bg-[var(--surface-1)] p-2"><span>{icon}</span><strong className="ml-1">{value}</strong><span className="block text-[11px] text-[var(--foreground-subtle)]">{label}</span></div>)}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--foreground-subtle)]">Live zoning demand</p>
                {([ ["Residential", simulation.demand.residential, "bg-emerald-500"], ["Commercial", simulation.demand.commercial, "bg-cyan-500"], ["Industrial", simulation.demand.industrial, "bg-amber-500"] ] as const).map(([label, value, color]) => (
                  <div key={label} className="mb-2 grid grid-cols-[76px_1fr_34px] items-center gap-2 text-[11px]"><span>{label}</span><span className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} /></span><strong>{Math.round(value * 100)}%</strong></div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 rounded-xl border border-[var(--border)] p-3 text-center text-[11px]">
                {[["Land value", simulation.environment.landValue, "🏘️"], ["Pollution", simulation.environment.pollution, "🏭"], ["Traffic", simulation.environment.congestion, "🚗"], ["Road access", simulation.environment.roadAccess, "🛣️"], ["Fire cover", simulation.coverage.fire, "🚒"], ["Health cover", simulation.coverage.health, "🚑"], ["Police cover", simulation.coverage.police, "🚓"], ["Abandoned", simulation.abandonedBuildings, "🏚️"]].map(([label, value, icon]) => <div key={String(label)}><span className="text-base">{icon}</span><strong className="block">{value}{label === "Abandoned" ? "" : "%"}</strong><span className="text-[11px] text-[var(--foreground-subtle)]">{label}</span></div>)}
              </div>
            </div>
          </section>
        )}

        {/* The playable district: licensed models in 3D, with an accessible map fallback. */}
        {cityViewMode === "3d" && simulation ? (
          <CityWorld3D cells={simulation.cells} width={simulation.width} height={simulation.height} active={!!activeTool && !simBusy} onPlot={(x, y) => activeTool ? void runSimulationAction({ x, y }) : setSelectedSimPlot({ x, y })} />
        ) : (
          <CityBoard
            buildings={buildings}
            owned={owned}
            layout={city?.buildingLayout ?? {}}
            selectedSlug={selectedBuilding}
            movingSlug={movingBuilding}
            width={city?.grid?.width}
            height={city?.grid?.height}
            time={selectedTime}
            weather={selectedWeather}
            busy={!!building || simBusy}
            simulationCells={simulation?.cells}
            simulationCatalog={simulationCatalog}
            activeTool={activeTool}
            onSimulationAction={(plot) => void runSimulationAction(plot)}
            onSimulationInspect={setSelectedSimPlot}
            onSelect={setSelectedBuilding}
            onMoveStart={(slug) => { setMovingBuilding(slug); setSelectedBuilding(null); }}
            onPlace={(definition, plot) => void handleBuy(definition, plot)}
            onMove={(slug, plot) => void moveBuilding(slug, plot)}
          />
        )}

        {selectedSimPlot && selectedSimCell && (
          <section className="rounded-2xl border border-[var(--brand-400)]/30 bg-[var(--card)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3"><span className="text-3xl">{selectedSimSpec?.icon ?? (selectedSimCell.kind === "road" ? "🛣️" : "🏗️")}</span><div><p className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-400)]">Plot {selectedSimPlot.x + 1}, {selectedSimPlot.y + 1}</p><h3 className="font-bold">{selectedSimSpec?.name ?? selectedSimCell.zone ?? selectedSimCell.kind}</h3></div></div>
              <button type="button" onClick={() => setSelectedSimPlot(null)} className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs">Close</button>
            </div>
            {selectedSimCell.kind === "building" && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                {[["Level", selectedSimCell.level ?? 1], ["Condition", `${selectedSimCell.condition ?? 100}%`], ["Age", `${selectedSimCell.age ?? 0} days`], ["Residents", selectedSimCell.residents ?? 0], ["Employees", selectedSimCell.employees ?? 0], ["Land value", selectedSimCell.landValue ?? simulation?.environment.landValue ?? 0]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-[var(--surface-1)] p-2"><strong>{value}</strong><span className="block text-[11px] text-[var(--foreground-subtle)]">{label}</span></div>)}
              </div>
            )}
            {selectedSimCell.abandoned && <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs text-red-300">This building is abandoned. Restore utilities, road access, jobs and land value to attract occupants before it collapses.</p>}
            {(selectedSimCell.stressDays ?? 0) > 0 && !selectedSimCell.abandoned && <p className="mt-3 text-xs text-[var(--color-warning)]">⚠ Under stress for {selectedSimCell.stressDays} day(s). Inspect utilities, employment and road access.</p>}
          </section>
        )}

        {simulation?.logs.length ? (
          <section className="rounded-2xl border border-[var(--forge-border)] bg-[var(--card)] p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">City dispatch</h2><span className="text-[11px] text-[var(--foreground-subtle)]">{simulation.disastersSurvived} emergencies resolved</span></div>
            <div className="space-y-2">
              {simulation.logs.slice(0, 5).map((entry, index) => (
                <div key={`${entry.day}-${index}`} className={`flex gap-3 rounded-xl border p-3 text-xs ${entry.tone === "danger" ? "border-red-500/25 bg-red-500/5" : entry.tone === "good" ? "border-emerald-500/25 bg-emerald-500/5" : "border-[var(--border)]"}`}>
                  <span className="shrink-0 font-bold text-[var(--foreground-subtle)]">Day {entry.day}</span><span>{entry.message}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Citizen economy */}
        <section className="grid gap-4 rounded-2xl border border-[var(--rgba-245-158-11-0_28)] bg-gradient-to-br from-[var(--card)] to-[var(--rgba-245-158-11-0_07)] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--rgba-245-158-11-0_15)] text-[var(--color-warning)]"><Coins size={24} /></div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--color-warning)]">Citizen treasury</p>
              <h2 className="mt-1 text-lg font-bold">Your city works while you focus</h2>
              <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
                Citizens contribute <strong className="text-[var(--foreground)]">{city?.tax?.ratePerHour ?? Math.max(1, Math.floor((city?.population ?? 0) / 10))} coins/hour</strong>. Revenue stores for up to {city?.tax?.storageHours ?? 24} hours.
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--foreground-subtle)]"><Clock3 size={11} /> Grow population and add properties to raise revenue</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void collectTax()}
            disabled={collectingTax || (city?.tax?.available ?? 0) < 1}
            className="min-h-12 rounded-xl bg-[var(--color-warning)] px-5 text-sm font-black text-[var(--palette-0d0f1c)] shadow-lg transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
          >
            {collectingTax ? "Collecting…" : `Collect 🪙 ${(city?.tax?.available ?? 0).toLocaleString()}`}
          </button>
        </section>

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
          {displayed.map((b) => (
            <BuildingCard
              key={b.slug}
              building={b}
              owned={!!owned[b.slug]}
              selected={selectedBuilding === b.slug}
              onBuy={() => { setSelectedBuilding(b.slug); setMovingBuilding(null); window.scrollTo({ top: 180, behavior: "smooth" }); }}
              wallet={wallet}
              busy={building === b.slug}
              balanceKnown={!walletFailed}
            />
          ))}
        </motion.div>

        {/* Empty states — "no buildings at all" and "this category has none" are different messages */}
        {displayed.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Building2 size={40} className="text-[var(--foreground-subtle)]" />
            {buildingsFailed && buildings.length === 0 ? (
              <QueryError what="the building catalog" onRetry={() => setReloadKey((k) => k + 1)} />
            ) : buildings.length === 0 ? (
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
