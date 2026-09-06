import { Router } from "express";
import { db } from "@workspace/db";
import { distractionLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";
import { clockInZone } from "../lib/timezone";
import { userZone } from "../lib/userZone";
import { sendUnauthorized } from "../lib/httpErrors";

const router = Router();

function auth(req: any, res: any, next: any) {
  const userId = extractUserId(req);
  if (!userId) { sendUnauthorized(res); return; }
  req.userId = userId;
  next();
}

router.post("/distractions", auth, async (req: any, res) => {
  const { reason, worthIt, sessionId } = req.body as { reason?: string; worthIt?: boolean; sessionId?: string };
  if (!reason) { res.status(400).json({ error: "reason required" }); return; }
  const hour = clockInZone(Date.now(), await userZone(req.userId)).hour;
  try {
    const [log] = await db.insert(distractionLogsTable)
      .values({ userId: req.userId, reason, worthIt: worthIt ?? false, sessionId: sessionId ?? null, hour })
      .returning();
    res.json({ log });
  } catch (err) {
    logger.error({ err }, "distraction log error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/distractions/patterns", auth, async (req: any, res) => {
  try {
    const logs = await db.select().from(distractionLogsTable)
      .where(eq(distractionLogsTable.userId, req.userId))
      .orderBy(desc(distractionLogsTable.createdAt))
      .limit(200);

    const byReason: Record<string, number> = {};
    const byHour: Record<number, number> = {};
    let notWorthIt = 0;

    for (const log of logs) {
      byReason[log.reason] = (byReason[log.reason] ?? 0) + 1;
      byHour[log.hour] = (byHour[log.hour] ?? 0) + 1;
      if (!log.worthIt) notWorthIt++;
    }

    const reasonData = Object.entries(byReason)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const hourData = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${h.toString().padStart(2, "0")}:00`,
      count: byHour[h] ?? 0,
    }));

    res.json({ reasonData, hourData, total: logs.length, notWorthItPct: logs.length > 0 ? Math.round((notWorthIt / logs.length) * 100) : 0 });
  } catch (err) {
    logger.error({ err }, "distraction patterns error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/distractions/nudge", auth, async (req: any, res) => {
  try {
    const currentHour = clockInZone(Date.now(), await userZone(req.userId)).hour;
    const logs = await db.select({ hour: distractionLogsTable.hour }).from(distractionLogsTable)
      .where(eq(distractionLogsTable.userId, req.userId));

    const hourCounts: Record<number, number> = {};
    for (const l of logs) { hourCounts[l.hour] = (hourCounts[l.hour] ?? 0) + 1; }

    const nextHour = (currentHour + 1) % 24;
    const riskHour = hourCounts[nextHour] ?? 0;
    const totalLogs = logs.length;
    const showNudge = totalLogs >= 5 && riskHour >= Math.max(2, totalLogs * 0.1);

    res.json({
      showNudge,
      riskHour: nextHour,
      message: showNudge
        ? `Your focus usually dips around ${nextHour}:00. Start a block before the slump?`
        : null,
    });
  } catch (err) {
    logger.error({ err }, "distraction nudge error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as distractionsRouter };
