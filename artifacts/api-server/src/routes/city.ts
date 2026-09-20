import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db, focusCitiesTable, cityBuildingDefinitionsTable, userWalletsTable, usersTable, studyStreaksTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { dayKeyInZone, resolveUserZone, shiftDayKey } from "../lib/timezone";
import { eq, sql } from "drizzle-orm";
import { isUserPremium } from "../lib/premiumCheck";
import { burnCoins, mintCoins } from "../lib/coinLedger";
import { advanceSimulationDay, applyGridAction, createCitySimulation, recalculate, SIM_BUILDINGS, SPECIAL_COSTS, TOOL_COSTS, type CitySimulation, type CityTool } from "../lib/citySimulation";

export const CITY_SKINS = [
  { id: "classic", name: "Classic Academy", emoji: "🏛️", premiumOnly: false, gradient: "#0f172a,#312e81" },
  { id: "cosmic", name: "Cosmic Civilization", emoji: "🌌", premiumOnly: true, gradient: "#09001f,#581c87" },
  { id: "neon", name: "Neon Metropolis", emoji: "🌃", premiumOnly: true, gradient: "#020617,#0e7490" },
  { id: "aurora", name: "Aurora Kingdom", emoji: "🌠", premiumOnly: true, gradient: "#052e16,#6d28d9" },
] as const;

export const cityRouter = Router();

export type CityWeather = "clear" | "cloudy" | "rain" | "wind" | "rainbow";

/**
 * Weather is a reflection of the last few days of focus, not a dice roll
 * (it used to be `Math.random()` every four hours, so the "your city reacts
 * to your work" promise was decoration).
 *
 *   rainbow — studied today *and* a 7+ day streak is alive
 *   clear   — studied today
 *   wind    — studied yesterday but not yet today (momentum, about to turn)
 *   cloudy  — 2–3 quiet days
 *   rain    — 4+ quiet days, or never studied
 *
 * Pure so it can be unit-tested; the route supplies the day keys.
 */
export function deriveCityWeather(input: {
  lastStudyDate: string | null;
  currentStreak: number;
  today: string;
  yesterday: string;
}): CityWeather {
  const { lastStudyDate, currentStreak, today, yesterday } = input;
  if (!lastStudyDate) return "rain";
  if (lastStudyDate === today) return currentStreak >= 7 ? "rainbow" : "clear";
  if (lastStudyDate === yesterday) return "wind";
  const quietDays = daysBetween(lastStudyDate, today);
  return quietDays >= 4 ? "rain" : "cloudy";
}

function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  if (![fy, fm, fd, ty, tm, td].every(Number.isFinite)) return 0;
  return Math.round((Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) / 86_400_000);
}

async function currentWeatherFor(userId: string): Promise<CityWeather> {
  const [user] = await db.select({ timezone: usersTable.timezone }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const zone = resolveUserZone(user?.timezone);
  const today = dayKeyInZone(Date.now(), zone);
  const [streak] = await db.select({ lastStudyDate: studyStreaksTable.lastStudyDate, currentStreak: studyStreaksTable.currentStreak })
    .from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId)).limit(1);
  return deriveCityWeather({
    lastStudyDate: streak?.lastStudyDate ?? null,
    currentStreak: streak?.currentStreak ?? 0,
    today,
    yesterday: shiftDayKey(today, -1),
  });
}

function nextTier(sessions: number): string {
  if (sessions >= 350) return "civilization";
  if (sessions >= 175) return "metropolis";
  if (sessions >= 90)  return "city";
  if (sessions >= 40)  return "town";
  if (sessions >= 15)  return "village";
  return "hamlet";
}
function tierName(t: string): string {
  const names: Record<string, string> = {
    hamlet: "Study Hamlet", village: "Focus Village", town: "Learning Town",
    city: "Knowledge City", metropolis: "Wisdom Metropolis", civilization: "Enlightened Civilization",
  };
  return names[t] ?? "Study Hamlet";
}

const CITY_GRID_WIDTH = 10;
const CITY_GRID_HEIGHT = 8;
const MAX_TAX_HOURS = 24;

function isValidPlot(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== "object") return false;
  const { x, y } = value as { x?: unknown; y?: unknown };
  return Number.isInteger(x) && Number.isInteger(y) && Number(x) >= 0 && Number(x) < CITY_GRID_WIDTH
    && Number(y) >= 0 && Number(y) < CITY_GRID_HEIGHT;
}

