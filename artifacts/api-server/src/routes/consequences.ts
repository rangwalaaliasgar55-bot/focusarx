import { Request, Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { Router } from "express";
import {
  db, consequenceContractsTable, freezeTokensTable, focusSessionsTable, studyStreaksTable,
} from "@workspace/db";
import { eq, and, gte, sum } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

function getMondayStr(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split("T")[0]!;
}

async function getWeekMinutes(userId: string, weekStart: string): Promise<number> {
  const startDate = new Date(weekStart + "T00:00:00Z");
  const endDate = new Date(startDate.getTime() + 7 * 86400000);
  const [row] = await db
    .select({ total: sum(focusSessionsTable.durationSec) })
    .from(focusSessionsTable)
    .where(
      and(
        eq(focusSessionsTable.userId, userId),
        eq(focusSessionsTable.mode, "focus"),
        gte(focusSessionsTable.createdAt, startDate),
      ),
    );
  return Math.floor(Number(row?.total ?? 0) / 60);
}

router.get("/consequences", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const weekStart = getMondayStr();
    const contracts = await db
      .select()
      .from(consequenceContractsTable)
      .where(eq(consequenceContractsTable.userId, req.userId))
      .orderBy(consequenceContractsTable.weekStart);

    const [freezeRow] = await db
      .select()
      .from(freezeTokensTable)
      .where(eq(freezeTokensTable.userId, req.userId));

    const weekMinutes = await getWeekMinutes(req.userId, weekStart);

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

  const weekStart = getMondayStr();

  try {
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
