import { Router } from "express";
import { db, roadmapsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import jwt from "jsonwebtoken";
import { getServerConfig } from "../lib/config";
import { aiRoadmapLimiter } from "../lib/rateLimiter";

const router = Router();

function extractUserId(req: any): string | null {
  const header: string = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const config = getServerConfig();
    if (!config.jwtSecret) return null;
    const payload = jwt.verify(token, config.jwtSecret) as { sub?: string };
    return payload?.sub ?? null;
  } catch { return null; }
}

router.post("/roadmap/save", aiRoadmapLimiter, async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { subject, data } = req.body as { subject?: string; data?: unknown };
  if (!subject || !data) { res.status(400).json({ error: "subject and data are required" }); return; }
  try {
    const [saved] = await db.insert(roadmapsTable).values({ userId, subject, data }).returning();
    res.json({ ok: true, id: saved?.id });
  } catch (err) {
    logger.error({ err }, "roadmap save error");
    res.status(500).json({ error: "Failed to save roadmap" });
  }
});

router.get("/roadmap/list", async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const rows = await db.select({
      id: roadmapsTable.id,
      subject: roadmapsTable.subject,
      createdAt: roadmapsTable.createdAt,
    }).from(roadmapsTable)
      .where(eq(roadmapsTable.userId, userId))
      .orderBy(desc(roadmapsTable.createdAt))
      .limit(20);
    res.json({ roadmaps: rows });
  } catch (err) {
    logger.error({ err }, "roadmap list error");
    res.status(500).json({ error: "Failed to load roadmaps" });
  }
});

router.get("/roadmap/:id", async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { id } = req.params as { id: string };
  try {
    const [row] = await db.select().from(roadmapsTable)
      .where(eq(roadmapsTable.id, id));
    if (!row || row.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ roadmap: row });
  } catch (err) {
    logger.error({ err }, "roadmap get error");
    res.status(500).json({ error: "Failed to load roadmap" });
  }
});

router.delete("/roadmap/:id", async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const { id } = req.params as { id: string };
  try {
    const [row] = await db.select({ userId: roadmapsTable.userId }).from(roadmapsTable).where(eq(roadmapsTable.id, id));
    if (!row || row.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
    await db.delete(roadmapsTable).where(eq(roadmapsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "roadmap delete error");
    res.status(500).json({ error: "Failed to delete roadmap" });
  }
});

export { router as roadmapRouter };
