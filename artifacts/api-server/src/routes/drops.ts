import { Router } from "express";
import { db } from "@workspace/db";
import { adminDropsTable, usersTable, marketplaceItemsTable } from "@workspace/db";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { requireAdmin } from "../lib/adminAuth";
import { generalLimiter, adminLimiter } from "../lib/rateLimiter";
import { logger } from "../lib/logger";
import {
  DROP_TYPES,
  createDrop,
  claimDrop,
  listDrops,
  endDrop,
  duplicateDrop,
  dropClaimSparkline,
  emailBlastForDrop,
  isDropLive,
  type DropType,
} from "../lib/drops";

export const dropsRouter = Router();

// ─── GET /drops — public: live + upcoming drops for the countdown chip ───────

dropsRouter.get("/drops", async (_req, res) => {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 3600 * 1000);
    const drops = await db
      .select()
      .from(adminDropsTable)
      .where(and(
        eq(adminDropsTable.isActive, true),
        isNull(adminDropsTable.cancelledAt),
        gte(adminDropsTable.endsAt, now),
      ))
      .orderBy(desc(adminDropsTable.startsAt))
      .limit(10);

    res.json({
      drops: drops.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        description: d.description,
        payload: d.payload,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        poolTotal: d.poolTotal,
        poolRemaining: d.poolTotal - d.poolClaimed,
        live: isDropLive(d, now),
        upcoming: d.startsAt > now && d.startsAt <= horizon,
      })),
    });
  } catch (err) {
    logger.error({ err }, "get drops error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── POST /drops/:id/claim — authenticated ───────────────────────────────────

dropsRouter.post("/drops/:id/claim", authMiddleware, generalLimiter, async (req: AuthRequest, res) => {
  try {
    const result = await claimDrop(String(req.params.id), req.userId);
    if (!result.ok) {
      res.status(result.code === "not_found" || result.code === "not_live" ? 404 : 409).json({ error: result.error, code: result.code });
      return;
    }
    res.json(result);
  } catch (err) {
    logger.error({ err }, "claim drop error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── Admin: create / list / end / cancel / duplicate ─────────────────────────

dropsRouter.get("/admin/drops", authMiddleware, requireAdmin, adminLimiter, async (_req: AuthRequest, res) => {
  try {
    const drops = await listDrops();
    // Sparklines for the 3 most recent drops.
    const sparklines: Record<string, unknown> = {};
    for (const d of drops.slice(0, 3)) {
      sparklines[d.id] = await dropClaimSparkline(d.id);
    }
    // Item catalogue for the flash-sale picker.
    const items = await db
      .select({ id: marketplaceItemsTable.id, name: marketplaceItemsTable.name, costCoins: marketplaceItemsTable.costCoins })
      .from(marketplaceItemsTable)
      .where(eq(marketplaceItemsTable.isActive, true))
      .orderBy(desc(marketplaceItemsTable.costCoins))
      .limit(60);
    res.json({ drops, sparklines, templates: DROP_TYPES, items });
  } catch (err) {
    logger.error({ err }, "list drops error");
    res.status(500).json({ error: "Internal error" });
  }
});

dropsRouter.post("/admin/drops", authMiddleware, requireAdmin, adminLimiter, async (req: AuthRequest, res) => {
  try {
    const { type, title, description, payload, startsAt, endsAt, emailBlast } = req.body ?? {};
    if (!DROP_TYPES.some((t) => t.type === type)) {
      res.status(400).json({ error: "Unknown drop type" }); return;
    }
    const start = startsAt ? new Date(startsAt) : new Date(Date.now() + 15 * 60 * 1000); // default: live in 15 min
    const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 3 * 3600 * 1000); // default: 3h window
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      res.status(400).json({ error: "Invalid window (endsAt must be after startsAt)" }); return;
    }
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "Title is required" }); return;
    }
    // flash_sale needs a valid item reference
    if (type === "item_flash_sale") {
      const itemId = String(payload?.itemId ?? "");
      const [item] = await db.select({ id: marketplaceItemsTable.id })
        .from(marketplaceItemsTable)
        .where(and(eq(marketplaceItemsTable.id, itemId), eq(marketplaceItemsTable.isActive, true)))
        .limit(1);
      if (!item) { res.status(400).json({ error: "Flash sale needs a valid active item" }); return; }
    }

    const created = await createDrop({
      type: type as DropType,
      title,
      description,
      payload,
      startsAt: start,
      endsAt: end,
      createdById: req.userId,
      createdVia: "admin",
    });

    if (emailBlast) {
      void emailBlastForDrop(created.id).catch((err) => logger.warn({ err }, "drop email blast failed"));
    }
    res.json({ id: created.id, fannedOut: created.fannedOut, emailBlast: emailBlast ? "queued" : "skipped" });
  } catch (err) {
    logger.error({ err }, "create drop error");
    res.status(500).json({ error: "Internal error" });
  }
});

dropsRouter.post("/admin/drops/:id/end", authMiddleware, requireAdmin, adminLimiter, async (req: AuthRequest, res) => {
  try {
    await endDrop(String(req.params.id), false);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "end drop error");
    res.status(500).json({ error: "Internal error" });
  }
});

dropsRouter.post("/admin/drops/:id/cancel", authMiddleware, requireAdmin, adminLimiter, async (req: AuthRequest, res) => {
  try {
    await endDrop(String(req.params.id), true);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "cancel drop error");
    res.status(500).json({ error: "Internal error" });
  }
});

dropsRouter.post("/admin/drops/:id/duplicate", authMiddleware, requireAdmin, adminLimiter, async (req: AuthRequest, res) => {
  try {
    const copy = await duplicateDrop(String(req.params.id));
    if (!copy) { res.status(404).json({ error: "Drop not found" }); return; }
    res.json({ id: copy.id });
  } catch (err) {
    logger.error({ err }, "duplicate drop error");
    res.status(500).json({ error: "Internal error" });
  }
});
