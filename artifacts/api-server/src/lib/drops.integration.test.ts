/**
 * Integration tests for Admin Drops (Workstream B) against real Postgres.
 * Skipped without DATABASE_URL (db module throws at import — lazy imports).
 *
 * Acceptance covered:
 *  - atomic pool: 10 racers on a pool of 1 → exactly one wins, no oversell
 *  - per-user one-claim enforcement (unique constraint)
 *  - window check: pre-start / post-end claims rejected
 *  - XP multiplier active only inside the window, server-side only
 *  - every mint/burn writes a coin_transaction (ledger audit)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("admin drops (Workstream B)", () => {
  let db: typeof import("@workspace/db").db;
  let adminDropsTable: typeof import("@workspace/db").adminDropsTable;
  let adminDropClaimsTable: typeof import("@workspace/db").adminDropClaimsTable;
  let userWalletsTable: typeof import("@workspace/db").userWalletsTable;
  let coinTransactionsTable: typeof import("@workspace/db").coinTransactionsTable;
  let usersTable: typeof import("@workspace/db").usersTable;
  let createDrop: typeof import("./drops").createDrop;
  let claimDrop: typeof import("./drops").claimDrop;
  let activeDropXpMultiplier: typeof import("./drops").activeDropXpMultiplier;
  let endDrop: typeof import("./drops").endDrop;

  const testUsers: string[] = [];

  beforeAll(async () => {
    const dbmod = await import("@workspace/db");
    const drops = await import("./drops");
    ({ db, adminDropsTable, adminDropClaimsTable, userWalletsTable, coinTransactionsTable, usersTable } = dbmod as any);
    ({ createDrop, claimDrop, activeDropXpMultiplier, endDrop } = drops);

    // Clean slate: any leftover test drops + test-user drop history.
    await db.delete(adminDropClaimsTable);
    await db.delete(adminDropsTable);
    await db.delete(coinTransactionsTable).where(eq(coinTransactionsTable.reason, "drop_claim"));

    // Deterministic test users (role=user so fan-out logic targets them).
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const id = `drop-test-user-${i}`;
      await db.insert(usersTable).values({
        id,
        email: `${id}@test.focusarx`,
        name: `Drop Tester ${i}`,
        isGuest: false,
        role: "user",
      }).onConflictDoNothing();
      await db.insert(userWalletsTable).values({ userId: id, coins: 10000, totalXp: 1000, weeklyXp: 1000 }).onConflictDoNothing();
      ids.push(id);
    }
    testUsers.push(...ids);
  }, 120_000);

  afterAll(async () => {
    try {
      await db.delete(adminDropClaimsTable);
      await db.delete(adminDropsTable);
      if (testUsers.length) {
        await db.delete(userWalletsTable).where(inArray(userWalletsTable.userId, testUsers));
        await db.delete(usersTable).where(inArray(usersTable.id, testUsers));
      }
    } catch { /* best effort */ }
  }, 30_000);

  it("atomic pool: 10 racers on a pool of 1 → exactly one wins, no oversell", async () => {
    const { id } = await createDrop({
      type: "coin_rain",
      title: "Race Test Rain",
      description: "pool of 1",
      payload: { coinsPerClaim: 100, poolTotal: 1 },
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 3600_000),
    });

    const results = await Promise.all(
      testUsers.map((u) => claimDrop(id, u)),
    );
    const winners = results.filter((r) => r.ok);
    const poolEmpty = results.filter((r) => !r.ok && r.code === "pool_empty");

    expect(winners.length).toBe(1);
    expect(poolEmpty.length).toBe(9);
    expect(winners[0].poolRemaining).toBe(0);

    // Exactly one claim row.
    const [claimsRow] = await db.select({ n: sql<number>`count(*)` }).from(adminDropClaimsTable).where(eq(adminDropClaimsTable.dropId, id));
    expect(Number(claimsRow.n)).toBe(1);
    const [claimRow] = await db.select({ userId: adminDropClaimsTable.userId, rewardCoins: adminDropClaimsTable.rewardCoins })
      .from(adminDropClaimsTable)
      .where(eq(adminDropClaimsTable.dropId, id));
    expect(claimRow.rewardCoins).toBe(100);

    // Exactly one coin_transaction — scoped to the winner (the table is
    // shared with other tests' history).
    const [txCountRow] = await db.select({ n: sql<number>`count(*)` }).from(coinTransactionsTable)
      .where(and(eq(coinTransactionsTable.userId, claimRow.userId), eq(coinTransactionsTable.reason, "drop_claim")));
    expect(Number(txCountRow.n)).toBe(1);

    // Ledger balance consistency: winner's wallet == ledger balanceAfter.
    const [txRow] = await db.select({ balanceAfter: coinTransactionsTable.balanceAfter, amount: coinTransactionsTable.amount })
      .from(coinTransactionsTable)
      .where(and(eq(coinTransactionsTable.userId, claimRow.userId), eq(coinTransactionsTable.reason, "drop_claim")))
      .limit(1);
    expect(txRow.amount).toBe(claimRow.rewardCoins);
    const [walletRow] = await db.select({ coins: userWalletsTable.coins }).from(userWalletsTable).where(eq(userWalletsTable.userId, claimRow.userId));
    expect(walletRow.coins).toBe(txRow.balanceAfter);
    await endDrop(id);
  }, 120_000);

  it("double-claim is rejected even inside the window", async () => {
    const { id } = await createDrop({
      type: "coin_rain",
      title: "Double Claim Test",
      payload: { coinsPerClaim: 50, poolTotal: 100 },
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 3600_000),
    });
    const first = await claimDrop(id, testUsers[0]);
    const second = await claimDrop(id, testUsers[0]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("already_claimed");
    await endDrop(id);
  }, 60_000);

  it("window check: pre-start and post-end claims are rejected", async () => {
    const { id } = await createDrop({
      type: "coin_rain",
      title: "Not Live Yet",
      payload: { coinsPerClaim: 10, poolTotal: 10 },
      startsAt: new Date(Date.now() + 3600_000),
      endsAt: new Date(Date.now() + 7200_000),
    });
    const before = await claimDrop(id, testUsers[1]);
    expect(before.ok).toBe(false);
    if (!before.ok) expect(before.code).toBe("not_live");

    const { id: ended } = await createDrop({
      type: "coin_rain",
      title: "Already Over",
      payload: { coinsPerClaim: 10, poolTotal: 10 },
      startsAt: new Date(Date.now() - 7200_000),
      endsAt: new Date(Date.now() - 3600_000),
    });
    const after = await claimDrop(ended, testUsers[1]);
    expect(after.ok).toBe(false);
    if (!after.ok) expect(after.code).toBe("not_live");
  }, 60_000);

  it("XP multiplier is active inside the window and 1 outside", async () => {
    const { id } = await createDrop({
      type: "double_xp",
      title: "Double XP Test",
      payload: { multiplier: 2 },
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 3600_000),
    });
    const live = await activeDropXpMultiplier();
    expect(live.multiplier).toBe(2);
    expect(live.dropId).toBe(id);

    await endDrop(id);
    const after = await activeDropXpMultiplier();
    expect(after.multiplier).toBe(1);
    expect(after.dropId).toBeNull();
  }, 60_000);

  it("flash quest requires meeting the focus target first", async () => {
    const { id } = await createDrop({
      type: "flash_quest",
      title: "Focus 5 Minutes",
      payload: { targetMinutes: 5, rewardCoins: 200, rewardXp: 100 },
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 3600_000),
    });
    const early = await claimDrop(id, testUsers[2]);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.code).toBe("quest_not_met");
    await endDrop(id);
  }, 60_000);
});
