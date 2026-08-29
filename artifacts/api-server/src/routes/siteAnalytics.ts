import { Router } from "express";
import { z } from "zod";
import { db, visitorsTable, analyticsSessionsTable, pageViewsTable, analyticsEventsTable } from "@workspace/db";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { trackLimiter } from "../lib/rateLimiter";
import { isBotUserAgent } from "../lib/botFilter";
import { parseUserAgent, resolveCountry } from "../lib/parseUserAgent";
import { sendValidationError } from "../lib/httpErrors";
import { extractUserId } from "./auth";

const router = Router();

const SESSION_IDLE_MS = 30 * 60 * 1000;
const PAGE_DEDUPE_MS = 30 * 1000;

const trackSchema = z.object({
  visitorId: z.string().min(8).max(80).regex(/^foc_/),
  sessionId: z.string().min(8).max(80).optional(),
  page: z.string().max(500).optional(),
  userId: z.string().max(80).optional(),
  events: z.array(z.object({
    eventId: z.string().min(8).max(120),
    eventType: z.string().min(1).max(80),
    eventData: z.record(z.string(), z.unknown()).optional(),
  })).max(20).optional(),
});

function sessionCounterField(eventType: string): keyof typeof analyticsSessionsTable.$inferInsert | null {
  switch (eventType) {
    case "focus_session_started": return "focusSessionsStarted";
    case "task_created": return "tasksCreated";
    case "roadmap_generated": return "roadmapsGenerated";
    case "ai_feature_used": return "aiFeaturesUsed";
    default: return null;
  }
}

async function findOrCreateSession(visitorId: string, sessionId: string | undefined, now: Date) {
  if (sessionId) {
    const [existing] = await db.select()
      .from(analyticsSessionsTable)
      .where(and(
        eq(analyticsSessionsTable.id, sessionId),
        eq(analyticsSessionsTable.visitorId, visitorId),
      ));
    if (existing) {
      const idle = now.getTime() - existing.lastActivityAt.getTime();
      if (idle <= SESSION_IDLE_MS) {
        return { session: existing, isNew: false };
      }
      await db.update(analyticsSessionsTable)
        .set({
          sessionEnd: existing.lastActivityAt,
          durationSec: Math.round((existing.lastActivityAt.getTime() - existing.sessionStart.getTime()) / 1000),
        })
        .where(eq(analyticsSessionsTable.id, existing.id));
    }
  }

  const cutoff = new Date(now.getTime() - SESSION_IDLE_MS);
  const [recent] = await db.select()
    .from(analyticsSessionsTable)
    .where(and(
      eq(analyticsSessionsTable.visitorId, visitorId),
      gte(analyticsSessionsTable.lastActivityAt, cutoff),
    ))
    .orderBy(desc(analyticsSessionsTable.lastActivityAt))
    .limit(1);

  if (recent) {
    return { session: recent, isNew: false };
  }

  const [created] = await db.insert(analyticsSessionsTable)
    .values({ visitorId, sessionStart: now, lastActivityAt: now })
    .returning();

  await db.update(visitorsTable)
    .set({ visitCount: sql`${visitorsTable.visitCount} + 1`, lastSeen: now })
    .where(eq(visitorsTable.visitorId, visitorId));

  return { session: created!, isNew: true };
}

