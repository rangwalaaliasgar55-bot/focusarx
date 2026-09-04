import { Router } from "express";
import { and, eq, gte } from "drizzle-orm";
import { db, focusSessionsTable, studyStreaksTable, usersTable } from "@workspace/db";
import { authMiddleware, AuthRequest } from "../middlewares/auth";
import { generalLimiter } from "../lib/rateLimiter";
import { sendEmail } from "./email";
import { emailLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { resolveUserZone } from "../lib/timezone";

const router = Router();

function hourInZone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false })
      .formatToParts(date);
    return Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  } catch {
    return date.getUTCHours();
  }
}

async function buildRecap(userId: string) {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [user] = await db.select({ timezone: usersTable.timezone, email: usersTable.email, name: usersTable.name })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const zone = resolveUserZone(user?.timezone);
  const sessions = await db.select({
    durationSec: focusSessionsTable.durationSec,
    status: focusSessionsTable.sessionStatus,
    completedAt: focusSessionsTable.completedAt,
  }).from(focusSessionsTable)
    .where(and(eq(focusSessionsTable.userId, userId), gte(focusSessionsTable.completedAt, since)))
    .limit(2000);
  const focus = sessions.filter((s) => (s.status ?? "completed") !== "cancelled");
  const minutes = Math.round(focus.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) / 60);
  const hours = new Array<number>(24).fill(0);
  for (const s of focus) {
    if (s.completedAt) hours[hourInZone(new Date(s.completedAt), zone)]! += 1;
  }
  const bestHour = hours.indexOf(Math.max(...hours));
  const [streak] = await db.select({ currentStreak: studyStreaksTable.currentStreak })
    .from(studyStreaksTable).where(eq(studyStreaksTable.userId, userId)).limit(1);
  return {
    weekKey: new Date().toISOString().slice(0, 10),
    sessions: focus.length,
    minutes,
    bestHour: focus.length ? bestHour : null,
    currentStreak: streak?.currentStreak ?? 0,
    email: user?.email ?? null,
    name: user?.name ?? null,
  };
}

function recapText(r: Awaited<ReturnType<typeof buildRecap>>): string {
  const who = r.name ? `, ${r.name.split(" ")[0]}` : "";
  return [
    `Your week${who}: ${r.sessions} sessions, ${r.minutes} focused minutes, ${r.currentStreak}-day streak.`,
    r.bestHour != null ? `Sharpest hour: ${r.bestHour}:00.` : "",
  ].filter(Boolean).join(" ");
}

/** Weekly recap data + share-image URL (Phase 9.11). */
router.get("/recap/weekly", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const recap = await buildRecap(req.userId!);
    const params = new URLSearchParams({
      tag: "WEEKLY RECAP",
      title: `${recap.minutes} focused minutes`,
      subtitle: `${recap.sessions} sessions · ${recap.currentStreak}-day streak`,
    });
    res.json({ ...recap, shareImage: `/api/og?${params.toString()}` });
  } catch (err) {
    logger.error({ err }, "weekly recap error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Recap failed" } });
  }
});

/** Email the recap to the account address (max 1/day, Resend when configured). */
router.post("/recap/weekly/email", authMiddleware, generalLimiter, async (req: AuthRequest, res) => {
  try {
    const recap = await buildRecap(req.userId!);
    if (!recap.email) {
      res.status(400).json({ error: { code: "NO_EMAIL", message: "No email on this account" } });
      return;
    }
    const dayAgo = new Date(Date.now() - 20 * 3_600_000);
    const [recent] = await db.select({ id: emailLogsTable.id }).from(emailLogsTable)
      .where(and(
        eq(emailLogsTable.recipientId, req.userId!),
        eq(emailLogsTable.template, "weekly_recap"),
        gte(emailLogsTable.createdAt, dayAgo),
      )).limit(1);
    if (recent) {
      res.status(429).json({ error: { code: "ALREADY_SENT", message: "Recap already sent today" } });
      return;
    }
    const text = recapText(recap);
    const result = await sendEmail(
      recap.email,
      `Your FocusArx week: ${recap.minutes} focused minutes`,
      `<p>${text}</p><p>Keep the streak alive — one session today is enough.</p>`,
      "weekly_recap",
      req.userId!,
    );
    if (!result.ok) {
      res.status(502).json({ error: { code: "EMAIL_FAILED", message: result.error ?? "Send failed" } });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "weekly recap email error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Recap email failed" } });
  }
});

export { router as recapRouter };
