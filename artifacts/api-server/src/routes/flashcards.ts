import { Router } from "express";
import { z } from "zod";
import { db, flashcardDecksTable, flashcardsTable } from "@workspace/db";
import { eq, and, desc, lte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { authMiddleware, AuthRequest } from "../middlewares/auth";

const router = Router();

const createDeckSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
  category: z.string().max(60).optional(),
});

const createCardSchema = z.object({
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(1000),
});

/** Leitner box intervals in days: box 1 → 1d, 2 → 3d, 3 → 7d, 4 → 14d, 5 → 30d. */
const BOX_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];

router.use(authMiddleware);

// ─── DECKS ──────────────────────────────────────────────────────────────────

router.get("/flashcards/decks", async (req: AuthRequest, res) => {
  try {
    const decks = await db.select().from(flashcardDecksTable)
      .where(eq(flashcardDecksTable.userId, req.userId))
      .orderBy(desc(flashcardDecksTable.updatedAt));

    // Attach card counts.
    const counts = await db.select({ deckId: flashcardsTable.deckId, c: sql<number>`count(*)` })
      .from(flashcardsTable).groupBy(flashcardsTable.deckId);
    const countMap = new Map(counts.map((c) => [c.deckId, Number(c.c)]));

    const due = await db.select({ deckId: flashcardsTable.deckId, c: sql<number>`count(*)` })
      .from(flashcardsTable)
      .where(lte(flashcardsTable.nextReviewAt, new Date()))
      .groupBy(flashcardsTable.deckId);
    const dueMap = new Map(due.map((d) => [d.deckId, Number(d.c)]));

    res.json(decks.map((d) => ({
      ...d,
      cardCount: countMap.get(d.id) ?? 0,
      dueCount: dueMap.get(d.id) ?? 0,
    })));
  } catch (err) {
    logger.error({ err }, "flashcards decks error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/flashcards/decks", async (req: AuthRequest, res) => {
  const parsed = createDeckSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Title is required" }); return; }
  try {
    const [deck] = await db.insert(flashcardDecksTable).values({
      userId: req.userId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      category: parsed.data.category || "General",
    }).returning();
    res.status(201).json(deck);
  } catch (err) {
    logger.error({ err }, "create deck error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/flashcards/decks/:id", async (req: AuthRequest, res) => {
  try {
    const [deck] = await db.select({ userId: flashcardDecksTable.userId })
      .from(flashcardDecksTable).where(eq(flashcardDecksTable.id, req.params.id as string)).limit(1);
    if (!deck || deck.userId !== req.userId) { res.status(404).json({ error: "Deck not found" }); return; }
    await db.delete(flashcardDecksTable).where(eq(flashcardDecksTable.id, req.params.id as string));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete deck error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── CARDS ──────────────────────────────────────────────────────────────────

router.get("/flashcards/decks/:id/cards", async (req: AuthRequest, res) => {
  try {
    const cards = await db.select().from(flashcardsTable)
      .where(eq(flashcardsTable.deckId, req.params.id as string))
      .orderBy(flashcardsTable.createdAt);
    res.json(cards);
  } catch (err) {
    logger.error({ err }, "flashcards cards error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/flashcards/decks/:id/cards", async (req: AuthRequest, res) => {
  const parsed = createCardSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Front and back are required" }); return; }
  try {
    const [deck] = await db.select({ userId: flashcardDecksTable.userId })
      .from(flashcardDecksTable).where(eq(flashcardDecksTable.id, req.params.id as string)).limit(1);
    if (!deck || deck.userId !== req.userId) { res.status(404).json({ error: "Deck not found" }); return; }

    const [card] = await db.insert(flashcardsTable).values({
      deckId: req.params.id as string,
      front: parsed.data.front,
      back: parsed.data.back,
    }).returning();
    res.status(201).json(card);
  } catch (err) {
    logger.error({ err }, "create card error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/flashcards/cards/:id", async (req: AuthRequest, res) => {
  try {
    await db.delete(flashcardsTable).where(eq(flashcardsTable.id, req.params.id as string));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete card error");
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * Review a card (spaced repetition). `rating` is "again" | "hard" | "good" | "easy".
 * "again" → box 1 (review again in 10 min); otherwise advance the Leitner box.
 */
router.post("/flashcards/cards/:id/review", async (req: AuthRequest, res) => {
  const { rating } = req.body as { rating?: string };
  if (!rating || !["again", "hard", "good", "easy"].includes(rating)) {
    res.status(400).json({ error: "rating must be again|hard|good|easy" }); return;
  }
  try {
    const [card] = await db.select().from(flashcardsTable)
      .where(eq(flashcardsTable.id, req.params.id as string)).limit(1);
    if (!card) { res.status(404).json({ error: "Card not found" }); return; }

    let newBox: number;
    let intervalDays: number;
    if (rating === "again") {
      newBox = 1;
      intervalDays = 0; // 10 minutes from now
    } else if (rating === "hard") {
      newBox = Math.max(1, card.box);
      intervalDays = BOX_INTERVALS_DAYS[newBox] ?? 1;
    } else if (rating === "easy") {
      newBox = Math.min(5, card.box + 2);
      intervalDays = BOX_INTERVALS_DAYS[newBox] ?? 30;
    } else { // good
      newBox = Math.min(5, card.box + 1);
      intervalDays = BOX_INTERVALS_DAYS[newBox] ?? 7;
    }

    const nextReviewAt = new Date(Date.now() + (intervalDays === 0 ? 10 * 60_000 : intervalDays * 86_400_000));
    const correct = rating === "again" ? 0 : 1;

    const [updated] = await db.update(flashcardsTable).set({
      box: newBox,
      nextReviewAt,
      correctCount: sql`correct_count + ${correct}`,
      incorrectCount: sql`incorrect_count + ${correct === 0 ? 1 : 0}`,
    }).where(eq(flashcardsTable.id, card.id)).returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "review card error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as flashcardsRouter };
