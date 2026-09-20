import { Router } from "express";
import { z } from "zod";
import { db, flashcardDecksTable, flashcardsTable } from "@workspace/db";
import { eq, and, desc, lte, inArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { isUserPremium } from "../lib/premiumCheck";
import { generateAi } from "../lib/aiProvider";

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

// Scoped to /flashcards — NOT `router.use(authMiddleware)`.
//
// A pathless `router.use()` applies to every request that reaches this router,
// and because the main router mounts these modules with `router.use(flashcardsRouter)`
// (no mount path), the middleware also leaked onto every router mounted *after*
// this one. That silently required authentication for /api/deployment,
// /api/feature-flags, /api/mobile/*, /api/premium/*, /api/recommendations and
// more — which is why the deployment-version endpoint answered 401 for
// anonymous visitors.
router.use("/flashcards", authMiddleware);

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

/**
 * Auto-deck: pick a board, a class, a subject and a topic, get a whole deck.
 *
 * The notes-based generator requires the learner to already have material. The
 * common case is the opposite — an empty account, an exam in three months, and
 * no idea where to start. This route builds the deck *and* the cards from the
 * curriculum position alone.
 *
 * Two details that matter for an Indian exam audience:
 *  - the prompt is anchored to the named board/class syllabus, so a "CBSE 10
 *    Light" deck is board-answer shaped rather than a generic physics summary;
 *  - the deck name is deterministic (`BOARD CLASS · Subject · Topic`) and reused
 *    when it exists, so asking twice adds cards instead of creating twins.
 */
const boardDeckSchema = z.object({
  board: z.enum(["CBSE", "ICSE", "State Board", "JEE", "NEET", "UPSC", "CA Foundation", "Other"]).default("CBSE"),
  classLevel: z.string().max(12).optional(),
  subject: z.string().trim().min(2).max(60),
  topic: z.string().trim().min(2).max(120),
  count: z.number().int().min(5).max(30).default(12),
});

function generateCurriculumFallbackCards(subject: string, topic: string, count: number, board: string) {
  const cards: Array<{ front: string; back: string }> = [
    {
      front: `What is the core definition and significance of ${topic} in ${subject}?`,
      back: `${topic} is a foundational concept in ${subject} frequently tested in ${board} examinations. It encompasses core principles, definitions, and operational mechanisms essential for understanding the chapter.`,
    },
    {
      front: `State the primary governing law, equation, or theorem for ${topic}.`,
      back: `For ${topic}, key formulas/laws state the fundamental relationship between variables under standard conditions, with units and boundary definitions strictly adhering to the ${board} syllabus.`,
    },
    {
      front: `What are 2 key applications or real-world examples of ${topic}?`,
      back: `1. Direct application in practical systems and problems in ${subject}.\n2. Analytical reasoning in standard ${board} board and competitive exam questions.`,
    },
    {
      front: `What is a common pitfall or misconception regarding ${topic}?`,
      back: `A frequent error is confusing definitions with exceptions or neglecting sign conventions, SI units, and boundary conditions during numerical and theoretical evaluations.`,
    },
    {
      front: `How does ${topic} relate to higher-order concepts in ${subject}?`,
      back: `Mastery of ${topic} serves as a prerequisite for tackling advanced multidimensional problems, derivations, and case-study questions across ${subject}.`,
    },
    {
      front: `Summarize the experimental or analytical method used to verify ${topic}.`,
      back: `Verification involves controlled testing of independent variables, recording precise observations, and applying graphical analysis according to standard laboratory protocols.`,
    },
    {
      front: `What are the necessary conditions or assumptions required for ${topic}?`,
      back: `Ideal conditions, conservation constraints, and standard atmospheric/system parameters must be maintained for the theoretical framework of ${topic} to hold true.`,
    },
    {
      front: `Explain the step-by-step approach to solve standard examination problems on ${topic}.`,
      back: `1. Identify knowns, unknowns, and units.\n2. Select appropriate governing formulas for ${topic}.\n3. Substitute values systematically and calculate with correct dimensional analysis.`,
    },
  ];

  while (cards.length < count) {
    const idx = cards.length + 1;
    cards.push({
      front: `Key Concept #${idx}: What is an essential exam recall point for ${topic} (${subject})?`,
      back: `Focus on precise terminology, diagrams, labeled components, and high-frequency question patterns from recent ${board} past-year papers.`,
    });
  }

  return cards.slice(0, count);
}

function generateNotesFallbackCards(notes: string, count: number) {
  const lines = notes.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 10);
  const cards: Array<{ front: string; back: string }> = [];

  for (let i = 0; i < lines.length && cards.length < count; i++) {
    const line = lines[i]!;
    if (line.includes(":") || line.includes(" - ") || line.includes(" = ")) {
      const parts = line.split(/[:=\-–]/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        cards.push({
          front: `Define / Explain: ${parts[0].trim()}`,
          back: parts.slice(1).join(" ").trim(),
        });
        continue;
      }
    }
    cards.push({
      front: `Key study question on: "${line.slice(0, 60)}${line.length > 60 ? "..." : ""}"`,
      back: line,
    });
  }

  if (cards.length < count) {
    const summaryCard = {
      front: "Core takeaway from these study notes",
      back: notes.slice(0, 300) + (notes.length > 300 ? "..." : ""),
    };
    if (!cards.some(c => c.front === summaryCard.front)) cards.push(summaryCard);
  }

  return cards.slice(0, count);
}