router.post("/track", trackLimiter, async (req, res) => {
  const parsed = trackSchema.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, "Invalid tracking payload");
    return;
  }

  const { visitorId, sessionId: clientSessionId, page, userId: bodyUserId, events } = parsed.data;
  const ua = req.headers["user-agent"] ?? "";
  const isBot = isBotUserAgent(ua);
  const now = new Date();

  if (isBot) {
    res.json({ ok: true, sessionId: clientSessionId ?? null, skipped: "bot" });
    return;
  }

  const authUserId = extractUserId(req);
  const linkedUserId = bodyUserId ?? authUserId ?? null;
  const { deviceType, browser, os } = parseUserAgent(ua);
  const country = resolveCountry(req);

  try {
    await db.insert(visitorsTable).values({
      visitorId,
      userId: linkedUserId,
      firstSeen: now,
      lastSeen: now,
      visitCount: 0,
      deviceType,
      browser,
      os,
      country,
      isBot: false,
    }).onConflictDoUpdate({
      target: visitorsTable.visitorId,
      set: {
        lastSeen: now,
        ...(linkedUserId ? { userId: linkedUserId } : {}),
        deviceType,
        browser,
        os,
        ...(country ? { country } : {}),
      },
    });

    const { session, isNew } = await findOrCreateSession(visitorId, clientSessionId, now);

    if (page) {
      const dedupeCutoff = new Date(now.getTime() - PAGE_DEDUPE_MS);
      const [recentPage] = await db.select({ id: pageViewsTable.id })
        .from(pageViewsTable)
        .where(and(
          eq(pageViewsTable.visitorId, visitorId),
          eq(pageViewsTable.page, page),
          gte(pageViewsTable.viewedAt, dedupeCutoff),
        ))
        .limit(1);

      if (!recentPage) {
        await db.insert(pageViewsTable).values({
          visitorId,
          sessionId: session.id,
          page,
          viewedAt: now,
        });
        await db.update(analyticsSessionsTable)
          .set({
            pageViews: sql`${analyticsSessionsTable.pageViews} + 1`,
            lastActivityAt: now,
          })
          .where(eq(analyticsSessionsTable.id, session.id));
      } else {
        await db.update(analyticsSessionsTable)
          .set({ lastActivityAt: now })
          .where(eq(analyticsSessionsTable.id, session.id));
      }
    } else {
      await db.update(analyticsSessionsTable)
        .set({ lastActivityAt: now })
        .where(eq(analyticsSessionsTable.id, session.id));
    }

    if (events?.length) {
      for (const ev of events) {
        try {
          await db.insert(analyticsEventsTable).values({
            eventId: ev.eventId,
            visitorId,
            sessionId: session.id,
            eventType: ev.eventType,
            eventData: ev.eventData ?? null,
          });

          const counter = sessionCounterField(ev.eventType);
          if (counter === "focusSessionsStarted") {
            await db.update(analyticsSessionsTable)
              .set({ focusSessionsStarted: sql`${analyticsSessionsTable.focusSessionsStarted} + 1`, lastActivityAt: now })
              .where(eq(analyticsSessionsTable.id, session.id));
          } else if (counter === "tasksCreated") {
            await db.update(analyticsSessionsTable)
              .set({ tasksCreated: sql`${analyticsSessionsTable.tasksCreated} + 1`, lastActivityAt: now })
              .where(eq(analyticsSessionsTable.id, session.id));
          } else if (counter === "roadmapsGenerated") {
            await db.update(analyticsSessionsTable)
              .set({ roadmapsGenerated: sql`${analyticsSessionsTable.roadmapsGenerated} + 1`, lastActivityAt: now })
              .where(eq(analyticsSessionsTable.id, session.id));
          } else if (counter === "aiFeaturesUsed") {
            await db.update(analyticsSessionsTable)
              .set({ aiFeaturesUsed: sql`${analyticsSessionsTable.aiFeaturesUsed} + 1`, lastActivityAt: now })
              .where(eq(analyticsSessionsTable.id, session.id));
          }
        } catch {
          /* duplicate event_id — ignore */
        }
      }
    }

    res.json({ ok: true, sessionId: session.id, isNewSession: isNew });
  } catch (err) {
    // Analytics is best-effort telemetry, never part of the product contract.
    //
    // A 500 here is actively harmful: the client batches events and flushes on
    // a timer, so failing loudly turns one database blip into a retry storm
    // from every open tab at exactly the moment the database is already
    // struggling. Log the real error server-side, answer 503 with `ok: false`
    // — honest, retryable, distinguishable from success. Nothing in the app
    // reads this response to decide whether to keep working.
    logger.warn({ err, visitorId, page }, "track error — analytics event dropped");
    res.status(503).json({
      ok: false,
      error: { code: "TRACK_FAILED", message: "Analytics event could not be recorded" },
    });
  }
});

export { router as siteAnalyticsRouter };