function normalizeLayout(owned: Record<string, boolean>, stored: Record<string, { x: number; y: number }> | null | undefined) {
  const layout = { ...(stored ?? {}) };
  const occupied = new Set(Object.values(layout).filter(isValidPlot).map((plot) => `${plot.x}:${plot.y}`));
  for (const slug of Object.keys(owned).filter((key) => owned[key]).sort()) {
    if (isValidPlot(layout[slug])) continue;
    for (let index = 0; index < CITY_GRID_WIDTH * CITY_GRID_HEIGHT; index += 1) {
      const position = { x: index % CITY_GRID_WIDTH, y: Math.floor(index / CITY_GRID_WIDTH) };
      if (!occupied.has(`${position.x}:${position.y}`)) { layout[slug] = position; occupied.add(`${position.x}:${position.y}`); break; }
    }
  }
  return layout;
}

/** Coins produced each hour. Population keeps every city productive while
 * buildings provide a visible incentive to keep expanding. */
function taxRate(city: { population: number | null; totalBuildings: number | null; simulation?: unknown }): number {
  const simulation = city.simulation as Partial<CitySimulation> | null | undefined;
  const simulatedNet = Math.max(0, Number(simulation?.daily?.net ?? 0));
  return Math.max(1, Math.floor((city.population ?? 0) / 10) + (city.totalBuildings ?? 0) * 2 + simulatedNet);
}

export function taxSnapshot(city: { population: number | null; totalBuildings: number | null; lastTaxAt: Date | null; simulation?: unknown }, now = new Date()) {
  const ratePerHour = taxRate(city);
  const elapsedHours = Math.max(0, Math.min(MAX_TAX_HOURS, (now.getTime() - (city.lastTaxAt?.getTime() ?? now.getTime())) / 3_600_000));
  return {
    ratePerHour,
    available: Math.floor(ratePerHour * elapsedHours),
    storageHours: MAX_TAX_HOURS,
    nextCoinInSeconds: Math.max(0, Math.ceil(3600 / ratePerHour - ((elapsedHours * 3600) % (3600 / ratePerHour)))),
  };
}

async function getOrCreateCity(userId: string) {
  const existing = await db.select().from(focusCitiesTable).where(eq(focusCitiesTable.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  const [city] = await db.insert(focusCitiesTable).values({
    userId,
    tier: "hamlet",
    tierName: "Study Hamlet",
    weather: await currentWeatherFor(userId),
    weatherUpdatedAt: new Date(),
  }).returning();
  return city;
}

cityRouter.get("/city", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const city = await getOrCreateCity(req.userId);
    // Weather follows behaviour; recompute on every read and persist only when
    // it actually changes so the row keeps a truthful `weatherUpdatedAt`.
    const weather = await currentWeatherFor(req.userId);
    if (weather !== city.weather) {
      await db.update(focusCitiesTable).set({ weather, weatherUpdatedAt: new Date() }).where(eq(focusCitiesTable.id, city.id));
      city.weather = weather;
      city.weatherUpdatedAt = new Date();
    }
    const premium = await isUserPremium(req.userId);
    res.json({
      ...city,
      buildingLayout: normalizeLayout((city.buildings as Record<string, boolean> | null) ?? {}, city.buildingLayout as Record<string, { x: number; y: number }> | null),
      tax: taxSnapshot(city),
      grid: { width: CITY_GRID_WIDTH, height: CITY_GRID_HEIGHT },
      premium,
      skins: CITY_SKINS.map((skin) => ({ ...skin, locked: skin.premiumOnly && !premium })),
    });
  } catch (err) {
    logger.error({ err }, "city load failed");
    res.status(500).json({ error: "Failed to load city" });
  }
});

cityRouter.patch("/city/skin", authMiddleware, async (req: AuthRequest, res: Response) => {
  const skin = CITY_SKINS.find((item) => item.id === (req.body as { skinId?: string }).skinId);
  if (!skin) return res.status(400).json({ error: "Invalid city skin" });
  if (skin.premiumOnly && !await isUserPremium(req.userId)) return res.status(403).json({ error: "This city skin requires Premium" });
  const city = await getOrCreateCity(req.userId);
  const [updated] = await db.update(focusCitiesTable).set({ selectedSkin: skin.id, updatedAt: new Date() })
    .where(eq(focusCitiesTable.id, city.id)).returning();
  res.json({ city: updated, skin });
});

cityRouter.get("/city/buildings", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const defs = await db.select().from(cityBuildingDefinitionsTable).orderBy(cityBuildingDefinitionsTable.sortOrder);
    res.json(defs);
  } catch {
    res.status(500).json({ error: "Failed to load buildings" });
  }
});

