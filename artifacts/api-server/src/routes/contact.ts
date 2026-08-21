import { Router } from "express";
import { z } from "zod";
import { db, auditLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { generalLimiter } from "../lib/rateLimiter";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? "focusarx@gmail.com";

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});

const router = Router();

/**
 * Public contact form endpoint.
 * - Persists the message to the audit log so it is never lost.
 * - Emails the team via Resend when RESEND_API_KEY is configured.
 */
router.post("/contact", generalLimiter, async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please fill in all fields correctly." });
    return;
  }
  const { name, email, subject, message } = parsed.data;

  try {
    await db.insert(auditLogsTable).values({
      action: "contact",
      details: { name, email, subject, message },
      ip: req.ip ?? null,
    });

    // Best-effort email notification to the team.
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? "FocusArx <focusarx@gmail.com>",
            to: [CONTACT_EMAIL],
            replyTo: email,
            subject: `[Contact] ${subject}`,
            text: `From: ${name} <${email}>\n\n${message}`,
          }),
        });
        if (!response.ok) {
          logger.warn({ status: response.status }, "contact email send failed");
        }
      } catch (err) {
        logger.warn({ err }, "contact email send error");
      }
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "contact submit error");
    res.status(500).json({ error: "Something went wrong. Please try again or email us directly." });
  }
});

export { router as contactRouter };
