import { Router } from "express";
import {
  db,
  visitorsTable,
  analyticsEventsTable,
  usersTable,
  activeSessionsTable,
  focusSessionsTable,
  tokenLedgerTable,
  premiumEntitlementsTable,
  premiumPlansTable,
  userPetInventoryTable,
  petCatalogTable,
  battlePassClaimsTable,
  aiCallLogTable,
} from "@workspace/db";
import { eq, and, gte, desc, sql, count, isNotNull, lte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { checkAdminAuth } from "../lib/adminAuth";
import { sendUnauthorized } from "../lib/httpErrors";

const router = Router();

const ONLINE_MS = 5 * 60 * 1000;

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

router.get("/admin/analytics/overview", async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const now = new Date();
    const onlineCutoff = new Date(now.getTime() - ONLINE_MS);
    const todayStart = dayStart(now);

    const [totals] = await db.select({
      uniqueVisitors: count(),
    }).from(visitorsTable).where(eq(visitorsTable.isBot, false));

    const [visitSum] = await db.select({
      total: sql<number>`coalesce(sum(${visitorsTable.visitCount}), 0)::int`,
    }).from(visitorsTable).where(eq(visitorsTable.isBot, false));

    const [returning] = await db.select({ c: count() })
      .from(visitorsTable)
      .where(and(
        eq(visitorsTable.isBot, false),
        sql`${visitorsTable.visitCount} > 1`,
      ));

    const [online] = await db.select({ c: count() })
      .from(visitorsTable)
      .where(and(
        eq(visitorsTable.isBot, false),
        gte(visitorsTable.lastSeen, onlineCutoff),
      ));

    const [activeToday] = await db.select({ c: count() })
      .from(visitorsTable)
      .where(and(
        eq(visitorsTable.isBot, false),
        gte(visitorsTable.lastSeen, todayStart),
      ));

    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const [activeWeek] = await db.select({ c: count() })
      .from(visitorsTable)
      .where(and(eq(visitorsTable.isBot, false), gte(visitorsTable.lastSeen, weekAgo)));

    const [activeMonth] = await db.select({ c: count() })
      .from(visitorsTable)
      .where(and(eq(visitorsTable.isBot, false), gte(visitorsTable.lastSeen, monthAgo)));

    const unique = totals?.uniqueVisitors ?? 0;
    const returningCount = returning?.c ?? 0;

    res.json({
      totalVisits: visitSum?.total ?? 0,
      uniqueVisitors: unique,
      returningVisitors: returningCount,
      onlineUsers: online?.c ?? 0,
      activeToday: activeToday?.c ?? 0,
      activeWeek: activeWeek?.c ?? 0,
      activeMonth: activeMonth?.c ?? 0,
      returningRate: unique > 0 ? Math.round((returningCount / unique) * 100) : 0,
    });
  } catch (err) {
    logger.error({ err }, "admin analytics overview error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/analytics/charts", async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 29 * 86400000);

    const dailyRows = await db.select({
      date: sql<string>`date(${visitorsTable.lastSeen})`.as("date"),
      visitors: sql<number>`count(distinct ${visitorsTable.visitorId})::int`.as("visitors"),
    })
      .from(visitorsTable)
      .where(and(
        eq(visitorsTable.isBot, false),
        gte(visitorsTable.lastSeen, thirtyDaysAgo),
      ))
      .groupBy(sql`date(${visitorsTable.lastSeen})`)
      .orderBy(sql`date(${visitorsTable.lastSeen})`);

    const dailyMap = new Map(dailyRows.map((r) => [r.date, r.visitors]));
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(thirtyDaysAgo.getTime() + i * 86400000);
      const date = d.toISOString().split("T")[0]!;
      return { date, visitors: dailyMap.get(date) ?? 0 };
    });

    const twelveWeeksAgo = new Date(now.getTime() - 11 * 7 * 86400000);
    const weeklyRows = await db.select({
      week: sql<string>`to_char(date_trunc('week', ${visitorsTable.lastSeen}), 'YYYY-MM-DD')`.as("week"),
      visitors: sql<number>`count(distinct ${visitorsTable.visitorId})::int`.as("visitors"),
    })
      .from(visitorsTable)
      .where(and(eq(visitorsTable.isBot, false), gte(visitorsTable.lastSeen, twelveWeeksAgo)))
      .groupBy(sql`date_trunc('week', ${visitorsTable.lastSeen})`)
      .orderBy(sql`date_trunc('week', ${visitorsTable.lastSeen})`);

    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const monthlyRows = await db.select({
      month: sql<string>`to_char(date_trunc('month', ${visitorsTable.lastSeen}), 'YYYY-MM')`.as("month"),
      visitors: sql<number>`count(distinct ${visitorsTable.visitorId})::int`.as("visitors"),
    })
      .from(visitorsTable)
      .where(and(eq(visitorsTable.isBot, false), gte(visitorsTable.lastSeen, twelveMonthsAgo)))
      .groupBy(sql`date_trunc('month', ${visitorsTable.lastSeen})`)
      .orderBy(sql`date_trunc('month', ${visitorsTable.lastSeen})`);

    const thisMonth = daily.filter((d) => d.date.startsWith(now.toISOString().slice(0, 7)));
    const lastMonthDate = new Date(now);
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);
    const lastMonthVisitors = monthlyRows.find((m) => m.month === lastMonthKey)?.visitors ?? 0;
    const thisMonthVisitors = thisMonth.reduce((a, d) => a + d.visitors, 0);
    const growthPct = lastMonthVisitors > 0
      ? Math.round(((thisMonthVisitors - lastMonthVisitors) / lastMonthVisitors) * 100)
      : thisMonthVisitors > 0 ? 100 : 0;

    res.json({
      daily,
      weekly: weeklyRows.map((r) => ({ week: r.week, visitors: r.visitors })),
      monthly: monthlyRows.map((r) => ({ month: r.month, visitors: r.visitors })),
      growthPct,
    });
  } catch (err) {
    logger.error({ err }, "admin analytics charts error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/analytics/devices", async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const devices = await db.select({
      name: visitorsTable.deviceType,
      count: count(),
    })
      .from(visitorsTable)
      .where(and(eq(visitorsTable.isBot, false), isNotNull(visitorsTable.deviceType)))
      .groupBy(visitorsTable.deviceType);

    const browsers = await db.select({
      name: visitorsTable.browser,
      count: count(),
    })
      .from(visitorsTable)
      .where(and(eq(visitorsTable.isBot, false), isNotNull(visitorsTable.browser)))
      .groupBy(visitorsTable.browser)
      .orderBy(desc(count()))
      .limit(8);

    const osList = await db.select({
      name: visitorsTable.os,
      count: count(),
    })
      .from(visitorsTable)
      .where(and(eq(visitorsTable.isBot, false), isNotNull(visitorsTable.os)))
      .groupBy(visitorsTable.os)
      .orderBy(desc(count()))
      .limit(8);

    res.json({
      devices: devices.map((d) => ({ name: d.name ?? "unknown", count: d.count })),
      browsers: browsers.map((b) => ({ name: b.name ?? "Other", count: b.count })),
      os: osList.map((o) => ({ name: o.name ?? "Other", count: o.count })),
    });
  } catch (err) {
    logger.error({ err }, "admin analytics devices error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/analytics/live", async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const since = req.query.since as string | undefined;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60 * 60 * 1000);
    const now = new Date();
    const onlineCutoff = new Date(now.getTime() - ONLINE_MS);

    const events = await db.select({
      id: analyticsEventsTable.id,
      eventType: analyticsEventsTable.eventType,
      eventData: analyticsEventsTable.eventData,
      createdAt: analyticsEventsTable.createdAt,
      visitorId: analyticsEventsTable.visitorId,
    })
      .from(analyticsEventsTable)
      .where(gte(analyticsEventsTable.createdAt, sinceDate))
      .orderBy(desc(analyticsEventsTable.createdAt))
      .limit(50);

    // ── Who is here right now ────────────────────────────────────────────────
    // The event log alone is a poor "live" view: it says what happened, not who
    // is on the site this minute. Surface currently-focusing users (from
    // active_sessions) plus a live visitor/online count.
    const focusing = await db.select({
      userId: activeSessionsTable.userId,
      mode: activeSessionsTable.mode,
      timerStatus: activeSessionsTable.timerStatus,
      secondsLeft: activeSessionsTable.secondsLeft,
      activeSeconds: activeSessionsTable.activeSeconds,
      startedAt: activeSessionsTable.startedAt,
      name: usersTable.name,
      email: usersTable.email,
      isGuest: usersTable.isGuest,
    })
      .from(activeSessionsTable)
      .innerJoin(usersTable, eq(usersTable.id, activeSessionsTable.userId))
      .orderBy(desc(activeSessionsTable.startedAt))
      .limit(25);

    const [onlineVisitors] = await db.select({ c: count() })
      .from(visitorsTable)
      .where(and(eq(visitorsTable.isBot, false), gte(visitorsTable.lastSeen, onlineCutoff)));

    const [focusingCount] = await db.select({ c: count() })
      .from(activeSessionsTable)
      .where(eq(activeSessionsTable.timerStatus, "running"));

    res.json({
      events,
      serverTime: now.toISOString(),
      live: {
        onlineVisitors: Number(onlineVisitors?.c ?? 0),
        focusingNow: Number(focusingCount?.c ?? 0),
        users: focusing.map((u) => ({
          userId: u.userId,
          name: u.name || u.email?.split("@")[0] || (u.isGuest ? "Guest" : "User"),
          isGuest: u.isGuest,
          mode: u.mode,
          timerStatus: u.timerStatus,
          secondsLeft: u.secondsLeft,
          activeSeconds: u.activeSeconds,
          startedAt: u.startedAt,
        })),
      },
    });
  } catch (err) {
    logger.error({ err }, "admin analytics live error");
    res.status(500).json({ error: "Internal error" });
  }
});


