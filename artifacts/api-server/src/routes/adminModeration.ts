import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, socialPostsTable, usersTable, postCommentsTable } from "@workspace/db";
import { eq, inArray, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getServerConfig } from "../lib/config";
import { extractUserId } from "./auth";
import { adminLimiter } from "../lib/rateLimiter";

const router = Router();
const ADMIN_COOKIE = "focusarx_admin";

function isAdminAuthed(req: { headers: { cookie?: string } }): boolean {
  const secret = getServerConfig().jwtSecret;
  if (!secret) return false;
  const cookieHeader = req.headers.cookie ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]+)`));
  const token = match?.[1];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, secret) as { role?: string };
    return payload?.role === "admin_session";
  } catch {
    return false;
  }
}

async function checkAuth(req: { headers: { cookie?: string; authorization?: string } }): Promise<boolean> {
  if (isAdminAuthed(req)) return true;
  const userId = extractUserId(req);
  if (!userId) return false;
  try {
    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
    return user?.role?.toLowerCase() === "admin";
  } catch {
    return false;
  }
}

/**
 * GET /admin/moderation/queue — all posts needing review ("flagged" + recently
 * "rejected" for transparency), newest first.
 */
router.get("/admin/moderation/queue", async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const { status = "flagged" } = req.query as Record<string, string>;
    const posts = await db.select().from(socialPostsTable)
      .where(eq(socialPostsTable.moderationStatus, status === "rejected" ? "rejected" : "flagged"))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(100);

    const authorIds = [...new Set(posts.map((p) => p.userId))];
    const authors = authorIds.length
      ? await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
          .from(usersTable).where(inArray(usersTable.id, authorIds))
      : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    const flaggedCount = Number((await db.select({ c: sql<number>`count(*)` }).from(socialPostsTable)
      .where(eq(socialPostsTable.moderationStatus, "flagged")))[0]?.c ?? 0);

    res.json({
      flaggedCount,
      posts: posts.map((p) => ({
        id: p.id,
        content: p.content,
        type: p.type,
        moderationStatus: p.moderationStatus,
        moderationReason: p.moderationReason,
        createdAt: p.createdAt,
        author: authorMap.get(p.userId)
          ? { id: p.userId, name: authorMap.get(p.userId)!.name, email: authorMap.get(p.userId)!.email }
          : { id: p.userId, name: "Unknown", email: "" },
      })),
    });
  } catch (err) {
    logger.error({ err }, "moderation queue error");
    res.status(500).json({ error: "Internal error" });
  }
});

/** POST /admin/moderation/:id/approve — clear a flagged post. */
router.post("/admin/moderation/:id/approve", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const [updated] = await db.update(socialPostsTable)
      .set({ moderationStatus: "approved", moderationReason: null })
      .where(eq(socialPostsTable.id, req.params.id as string))
      .returning({ id: socialPostsTable.id, moderationStatus: socialPostsTable.moderationStatus });
    if (!updated) { res.status(404).json({ error: "Post not found" }); return; }
    res.json({ ok: true, id: updated.id, moderationStatus: updated.moderationStatus });
  } catch (err) {
    logger.error({ err }, "moderation approve error");
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * POST /admin/moderation/digest — email the admin a summary of flagged content.
 * Uses Resend (RESEND_API_KEY). This makes moderation work *easy*: admins get
 * a digest in their inbox instead of having to check the queue manually.
 */
router.post("/admin/moderation/digest", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const adminEmail = process.env.CONTACT_EMAIL ?? "focusarx@gmail.com";
  try {
    const posts = await db.select().from(socialPostsTable)
      .where(eq(socialPostsTable.moderationStatus, "flagged"))
      .orderBy(desc(socialPostsTable.createdAt))
      .limit(20);

    if (posts.length === 0) {
      res.json({ ok: true, sent: false, reason: "No flagged content" });
      return;
    }

    const rows = posts.map((p, i) => `${i + 1}. "${p.content.slice(0, 120)}" — ${p.moderationReason ?? "flagged"}`).join("\n");

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn("RESEND_API_KEY not set — moderation digest not emailed");
      res.json({ ok: true, sent: false, reason: "RESEND_API_KEY not configured", flaggedCount: posts.length });
      return;
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "FocusArx <focusarx@gmail.com>",
        to: [adminEmail],
        subject: `FocusArx moderation digest — ${posts.length} flagged post(s)`,
        text: `You have ${posts.length} post(s) awaiting moderation:\n\n${rows}\n\nReview them in the admin panel: /admin (Moderation tab).`,
      }),
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, "moderation digest email failed");
      res.json({ ok: false, error: "Email send failed", flaggedCount: posts.length });
      return;
    }
    res.json({ ok: true, sent: true, flaggedCount: posts.length });
  } catch (err) {
    logger.error({ err }, "moderation digest error");
    res.status(500).json({ error: "Internal error" });
  }
});

/** POST /admin/moderation/:id/reject — hide (reject) a post. */
router.post("/admin/moderation/:id/reject", adminLimiter, async (req, res) => {
  if (!await checkAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  const reason = (req.body as { reason?: string }).reason;
  try {
    const [updated] = await db.update(socialPostsTable)
      .set({ moderationStatus: "rejected", moderationReason: reason || "Rejected by admin" })
      .where(eq(socialPostsTable.id, req.params.id as string))
      .returning({ id: socialPostsTable.id, moderationStatus: socialPostsTable.moderationStatus });
    if (!updated) { res.status(404).json({ error: "Post not found" }); return; }
    res.json({ ok: true, id: updated.id, moderationStatus: updated.moderationStatus });
  } catch (err) {
    logger.error({ err }, "moderation reject error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as adminModerationRouter };
