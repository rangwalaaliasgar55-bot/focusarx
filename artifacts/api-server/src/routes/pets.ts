import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import { db, userPetsTable, userWalletsTable } from "@workspace/db";
import { isUserPremium } from "../lib/premiumCheck";
import { eq } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

const PET_XP_PER_LEVEL = 500;

export const PET_TYPES = [
  { id: "owl", name: "Sage Owl", emoji: "🦉", desc: "Wise and calm. Perfect for deep study sessions.", evolutions: ["Owlet", "Wise Owl", "Elder Sage", "Celestial Owl"], premiumOnly: false },
  { id: "fox", name: "Focus Fox", emoji: "🦊", desc: "Sharp and cunning. Thrives on consistency.", evolutions: ["Fox Kit", "Quick Fox", "Silver Fox", "Phantom Fox"], premiumOnly: false },
  { id: "dragon", name: "Study Dragon", emoji: "🐲", desc: "Fierce and powerful. Grows with your ambition.", evolutions: ["Hatchling", "Drake", "Fire Drake", "Legendary Dragon"], premiumOnly: true },
  { id: "robot", name: "Study Bot", emoji: "🤖", desc: "Logical and precise. Optimizes your sessions.", evolutions: ["Prototype", "StudyBot v2", "Neural Bot", "Quantum AI"], premiumOnly: false },
  { id: "cat", name: "Neko Scholar", emoji: "🐱", desc: "Curious and playful. Keeps you motivated.", evolutions: ["Kitten", "Scholar Cat", "Mystic Cat", "Cosmic Neko"], premiumOnly: false },
  { id: "phoenix", name: "Rising Phoenix", emoji: "🦅", desc: "Reborn after every session. Symbolizes growth.", evolutions: ["Fledgling", "Ember Bird", "Phoenix", "Eternal Flame"], premiumOnly: true },
];

router.get("/pets/types", (_req, res) => {
  res.json({ petTypes: PET_TYPES });
});

router.get("/pets", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [pet] = await db.select().from(userPetsTable).where(eq(userPetsTable.userId, req.userId));
    if (!pet) { res.json({ pet: null }); return; }

    const xpToNextLevel = PET_XP_PER_LEVEL * pet.petLevel - pet.petXp;
    const evolutionStage = Math.min(3, Math.floor((pet.petLevel - 1) / 10));
    const type = PET_TYPES.find(p => p.id === pet.petType);
    const evolutionName = type?.evolutions[evolutionStage] ?? pet.petType;

    res.json({ pet: { ...pet, xpToNextLevel, evolutionStage, evolutionName } });
  } catch (err) {
    logger.error({ err }, "get pet error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/pets", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { petType, petName } = req.body as any;
  if (!petType) { res.status(400).json({ error: "petType required" }); return; }
  const validType = PET_TYPES.find(p => p.id === petType);
  if (!validType) { res.status(400).json({ error: "Invalid pet type" }); return; }
  if (validType.premiumOnly && !(await isUserPremium(req.userId!))) {
    return res.status(403).json({ error: "This pet requires Premium" });
  }

  try {
    const [existing] = await db.select().from(userPetsTable).where(eq(userPetsTable.userId, req.userId));
    if (existing) {
      // Allow renaming pet
      const [updated] = await db.update(userPetsTable).set({
        petName: petName || existing.petName,
        updatedAt: new Date(),
      }).where(eq(userPetsTable.userId, req.userId)).returning();
      res.json({ pet: updated });
    } else {
      const [pet] = await db.insert(userPetsTable).values({
        userId: req.userId, petType, petName: petName || validType.name,
        petLevel: 1, petXp: 0, evolutionStage: 1, mood: "happy",
      }).returning();
      res.json({ pet });
    }
  } catch (err) {
    logger.error({ err }, "create pet error");
    res.status(500).json({ error: "Internal error" });
  }
});

// Pet XP is awarded only by trusted server-side session/reward events.
router.post("/pets/award-xp", authMiddleware, (_req: AuthRequest, res: Response) => {
  res.status(410).json({ error: "Direct pet XP awards are no longer supported" });
});

export { router as petsRouter };
