import { Router } from "express";
import { AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { tokenLedgerTable } from "@workspace/db";
import { grantTokensAdmin, getTokenBalance } from "../lib/tokenLedger";
import { usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

// Admin: grant/remove tokens with reason + immutable audit + before/after balance
router.post("/admin/tokens/grant", async (req, res) => {
  const { checkAdminAuth } = await import("../lib/adminAuth");
  if (!await checkAdminAuth(req)) return res.status(403).json({ error: "Forbidden" });
  const authReq = req as AuthRequest;
  const { userId, amount, reason, type } = req.body as { userId: string; amount: number; reason: string; type?: "grant" | "remove" };
  if (!userId || !amount || !reason) return res.status(400).json({ error: "userId, amount, reason required" });
  if (reason.length < 5) return res.status(400).json({ error: "Reason must be at least 5 chars" });
  if (Math.abs(amount) > 100000) return res.status(400).json({ error: "Amount too large" });

  try {
    const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });

    const beforeBalance = await getTokenBalance(userId);
    const { extractUserId } = await import("./auth");
    const adminId = extractUserId(req) ?? "admin";
    const finalAmount = type === "remove" ? -Math.abs(amount) : Math.abs(amount);
    const idempotencyKey = `admin_${req.userId}_${userId}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

    const result = await grantTokensAdmin(userId, finalAmount, adminId, reason, idempotencyKey, { description: `admin ${type} ${reason}` } as any);
    const afterBalance = result.balanceAfter;

    // Audit log already in ledger with adminReason, but also log to logger
    logger.info({ adminId, targetUserId: userId, amount: finalAmount, reason, beforeBalance, afterBalance }, "admin token grant");

    res.json({ success: true, beforeBalance, afterBalance, ledgerId: result.ledgerId, amount: finalAmount });
  } catch (err) {
    logger.error({ err }, "admin token grant error");
    res.status(500).json({ error: "Failed to grant tokens" });
  }
});

router.get("/admin/tokens/ledger", async (req, res) => {
  const { checkAdminAuth } = await import("../lib/adminAuth");
  if (!await checkAdminAuth(req)) return res.status(403).json({ error: "Forbidden" });
  const { userId, limit = "50" } = req.query as { userId?: string; limit?: string };
  try {
    const lim = Math.min(100, parseInt(limit) || 50);
    const query = db.select().from(tokenLedgerTable).orderBy(desc(tokenLedgerTable.createdAt)).limit(lim);
    if (userId) {
      const rows = await db.select().from(tokenLedgerTable).where(eq(tokenLedgerTable.userId, userId)).orderBy(desc(tokenLedgerTable.createdAt)).limit(lim);
      return res.json({ ledger: rows });
    }
    const rows = await db.select().from(tokenLedgerTable).orderBy(desc(tokenLedgerTable.createdAt)).limit(lim);
    res.json({ ledger: rows });
  } catch (err) {
    logger.error({ err }, "admin ledger fetch error");
    res.status(500).json({ error: "Failed to fetch ledger" });
  }
});

router.get("/admin/tokens/analytics", async (req, res) => {
  const { checkAdminAuth } = await import("../lib/adminAuth");
  if (!await checkAdminAuth(req)) return res.status(403).json({ error: "Forbidden" });
  try {
    const { sql } = await import("drizzle-orm");
    const totalCirculation = await db.select({ sum: sql<number>`COALESCE(SUM(amount),0)` }).from(tokenLedgerTable);
    const earned = await db.select({ sum: sql<number>`COALESCE(SUM(amount),0)` }).from(tokenLedgerTable).where(eq(tokenLedgerTable.transactionType, "earn"));
    const spent = await db.select({ sum: sql<number>`COALESCE(SUM(amount),0)` }).from(tokenLedgerTable).where(eq(tokenLedgerTable.transactionType, "spend"));
    const grants = await db.select({ sum: sql<number>`COALESCE(SUM(amount),0)` }).from(tokenLedgerTable).where(eq(tokenLedgerTable.transactionType, "admin_grant"));

    res.json({
      totalCirculation: totalCirculation[0]?.sum ?? 0,
      totalEarned: earned[0]?.sum ?? 0,
      totalSpent: Math.abs(spent[0]?.sum ?? 0),
      totalAdminGrants: grants[0]?.sum ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "admin token analytics error");
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

export { router as adminTokensRouter };
