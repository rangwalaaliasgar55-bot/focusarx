/**
 * coinLedger — the single gate for coin mint/burn (Workstream C rule:
 * "ALL mint/burn write coin_transactions").
 *
 * Every coin movement in the product goes through mintCoins/burnCoins so the
 * admin economy dashboard and ledger audit are complete by construction.
 * New code must never UPDATE user_wallets.coins directly.
 *
 * Both helpers accept an optional drizzle transaction (`tx`) so callers
 * inside `db.transaction(...)` stay fully atomic — pass the tx through.
 */
import { db } from "@workspace/db";
import { userWalletsTable, coinTransactionsTable } from "@workspace/db";
import { and, eq, gte, sql, type SQL } from "drizzle-orm";

type TxOrDb = {
  update: (t: typeof userWalletsTable) => any;
  insert: (t: any) => any;
  select: () => any;
};

interface TxMeta {
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Mint coins: wallet += amount (lazy-created if missing) + one earn row.
 * Returns the new balance.
 */
export async function mintCoins(
  userId: string,
  amount: number,
  reason: string,
  meta: TxMeta = {},
  tx?: TxOrDb,
): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`mintCoins: invalid amount ${amount}`);
  const t = (tx ?? db) as typeof db;

  const rows = await t.update(userWalletsTable)
    .set({ coins: sql`coins + ${amount}`, updatedAt: new Date() })
    .where(eq(userWalletsTable.userId, userId))
    .returning({ coins: userWalletsTable.coins });

  if (!rows.length) {
    await t.insert(userWalletsTable)
      .values({ userId, coins: amount, totalXp: 0, weeklyXp: 0 })
      .onConflictDoUpdate({
        target: userWalletsTable.userId,
        set: { coins: sql`coins + ${amount}`, updatedAt: new Date() },
      });
    const after = await t.select({ coins: userWalletsTable.coins })
      .from(userWalletsTable).where(eq(userWalletsTable.userId, userId));
    return Number(after[0]?.coins ?? amount);
  }

  const balanceAfter = Number(rows[0].coins);
  await t.insert(coinTransactionsTable).values({
    userId, type: "earn", amount, reason,
    description: meta.description ?? `${reason.replace(/_/g, " ")}: +${amount} coins`,
    balanceAfter,
    metadata: (meta.metadata ?? null) as SQL | Record<string, unknown> | null,
  });
  return balanceAfter;
}

/**
 * Burn coins: atomic, only succeeds if the balance covers the amount.
 * Returns the new balance, or null when the user cannot afford it.
 */
export async function burnCoins(
  userId: string,
  amount: number,
  reason: string,
  meta: TxMeta = {},
  tx?: TxOrDb,
): Promise<number | null> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`burnCoins: invalid amount ${amount}`);
  const t = (tx ?? db) as typeof db;

  const rows = await t.update(userWalletsTable)
    .set({ coins: sql`coins - ${amount}`, updatedAt: new Date() })
    .where(and(eq(userWalletsTable.userId, userId), gte(userWalletsTable.coins, amount)))
    .returning({ coins: userWalletsTable.coins });

  if (!rows.length) return null;
  const balanceAfter = Number(rows[0].coins);
  await t.insert(coinTransactionsTable).values({
    userId, type: "spend", amount: -amount, reason,
    description: meta.description ?? `${reason.replace(/_/g, " ")}: -${amount} coins`,
    balanceAfter,
    metadata: (meta.metadata ?? null) as SQL | Record<string, unknown> | null,
  });
  return balanceAfter;
}