function simulationFor(city: { simulation: unknown }): CitySimulation {
  const stored = city.simulation as Partial<CitySimulation> | null;
  return stored?.version === 1 && stored.cells && stored.width && stored.height ? recalculate(stored as CitySimulation) : createCitySimulation();
}

cityRouter.get("/city/simulation", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const city = await getOrCreateCity(req.userId);
    const simulation = simulationFor(city);
    if ((city.simulation as Partial<CitySimulation> | null)?.version !== 1) {
      await db.update(focusCitiesTable).set({ simulation: simulation as unknown as Record<string, unknown>, updatedAt: new Date() }).where(eq(focusCitiesTable.id, city.id));
    }
    res.json({ simulation, catalog: SIM_BUILDINGS, costs: { tools: TOOL_COSTS, specials: SPECIAL_COSTS } });
  } catch (err) {
    logger.error({ err }, "city simulation load failed");
    res.status(500).json({ error: "Failed to load city simulation" });
  }
});

cityRouter.post("/city/simulation/action", authMiddleware, async (req: AuthRequest, res: Response) => {
  const body = req.body as { tool?: string; x?: number; y?: number; building?: string };
  const validTools = new Set(["road", "residential", "commercial", "industrial", "bulldoze", "repair", "special"]);
  if (!body.tool || !validTools.has(body.tool) || !Number.isInteger(body.x) || !Number.isInteger(body.y)) {
    return res.status(400).json({ error: "Invalid city action" });
  }
  try {
    await getOrCreateCity(req.userId);
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM focus_cities WHERE user_id = ${req.userId} FOR UPDATE`);
      const [city] = await tx.select().from(focusCitiesTable).where(eq(focusCitiesTable.userId, req.userId)).limit(1);
      if (!city) throw new Error("City not found");
      const applied = applyGridAction(simulationFor(city), { tool: body.tool as CityTool | "special", x: body.x!, y: body.y!, building: body.building });
      if (applied.cost > 0) {
        const balance = await burnCoins(req.userId, applied.cost, "city_simulation", {
          description: applied.message,
          metadata: { tool: body.tool, building: body.building, x: body.x, y: body.y },
        }, tx);
        if (balance === null) return { insufficient: true as const, required: applied.cost };
        const [updated] = await tx.update(focusCitiesTable).set({ simulation: applied.state as unknown as Record<string, unknown>, population: Math.max(5, applied.state.population), updatedAt: new Date() })
          .where(eq(focusCitiesTable.id, city.id)).returning();
        return { simulation: applied.state, city: updated, newCoins: balance, message: applied.message };
      }
      return { simulation: applied.state, city, newCoins: null, message: applied.message };
    });
    if (result.insufficient) return res.status(400).json({ error: `You need ${result.required} coins for that action` });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "City action failed";
    if (["Invalid city plot", "There is nothing to bulldoze", "That building does not need repairs", "That plot is occupied", "Zones must touch a road", "Service buildings must touch a road", "Unknown service building"].includes(message)) {
      return res.status(400).json({ error: message });
    }
    logger.error({ err }, "city simulation action failed");
    res.status(500).json({ error: "City action failed" });
  }
});

cityRouter.post("/city/simulation/advance", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await getOrCreateCity(req.userId);
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM focus_cities WHERE user_id = ${req.userId} FOR UPDATE`);
      const [city] = await tx.select().from(focusCitiesTable).where(eq(focusCitiesTable.userId, req.userId)).limit(1);
      if (!city) throw new Error("City not found");
      const current = simulationFor(city);
      const simulation = advanceSimulationDay(current, city.id.length + city.totalSessions + current.day);
      const [updated] = await tx.update(focusCitiesTable).set({ simulation: simulation as unknown as Record<string, unknown>, population: Math.max(5, simulation.population), updatedAt: new Date() })
        .where(eq(focusCitiesTable.id, city.id)).returning();
      return { simulation, city: updated };
    });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "city simulation advance failed");
    res.status(500).json({ error: "Failed to advance city day" });
  }
});

cityRouter.patch("/city/buildings/:slug/move", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { slug } = req.params as { slug: string };
  const position = (req.body as { position?: unknown } | undefined)?.position;
  if (!isValidPlot(position)) return res.status(400).json({ error: "Choose a valid city plot" });
  try {
    const city = await getOrCreateCity(req.userId);
    const owned = (city.buildings as Record<string, boolean> | null) ?? {};
    if (!owned[slug]) return res.status(404).json({ error: "Build this property before moving it" });
    const layout = normalizeLayout(owned, city.buildingLayout as Record<string, { x: number; y: number }> | null);
    if (Object.entries(layout).some(([key, plot]) => key !== slug && plot.x === position.x && plot.y === position.y)) {
      return res.status(409).json({ error: "That plot is already occupied" });
    }
    const [updated] = await db.update(focusCitiesTable)
      .set({ buildingLayout: { ...layout, [slug]: position }, updatedAt: new Date() })
      .where(eq(focusCitiesTable.id, city.id)).returning();
    res.json({ city: updated });
  } catch (err) {
    logger.error({ err }, "city building move failed");
    res.status(500).json({ error: "Failed to move building" });
  }
});

