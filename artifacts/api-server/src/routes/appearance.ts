import { Router, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  petBattlesTable,
  userAppearanceTable,
  userPetInventoryTable,
  petCatalogTable,
} from "@workspace/db";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  BATTLE_DESIGNS,
  DEFAULT_APPEARANCE,
  LAYOUTS,
  PET_DESIGNS,
  TIMER_FACE_IDS,
  TIMER_FACE_LABELS,
  sanitizeAppearancePatch,
  sanitizeBattleReport,
} from "../lib/appearanceCatalog";

/**
 * Design assignment for the signed-in account, and the battle log.
 *
 * Two writers share `user_appearance` (the user and the admin console), so the
 * routes here are deliberately strict about who wins: an admin pin
 * (`locked = true`) makes the user's PUT fail with 409 `appearance_locked`
 * rather than succeed and be overwritten later. A user editing their own row
 * always clears the pin's `source`, but never the pin itself — only the console
 * unlocks.
 */

const router = Router();

/** The catalog the client renders pickers from — one source of truth. */
function catalogPayload() {
  return {
    defaults: DEFAULT_APPEARANCE,
    timerFaces: TIMER_FACE_IDS.map((id) => ({ id, label: TIMER_FACE_LABELS[id] })),
    petDesigns: PET_DESIGNS,
    battleDesigns: BATTLE_DESIGNS,
    layouts: LAYOUTS,
  };
}

async function readAppearance(userId: string) {
  const [row] = await db.select().from(userAppearanceTable).where(eq(userAppearanceTable.userId, userId));
  return row ?? null;
}

/**
 * Shape sent to both clients. `effective` is what the UI must render, and is
 * the only field the readers should use — it already folds a missing row into
 * the catalog defaults, so a client never has to know whether a row exists.
 */
function appearancePayload(row: Awaited<ReturnType<typeof readAppearance>> | null) {
  const effective = {
    timerFace: row?.timerFace ?? DEFAULT_APPEARANCE.timerFace,
    petDesign: row?.petDesign ?? DEFAULT_APPEARANCE.petDesign,
    battleDesign: row?.battleDesign ?? DEFAULT_APPEARANCE.battleDesign,
    layout: row?.layout ?? DEFAULT_APPEARANCE.layout,
  };
  return {
    appearance: effective,
    effective,
    /** True when no row exists yet — the user is still on the defaults. */
    isDefault: !row,
    locked: row?.locked ?? false,
    source: row?.source ?? "default",
    updatedAt: row?.updatedAt ?? null,
  };
}

// GET /api/appearance — the account's design assignment + the catalog.
router.get("/appearance", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const row = await readAppearance(req.userId);
    res.json({ ...appearancePayload(row), catalog: catalogPayload() });
  } catch (err) {
    logger.error({ err }, "get appearance error");
    res.status(500).json({ error: "Internal error" });
  }
});

// PUT /api/appearance — the user's own choice.
router.put("/appearance", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { patch, invalid } = sanitizeAppearancePatch(req.body);
  if (invalid.length > 0) {
    res.status(400).json({ error: "Invalid value", fields: invalid });
    return;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "No known fields to update" });
    return;
  }
  try {
    const existing = await readAppearance(req.userId);
    if (existing?.locked) {
      // Deliberately a 409 with a machine-readable code: the settings UI shows
      // "set by an admin" and must not look like a failed save.
      res.status(409).json({ error: "Your design is managed by an admin", code: "appearance_locked" });
      return;
    }
    const [row] = await db
      .insert(userAppearanceTable)
      .values({ userId: req.userId, ...patch, source: "user", updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userAppearanceTable.userId,
        set: { ...patch, source: "user", updatedAt: new Date() },
      })
      .returning();
    res.json({ ...appearancePayload(row), catalog: catalogPayload() });
  } catch (err) {
    logger.error({ err }, "put appearance error");
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /api/appearance — back to defaults (the user's own choice).
router.delete("/appearance", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await readAppearance(req.userId);
    if (existing?.locked) {
      res.status(409).json({ error: "Your design is managed by an admin", code: "appearance_locked" });
      return;
    }
    await db.delete(userAppearanceTable).where(eq(userAppearanceTable.userId, req.userId));
    res.json({ ...appearancePayload(null), catalog: catalogPayload() });
  } catch (err) {
    logger.error({ err }, "delete appearance error");
    res.status(500).json({ error: "Internal error" });
  }
});

/* ── battles ─────────────────────────────────────────────────────────────── */

// POST /api/appearance/battles — record a finished fight.
router.post("/appearance/battles", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { report, error } = sanitizeBattleReport(req.body);
  if (!report) {
    res.status(400).json({ error: `Invalid battle report: ${error}` });
    return;
  }
  try {
    const [row] = await db
      .insert(petBattlesTable)
      .values({ userId: req.userId, ...report })
      .returning();
    res.status(201).json({ battle: row });
  } catch (err) {
    logger.error({ err }, "post battle error");
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /api/appearance/battles — recent fights + a small summary.
router.get("/appearance/battles", authMiddleware, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  try {
    const rows = await db
      .select()
      .from(petBattlesTable)
      .where(eq(petBattlesTable.userId, req.userId))
      .orderBy(desc(petBattlesTable.createdAt))
      .limit(limit);

    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        wins: sql<number>`count(*) filter (where ${petBattlesTable.result} = 'win')::int`,
        losses: sql<number>`count(*) filter (where ${petBattlesTable.result} = 'loss')::int`,
        design: sql<string>`coalesce(max(${petBattlesTable.design}), 'duel')`,
      })
      .from(petBattlesTable)
      .where(eq(petBattlesTable.userId, req.userId));

    res.json({
      battles: rows,
      summary: {
        total: totals?.total ?? 0,
        wins: totals?.wins ?? 0,
        losses: totals?.losses ?? 0,
        lastDesign: totals?.design ?? DEFAULT_APPEARANCE.battleDesign,
      },
    });
  } catch (err) {
    logger.error({ err }, "get battles error");
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * The opponent the arena offers, drawn from the live catalog.
 *
 * The client could invent a rival, but reading it from the catalog means a
 * battle report's `rivalSlug` is a species that actually exists, and new
 * releases automatically become opponents.
 */
router.get("/appearance/rivals", authMiddleware, async (req: AuthRequest, res: Response) => {
  const limit = Math.min(24, Math.max(3, Number(req.query.limit) || 12));
  try {
    const rows = await db
      .select({
        slug: petCatalogTable.slug,
        name: petCatalogTable.name,
        rarity: petCatalogTable.rarity,
        category: petCatalogTable.category,
        thumbnailUrl: petCatalogTable.thumbnailUrl,
        modelUrl: petCatalogTable.modelUrl,
      })
      .from(petCatalogTable)
      .where(eq(petCatalogTable.isActive, true))
      .orderBy(desc(petCatalogTable.sortOrder))
      .limit(limit);

    // The user's own level drives the level bands the arena offers, so a
    // level-1 companion is not matched against a level-20 legendary.
    const [owned] = await db
      .select({ level: userPetInventoryTable.level })
      .from(userPetInventoryTable)
      .where(and(eq(userPetInventoryTable.userId, req.userId), eq(userPetInventoryTable.isActive, true)))
      .limit(1);

    res.json({ rivals: rows, petLevel: owned?.level ?? 1 });
  } catch (err) {
    logger.error({ err }, "get rivals error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as appearanceRouter };