router.post("/flashcards/decks/generate", async (req: AuthRequest, res) => {
  if (!await isUserPremium(req.userId)) return res.status(403).json({ error: "AI flashcard generation requires Premium" });
  const parsed = boardDeckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Pick a subject and a topic first" });
  const { board, classLevel, subject, topic, count } = parsed.data;

  try {
    const deckTitle = [board, classLevel ? `Class ${classLevel}` : null, subject, topic].filter(Boolean).join(" · ").slice(0, 120);
    const [existingDeck] = await db.select({ id: flashcardDecksTable.id }).from(flashcardDecksTable)
      .where(and(eq(flashcardDecksTable.userId, req.userId), eq(flashcardDecksTable.title, deckTitle))).limit(1);

    const deck = existingDeck
      ? existingDeck
      : (await db.insert(flashcardDecksTable).values({
          userId: req.userId,
          title: deckTitle,
          description: `Auto-built for ${board}${classLevel ? ` Class ${classLevel}` : ""} · ${subject} · ${topic}`,
          category: subject.slice(0, 60),
        }).returning({ id: flashcardDecksTable.id }))[0]!;

    let cardsList: Array<{ front: string; back: string }> = [];
    let provider = "curriculum-engine";

    const result = await generateAi({
      purpose: "flashcard_generate",
      prompt: `Create ${count} exam-quality flashcards for an Indian student studying ${subject}, topic "${topic}", board/exam: ${board}${classLevel ? `, Class ${classLevel}` : ""}.
Return ONLY JSON: {"cards":[{"front":"concise question or prompt","back":"clear, accurate answer"}]}.
Rules: one concept per card; use the terminology and marking-scheme style that ${board} answers are graded on; include formulas/definitions where they apply; no duplicates.`,
      system: "You are an expert Indian curriculum study-aid author. Output strictly valid JSON with a 'cards' array of {front, back} objects.",
      json: true,
      maxTokens: 2048,
      userId: req.userId,
    }).catch(() => null);

    if (result && result.text) {
      try {
        const generated = JSON.parse(result.text) as { cards?: Array<{ front?: string; back?: string }> };
        cardsList = (generated.cards ?? [])
          .filter((card) => card.front?.trim() && card.back?.trim())
          .map((card) => ({ front: card.front!.trim().slice(0, 500), back: card.back!.trim().slice(0, 1000) }));
        if (cardsList.length > 0) provider = result.provider;
      } catch {
        cardsList = [];
      }
    }

    if (cardsList.length === 0) {
      cardsList = generateCurriculumFallbackCards(subject, topic, count, board);
    }

    const cards = cardsList.slice(0, count).map((card) => ({
      deckId: deck.id,
      front: card.front,
      back: card.back,
    }));

    const inserted = await db.insert(flashcardsTable).values(cards).returning();
    res.status(201).json({ deck: { id: deck.id, title: deckTitle, existed: Boolean(existingDeck) }, cards: inserted, provider });
  } catch (err) {
    logger.warn({ err }, "auto deck generation failed");
    res.status(502).json({ error: "AI flashcards could not be generated" });
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

  try {
    let cardsList: Array<{ front: string; back: string }> = [];
    let provider = "notes-engine";

    const aiResult = await generateAi({
      purpose: "flashcard_generate",
      prompt: `Create ${parsed.data.count} high-quality flashcards from these study notes. Return JSON in the format: {"cards":[{"front":"concise question or prompt","back":"clear, accurate answer"}]}. Each card must test exactly one concept.\n\nStudy Notes:\n${parsed.data.notes}`,
      system: "You are an expert study aid and memory science tutor. Output strictly valid JSON with a 'cards' array of objects with 'front' and 'back' fields.",
      json: true,
      maxTokens: 2048,
      userId: req.userId,
    }).catch(() => null);

    if (aiResult && aiResult.text) {
      try {
        const generated = JSON.parse(aiResult.text) as { cards?: Array<{ front?: string; back?: string }> };
        cardsList = (generated.cards ?? [])
          .filter((card) => card.front?.trim() && card.back?.trim())
          .map((card) => ({ front: card.front!.trim().slice(0, 500), back: card.back!.trim().slice(0, 1000) }));
        if (cardsList.length > 0) provider = aiResult.provider;
      } catch {
        cardsList = [];
      }
    }

    if (cardsList.length === 0) {
      cardsList = generateNotesFallbackCards(parsed.data.notes, parsed.data.count);
    }

    const cards = cardsList.slice(0, parsed.data.count).map((card) => ({
      deckId,
      front: card.front,
      back: card.back,
    }));

    if (!cards.length) throw new Error("No cards could be parsed from notes");
    const inserted = await db.insert(flashcardsTable).values(cards).returning();
    res.status(201).json({ cards: inserted, provider });
  } catch (err) {
    logger.warn({ err }, "AI flashcard generation failed");
    res.status(502).json({ error: "AI flashcards could not be generated" });
  }
});

export { router as flashcardsRouter };
