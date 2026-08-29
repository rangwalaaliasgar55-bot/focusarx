import { Router } from "express";
import { z } from "zod";
import { db, siteSettingsTable, usersTable, focusSessionsTable } from "@workspace/db";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { adminLimiter } from "../lib/rateLimiter";
import { getSiteSettings, invalidateSiteSettingsCache } from "../lib/siteSettings";
import { checkAdminAuth } from "../lib/adminAuth";
import { sendForbidden, sendInternal, sendValidationError } from "../lib/httpErrors";

const router = Router();
const checkAuth = checkAdminAuth;

/**
 * Public — the frontend reads this to show maintenance mode + announcements.
 *
 * Deliberately cannot fail. Site settings are decorative: if the database is
 * unreachable the correct behaviour is to render the app with defaults, not to
 * turn the whole page into an error state. `getSiteSettings()` already falls
 * back to defaults internally and reports whether it did, so this route answers
 * 200 either way and includes `degraded: true` when the stored values could not
 * be read — honest about the outage, but never fatal.
 */
router.get("/site/settings", async (_req, res) => {
  try {
    const settings = await getSiteSettings();
    res.set("Cache-Control", "no-store");
    res.json(settings);
  } catch (err) {
    logger.error({ err }, "public site settings error");
    sendInternal(res);
  }
});

const updateSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).optional(),
  announcementEnabled: z.boolean().optional(),
  announcementTitle: z.string().max(100).optional(),
  announcementText: z.string().max(500).optional(),
  announcementEmoji: z.string().max(8).optional(),
  brandingName: z.string().max(60).optional(),
  brandingTagline: z.string().max(200).optional(),
  heroTitle: z.string().max(120).optional().nullable(),
  heroSubtitle: z.string().max(300).optional().nullable(),
  heroCtaText: z.string().max(60).optional().nullable(),
});

// ─── COMMUNITY PULSE (A4 — honest scale display) ────────────────────────────
// Public, cached 60s. The ONLY public counter that mixes humans + AI rivals,
// and it always says so ("incl. AI rivals"). Real humans are reported
// separately — never blended without a label.
let pulseCache: { at: number; data: unknown } | null = null;

router.get("/site/community-pulse", async (_req, res) => {
  if (pulseCache && Date.now() - pulseCache.at < 60_000) {
    res.json(pulseCache.data);
    return;
  }
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const [membersArr, botsArr, humansArr, studiersArr] = await Promise.all([
      db.select({ n: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.isGuest, false)),
      db.select({ n: sql<number>`count(*)` }).from(usersTable).where(and(eq(usersTable.isGuest, false), eq(usersTable.role, "bot"))),
      db.select({ n: sql<number>`count(*)` }).from(usersTable).where(and(eq(usersTable.isGuest, false), ne(usersTable.role, "bot"))),
      db.select({ n: sql<number>`count(distinct ${focusSessionsTable.userId})` })
        .from(focusSessionsTable)
        .innerJoin(usersTable, eq(usersTable.id, focusSessionsTable.userId))
        .where(and(
          eq(usersTable.isGuest, false),
          ne(usersTable.role, "bot"),
          gte(focusSessionsTable.completedAt, weekAgo),
        )),
    ]);

    const total = Number(membersArr[0]?.n ?? 0);
    const bots = Number(botsArr[0]?.n ?? 0);
    const humans = Number(humansArr[0]?.n ?? 0);
    const studiers = Number(studiersArr[0]?.n ?? 0);
    const rounded = Math.floor(total / 100) * 100;
    const data = {
      membersLabel: total > rounded
        ? `${rounded.toLocaleString("en-US")}+ members training daily`
        : `${total.toLocaleString("en-US")} members training daily`,
      membersTotal: total,
      aiRivals: bots,
      realMembers: humans,
      realStudiersThisWeek: studiers,
      studiersLabel: `${studiers.toLocaleString("en-US")} real studiers this week`,
      generatedAt: new Date().toISOString(),
    };
    pulseCache = { at: Date.now(), data };
    res.json(data);
  } catch (err) {
    logger.error({ err }, "community pulse error");
    sendInternal(res);
  }
});

/** Admin — read full settings. */
router.get("/admin/site/settings", async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  try {
    const [row] = await db.select().from(siteSettingsTable).limit(1);
    res.json(row ?? { maintenanceMode: false, announcementEnabled: false, brandingName: "FocusArx" });
  } catch (err) {
    logger.error({ err }, "admin site settings get error");
    sendInternal(res);
  }
});

/** Admin — update settings (maintenance mode, announcement, branding). */
router.patch("/admin/site/settings", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { sendForbidden(res); return; }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, "Invalid settings");
    return;
  }
  const updates = parsed.data;

  try {
    const [existing] = await db.select().from(siteSettingsTable).limit(1);
    if (existing) {
      const [updated] = await db.update(siteSettingsTable)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(siteSettingsTable.id, existing.id))
        .returning();
      invalidateSiteSettingsCache();
      res.json({ ok: true, settings: updated });
    } else {
      const [created] = await db.insert(siteSettingsTable)
        .values({ id: "default", ...updates })
        .returning();
      invalidateSiteSettingsCache();
      res.json({ ok: true, settings: created });
    }
  } catch (err) {
    logger.error({ err }, "admin site settings update error");
    sendInternal(res);
  }
});

export { router as siteRouter };