router.get("/admin/analytics/premium-economy", async (req, res) => {
  if (!await checkAdminAuth(req)) { sendUnauthorized(res); return; }
  try {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24*3600*1000);
    const weekAgo = new Date(now.getTime() - 7*24*3600*1000);
    const monthAgo = new Date(now.getTime() - 30*24*3600*1000);

    // DAU/WAU
    const [dau] = await db.select({ c: count() }).from(visitorsTable).where(and(eq(visitorsTable.isBot,false), gte(visitorsTable.lastSeen, dayAgo)));
    const [wau] = await db.select({ c: count() }).from(visitorsTable).where(and(eq(visitorsTable.isBot,false), gte(visitorsTable.lastSeen, weekAgo)));

    // Focus minutes
    const [focusAgg] = await db.select({ totalSec: sql<number>`coalesce(sum(${focusSessionsTable.durationSec}),0)`, cnt: count() }).from(focusSessionsTable).where(gte(focusSessionsTable.createdAt, weekAgo));
    const [focusMonthAgg] = await db.select({ totalSec: sql<number>`coalesce(sum(${focusSessionsTable.durationSec}),0)` }).from(focusSessionsTable).where(gte(focusSessionsTable.createdAt, monthAgo));

    // Token circulation
    const [circulation] = await db.select({ sum: sql<number>`coalesce(sum(amount),0)` }).from(tokenLedgerTable);
    const [earned] = await db.select({ sum: sql<number>`coalesce(sum(amount),0)` }).from(tokenLedgerTable).where(eq(tokenLedgerTable.transactionType, "earn"));
    const [spent] = await db.select({ sum: sql<number>`coalesce(sum(amount),0)` }).from(tokenLedgerTable).where(eq(tokenLedgerTable.transactionType, "spend"));
    const [grants] = await db.select({ sum: sql<number>`coalesce(sum(amount),0)` }).from(tokenLedgerTable).where(eq(tokenLedgerTable.transactionType, "admin_grant"));

    // Premium unlocks/expirations
    const [activePremium] = await db.select({ c: count() }).from(premiumEntitlementsTable).where(and(eq(premiumEntitlementsTable.status, "active"), gte(premiumEntitlementsTable.endsAt, now)));
    const [expiredWeek] = await db.select({ c: count() }).from(premiumEntitlementsTable).where(and(eq(premiumEntitlementsTable.status, "expired"), gte(premiumEntitlementsTable.endsAt, weekAgo)));
    const [unlocksWeek] = await db.select({ c: count() }).from(premiumEntitlementsTable).where(gte(premiumEntitlementsTable.createdAt, weekAgo));
    const [expiringSoon] = await db.select({ c: count() }).from(premiumEntitlementsTable).where(and(eq(premiumEntitlementsTable.status, "active"), lte(premiumEntitlementsTable.endsAt, new Date(now.getTime()+3*24*3600*1000)), gte(premiumEntitlementsTable.endsAt, now)));

    // Battle-pass participation
    const [bpParticipants] = await db.select({ c: sql<number>`count(distinct ${battlePassClaimsTable.userId})` }).from(battlePassClaimsTable).where(gte(battlePassClaimsTable.claimedAt, monthAgo));
    const [bpClaimsWeek] = await db.select({ c: count() }).from(battlePassClaimsTable).where(gte(battlePassClaimsTable.claimedAt, weekAgo));

    // Pet ownership
    const [totalPetsOwned] = await db.select({ c: count() }).from(userPetInventoryTable);
    const petOwnershipByRarity = await db.select({ rarity: petCatalogTable.rarity, count: count() }).from(userPetInventoryTable).innerJoin(petCatalogTable, eq(petCatalogTable.id, userPetInventoryTable.petId)).groupBy(petCatalogTable.rarity);
    const petOwnershipByCategory = await db.select({ category: petCatalogTable.category, count: count() }).from(userPetInventoryTable).innerJoin(petCatalogTable, eq(petCatalogTable.id, userPetInventoryTable.petId)).groupBy(petCatalogTable.category);

    // Events: seasonal/event pet unlocks etc via token ledger source seasonal_event, event
    const [seasonalEarned] = await db.select({ sum: sql<number>`coalesce(sum(amount),0)` }).from(tokenLedgerTable).where(eq(tokenLedgerTable.source, "seasonal_event"));
    const [referralEarned] = await db.select({ sum: sql<number>`coalesce(sum(amount),0)` }).from(tokenLedgerTable).where(eq(tokenLedgerTable.source, "referral"));

    // AI usage
    const [aiCallsWeek] = await db.select({ c: count() }).from(aiCallLogTable).where(gte(aiCallLogTable.createdAt, weekAgo));
    const [aiCallsMonth] = await db.select({ c: count() }).from(aiCallLogTable).where(gte(aiCallLogTable.createdAt, monthAgo));
    const aiByStatus = await db.select({ status: aiCallLogTable.status, count: count() }).from(aiCallLogTable).where(gte(aiCallLogTable.createdAt, weekAgo)).groupBy(aiCallLogTable.status);

    // Errors: count failed AI calls + maybe analytics events with error type
    const [failedAi] = await db.select({ c: count() }).from(aiCallLogTable).where(and(eq(aiCallLogTable.status, "error"), gte(aiCallLogTable.createdAt, weekAgo)));

    res.json({
      dau: dau?.c ?? 0,
      wau: wau?.c ?? 0,
      focusMinutesWeek: Math.round((focusAgg?.totalSec ?? 0)/60),
      focusMinutesMonth: Math.round((focusMonthAgg?.totalSec ?? 0)/60),
      focusSessionsWeek: focusAgg?.cnt ?? 0,
      tokenCirculation: circulation?.sum ?? 0,
      totalEarned: earned?.sum ?? 0,
      totalSpent: Math.abs(spent?.sum ?? 0),
      totalAdminGrants: grants?.sum ?? 0,
      premium: {
        active: activePremium?.c ?? 0,
        unlocksWeek: unlocksWeek?.c ?? 0,
        expiredWeek: expiredWeek?.c ?? 0,
        expiringSoon: expiringSoon?.c ?? 0,
      },
      battlePass: {
        participantsMonth: Number((bpParticipants as any)?.c ?? 0),
        claimsWeek: bpClaimsWeek?.c ?? 0,
      },
      pets: {
        totalOwned: totalPetsOwned?.c ?? 0,
        byRarity: petOwnershipByRarity,
        byCategory: petOwnershipByCategory,
      },
      events: {
        seasonalTokens: seasonalEarned?.sum ?? 0,
        referralTokens: referralEarned?.sum ?? 0,
      },
      aiUsage: {
        callsWeek: aiCallsWeek?.c ?? 0,
        callsMonth: aiCallsMonth?.c ?? 0,
        byStatus: aiByStatus,
        errorsWeek: failedAi?.c ?? 0,
      }
    });
  } catch (err) {
    const { logger } = await import("../lib/logger");
    logger.error({ err }, "admin premium-economy analytics error");
    res.status(500).json({ error: "Internal error" });
  }
});


export { router as adminAnalyticsRouter };
