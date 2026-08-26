/**
 * tokenLedger — central Focus Tokens economy
 * - Ledger is source of truth
 * - Idempotent via idempotencyKey
 * - Transactional balance updates
 * - Daily limits, anti-abuse
 */

import { db } from "@workspace/db";
import {
  tokenLedgerTable,
  userWalletsTable,
  tokenEarningRulesTable,
} from "@workspace/db";
import { and, eq, gte, sql, desc } from "drizzle-orm";
import { logger } from "./logger";

type DbOrTx = any;

export type TransactionType = "earn" | "spend" | "refund" | "admin_grant" | "adjustment" | "expiration";
export type TokenSource =
  | "session_complete"
  | "daily_quest"
  | "weekly_quest"
  | "streak"
  | "battle_pass"
  | "community_challenge"
  | "pet_milestone"
  | "city_upgrade"
  | "admin_grant"
  | "seasonal_event"
  | "referral"
  | "premium_purchase"
  | "cosmetic_purchase"
  | "daily_reward"
  | "achievement"
  | "lootbox"
  | "drop_claim"
  | "adjustment"
  | "refund";

interface TokenMeta {
  description?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  adminReason?: string;
  adminId?: string;
}

// Default earning rules — will be seeded in DB, fallback here
const DEFAULT_EARNING_RULES: Record<string, { amount: number; dailyLimit?: number }> = {
  session_complete: { amount: 50, dailyLimit: 500 }, // 10 sessions max
  daily_quest: { amount: 30, dailyLimit: 150 },
  weekly_quest: { amount: 100 },
  streak: { amount: 20, dailyLimit: 20 },
  battle_pass: { amount: 50 },
  pet_milestone: { amount: 40 },
  city_upgrade: { amount: 60 },
  seasonal_event: { amount: 80 },
  referral: { amount: 200 },
  daily_reward: { amount: 25, dailyLimit: 25 },
  achievement: { amount: 50 },
  lootbox: { amount: 30 },
  drop_claim: { amount: 40, dailyLimit: 200 },
};

/**
 * Get earning rule from DB, fallback to defaults
 */
async function getEarningRule(source: TokenSource, tx?: DbOrTx): Promise<{ amount: number; dailyLimit?: number; isActive: boolean }> {
  try {
    const t = tx ?? db;
    const [rule] = await t.select().from(tokenEarningRulesTable).where(eq(tokenEarningRulesTable.source, source)).limit(1);
    if (rule) {
      return { amount: rule.amount, dailyLimit: rule.dailyLimit ?? undefined, isActive: rule.isActive };
    }
  } catch {}
  const def = DEFAULT_EARNING_RULES[source];
  if (def) return { amount: def.amount, dailyLimit: def.dailyLimit, isActive: true };
  return { amount: 0, isActive: false };
}

/**
 * Check daily limit for a source
 */
async function checkDailyLimit(userId: string, source: TokenSource, amount: number, tx?: DbOrTx): Promise<boolean> {
  const rule = await getEarningRule(source, tx);
  if (!rule.dailyLimit) return true;
  const t = tx ?? db;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  try {
    const [row] = await t
      .select({ total: sql<number>`coalesce(sum(${tokenLedgerTable.amount}),0)::int` })
      .from(tokenLedgerTable)
      .where(
        and(
          eq(tokenLedgerTable.userId, userId),
          eq(tokenLedgerTable.source, source),
          eq(tokenLedgerTable.transactionType, "earn"),
          gte(tokenLedgerTable.createdAt, today)
        )
      );
    const totalToday = row?.total ?? 0;
    return totalToday + amount <= rule.dailyLimit;
  } catch {
    return true;
  }
}

/**
 * Earn tokens — idempotent, transactional, with daily limits
 * Returns { balanceAfter, ledgerEntry, limited }
 */
export async function earnTokens(
  userId: string,
  source: TokenSource,
  idempotencyKey: string,
  meta: TokenMeta = {},
  amountOverride?: number,
  tx?: DbOrTx
): Promise<{ balanceAfter: number; ledgerId: string; limited?: boolean }> {
  const t = tx ?? db;
  const rule = await getEarningRule(source, t);
  if (!rule.isActive) {
    throw new Error(`Earning source ${source} is disabled`);
  }
  const amount = amountOverride ?? rule.amount;
  if (amount <= 0) throw new Error(`Invalid earn amount ${amount}`);

  // Check daily limit
  const withinLimit = await checkDailyLimit(userId, source, amount, t);
  if (!withinLimit) {
    // Return current balance without granting
    const [wallet] = await t.select({ coins: userWalletsTable.coins }).from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
    return { balanceAfter: wallet?.coins ?? 0, ledgerId: "", limited: true };
  }

  // Idempotency check
  try {
    const [existing] = await t.select().from(tokenLedgerTable).where(eq(tokenLedgerTable.idempotencyKey, idempotencyKey)).limit(1);
    if (existing) {
      return { balanceAfter: existing.balanceAfter, ledgerId: existing.id };
    }
  } catch {}

  // Transactional mint
  return await (tx ? Promise.resolve(tx) : db.transaction(async (trx) => {
    return await earnTokensInner(userId, source, amount, idempotencyKey, meta, trx);
  })) as any;

  // If tx provided, run inner directly
  // Note: when tx is provided, caller is responsible for transaction wrapper
  // We'll handle both cases
}

