import { Router, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, userEmotesTable } from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { isUserPremium } from "../lib/premiumCheck";

export const EMOTES = [
  { id: "focus", emoji: "🎯", name: "Locked In", premiumOnly: false },
  { id: "fire", emoji: "🔥", name: "On Fire", premiumOnly: false },
  { id: "brain", emoji: "🧠", name: "Brain Power", premiumOnly: false },
  { id: "clap", emoji: "👏", name: "Well Done", premiumOnly: false },
  { id: "rocket", emoji: "🚀", name: "Launch", premiumOnly: true },
  { id: "crown", emoji: "👑", name: "Focus Royalty", premiumOnly: true },
  { id: "crystal", emoji: "🔮", name: "Deep Vision", premiumOnly: true },
  { id: "phoenix", emoji: "🪽", name: "Rise", premiumOnly: true },
  { id: "galaxy", emoji: "🌌", name: "Cosmic Flow", premiumOnly: true },
  { id: "diamond", emoji: "💎", name: "Unbreakable", premiumOnly: true },
] as const;

const router = Router();
router.use(authMiddleware);

router.get("/emotes", async (req: AuthRequest, res: Response) => {
  const [premium, owned] = await Promise.all([
    isUserPremium(req.userId),
    db.select().from(userEmotesTable).where(eq(userEmotesTable.userId, req.userId)),
  ]);
  const ownedMap = new Map(owned.map((row) => [row.emoteId, row]));
  res.json({
    premium,
    emotes: EMOTES.map((emote) => ({
      ...emote,
      unlocked: !emote.premiumOnly || premium || ownedMap.has(emote.id),
      equipped: ownedMap.get(emote.id)?.equipped ?? false,
    })),
  });
});

router.post("/emotes/:id/equip", async (req: AuthRequest, res: Response) => {
  const emote = EMOTES.find((item) => item.id === req.params.id);
  if (!emote) return res.status(404).json({ error: "Emote not found" });
  if (emote.premiumOnly && !await isUserPremium(req.userId)) {
    return res.status(403).json({ error: "This emote requires Premium" });
  }
  const existing = await db.select().from(userEmotesTable).where(and(
    eq(userEmotesTable.userId, req.userId), eq(userEmotesTable.emoteId, emote.id),
  )).limit(1);
  if (existing[0]) {
    await db.update(userEmotesTable).set({ equipped: true }).where(eq(userEmotesTable.id, existing[0].id));
  } else {
    await db.insert(userEmotesTable).values({ userId: req.userId, emoteId: emote.id, equipped: true });
  }
  res.json({ ok: true, emote });
});

export { router as emotesRouter };
