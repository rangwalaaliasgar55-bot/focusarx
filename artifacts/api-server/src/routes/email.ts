import { Router } from "express";
import { db } from "@workspace/db";
import {
  emailLogsTable,
  usersTable,
  premiumSubscriptionsTable,
} from "@workspace/db/schema";
import { eq, and, isNull, lt, sql } from "drizzle-orm";
import { extractUserId } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

async function checkAdminAuth(req: any): Promise<boolean> {
  const cookieHeader = req.headers.cookie ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)focusarx_admin=([^;]+)/);
  const token = match?.[1];
  if (token) {
    try {
      const jwt = await import("jsonwebtoken");
      const secret = process.env.AUTH_SECRET ?? process.env.JWT_SECRET ?? "dev-secret";
      const payload = jwt.default.verify(token, secret) as { role?: string };
      if (payload?.role === "admin_session") return true;
    } catch { }
  }
  const userId = extractUserId(req);
  if (!userId) return false;
  try {
    const [user] = await db.select({ role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, userId));
    return user?.role?.toLowerCase() === "admin";
  } catch { return false; }
}

const EMAIL_TEMPLATES: Record<string, { subject: string; html: (name: string) => string }> = {
  welcome: {
    subject: "Welcome to FocusArx 🎯",
    html: (name) => `<h1>Welcome, ${name || "Scholar"}!</h1><p>Your focus journey starts now. Complete your first session and earn rewards!</p>`,
  },
  come_back: {
    subject: "We miss you! Come back and focus 🔥",
    html: (name) => `<h1>Hey ${name || "there"}!</h1><p>Your study streak is waiting. Come back and keep the momentum going.</p>`,
  },
  streak_reminder: {
    subject: "Don't break your streak! 🔥",
    html: (name) => `<h1>Hi ${name || "Scholar"}!</h1><p>Your study streak is at risk! Complete a session today to keep it alive.</p>`,
  },
  new_feature: {
    subject: "New Features Available on FocusArx ✨",
    html: (name) => `<h1>Hi ${name || "there"}!</h1><p>We've shipped exciting new features: Premium Economy, 50 Loot Boxes, Focus City 2.0, and more!</p>`,
  },
  weekly_report: {
    subject: "Your Weekly Focus Report 📊",
    html: (name) => `<h1>Weekly Summary for ${name || "you"}</h1><p>Check your progress in the FocusArx dashboard.</p>`,
  },
  monthly_wrapped: {
    subject: "Your Monthly Focus Wrapped 🎁",
    html: (name) => `<h1>Your Month in Focus, ${name || "Scholar"}!</h1><p>See your monthly achievements and wrapped stats in the app.</p>`,
  },
  premium_promo: {
    subject: "Unlock Premium for 9,000 Coins 👑",
    html: (name) => `<h1>Go Premium, ${name || "Scholar"}!</h1><p>Unlock exclusive pets, XP multipliers, premium loot boxes, and more for just 9,000 Focus Coins.</p>`,
  },
};

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  providerId?: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — email not sent (logged only)");
    return { ok: true, id: `mock-${Date.now()}` };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "FocusArx <noreply@focusarx.app>",
        to,
        subject,
        html,
      }),
    });
    const data = await response.json() as any;
    if (!response.ok) return { ok: false, error: data.message ?? "Send failed" };
    return { ok: true, id: data.id };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

// ─── GET: email logs ──────────────────────────────────────────────────────────

router.get("/admin/email/logs", async (req, res) => {
  if (!await checkAdminAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  try {
    const logs = await db.select({
      id: emailLogsTable.id,
      recipientEmail: emailLogsTable.recipientEmail,
      template: emailLogsTable.template,
      subject: emailLogsTable.subject,
      status: emailLogsTable.status,
      sentAt: emailLogsTable.sentAt,
      bounced: emailLogsTable.bounced,
      createdAt: emailLogsTable.createdAt,
    }).from(emailLogsTable).orderBy(sql`${emailLogsTable.createdAt} DESC`).limit(200);

    const stats = {
      total: logs.length,
      sent: logs.filter(l => l.status === "sent").length,
      pending: logs.filter(l => l.status === "pending").length,
      failed: logs.filter(l => l.status === "failed").length,
      bounced: logs.filter(l => l.bounced).length,
    };

    res.json({ logs, stats });
  } catch (err) {
    logger.error({ err }, "email logs error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── POST: send email blast ───────────────────────────────────────────────────

router.post("/admin/email/blast", async (req, res) => {
  if (!await checkAdminAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { template, audience, customSubject, customHtml, selectedUserIds } = req.body as {
    template: string;
    audience: "all" | "inactive" | "premium" | "low_activity" | "selected";
    customSubject?: string;
    customHtml?: string;
    selectedUserIds?: string[];
  };

  if (!template && !customSubject) {
    res.status(400).json({ error: "template or customSubject required" }); return;
  }

  try {
    let recipients: { id: string; email: string; name: string | null }[] = [];

    if (audience === "all") {
      recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable).where(eq(usersTable.isGuest, false));
    } else if (audience === "premium") {
      const premiumUsers = await db.select({ userId: premiumSubscriptionsTable.userId })
        .from(premiumSubscriptionsTable).where(eq(premiumSubscriptionsTable.isActive, true));
      const ids = premiumUsers.map(p => p.userId);
      if (ids.length > 0) {
        recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
          .from(usersTable).where(and(eq(usersTable.isGuest, false)));
        recipients = recipients.filter(u => ids.includes(u.id));
      }
    } else if (audience === "inactive") {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable).where(and(eq(usersTable.isGuest, false), lt(usersTable.createdAt, cutoff)));
    } else if (audience === "selected" && selectedUserIds?.length) {
      recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable).where(eq(usersTable.isGuest, false));
      recipients = recipients.filter(u => selectedUserIds.includes(u.id));
    } else {
      recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable).where(eq(usersTable.isGuest, false));
    }

    const tmpl = EMAIL_TEMPLATES[template];
    let sent = 0;
    let failed = 0;

    for (const user of recipients.slice(0, 500)) {
      const subject = customSubject ?? tmpl?.subject ?? "Message from FocusArx";
      const html = customHtml ?? tmpl?.html(user.name ?? "") ?? `<p>Hello ${user.name ?? "Scholar"}!</p>`;

      const logId = crypto.randomUUID();
      await db.insert(emailLogsTable).values({
        id: logId,
        recipientId: user.id,
        recipientEmail: user.email,
        template: template ?? "custom",
        subject,
        status: "pending",
      }).catch(() => {});

      const result = await sendEmailViaResend(user.email, subject, html);

      await db.update(emailLogsTable).set({
        status: result.ok ? "sent" : "failed",
        providerId: result.id,
        sentAt: result.ok ? new Date() : undefined,
        error: result.error,
      }).where(eq(emailLogsTable.id, logId)).catch(() => {});

      if (result.ok) sent++;
      else failed++;
    }

    res.json({ ok: true, sent, failed, total: recipients.length });
  } catch (err) {
    logger.error({ err }, "email blast error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/admin/email/templates", async (req, res) => {
  if (!await checkAdminAuth(req)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json({
    templates: Object.keys(EMAIL_TEMPLATES).map(key => ({
      key,
      subject: EMAIL_TEMPLATES[key]!.subject,
    })),
  });
});

export { router as emailRouter };
