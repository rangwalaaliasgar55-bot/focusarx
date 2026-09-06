import { Router } from "express";
import { db } from "@workspace/db";
import {
  emailLogsTable,
  usersTable,
  premiumSubscriptionsTable,
  studyStreaksTable,
} from "@workspace/db";
import { eq, and, gte, lt, ne, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { checkAdminAuth } from "../lib/adminAuth";

const router = Router();

// ─── Shared email layout wrapper ─────────────────────────────────────────────
function emailLayout(preheader: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FocusArx</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: #07080f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #e2e8f0; }
    .wrapper { background-color: #07080f; padding: 40px 20px; }
    .container { max-width: 560px; margin: 0 auto; background-color: #0d1120; border-radius: 16px; border: 1px solid rgba(124,58,237,0.18); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a0a3d 0%, #0d1120 60%); padding: 32px 36px 24px; border-bottom: 1px solid rgba(124,58,237,0.12); }
    .logo { display: inline-flex; align-items: center; gap: 10px; }
    .logo-icon { width: 32px; height: 32px; background: linear-gradient(135deg, #7c3aed, #e879f9); border-radius: 10px; display: inline-block; text-align: center; line-height: 32px; font-size: 16px; }
    .logo-text { font-size: 17px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; }
    .body { padding: 32px 36px; }
    .headline { font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.25; margin: 0 0 12px; letter-spacing: -0.4px; }
    .subline { font-size: 15px; color: #94a3b8; line-height: 1.65; margin: 0 0 24px; }
    .cta-btn { display: inline-block; background: linear-gradient(135deg, #7c3aed, #e879f9); color: #ffffff; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 12px; text-decoration: none; margin: 4px 0 24px; letter-spacing: -0.1px; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0; }
    .stat-row { display: flex; gap: 12px; margin-bottom: 20px; }
    .stat-box { flex: 1; background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.15); border-radius: 10px; padding: 14px 16px; text-align: center; }
    .stat-value { font-size: 22px; font-weight: 800; color: #a78bfa; display: block; margin-bottom: 2px; }
    .stat-label { font-size: 11px; color: #4b5563; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .tip-box { background: rgba(6,214,160,0.06); border: 1px solid rgba(6,214,160,0.18); border-radius: 10px; padding: 16px 18px; margin-bottom: 20px; }
    .tip-label { font-size: 11px; font-weight: 700; color: #06D6A0; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
    .tip-text { font-size: 14px; color: #cbd5e1; line-height: 1.6; margin: 0; }
    .bullet-list { padding-left: 0; list-style: none; margin: 0 0 20px; }
    .bullet-list li { padding: 6px 0 6px 20px; font-size: 14px; color: #94a3b8; line-height: 1.55; position: relative; }
    .bullet-list li::before { content: "→"; position: absolute; left: 0; color: #7c3aed; font-weight: 700; }
    .footer { padding: 20px 36px 28px; border-top: 1px solid rgba(255,255,255,0.05); }
    .footer-text { font-size: 12px; color: #374151; line-height: 1.6; margin: 0 0 8px; }
    .footer-links a { color: #4b5563; font-size: 12px; text-decoration: none; margin-right: 14px; }
    .footer-links a:hover { color: #7c3aed; }
    .privacy-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 5px 12px; font-size: 11px; color: #4b5563; margin-top: 10px; }
  </style>
</head>
<body>
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">
          <span class="logo-icon">⚡</span>
          <span class="logo-text">FocusArx</span>
        </div>
      </div>
      ${body}
      <div class="footer">
        <p class="footer-text">You're receiving this because you created a FocusArx account. We respect your inbox.</p>
        <div class="footer-links">
          <a href="https://focusarx.site/privacy">Privacy Policy</a>
          <a href="https://focusarx.site/unsubscribe">Unsubscribe</a>
          <a href="https://focusarx.site/support">Support</a>
        </div>
        <div class="privacy-badge">🔒 Your data is never sold. Ever.</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

const EMAIL_TEMPLATES: Record<string, { subject: string; html: (name: string, data?: Record<string, unknown>) => string }> = {
  // ─── Template 1: Welcome Email ─────────────────────────────────────────────
  // Trigger: On successful account creation
  // Goal: Drive first session completion within 24 hours
  welcome: {
    subject: "You're in. Time to build your first focus habit. 🎯",
    html: (name) => emailLayout(
      "Your FocusArx journey starts now — complete your first session and earn 100 XP",
      `<div class="body">
        <h1 class="headline">Welcome to FocusArx, ${name || "Scholar"} 👋</h1>
        <p class="subline">India's most advanced AI focus platform just got a new member. Here's exactly how to get the most out of your first week.</p>
        <div class="tip-box">
          <p class="tip-label">🚀 Your First Mission</p>
          <p class="tip-text">Complete your first focus session today. Even 25 minutes earns you 100 XP, your first badge, and starts your streak. The hardest part is always the first session.</p>
        </div>
        <p style="font-size:14px;color:#94a3b8;margin:0 0 16px;">What you get with your free account:</p>
        <ul class="bullet-list">
          <li>Unlimited focus sessions with Pomodoro timer and custom modes</li>
          <li>AI Coach powered by Groq — real-time productivity coaching</li>
          <li>Gamification: XP, levels, badges, missions, and streaks</li>
          <li>Deep analytics: Focus Score, Focus DNA, session history</li>
          <li>Study Rooms: focus alongside thousands of learners live</li>
        </ul>
        <a href="https://focusarx.site/dashboard" class="cta-btn">→ Start My First Session</a>
        <hr class="divider" />
        <p style="font-size:13px;color:#4b5563;margin:0;">Questions? Reply to this email or visit <a href="https://focusarx.site/support" style="color:#7c3aed;">our support page</a>. We reply within 24 hours.</p>
      </div>`
    ),
  },

  // ─── Template 2: Weekly Summary Email ─────────────────────────────────────
  // Trigger: Every Sunday at 8pm for users with at least 1 session in the past 7 days
  // Goal: Increase perceived progress, drive next week's sessions
  weekly_report: {
    subject: "Your focus week in numbers — {{FOCUS_HOURS}} hours logged 📊",
    html: (name, data = {}) => emailLayout(
      `You focused ${data.focusHours || "0"} hours this week — here's what that means for your growth`,
      `<div class="body">
        <h1 class="headline">Your Week in Focus 📊</h1>
        <p class="subline">Here's what you accomplished this week, ${name || "Scholar"}. Every session compounds.</p>
        <div class="stat-row">
          <div class="stat-box">
            <span class="stat-value">${data.focusHours || "0"}h</span>
            <span class="stat-label">Focus Time</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${data.sessionsCount || "0"}</span>
            <span class="stat-label">Sessions</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${data.currentStreak || "0"}</span>
            <span class="stat-label">Day Streak</span>
          </div>
        </div>
        <div class="tip-box">
          <p class="tip-label">💡 AI Insight This Week</p>
          <p class="tip-text">${data.aiInsight || "Consistency is compounding. Students who maintain a 7-day streak complete 3× more sessions in month two. Keep going."}</p>
        </div>
        <p style="font-size:14px;color:#94a3b8;margin:0 0 16px;">What to focus on next week:</p>
        <ul class="bullet-list">
          <li>${data.suggestion1 || "Try starting your first session before 10am — morning deep work is 40% more effective"}</li>
          <li>${data.suggestion2 || "Check your Focus DNA to see which time of day you score highest"}</li>
          <li>${data.suggestion3 || "Complete 3 daily missions to unlock bonus XP multipliers"}</li>
        </ul>
        <a href="https://focusarx.site/analytics" class="cta-btn">→ See Full Analytics</a>
        <hr class="divider" />
        <p style="font-size:13px;color:#4b5563;margin:0;line-height:1.6;">Your data is private and never sold. <a href="https://focusarx.site/privacy" style="color:#7c3aed;">Privacy Policy</a></p>
      </div>`
    ),
  },

  // ─── Template 3: Streak Reminder Email ────────────────────────────────────
  // Trigger: User hasn't completed any session for 23+ hours and has a streak ≥ 2 days
  // Goal: Prevent streak loss; drive a session completion within next 1 hour
  streak_reminder: {
    subject: "Your {{STREAK_DAYS}}-day streak ends at midnight 🔥",
    html: (name, data = {}) => emailLayout(
      `Don't let ${data.streakDays || "your"}-day streak disappear — a single 5-minute session saves it`,
      `<div class="body">
        <h1 class="headline" style="color:#f97316;">⚠️ Streak Alert, ${name || "Scholar"}</h1>
        <p class="subline">Your <strong style="color:#f97316;">${data.streakDays || ""}-day focus streak</strong> resets at midnight. You have until then to save it with a single session — even 5 minutes counts.</p>
        <div class="stat-row">
          <div class="stat-box" style="border-color:rgba(249,115,22,0.3);">
            <span class="stat-value" style="color:#f97316;">${data.streakDays || "?"}</span>
            <span class="stat-label">Day Streak</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${data.totalXp || "?"}</span>
            <span class="stat-label">Total XP Earned</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${data.freezeTokens || "0"}</span>
            <span class="stat-label">Freeze Tokens</span>
          </div>
        </div>
        <div class="tip-box" style="border-color:rgba(249,115,22,0.25);background:rgba(249,115,22,0.06);">
          <p class="tip-label" style="color:#f97316;">🧠 Remember Why You Started</p>
          <p class="tip-text">${data.goal ? `Your goal: "${data.goal}". Every session gets you closer.` : "The version of you that built this streak believed deep work matters. Prove them right — one session, right now."}</p>
        </div>
        <p style="font-size:14px;color:#94a3b8;margin:0 0 16px;">You have two options:</p>
        <ul class="bullet-list">
          <li><strong style="color:#fff;">Complete a session now</strong> — even 5 minutes saves your streak and earns XP</li>
          <li><strong style="color:#fff;">Use a Freeze Token</strong> — if you have one, protect today's streak automatically from the app</li>
        </ul>
        <a href="https://focusarx.site/dashboard" class="cta-btn" style="background:linear-gradient(135deg,#ea580c,#f97316);">→ Save My Streak Now</a>
        <hr class="divider" />
        <p style="font-size:13px;color:#4b5563;margin:0;">Streak resets are permanent but your XP, badges, and history are always kept. This is just a reminder — not pressure. You've got this.</p>
      </div>`
    ),
  },

  // ─── Remaining templates (kept for backwards compatibility) ───────────────
  come_back: {
    subject: "We miss you on FocusArx 🔥",
    html: (name) => emailLayout(
      "Your study streak is waiting — come back and keep the momentum",
      `<div class="body">
        <h1 class="headline">Hey ${name || "there"} 👋</h1>
        <p class="subline">You've been away for a while. Your XP, streaks, and sessions are all still here waiting for you.</p>
        <a href="https://focusarx.site/dashboard" class="cta-btn">→ Pick Up Where You Left Off</a>
      </div>`
    ),
  },
  new_feature: {
    subject: "New on FocusArx: What just shipped ✨",
    html: (name) => emailLayout(
      "Fresh features just dropped — come see what's new",
      `<div class="body">
        <h1 class="headline">New Features Just Dropped ✨</h1>
        <p class="subline">Hi ${name || "there"}! We've been building hard. Here's what's new on FocusArx.</p>
        <a href="https://focusarx.site/dashboard" class="cta-btn">→ Explore New Features</a>
      </div>`
    ),
  },
  monthly_wrapped: {
    subject: "Your Monthly Focus Wrapped is ready 🎁",
    html: (name) => emailLayout(
      "See your full month of focus — stats, achievements, and what's next",
      `<div class="body">
        <h1 class="headline">Your Month in Focus, ${name || "Scholar"} 🎁</h1>
        <p class="subline">Your monthly achievements and wrapped stats are ready to view in the app.</p>
        <a href="https://focusarx.site/wrapped" class="cta-btn">→ See My Monthly Wrapped</a>
      </div>`
    ),
  },
  premium_promo: {
    subject: "Unlock FocusArx Premium 👑",
    html: (name) => emailLayout(
      "Go further with Premium — unlimited AI, XP multipliers, and exclusive content",
      `<div class="body">
        <h1 class="headline">Go Premium, ${name || "Scholar"} 👑</h1>
        <p class="subline">Unlock exclusive pets, XP multipliers, premium loot boxes, and unlimited AI coaching.</p>
        <a href="https://focusarx.site/pricing" class="cta-btn">→ See Premium Plans</a>
      </div>`
    ),
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
    logger.warn("RESEND_API_KEY not set — email delivery is not configured");
    return { ok: false, error: "Email provider is not configured" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "FocusArx <focusarx@gmail.com>",
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

/**
 * Public email helper (used by drop blasts + Gemini briefings). Sends via
 * the configured provider and always writes an email_logs row — so admin
 * analytics see every email attempt even when the provider is unset
 * (status stays "pending").
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  template: string,
  recipientId?: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const res = await sendEmailViaResend(to, subject, html);
  try {
    await db.insert(emailLogsTable).values({
      recipientId: recipientId ?? null,
      recipientEmail: to,
      template,
      subject,
      status: res.ok ? "sent" : "failed",
      providerId: res.id,
      sentAt: res.ok ? new Date() : null,
      error: res.error ?? null,
    });
  } catch (err) {
    logger.warn({ err }, "email log write failed (non-fatal)");
  }
  return res;
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

  const { template, audience, customSubject, customHtml, selectedUserIds, streakMin, newUserDays } = req.body as {
    template: string;
    audience: "all" | "inactive" | "premium" | "low_activity" | "selected" | "streak" | "newUsers";
    customSubject?: string;
    customHtml?: string;
    selectedUserIds?: string[];
    streakMin?: number;
    newUserDays?: number;
  };

  if (!template && !customSubject) {
    res.status(400).json({ error: "template or customSubject required" }); return;
  }

  try {
    let recipients: { id: string; email: string; name: string | null }[] = [];

    // Filter out guest users AND bot users - only send to real users
    const baseCondition = and(eq(usersTable.isGuest, false), ne(usersTable.role, 'bot'));
    
    if (audience === "all") {
      recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable).where(baseCondition);
    } else if (audience === "premium") {
      const premiumUsers = await db.select({ userId: premiumSubscriptionsTable.userId })
        .from(premiumSubscriptionsTable).where(eq(premiumSubscriptionsTable.isActive, true));
      const ids = premiumUsers.map(p => p.userId);
      if (ids.length > 0) {
        recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
          .from(usersTable).where(baseCondition);
        recipients = recipients.filter(u => ids.includes(u.id));
      }
    } else if (audience === "inactive") {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable).where(and(baseCondition, lt(usersTable.createdAt, cutoff)));
    } else if (audience === "selected" && selectedUserIds?.length) {
      recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable).where(baseCondition);
      recipients = recipients.filter(u => selectedUserIds.includes(u.id));
    } else if (audience === "streak") {
      const minStreak = streakMin || 7;
      // Streaks live in study_streaks (one row per user), not on users —
      // users.current_streak does not exist and would fail at query time.
      recipients = await db
        .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable)
        .innerJoin(studyStreaksTable, eq(studyStreaksTable.userId, usersTable.id))
        .where(and(baseCondition, gte(studyStreaksTable.currentStreak, minStreak)));
    } else if (audience === "newUsers") {
      const days = newUserDays || 7;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable).where(and(baseCondition, sql`${usersTable.createdAt} >= ${cutoff}`));
    } else {
      recipients = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
        .from(usersTable).where(baseCondition);
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
