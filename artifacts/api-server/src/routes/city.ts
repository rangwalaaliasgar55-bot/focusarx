import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db, focusCitiesTable, cityBuildingDefinitionsTable, userWalletsTable, usersTable, studyStreaksTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { dayKeyInZone, resolveUserZone, shiftDayKey } from "../lib/timezone";
import { eq } from "drizzle-orm";
import { isUserPremium } from "../lib/premiumCheck";
import { burnCoins } from "../lib/coinLedger";

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
    res.json({ ...city, premium, skins: CITY_SKINS.map((skin) => ({ ...skin, locked: skin.premiumOnly && !premium })) });
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

cityRouter.post("/city/buildings/:slug/build", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { slug } = req.params as { slug: string };
  try {
    const [building] = await db.select().from(cityBuildingDefinitionsTable)
      .where(eq(cityBuildingDefinitionsTable.slug, slug)).limit(1);
    if (!building) return res.status(404).json({ error: "Building not found" });

    const city = await getOrCreateCity(req.userId);
    const owned = city.buildings as Record<string, boolean> ?? {};
    if (owned[slug]) return res.status(400).json({ error: "Already built" });

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

    const [updated] = await db.update(focusCitiesTable).set({
      buildings: newBuildings,
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
