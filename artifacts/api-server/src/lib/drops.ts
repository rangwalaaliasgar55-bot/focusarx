/**
 * Admin Drops engine (Workstream B) — scheduled hype events ("havoc").
 *
 * Types:
 *   coin_rain        limited coin pool, first-N claimers, live "X left" ticker
 *   double_xp        server-side XP multiplier for the window (session path)
 *   board_shakeup    weekly-board XP multiplier for the window (same infra)
 *   flash_quest      24h quest (focus N minutes in window) → big reward
 *   streak_freeze    claim grants a streak-freeze token
 *   item_flash_sale  marketplace item at a discount for the window
 *
 * Claims are atomic (UPDATE … WHERE pool_claimed + n <= pool_total
 * RETURNING) and per-user unique (UNIQUE(drop_id, user_id)) — duplicate
 * claims and pool overdraw are impossible under concurrency.
 *
 * No cron: expiry is a window check on read/claim; fan-out happens on
 * creation; the UI reads /drops for live countdowns.
 */
import { db, pool } from "@workspace/db";
import {
  adminDropsTable,
  adminDropClaimsTable,
  usersTable,
  userWalletsTable,
  coinTransactionsTable,
  freezeTokensTable,
  notificationsTable,
  focusSessionsTable,
  marketplaceItemsTable,
  userInventoryTable,
} from "@workspace/db";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { logger } from "./logger";
import { sendPush } from "./pushSender";
import { sendEmail } from "../routes/email";
import { emitDrop } from "./socketManager";

export type DropType = "coin_rain" | "double_xp" | "board_shakeup" | "flash_quest" | "streak_freeze" | "item_flash_sale";

export const DROP_TYPES: Array<{ type: DropType; label: string; description: string; defaultPayload: Record<string, unknown> }> = [
  { type: "coin_rain", label: "🪙 Coin Rain", description: "Limited coin pool — first claimers win. Live 'X coins left' ticker.", defaultPayload: { coinsPerClaim: 250, poolTotal: 25000 } },
  { type: "double_xp", label: "⚡ Double-XP Hour", description: "All focus sessions in the window earn 2× XP (server-side).", defaultPayload: { multiplier: 2 } },
  { type: "board_shakeup", label: "🏆 Leaderboard Shake-up", description: "Next 2 hours count 1.5× on the weekly board.", defaultPayload: { multiplier: 1.5, scope: "weekly" } },
  { type: "flash_quest", label: "🚩 Flash Quest", description: "Focus N minutes during the window to claim a big reward.", defaultPayload: { targetMinutes: 120, rewardCoins: 1000, rewardXp: 500 } },
  { type: "streak_freeze", label: "❄️ Streak-Freeze Giveaway", description: "Claim a streak-freeze token during the window.", defaultPayload: { tokensPerClaim: 1, poolTotal: 500 } },
  { type: "item_flash_sale", label: "🏷️ Rare Item Flash Sale", description: "A marketplace item at 40–70% off for the window.", defaultPayload: { itemId: "", discountPct: 50 } },
];

export interface DropInput {
  type: DropType;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  startsAt: Date;
  endsAt: Date;
  createdById?: string | null;
  createdVia?: "admin" | "gemini";
}

export function isDropLive(drop: { startsAt: Date; endsAt: Date; isActive: boolean; cancelledAt: Date | null; endedAt: Date | null }, now = new Date()): boolean {
  return drop.isActive && !drop.cancelledAt && !drop.endedAt && now >= drop.startsAt && now < drop.endsAt;
}

// ── creation + fan-out ───────────────────────────────────────────────────────