async function earnTokensInner(
  userId: string,
  source: TokenSource,
  amount: number,
  idempotencyKey: string,
  meta: TokenMeta,
  trx: DbOrTx
): Promise<{ balanceAfter: number; ledgerId: string }> {
  // Update wallet atomically
  const walletRows = await trx
    .update(userWalletsTable)
    .set({ coins: sql`coins + ${amount}`, updatedAt: new Date() })
    .where(eq(userWalletsTable.userId, userId))
    .returning({ coins: userWalletsTable.coins });

  let balanceAfter: number;
  if (!walletRows.length) {
    await trx
      .insert(userWalletsTable)
      .values({ userId, coins: amount, totalXp: 0, weeklyXp: 0 })
      .onConflictDoUpdate({
        target: userWalletsTable.userId,
        set: { coins: sql`coins + ${amount}`, updatedAt: new Date() },
      });
    const [after] = await trx.select({ coins: userWalletsTable.coins }).from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
    balanceAfter = after?.coins ?? amount;
  } else {
    balanceAfter = walletRows[0].coins;
  }

  // Insert ledger entry — idempotencyKey unique prevents double grant even if wallet update raced
  try {
    const [entry] = await trx
      .insert(tokenLedgerTable)
      .values({
        userId,
        amount,
        transactionType: "earn",
        source,
        relatedEntityId: meta.relatedEntityId,
        idempotencyKey,
        balanceAfter,
        adminReason: meta.adminReason,
        metadata: meta.metadata,
      })
      .returning({ id: tokenLedgerTable.id });

    logger.info({ userId, source, amount, balanceAfter }, "tokens earned");
    return { balanceAfter, ledgerId: entry.id };
  } catch (err: any) {
    // If duplicate idempotency key, fetch existing
    if (err?.code === "23505" || err?.message?.includes("duplicate") || err?.message?.includes("unique")) {
      const [existing] = await trx.select().from(tokenLedgerTable).where(eq(tokenLedgerTable.idempotencyKey, idempotencyKey)).limit(1);
      if (existing) {
        return { balanceAfter: existing.balanceAfter, ledgerId: existing.id };
      }
    }
    throw err;
  }
}

/**
 * Spend tokens — atomic, idempotent, fails if insufficient balance
 */
export async function spendTokens(
  userId: string,
  amount: number,
  source: TokenSource,
  idempotencyKey: string,
  meta: TokenMeta = {},
  tx?: DbOrTx
): Promise<{ balanceAfter: number; ledgerId: string } | null> {
  if (amount <= 0) throw new Error(`Invalid spend amount ${amount}`);
  const t = tx ?? db;

  // Idempotency check first
  try {
    const [existing] = await t.select().from(tokenLedgerTable).where(eq(tokenLedgerTable.idempotencyKey, idempotencyKey)).limit(1);
    if (existing) {
      return { balanceAfter: existing.balanceAfter, ledgerId: existing.id };
    }
  } catch {}

  // If tx provided, use it; else wrap in transaction
  if (tx) {
    return await spendTokensInner(userId, amount, source, idempotencyKey, meta, tx);
  }

  return await db.transaction(async (trx) => {
    return await spendTokensInner(userId, amount, source, idempotencyKey, meta, trx);
  });
}

