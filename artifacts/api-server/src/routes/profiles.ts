import { Router } from "express";
import { db } from "@workspace/db";
import { focusProfilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.userId = userId;
  next();
}

router.get("/profiles", auth, async (req: any, res) => {
  try {
    const profiles = await db.select().from(focusProfilesTable)
      .where(eq(focusProfilesTable.userId, req.userId));
    res.json({ profiles });
  } catch (err) {
    logger.error({ err }, "get profiles error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/profiles", auth, async (req: any, res) => {
  const { name, ssid, blockedDomains, whitelist } = req.body as {
    name?: string; ssid?: string; blockedDomains?: string[]; whitelist?: string[];
  };
  if (!name?.trim()) { res.status(400).json({ error: "Profile name required" }); return; }
  try {
    const [profile] = await db.insert(focusProfilesTable)
      .values({ userId: req.userId, name, ssid: ssid ?? null, blockedDomains: blockedDomains ?? [], whitelist: whitelist ?? [] })
      .returning();
    res.json({ profile });
  } catch (err) {
    logger.error({ err }, "create profile error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.put("/profiles/:id", auth, async (req: any, res) => {
  const { id } = req.params as { id: string };
  const { name, ssid, blockedDomains, whitelist } = req.body as {
    name?: string; ssid?: string; blockedDomains?: string[]; whitelist?: string[];
  };
  try {
    const [profile] = await db.update(focusProfilesTable)
      .set({ name, ssid: ssid ?? null, blockedDomains: blockedDomains ?? [], whitelist: whitelist ?? [] })
      .where(and(eq(focusProfilesTable.id, id), eq(focusProfilesTable.userId, req.userId)))
      .returning();
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
    res.json({ profile });
  } catch (err) {
    logger.error({ err }, "update profile error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.delete("/profiles/:id", auth, async (req: any, res) => {
  const { id } = req.params as { id: string };
  try {
    await db.delete(focusProfilesTable)
      .where(and(eq(focusProfilesTable.id, id), eq(focusProfilesTable.userId, req.userId)));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "delete profile error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/profiles/:id/activate", auth, async (req: any, res) => {
  const { id } = req.params as { id: string };
  try {
    await db.update(focusProfilesTable)
      .set({ isActive: false })
      .where(eq(focusProfilesTable.userId, req.userId));
    const [profile] = await db.update(focusProfilesTable)
      .set({ isActive: true })
      .where(and(eq(focusProfilesTable.id, id), eq(focusProfilesTable.userId, req.userId)))
      .returning();
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
    res.json({ profile });
  } catch (err) {
    logger.error({ err }, "activate profile error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as profilesRouter };