export async function createDrop(input: DropInput): Promise<{ id: string; fannedOut: number }> {
  const def = DROP_TYPES.find((d) => d.type === input.type);
  const payload = { ...(def?.defaultPayload ?? {}), ...(input.payload ?? {}) };

  let poolTotal = 0;
  if (input.type === "coin_rain" || input.type === "streak_freeze") {
    poolTotal = Math.max(1, Math.floor(Number(payload.poolTotal) || 0));
  }

  const [drop] = await db.insert(adminDropsTable).values({
    type: input.type,
    title: input.title.slice(0, 120),
    description: input.description?.slice(0, 500) ?? null,
    payload,
    poolTotal,
    poolClaimed: 0,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    isActive: true,
    createdById: input.createdById ?? null,
    createdVia: input.createdVia ?? "admin",
  }).returning();

  // Fan-out: in-app notification + push to real members (never to bots —
  // they don't read inboxes, and we don't fake engagement), socket pop, and
  // an optional email blast.
  let fannedOut = 0;
  try {
    const recipients = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(and(eq(usersTable.isGuest, false), eq(usersTable.role, "user")));

    if (recipients.length) {
      const ids = recipients.map((r) => r.id);
      const message = drop.description ?? "A drop is live on FocusArx.";
      // Bulk in-app notifications (500/stmt). Per-row params ($1..$2n), then
      // the constant title/message/data ($2n+1..$2n+3).
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const n = chunk.length;
        const params: unknown[] = [];
        const tuples = chunk.map((uid, k) => {
          params.push(uid, drop.id);
          return `(gen_random_uuid(), $${k * 2 + 1}::text, 'drop', $${2 * n + 1}::text, $${2 * n + 2}::text, $${2 * n + 3}::jsonb, false, now())`;
        });
        params.push(drop.title, message, JSON.stringify({ dropId: drop.id, type: drop.type }));
        await pool.query(
          `INSERT INTO notifications (id, user_id, type, title, message, data, read, created_at) VALUES ${tuples.join(", ")}`,
          params,
        );
      }
      fannedOut = recipients.length;
      // Push (best-effort, capped concurrency) + optional email handled by caller.
      await Promise.all(
        recipients.slice(0, 2000).map(async (r) => {
          try { await sendPush(r.id, { title: drop.title, body: drop.description ?? "A drop is live on FocusArx.", url: "/dashboard" }); } catch { /* best effort */ }
        }),
      );
    }
    emitDrop({ id: drop.id, type: drop.type, title: drop.title, description: drop.description, startsAt: drop.startsAt, endsAt: drop.endsAt });
  } catch (err) {
    logger.warn({ err, dropId: drop.id }, "drop fan-out failed (non-fatal)");
  }

  return { id: drop.id, fannedOut };
}

/**
 * Optional email blast for a drop (admin opt-in). Logs one row per recipient;
 * no-op when RESEND_API_KEY is unset (entries stay "pending").
 */
