import { Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import {
  db, consequenceContractsTable, freezeTokensTable, focusSessionsTable,
} from "@workspace/db";
import { eq, and, gte, lt, sum, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { userZone } from "../lib/userZone";
import { dayKeyInZone, dayStartInZone, shiftDayKey, weekStartInZone } from "../lib/timezone";

const router = Router();

/** Monday YYYY-MM-DD of the current week in the user's own calendar. */
async function currentWeekStart(userId: string): Promise<{ weekStart: string; zone: string }> {
  const zone = await userZone(userId);
  return { weekStart: dayKeyInZone(weekStartInZone(Date.now(), zone), zone), zone };
}

/**
 * Focus minutes *completed* inside one Monday→Sunday window. Bounded on both
 * ends (the previous version was open-ended and keyed on createdAt, so a
 * session started Sunday 23:50 and finished Monday counted for the old week
 * and an evaluation of a past week counted everything since).
 */
async function getWeekMinutes(userId: string, weekStart: string, zone: string): Promise<number> {
  const startDate = dayStartInZone(weekStart, zone);
  const endDate = dayStartInZone(shiftDayKey(weekStart, 7), zone);
  const [row] = await db
    .select({ total: sum(focusSessionsTable.durationSec) })
    .from(focusSessionsTable)
    .where(
      and(
        eq(focusSessionsTable.userId, userId),
        eq(focusSessionsTable.mode, "focus"),
        gte(focusSessionsTable.completedAt, startDate),
        lt(focusSessionsTable.completedAt, endDate),
      ),
    );
  return Math.floor(Number(row?.total ?? 0) / 60);
}

/**
 * Settle contracts whose week is over. A contract used to sit forever in
 * "neither achieved nor triggered" unless the user pressed the trigger
 * button on themselves — so the consequence was purely honour-system.
 */
async function settleExpiredContracts(
  userId: string,
  contracts: (typeof consequenceContractsTable.$inferSelect)[],
  currentWeekStart: string,
  zone: string,
) {
  const open = contracts.filter((c) => c.weekStart < currentWeekStart && !c.achieved && !c.consequenceTriggered);
  if (!open.length) return;
  const achievedIds: string[] = [];
  const triggeredIds: string[] = [];
  for (const c of open) {
    const minutes = await getWeekMinutes(userId, c.weekStart, zone);
    if (minutes >= c.targetMinutes) achievedIds.push(c.id); else triggeredIds.push(c.id);
  }
  const now = new Date();
  if (achievedIds.length) {
    await db.update(consequenceContractsTable).set({ achieved: true, updatedAt: now })
      .where(inArray(consequenceContractsTable.id, achievedIds));
  }
  if (triggeredIds.length) {
    await db.update(consequenceContractsTable).set({ consequenceTriggered: true, updatedAt: now })
      .where(inArray(consequenceContractsTable.id, triggeredIds));
  }
  for (const c of contracts) {
    if (achievedIds.includes(c.id)) c.achieved = true;
    if (triggeredIds.includes(c.id)) c.consequenceTriggered = true;
  }
}

router.get("/consequences", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { weekStart, zone } = await currentWeekStart(req.userId);
    const contracts = await db
      .select()
      .from(consequenceContractsTable)
      .where(eq(consequenceContractsTable.userId, req.userId))
      .orderBy(consequenceContractsTable.weekStart);
    await settleExpiredContracts(req.userId, contracts, weekStart, zone);

    const [freezeRow] = await db
      .select()
      .from(freezeTokensTable)
      .where(eq(freezeTokensTable.userId, req.userId));

    const weekMinutes = await getWeekMinutes(req.userId, weekStart, zone);

    const currentContract = contracts.find((c) => c.weekStart === weekStart) ?? null;

    if (currentContract && !currentContract.achieved && weekMinutes >= currentContract.targetMinutes) {
      await db
        .update(consequenceContractsTable)
        .set({ achieved: true, updatedAt: new Date() })
        .where(eq(consequenceContractsTable.id, currentContract.id));
      currentContract.achieved = true;
    }

    res.json({
      contracts,
      currentContract,
      weekMinutes,
      weekStart,
      freezeTokens: freezeRow?.tokensAvailable ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "get consequences error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/consequences", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { contractType, targetMinutes, charityName, charityAmount } = req.body as {
    contractType?: string;
    targetMinutes?: number;
    charityName?: string;
    charityAmount?: number;
  };

  if (!contractType || !targetMinutes) {
    res.status(400).json({ error: "contractType and targetMinutes required" });
    return;
  }

  if (!Number.isFinite(targetMinutes) || targetMinutes <= 0 || targetMinutes > 7 * 24 * 60) {
    res.status(400).json({ error: "targetMinutes must be between 1 and 10080" });
    return;
  }

  try {
    const { weekStart } = await currentWeekStart(req.userId);
    const [existing] = await db
      .select()
      .from(consequenceContractsTable)
      .where(and(
        eq(consequenceContractsTable.userId, req.userId),
        eq(consequenceContractsTable.weekStart, weekStart),
      ));

    if (existing) {
      const [updated] = await db
        .update(consequenceContractsTable)
        .set({
          contractType,
          targetMinutes: targetMinutes ?? 0,
          charityName: charityName ?? null,
          charityAmount: charityAmount ?? null,
          achieved: false,
          consequenceTriggered: false,
          updatedAt: new Date(),
        })
        .where(eq(consequenceContractsTable.id, existing.id))
        .returning();
      res.json({ contract: updated });
    } else {
      const [contract] = await db
        .insert(consequenceContractsTable)
        .values({
          userId: req.userId,
          weekStart,
          contractType,
          targetMinutes: targetMinutes ?? 0,
          charityName: charityName ?? null,
          charityAmount: charityAmount ?? null,
        })
        .returning();
      res.json({ contract });
    }
  } catch (err) {
    logger.error({ err }, "post consequence error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.patch("/consequences/:id/trigger", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [updated] = await db
      .update(consequenceContractsTable)
      .set({ consequenceTriggered: true, updatedAt: new Date() })
      .where(and(
        eq(consequenceContractsTable.id, req.params.id as string),
        eq(consequenceContractsTable.userId, req.userId),
      ))
      .returning();
    res.json({ contract: updated ?? null });
  } catch (err) {
    logger.error({ err }, "trigger consequence error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/consequences/use-freeze", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [freeze] = await db
      .select()
      .from(freezeTokensTable)
      .where(eq(freezeTokensTable.userId, req.userId));

    if (!freeze || freeze.tokensAvailable < 1) {
      res.status(400).json({ error: "No freeze tokens available" });
      return;
    }

    await db
      .update(freezeTokensTable)
      .set({
        tokensAvailable: freeze.tokensAvailable - 1,
        tokensUsed: freeze.tokensUsed + 1,
        updatedAt: new Date(),
      })
      .where(eq(freezeTokensTable.userId, req.userId));

    res.json({ tokensAvailable: freeze.tokensAvailable - 1 });
  } catch (err) {
    logger.error({ err }, "use-freeze error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as consequencesRouter };
