import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

export type EmailProvider = "gmail" | "smtp" | "resend" | "mock" | "none";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  provider: EmailProvider;
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  provider: "gmail" | "smtp";
}

const DEFAULT_FROM = "FocusArx <noreply@focusarx.app>";
const DEFAULT_GMAIL_USER = "focusarx@gmail.com";

function resolveSmtp(): SmtpConfig | null {
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  // Only the app password is strictly required; default the account to the
  // project mailbox so setting a single secret is enough to enable delivery.
  const gmailUser = process.env.GMAIL_USER ?? (gmailPass ? DEFAULT_GMAIL_USER : undefined);
  if (gmailUser && gmailPass) {
    return {
      host: "smtp.gmail.com",
      port: 465,
      user: gmailUser,
      pass: gmailPass,
      from: process.env.EMAIL_FROM ?? `FocusArx <${gmailUser}>`,
      provider: "gmail",
    };
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    return {
      host,
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      user,
      pass,
      from: process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? `FocusArx <${user}>`,
      provider: "smtp",
    };
  }

  return null;
}

let cachedTransporter: Transporter | null = null;
let cachedKey = "";

function getTransporter(smtp: SmtpConfig): Transporter {
  const key = `${smtp.host}:${smtp.port}:${smtp.user}`;
  if (cachedTransporter && cachedKey === key) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  cachedKey = key;
  return cachedTransporter;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Describes the active provider without exposing secrets — used by admin diagnostics. */
export function getEmailConfig(): { configured: boolean; provider: EmailProvider; from: string } {
  const smtp = resolveSmtp();
  if (smtp) return { configured: true, provider: smtp.provider, from: smtp.from };
  if (process.env.RESEND_API_KEY) {
    return { configured: true, provider: "resend", from: process.env.EMAIL_FROM ?? DEFAULT_FROM };
  }
  return { configured: false, provider: "none", from: process.env.EMAIL_FROM ?? DEFAULT_FROM };
}

async function sendViaResend(input: SendEmailInput, from: string): Promise<EmailResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? htmlToText(input.html),
      }),
    });
    const data = (await response.json()) as { id?: string; message?: string };
    if (!response.ok) return { ok: false, error: data.message ?? "Send failed", provider: "resend" };
    return { ok: true, id: data.id, provider: "resend" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed", provider: "resend" };
  }
}

/**
 * Sends a real email through the configured provider.
 * Precedence: Gmail SMTP → generic SMTP → Resend. In production a missing
 * provider is a hard failure (never a fake success); in dev it returns a mock.
 */
export async function sendEmail(input: SendEmailInput): Promise<EmailResult> {
  const smtp = resolveSmtp();
  if (smtp) {
    try {
      const transporter = getTransporter(smtp);
      const info = await transporter.sendMail({
        from: smtp.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? htmlToText(input.html),
      });
      if ((info.rejected ?? []).length > 0) {
        return { ok: false, error: `Recipient rejected: ${info.rejected.join(", ")}`, provider: smtp.provider };
      }
      return { ok: true, id: info.messageId, provider: smtp.provider };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Send failed", provider: smtp.provider };
    }
  }

  if (process.env.RESEND_API_KEY) {
    return sendViaResend(input, process.env.EMAIL_FROM ?? DEFAULT_FROM);
  }

  if (process.env.NODE_ENV === "production") {
    logger.error("No email provider configured — refusing to fake-send in production");
    return { ok: false, error: "No email provider configured (set GMAIL_USER/GMAIL_APP_PASSWORD)", provider: "none" };
  }

  logger.warn("No email provider configured — returning dev mock (no email sent)");
  return { ok: true, id: `mock-${Date.now()}`, provider: "mock" };
}
