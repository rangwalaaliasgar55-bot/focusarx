import { Router } from "express";
import { z } from "zod";
import { db, flashcardDecksTable, flashcardsTable } from "@workspace/db";
import { eq, and, desc, lte, inArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { isUserPremium } from "../lib/premiumCheck";

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

    // Aggregate per deck, scoped to this user's decks. The previous version
    // grouped the entire flashcards table (all users) twice per request — an
    // unbounded cross-tenant scan.
    const deckIds = decks.map((d) => d.id);
    if (deckIds.length === 0) {
      res.json([]);
      return;
    }
    const counts = await db.select({ deckId: flashcardsTable.deckId, c: sql<number>`count(*)` })
      .from(flashcardsTable)
      .where(inArray(flashcardsTable.deckId, deckIds))
      .groupBy(flashcardsTable.deckId);
    const countMap = new Map(counts.map((c) => [c.deckId, Number(c.c)]));

    const due = await db.select({ deckId: flashcardsTable.deckId, c: sql<number>`count(*)` })
      .from(flashcardsTable)
      .where(and(inArray(flashcardsTable.deckId, deckIds), lte(flashcardsTable.nextReviewAt, new Date())))
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
    if (!await isUserPremium(req.userId)) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(flashcardDecksTable)
        .where(eq(flashcardDecksTable.userId, req.userId));
      if (Number(count) >= 3) { res.status(403).json({ error: "Free accounts can create up to 3 decks. Upgrade to Premium for unlimited decks." }); return; }
    }
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
    const deckId = req.params.id as string;
    const [ownedDeck] = await db.select({ id: flashcardDecksTable.id })
      .from(flashcardDecksTable)
      .where(and(eq(flashcardDecksTable.id, deckId), eq(flashcardDecksTable.userId, req.userId)))
      .limit(1);
    if (!ownedDeck) { res.status(404).json({ error: "Deck not found" }); return; }

    const cards = await db.select().from(flashcardsTable)
      .where(eq(flashcardsTable.deckId, deckId))
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
    const cardId = req.params.id as string;
    const [ownedCard] = await db.select({ id: flashcardsTable.id })
      .from(flashcardsTable)
      .innerJoin(flashcardDecksTable, eq(flashcardsTable.deckId, flashcardDecksTable.id))
      .where(and(eq(flashcardsTable.id, cardId), eq(flashcardDecksTable.userId, req.userId)))
      .limit(1);
    if (!ownedCard) { res.status(404).json({ error: "Card not found" }); return; }

    await db.delete(flashcardsTable).where(eq(flashcardsTable.id, cardId));
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
    const [ownedRow] = await db.select({ card: flashcardsTable })
      .from(flashcardsTable)
      .innerJoin(flashcardDecksTable, eq(flashcardsTable.deckId, flashcardDecksTable.id))
      .where(and(
        eq(flashcardsTable.id, req.params.id as string),
        eq(flashcardDecksTable.userId, req.userId),
      ))
      .limit(1);
    const card = ownedRow?.card;
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

router.post("/flashcards/decks/:id/generate", async (req: AuthRequest, res) => {
  if (!await isUserPremium(req.userId)) return res.status(403).json({ error: "AI flashcard generation requires Premium" });
  const parsed = z.object({ notes: z.string().min(50).max(12_000), count: z.number().int().min(3).max(30).default(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Provide at least 50 characters of notes" });
  const deckId = req.params.id as string;
  const [deck] = await db.select({ id: flashcardDecksTable.id }).from(flashcardDecksTable)
    .where(and(eq(flashcardDecksTable.id, deckId), eq(flashcardDecksTable.userId, req.userId))).limit(1);
  if (!deck) return res.status(404).json({ error: "Deck not found" });
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI generation is not configured" });
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.1-8b-instant", temperature: 0.3, response_format: { type: "json_object" }, messages: [{ role: "user", content: `Create ${parsed.data.count} high-quality flashcards from these notes. Return JSON {"cards":[{"front":"question","back":"answer"}]}. Each card tests one idea. Notes:\n${parsed.data.notes}` }] }),
    });
    if (!response.ok) throw new Error("AI provider failed");
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const generated = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as { cards?: Array<{ front?: string; back?: string }> };
    const cards = (generated.cards ?? []).slice(0, parsed.data.count).filter((card) => card.front?.trim() && card.back?.trim())
      .map((card) => ({ deckId, front: card.front!.trim().slice(0, 500), back: card.back!.trim().slice(0, 1000) }));
    if (!cards.length) throw new Error("No cards generated");
    const inserted = await db.insert(flashcardsTable).values(cards).returning();
    res.status(201).json({ cards: inserted });
  } catch (err) {
    logger.warn({ err }, "AI flashcard generation failed");
    res.status(502).json({ error: "AI flashcards could not be generated" });
  }
});

export { router as flashcardsRouter };