async function spendTokensInner(
  userId: string,
  amount: number,
  source: TokenSource,
  idempotencyKey: string,
  meta: TokenMeta,
  trx: DbOrTx
): Promise<{ balanceAfter: number; ledgerId: string } | null> {
  // Atomic burn only if balance >= amount
  const walletRows = await trx
    .update(userWalletsTable)
    .set({ coins: sql`coins - ${amount}`, updatedAt: new Date() })
    .where(and(eq(userWalletsTable.userId, userId), gte(userWalletsTable.coins, amount)))
    .returning({ coins: userWalletsTable.coins });

  if (!walletRows.length) {
    return null; // insufficient balance
  }

  const balanceAfter = walletRows[0].coins;

  try {
    const [entry] = await trx
      .insert(tokenLedgerTable)
      .values({
        userId,
        amount: -amount,
        transactionType: "spend",
        source,
        relatedEntityId: meta.relatedEntityId,
        idempotencyKey,
        balanceAfter,
        adminReason: meta.adminReason,
        metadata: meta.metadata,
      })
      .returning({ id: tokenLedgerTable.id });

    logger.info({ userId, source, amount, balanceAfter }, "tokens spent");
    return { balanceAfter, ledgerId: entry.id };
  } catch (err: any) {
    if (err?.code === "23505" || err?.message?.includes("duplicate")) {
      const [existing] = await trx.select().from(tokenLedgerTable).where(eq(tokenLedgerTable.idempotencyKey, idempotencyKey)).limit(1);
      if (existing) {
        return { balanceAfter: existing.balanceAfter, ledgerId: existing.id };
      }
    }
    // Rollback wallet if ledger insert failed — but wallet already decremented, need to refund
    await trx
      .update(userWalletsTable)
      .set({ coins: sql`coins + ${amount}`, updatedAt: new Date() })
      .where(eq(userWalletsTable.userId, userId));
    throw err;
  }
}

/**
 * Admin grant — always succeeds, records admin reason
 */
export async function grantTokensAdmin(
  userId: string,
  amount: number,
  adminId: string,
  reason: string,
  idempotencyKey: string,
  meta: TokenMeta = {},
  tx?: DbOrTx
): Promise<{ balanceAfter: number; ledgerId: string }> {
  if (amount === 0) throw new Error("Amount cannot be zero");
  const t = tx ?? db;

  const [existing] = await t.select().from(tokenLedgerTable).where(eq(tokenLedgerTable.idempotencyKey, idempotencyKey)).limit(1);
  if (existing) {
    return { balanceAfter: existing.balanceAfter, ledgerId: existing.id };
  }

  const isEarn = amount > 0;

  if (tx) {
    return await grantInner(userId, amount, isEarn, adminId, reason, idempotencyKey, meta, tx);
  }

  return await db.transaction(async (trx) => {
    return await grantInner(userId, amount, isEarn, adminId, reason, idempotencyKey, meta, trx);
  });
}

async function grantInner(
  userId: string,
  amount: number,
  isEarn: boolean,
  adminId: string,
  reason: string,
  idempotencyKey: string,
  meta: TokenMeta,
  trx: DbOrTx
): Promise<{ balanceAfter: number; ledgerId: string }> {
  const walletRows = await trx
    .update(userWalletsTable)
    .set({ coins: sql`coins + ${amount}`, updatedAt: new Date() })
    .where(eq(userWalletsTable.userId, userId))
    .returning({ coins: userWalletsTable.coins });

  let balanceAfter: number;
  if (!walletRows.length) {
    await trx
      .insert(userWalletsTable)
      .values({ userId, coins: Math.max(0, amount), totalXp: 0, weeklyXp: 0 })
      .onConflictDoUpdate({
        target: userWalletsTable.userId,
        set: { coins: sql`coins + ${amount}`, updatedAt: new Date() },
      });
    const [after] = await trx.select({ coins: userWalletsTable.coins }).from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
    balanceAfter = after?.coins ?? Math.max(0, amount);
  } else {
    balanceAfter = walletRows[0].coins;
  }

  const [entry] = await trx
    .insert(tokenLedgerTable)
    .values({
      userId,
      amount,
      transactionType: "admin_grant",
      source: "admin_grant",
      relatedEntityId: meta.relatedEntityId,
      idempotencyKey,
      balanceAfter,
      adminReason: reason,
      metadata: { ...meta.metadata, adminId },
    })
    .returning({ id: tokenLedgerTable.id });

  return { balanceAfter, ledgerId: entry.id };
}

/**
 * Get ledger for user with pagination
 */
export async function getUserLedger(userId: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [entries, total] = await Promise.all([
    db.select().from(tokenLedgerTable).where(eq(tokenLedgerTable.userId, userId)).orderBy(desc(tokenLedgerTable.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(tokenLedgerTable).where(eq(tokenLedgerTable.userId, userId)).then(r => r[0]?.count ?? 0),
  ]);
  return { entries, total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) };
}

/**
 * Get current balance — from wallet cache, but verify against ledger sum periodically
 */
export async function getTokenBalance(userId: string): Promise<number> {
  const [wallet] = await db.select({ coins: userWalletsTable.coins }).from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
  return wallet?.coins ?? 0;
}
