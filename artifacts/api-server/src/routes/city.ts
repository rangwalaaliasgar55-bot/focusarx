import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { extractUserId } from "./auth";
import { db, focusCitiesTable, cityBuildingDefinitionsTable, userWalletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isUserPremium } from "../lib/premiumCheck";

export const CITY_SKINS = [
  { id: "classic", name: "Classic Academy", emoji: "🏛️", premiumOnly: false, gradient: "#0f172a,#312e81" },
  { id: "cosmic", name: "Cosmic Civilization", emoji: "🌌", premiumOnly: true, gradient: "#09001f,#581c87" },
  { id: "neon", name: "Neon Metropolis", emoji: "🌃", premiumOnly: true, gradient: "#020617,#0e7490" },
  { id: "aurora", name: "Aurora Kingdom", emoji: "🌠", premiumOnly: true, gradient: "#052e16,#6d28d9" },
] as const;

export const cityRouter = Router();

const WEATHER_TYPES = ["clear", "clear", "clear", "cloudy", "cloudy", "rain", "wind", "rainbow"];

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
    weather: WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)],
  }).returning();
  return city;
}

cityRouter.get("/city", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const city = await getOrCreateCity(req.userId);
    // Rotate weather every 4h
    const weatherAge = Date.now() - new Date(city.weatherUpdatedAt ?? 0).getTime();
    if (weatherAge > 4 * 60 * 60 * 1000) {
      const weather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
      await db.update(focusCitiesTable).set({ weather, weatherUpdatedAt: new Date() }).where(eq(focusCitiesTable.id, city.id));
      city.weather = weather;
    }
    const premium = await isUserPremium(req.userId);
    res.json({ ...city, premium, skins: CITY_SKINS.map((skin) => ({ ...skin, locked: skin.premiumOnly && !premium })) });
  } catch (e) {
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
      const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, req.userId)).limit(1);
      if (!wallet || wallet.coins < building.coinCost) {
        return res.status(400).json({ error: "Insufficient coins" });
      }
      await db.update(userWalletsTable).set({ coins: wallet.coins - building.coinCost }).where(eq(userWalletsTable.userId, req.userId));
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
  } catch (e: any) {
    res.status(500).json({ error: "Failed to build" });
  }
});