cityRouter.post("/city/tax/collect", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.transaction(async (tx) => {
      // Serialize claims for this city so two tabs cannot collect the same tax.
      await tx.execute(sql`SELECT id FROM focus_cities WHERE user_id = ${req.userId} FOR UPDATE`);
      const rows = await tx.select().from(focusCitiesTable).where(eq(focusCitiesTable.userId, req.userId)).limit(1);
      const city = rows[0];
      if (!city) return { unavailable: true as const };
      const now = new Date();
      const tax = taxSnapshot(city, now);
      if (tax.available < 1) return { city, tax, collected: 0, newCoins: null };
      const [updated] = await tx.update(focusCitiesTable).set({ lastTaxAt: now, updatedAt: now })
        .where(eq(focusCitiesTable.id, city.id)).returning();
      const newCoins = await mintCoins(req.userId, tax.available, "city_tax", {
        description: `Collected ${tax.available} coins from Focus City citizens`,
        metadata: { population: city.population, ratePerHour: tax.ratePerHour },
      }, tx);
      return { city: updated, tax: taxSnapshot(updated, now), collected: tax.available, newCoins };
    });
    if (result.unavailable) return res.status(404).json({ error: "City not found" });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "city tax collection failed");
    res.status(500).json({ error: "Failed to collect city tax" });
  }
});

cityRouter.post("/city/buildings/:slug/build", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { slug } = req.params as { slug: string };
  try {
    const [building] = await db.select().from(cityBuildingDefinitionsTable)
      .where(eq(cityBuildingDefinitionsTable.slug, slug)).limit(1);
    if (!building) return res.status(404).json({ error: "Building not found" });

    const city = await getOrCreateCity(req.userId);
    const owned = city.buildings as Record<string, boolean> ?? {};
    if (owned[slug]) return res.status(400).json({ error: "Already built" });

    const requestedPlot = (req.body as { position?: unknown } | undefined)?.position;
    if (requestedPlot !== undefined && !isValidPlot(requestedPlot)) return res.status(400).json({ error: "Choose a valid city plot" });
    const layout = normalizeLayout(owned, city.buildingLayout as Record<string, { x: number; y: number }> | null);
    if (requestedPlot && Object.values(layout).some((plot) => plot.x === requestedPlot.x && plot.y === requestedPlot.y)) {
      return res.status(409).json({ error: "That plot is already occupied" });
    }

    if (building.coinCost > 0) {
      const spent = await burnCoins(req.userId, building.coinCost, "city_building", {
        description: `Built ${building.name} in your Focus City`,
        metadata: { building: slug },
      });
      if (spent === null) return res.status(400).json({ error: "Insufficient coins" });
    }

    const newBuildings = { ...owned, [slug]: true };
    const totalBuildings = Object.keys(newBuildings).length;
    const newPopulation = (city.population ?? 0) + building.populationBonus;
    const newTier = nextTier(city.totalSessions ?? 0);
    const occupied = new Set(Object.values(layout).map((plot) => `${plot.x}:${plot.y}`));
    let position = requestedPlot as { x: number; y: number } | undefined;
    if (!position) {
      for (let y = 0; y < CITY_GRID_HEIGHT && !position; y += 1) {
        for (let x = 0; x < CITY_GRID_WIDTH; x += 1) {
          if (!occupied.has(`${x}:${y}`)) { position = { x, y }; break; }
        }
      }
    }
    if (!position) return res.status(409).json({ error: "Your city grid is full" });

    const [updated] = await db.update(focusCitiesTable).set({
      buildings: newBuildings,
      buildingLayout: { ...layout, [slug]: position },
      totalBuildings,
      population: newPopulation,
      tier: newTier,
      tierName: tierName(newTier),
      updatedAt: new Date(),
    }).where(eq(focusCitiesTable.id, city.id)).returning();

    const [w] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1);
    res.json({ city: updated, newCoins: w?.coins ?? 0 });
  } catch (err) {
    logger.error({ err }, "city build failed");
    res.status(500).json({ error: "Failed to build" });
  }
});
