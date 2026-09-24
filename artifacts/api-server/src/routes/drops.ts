import { Router } from "express";
import { db } from "@workspace/db";
import { adminDropsTable, adminDropClaimsTable, marketplaceItemsTable } from "@workspace/db";
import { and, desc, eq, gt, gte, inArray, isNull, lt } from "drizzle-orm";
import { authMiddleware, optionalAuthMiddleware, type AuthRequest } from "../middlewares/auth";
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

dropsRouter.get("/drops", optionalAuthMiddleware, async (req, res) => {
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

    // The public list is still public, but an authenticated visitor should not
    // be shown a dead "Claim" button after a reload. Include only that user's
    // claim ids; no reward or other-user data leaves the server.
    const userId = (req as AuthRequest).userId;
    const claimedIds = userId && drops.length > 0
      ? new Set((await db.select({ dropId: adminDropClaimsTable.dropId })
          .from(adminDropClaimsTable)
          .where(and(
            eq(adminDropClaimsTable.userId, userId),
            inArray(adminDropClaimsTable.dropId, drops.map((drop) => drop.id)),
          ))).map((row) => row.dropId))
      : new Set<string>();

    // A sale drop used to expose only an opaque item id, so the member-facing
    // banner could say little more than "Flash sale". Return the small,
    // public catalogue summary needed to explain what is actually discounted;
    // never expose inventory, owner, or internal item metadata here.
    const saleItemIds = [...new Set(drops
      .filter((drop) => drop.type === "item_flash_sale")
      .map((drop) => String(drop.payload?.itemId ?? ""))
      .filter(Boolean))];
    const saleItems = saleItemIds.length > 0
      ? await db.select({ id: marketplaceItemsTable.id, name: marketplaceItemsTable.name, emoji: marketplaceItemsTable.emoji, costCoins: marketplaceItemsTable.costCoins })
        .from(marketplaceItemsTable)
        .where(and(inArray(marketplaceItemsTable.id, saleItemIds), eq(marketplaceItemsTable.isActive, true)))
      : [];
    const saleItemsById = new Map(saleItems.map((item) => [item.id, item]));

    res.json({
      drops: drops.map((d) => ({
        ...(() => {
          const item = d.type === "item_flash_sale" ? saleItemsById.get(String(d.payload?.itemId ?? "")) : undefined;
          const discountPct = Math.min(70, Math.max(0, Number(d.payload?.discountPct) || 0));
          return item ? {
            saleItem: {
              name: item.name,
              emoji: item.emoji,
              price: item.costCoins,
              salePrice: Math.max(1, Math.round(item.costCoins * (100 - discountPct) / 100)),
            },
          } : {};
        })(),
        id: d.id,
        type: d.type,
        title: d.title,
        description: d.description,
        payload: d.payload,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        poolTotal: d.poolTotal,
        poolRemaining: Math.max(0, d.poolTotal - d.poolClaimed),
        live: isDropLive(d, now),
        upcoming: d.startsAt > now && d.startsAt <= horizon,
        claimed: claimedIds.has(d.id),
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

    // The member UI deliberately foregrounds one event and collapses the rest.
    // Keep the operational side humane too: more than three simultaneous
    // campaigns means competing push/email messages and unclear rewards.
    const overlaps = await db.select({ id: adminDropsTable.id })
      .from(adminDropsTable)
      .where(and(
        eq(adminDropsTable.isActive, true),
        isNull(adminDropsTable.cancelledAt),
        lt(adminDropsTable.startsAt, end),
        gt(adminDropsTable.endsAt, start),
      ))
      .limit(3);
    if (overlaps.length >= 3) {
      res.status(409).json({ error: "This window already has three active events. End, cancel, or reschedule one before adding another." }); return;
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
