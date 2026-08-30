/**
 * walletLock — Row-level locking for wallet operations
 * 
 * P0 Blueprint Fix: Prevents race conditions in concurrent coin/XP updates
 * 
 * Pattern:
 *   await db.transaction(async (tx) => {
 *     await lockWallet(tx, userId);
 *     // Now safely read/modify/write using locked row
 *     return await mintCoins(userId, amount, reason, {}, tx);
 *   });
 */

import { sql } from 'drizzle-orm';

type TxClient = {
  execute: (query: any) => Promise<any>;
};

/**
 * Lock a user's wallet row with FOR UPDATE within a transaction.
 * Must be called inside db.transaction(async (tx) => { ... })
 * 
 * This prevents concurrent reads from seeing stale data and
 * prevents race conditions like double-spending.
 */
export async function lockWallet(tx: TxClient, userId: string): Promise<any> {
  const result = await tx.execute(
    sql`SELECT coins, total_xp, weekly_xp FROM user_wallets WHERE user_id = ${userId} FOR UPDATE`
  );
  return result.rows?.[0] ?? null;
}

/**
 * Alias for lockWallet — semantic naming for with-transaction patterns
 */
export const withWalletLock = lockWallet;