export async function emailBlastForDrop(dropId: string): Promise<{ recipients: number }> {
  const [drop] = await db.select().from(adminDropsTable).where(eq(adminDropsTable.id, dropId)).limit(1);
  if (!drop) return { recipients: 0 };
  const recipients = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(and(eq(usersTable.isGuest, false), eq(usersTable.role, "user")));
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #18181b;">
      <h1 style="font-size: 20px; margin: 0 0 8px;">${drop.title}</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #52525b;">${drop.description ?? "A drop is live on FocusArx."}</p>
      <p style="font-size: 13px; color: #71717a;">Live ${drop.startsAt.toLocaleString("en-IN")} – ${drop.endsAt.toLocaleString("en-IN")} (IST).</p>
      <a href="/dashboard" style="display: inline-block; background: #7c3aed; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 10px; font-size: 14px; font-weight: 600;">Open FocusArx</a>
    </div>`;
  for (const r of recipients) {
    const res = await sendEmail(r.email, `🔥 ${drop.title} — live now`, html, "drop_announcement");
    if (!res.ok) break; // provider down — don't spam the API
  }
  return { recipients: recipients.length };
}

// ── multipliers (server-side, used by the session-reward path) ───────────────

export interface ActiveMultiplier {
  multiplier: number;
  dropId: string | null;
  type: DropType | null;
}

/**
 * The effective XP multiplier for session rewards right now. Only one drop
 * type can grant XP at a time (first live wins); multipliers never stack —
 * predictable, auditable, and impossible to spoof from the client.
 */
export async function activeDropXpMultiplier(now = new Date()): Promise<ActiveMultiplier> {
  const rows = await db
    .select({ id: adminDropsTable.id, type: adminDropsTable.type, payload: adminDropsTable.payload, startsAt: adminDropsTable.startsAt, endsAt: adminDropsTable.endsAt, isActive: adminDropsTable.isActive, cancelledAt: adminDropsTable.cancelledAt, endedAt: adminDropsTable.endedAt })
    .from(adminDropsTable)
    .orderBy(desc(adminDropsTable.startsAt));
  for (const drop of rows) {
    if (!isDropLive(drop, now)) continue;
    if (drop.type === "double_xp" || drop.type === "board_shakeup") {
      const m = Number(drop.payload?.multiplier) || 1;
      if (m > 1) return { multiplier: m, dropId: drop.id, type: drop.type };
    }
  }
  return { multiplier: 1, dropId: null, type: null };
}

/** All live flash-sale discounts at once — itemId -> { discountPct, dropId, endsAt }. */
export async function liveSaleDiscounts(now = new Date()): Promise<Map<string, { discountPct: number; dropId: string; endsAt: Date }>> {
  const out = new Map<string, { discountPct: number; dropId: string; endsAt: Date }>();
  const rows = await db
    .select({ id: adminDropsTable.id, type: adminDropsTable.type, payload: adminDropsTable.payload, startsAt: adminDropsTable.startsAt, endsAt: adminDropsTable.endsAt, isActive: adminDropsTable.isActive, cancelledAt: adminDropsTable.cancelledAt, endedAt: adminDropsTable.endedAt })
    .from(adminDropsTable)
    .where(eq(adminDropsTable.type, "item_flash_sale"));
  for (const drop of rows) {
    if (!isDropLive(drop, now)) continue;
    const itemId = typeof drop.payload?.itemId === "string" ? drop.payload.itemId : null;
    if (!itemId) continue;
    const pct = Math.min(70, Math.max(0, Number(drop.payload?.discountPct) || 0));
    if (pct > 0) out.set(itemId, { discountPct: pct, dropId: drop.id, endsAt: drop.endsAt });
  }
  return out;
}

/** Flash-sale discount for a marketplace item right now (Workstream C tie-in). */
export async function activeSaleDiscount(itemId: string, now = new Date()): Promise<{ discountPct: number; dropId: string } | null> {
  const sales = await liveSaleDiscounts(now);
  const hit = sales.get(itemId);
  return hit ? { discountPct: hit.discountPct, dropId: hit.dropId } : null;
}

// ── claims ───────────────────────────────────────────────────────────────────

export type ClaimResult =
  | { ok: true; rewardCoins: number; rewardXp: number; itemGranted?: string; poolRemaining: number }
  | { ok: false; error: string; code: "not_live" | "no_claim" | "pool_empty" | "already_claimed" | "quest_not_met" | "not_found" | "sale_not_live" | "already_owned" | "cant_afford" };

export async function claimDrop(dropId: string, userId: string): Promise<ClaimResult> {
  const [drop] = await db.select().from(adminDropsTable).where(eq(adminDropsTable.id, dropId)).limit(1);
  if (!drop) return { ok: false, error: "Drop not found", code: "not_found" };
  const now = new Date();
  if (!isDropLive(drop, now)) return { ok: false, error: "This drop is not live right now", code: "not_live" };

  // Per-user duplicate guard (unique constraint is the last line of defence).
  const [existing] = await db.select({ id: adminDropClaimsTable.id })
    .from(adminDropClaimsTable)
    .where(and(eq(adminDropClaimsTable.dropId, dropId), eq(adminDropClaimsTable.userId, userId)))
    .limit(1);
  if (existing) return { ok: false, error: "You already claimed this drop", code: "already_claimed" };

  let rewardCoins = 0;
  let rewardXp = 0;
  let itemGranted: string | undefined;

  if (drop.type === "coin_rain" || drop.type === "streak_freeze") {
    // Atomic pool decrement — exactly one claimer wins the last unit.
    const res = await pool.query(
      `UPDATE admin_drops
       SET pool_claimed = pool_claimed + 1
       WHERE id = $1 AND is_active = true AND cancelled_at IS NULL AND ended_at IS NULL
         AND starts_at <= now() AND ends_at > now()
         AND pool_claimed + 1 <= pool_total
       RETURNING pool_claimed, pool_total`,
      [dropId],
    );
    if (!res.rowCount) return { ok: false, error: "The pool is empty", code: "pool_empty" };
    const poolRemaining = Number(res.rows[0].pool_total) - Number(res.rows[0].pool_claimed);

    if (drop.type === "coin_rain") {
      rewardCoins = Math.max(1, Math.floor(Number(drop.payload?.coinsPerClaim) || 100));
      await awardCoins(userId, rewardCoins, "drop_claim", `🪙 ${drop.title}`, { dropId });
    } else {
      const tokens = Math.max(1, Math.floor(Number(drop.payload?.tokensPerClaim) || 1));
      await db.insert(freezeTokensTable)
        .values({ userId, tokensAvailable: tokens })
        .onConflictDoUpdate({ target: freezeTokensTable.userId, set: { tokensAvailable: sql`${freezeTokensTable.tokensAvailable} + ${tokens}`, updatedAt: new Date() } });
    }
    await db.insert(adminDropClaimsTable).values({ dropId, userId, rewardCoins }).onConflictDoNothing();
    return { ok: true, rewardCoins, rewardXp, poolRemaining };
  }

  if (drop.type === "flash_quest") {
    const targetMinutes = Math.max(5, Math.floor(Number(drop.payload?.targetMinutes) || 60));
    const [row] = await db.select({ mins: sql<number>`coalesce(sum(${focusSessionsTable.durationSec}), 0) / 60` })
      .from(focusSessionsTable)
      .where(and(
        eq(focusSessionsTable.userId, userId),
        eq(focusSessionsTable.mode, "focus"),
        gte(focusSessionsTable.completedAt, drop.startsAt),
        lt(focusSessionsTable.completedAt, drop.endsAt),
      ));
    const mins = Math.floor(Number(row?.mins ?? 0));
    if (mins < targetMinutes) {
      return { ok: false, error: `Focus ${targetMinutes - mins} more minutes to claim this quest`, code: "quest_not_met" };
    }
    rewardCoins = Math.max(0, Math.floor(Number(drop.payload?.rewardCoins) || 0));
    rewardXp = Math.max(0, Math.floor(Number(drop.payload?.rewardXp) || 0));
    if (rewardCoins) await awardCoins(userId, rewardCoins, "drop_claim", `🚩 ${drop.title}`, { dropId });
    if (rewardXp) await awardXp(userId, rewardXp, { dropId });
    await db.insert(adminDropClaimsTable).values({ dropId, userId, rewardCoins, rewardXp }).onConflictDoNothing();
    return { ok: true, rewardCoins, rewardXp, poolRemaining: 0 };
  }

  if (drop.type === "item_flash_sale") {
    const itemId = String(drop.payload?.itemId ?? "");
    const [item] = itemId
      ? await db.select().from(marketplaceItemsTable).where(and(eq(marketplaceItemsTable.id, itemId), eq(marketplaceItemsTable.isActive, true))).limit(1)
      : [];
    if (!item) return { ok: false, error: "This sale's item is not available", code: "sale_not_live" };
    const [owned] = await db.select({ id: userInventoryTable.id })
      .from(userInventoryTable)
      .where(and(eq(userInventoryTable.userId, userId), eq(userInventoryTable.itemId, item.id)))
      .limit(1);
    if (owned) return { ok: false, error: "You already own this item", code: "already_owned" };
    const discountPct = Math.min(70, Math.max(0, Number(drop.payload?.discountPct) || 0));
    const price = Math.max(1, Math.round(item.costCoins * (100 - discountPct) / 100));
    const [wallet] = await db.select().from(userWalletsTable).where(eq(userWalletsTable.userId, userId)).limit(1);
    if (!wallet || wallet.coins < price) {
      return { ok: false, error: `Need ${price} coins for this sale`, code: "cant_afford" };
    }
    // Atomic spend: only succeeds if balance still covers the price.
    const spend = await pool.query(
      `UPDATE user_wallets SET coins = coins - $2, updated_at = now()
       WHERE user_id = $1 AND coins >= $2 RETURNING coins`,
      [userId, price],
    );
    if (!spend.rowCount) return { ok: false, error: "Not enough coins", code: "cant_afford" };
    await db.insert(coinTransactionsTable).values({
      userId, type: "spend", amount: -price, reason: "drop_purchase",
      description: `🏷️ ${item.name} (flash sale, ${discountPct}% off)`,
      balanceAfter: Number(spend.rows[0].coins), metadata: { dropId, itemId: item.id, discountPct },
    });
    await db.insert(userInventoryTable).values({ userId, itemId: item.id, equipped: false }).onConflictDoNothing();
    itemGranted = item.name;
    await db.insert(adminDropClaimsTable).values({ dropId, userId, itemGranted: item.id }).onConflictDoNothing();
    return { ok: true, rewardCoins: 0, rewardXp: 0, itemGranted, poolRemaining: 0 };
  }

  // double_xp / board_shakeup have nothing to claim — the multiplier applies
  // to sessions automatically during the window.
  return { ok: false, error: "Nothing to claim — the multiplier applies automatically to your sessions", code: "no_claim" };
}

// ── ledger helpers (every drop mint/burn is a coin_transaction — rule C) ────

async function awardCoins(userId: string, amount: number, reason: string, description: string, metadata: Record<string, unknown>): Promise<void> {
  const res = await pool.query(
    `UPDATE user_wallets SET coins = coins + $2, updated_at = now()
     WHERE user_id = $1 RETURNING coins`,
    [userId, amount],
  );
  if (!res.rowCount) {
    // User has no wallet row yet — create it with the balance (never update
    // on top of the insert or the reward would double).
    await db.insert(userWalletsTable).values({ userId, coins: amount, totalXp: 0, weeklyXp: 0 }).onConflictDoUpdate({
      target: userWalletsTable.userId,
      set: { coins: sql`${userWalletsTable.coins} + ${amount}`, updatedAt: new Date() },
    });
  }
  const after = await pool.query(`SELECT coins FROM user_wallets WHERE user_id = $1`, [userId]);
  await db.insert(coinTransactionsTable).values({
    userId, type: "earn", amount, reason, description,
    balanceAfter: Number(after.rows[0]?.coins ?? amount), metadata,
  });
}

async function awardXp(userId: string, amount: number, metadata: Record<string, unknown>): Promise<void> {
  const res = await pool.query(
    `UPDATE user_wallets
     SET total_xp = total_xp + $2,
         weekly_xp = weekly_xp + $2,
         level = GREATEST(1, floor(sqrt((total_xp + $2) / 100.0)) + 1),
         updated_at = now()
     WHERE user_id = $1 RETURNING 1`,
    [userId, amount],
  );
  if (!res.rowCount) {
    await db.insert(userWalletsTable).values({ userId, coins: 0, totalXp: amount, weeklyXp: amount }).onConflictDoNothing();
  }
  void metadata;
}

// ── admin surface ────────────────────────────────────────────────────────────

export async function listDrops() {
  const drops = await db.select().from(adminDropsTable).orderBy(desc(adminDropsTable.createdAt)).limit(100);
  const claimCounts = await db
    .select({ dropId: adminDropClaimsTable.dropId, n: sql<number>`count(*)` })
    .from(adminDropClaimsTable)
    .groupBy(adminDropClaimsTable.dropId);
  const countMap = new Map(claimCounts.map((c) => [c.dropId, Number(c.n)]));
  return drops.map((d) => ({
    ...d,
    claims: countMap.get(d.id) ?? 0,
    poolRemaining: d.poolTotal - d.poolClaimed,
    live: isDropLive(d),
  }));
}

export async function endDrop(dropId: string, cancelled = false) {
  const set: Record<string, unknown> = cancelled
    ? { cancelledAt: new Date(), isActive: false }
    : { endedAt: new Date(), isActive: false };
  await db.update(adminDropsTable).set(set).where(eq(adminDropsTable.id, dropId));
}

export async function duplicateDrop(dropId: string): Promise<{ id: string } | null> {
  const [drop] = await db.select().from(adminDropsTable).where(eq(adminDropsTable.id, dropId)).limit(1);
  if (!drop) return null;
  const durationMs = drop.endsAt.getTime() - drop.startsAt.getTime();
  const now = new Date();
  const [copy] = await db.insert(adminDropsTable).values({
    type: drop.type,
    title: `${drop.title} (repeat)`,
    description: drop.description,
    payload: drop.payload,
    poolTotal: drop.poolTotal,
    poolClaimed: 0,
    startsAt: now,
    endsAt: new Date(now.getTime() + durationMs),
    isActive: true,
    createdVia: drop.createdVia,
  }).returning({ id: adminDropsTable.id });
  return copy;
}

/** Live claim-rate sparkline data (claims per 15-min bucket, last 2h). */
export async function dropClaimSparkline(dropId: string) {
  const rows = await db
    .select({ claimedAt: adminDropClaimsTable.claimedAt })
    .from(adminDropClaimsTable)
    .where(and(eq(adminDropClaimsTable.dropId, dropId), gte(adminDropClaimsTable.claimedAt, new Date(Date.now() - 2 * 3600 * 1000))));
  // Bucket in JS (15 min over 2h = 8 buckets) — tiny dataset, no SQL trickery.
  const buckets: Array<{ bucket: string; n: number }> = [];
  const now = Date.now();
  for (let b = 7; b >= 0; b--) {
    const start = now - (b + 1) * 15 * 60 * 1000;
    const end = now - b * 15 * 60 * 1000;
    buckets.push({
      bucket: new Date(end).toISOString().slice(11, 16),
      n: rows.filter((r) => { const t = new Date(r.claimedAt).getTime(); return t > start && t <= end; }).length,
    });
  }
  return buckets;
}
