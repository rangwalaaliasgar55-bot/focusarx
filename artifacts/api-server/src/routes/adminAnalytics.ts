import { Router } from "express";
import {
  db,
  visitorsTable,
  analyticsEventsTable,
} from "@workspace/db";
import { eq, and, gte, desc, sql, count, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { checkAdminAuth } from "../lib/adminAuth";

const router = Router();

const ONLINE_MS = 5 * 60 * 1000;

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

router.get("/admin/analytics/overview", async (req, res) => {
  if (!await checkAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
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
  if (!await checkAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
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
  if (!await checkAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
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
  if (!await checkAdminAuth(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const since = req.query.since as string | undefined;
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60 * 60 * 1000);

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

    res.json({ events, serverTime: new Date().toISOString() });
  } catch (err) {
    logger.error({ err }, "admin analytics live error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as adminAnalyticsRouter };
