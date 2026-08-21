import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db, siteSettingsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getServerConfig } from "../lib/config";
import { extractUserId } from "./auth";
import { adminLimiter } from "../lib/rateLimiter";
import { getSiteSettings, invalidateSiteSettingsCache } from "../lib/siteSettings";

const router = Router();
const ADMIN_COOKIE = "focusarx_admin";

function isAdminAuthed(req: { headers: { cookie?: string } }): boolean {
  const secret = getServerConfig().jwtSecret;
  if (!secret) return false;
  const match = (req.headers.cookie ?? "").match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  const token = match?.[1];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, secret) as { role?: string };
    return payload?.role === "admin_session";
  } catch {
    return false;
  }
}

async function checkAuth(req: { headers: { cookie?: string; authorization?: string } }): Promise<boolean> {
  if (isAdminAuthed(req)) return true;
  const userId = extractUserId(req);
  if (!userId) return false;
  try {
    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
    return user?.role?.toLowerCase() === "admin";
  } catch {
    return false;
  }
}

/** Public — the frontend reads this to show maintenance mode + announcements. */
router.get("/site/settings", async (_req, res) => {
  try {
    res.json(await getSiteSettings());
  } catch (err) {
    logger.error({ err }, "public site settings error");
    res.status(500).json({ error: "Internal error" });
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

/** Admin — read full settings. */
router.get("/admin/site/settings", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const [row] = await db.select().from(siteSettingsTable).limit(1);
    res.json(row ?? { maintenanceMode: false, announcementEnabled: false, brandingName: "FocusArx" });
  } catch (err) {
    logger.error({ err }, "admin site settings get error");
    res.status(500).json({ error: "Internal error" });
  }
});

/** Admin — update settings (maintenance mode, announcement, branding). */
router.patch("/admin/site/settings", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings", details: parsed.error.errors });
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
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as siteRouter };
