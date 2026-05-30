import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { z } from "zod";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getServerConfig } from "../lib/config";
import { authLimiter, forgotPasswordLimiter } from "../lib/rateLimiter";

const loginSchema = z.object({
  email: z.string().email().max(254).toLowerCase().trim(),
  password: z.string().min(1).max(256),
});

const registerSchema = z.object({
  email: z.string().email().max(254).toLowerCase().trim(),
  password: z.string().min(8).max(128),
  name: z.string().max(100).optional(),
});

const forgotSchema = z.object({
  email: z.string().email().max(254).toLowerCase().trim(),
});

const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8).max(128),
});

const router = Router();

function jwtSecretOrRespond(res: { status: (code: number) => { json: (body: unknown) => void } }): string | null {
  const secret = getServerConfig().jwtSecret;
  if (!secret) {
    res.status(503).json({
      error: "Authentication is not configured",
      hint: "Set AUTH_SECRET in your environment variables",
    });
    return null;
  }
  return secret;
}

function makeToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: "7d" });
}

function verifyToken(token: string, secret: string): { sub: string } | null {
  try {
    return jwt.verify(token, secret) as { sub: string };
  } catch {
    return null;
  }
}

export function extractUserId(req: { headers: { authorization?: string } }): string | null {
  const secret = getServerConfig().jwtSecret;
  if (!secret) return null;
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const payload = verifyToken(token, secret);
  return payload?.sub ?? null;
}

router.get("/auth/session", async (req, res) => {
  if (!jwtSecretOrRespond(res)) return;
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, isGuest: usersTable.isGuest, role: usersTable.role, onboardingCompleted: usersTable.onboardingCompleted }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(401).json({ error: "User not found" }); return; }
    res.json({ user });
  } catch (err) {
    logger.error({ err }, "session error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/auth/login", authLimiter, async (req, res) => {
  const secret = jwtSecretOrRespond(res);
  if (!secret) return;
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid email or password format" }); return; }
  const { email, password } = parsed.data;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user?.hashedPassword) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    res.json({ token: makeToken(user.id, secret), user: { id: user.id, email: user.email, name: user.name, isGuest: user.isGuest } });
  } catch (err) {
    logger.error({ err }, "login error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/auth/register", authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid input";
    res.status(400).json({ error: msg });
    return;
  }
  const { email, password, name } = parsed.data;
  try {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing) { res.status(400).json({ error: "Email already registered" }); return; }
    const hashedPassword = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({ email, name: name || null, hashedPassword, isGuest: false }).returning();
    if (!user) { res.status(500).json({ error: "Failed to create user" }); return; }
    res.status(201).json({ message: "Account created", user: { id: user.id, email: user.email } });
  } catch (err) {
    logger.error({ err }, "register error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/auth/guest", async (req, res) => {
  const secret = jwtSecretOrRespond(res);
  if (!secret) return;
  const { guestKey } = req.body as { guestKey?: string };
  if (!guestKey || guestKey.length < 8) { res.status(400).json({ error: "Invalid guest key" }); return; }
  const safeKey = guestKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
  const guestEmail = `guest_${safeKey}@guest.focusarx.internal`;
  try {
    let [user] = await db.select().from(usersTable).where(eq(usersTable.guestKey, safeKey));
    if (!user) {
      const [created] = await db.insert(usersTable).values({ email: guestEmail, guestKey: safeKey, isGuest: true, name: "Guest" }).returning();
      user = created;
    }
    if (!user) { res.status(500).json({ error: "Failed to create guest" }); return; }
    res.json({ token: makeToken(user.id, secret), user: { id: user.id, email: user.email, name: user.name, isGuest: true } });
  } catch (err) {
    logger.error({ err }, "guest error");
    res.status(500).json({ error: "Internal error" });
  }
});

// ── Password reset ────────────────────────────────────────────────────────

async function sendResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user ?? "noreply@focusarx.app";

  if (!host || !user || !pass) return false;

  try {
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({
      from: `"FocusArx" <${from}>`,
      to,
      subject: "Reset your FocusArx password",
      text: `Click the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
      html: `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`,
    });
    return true;
  } catch (err) {
    logger.warn({ err }, "failed to send reset email");
    return false;
  }
}

router.post("/auth/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Valid email required" }); return; }
  const { email } = parsed.data;
  const { appUrl } = getServerConfig();

  try {
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable).where(and(eq(usersTable.email, email.toLowerCase().trim()), eq(usersTable.isGuest, false)));

    if (!user) {
      res.json({ ok: true, emailSent: false });
      return;
    }

    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3600_000);

    await db.insert(passwordResetTokensTable).values({ userId: user.id, token, expiresAt });

    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    const emailSent = await sendResetEmail(user.email, resetUrl);

    const isDev = process.env.NODE_ENV !== "production";
    res.json({ ok: true, emailSent, ...(isDev && !emailSent ? { devResetUrl: resetUrl } : {}) });
  } catch (err) {
    logger.error({ err }, "forgot password error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/auth/reset-password", authLimiter, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Token and a password of at least 8 characters are required" }); return; }
  const { token, password } = parsed.data;

  try {
    const now = new Date();
    const [resetToken] = await db.select().from(passwordResetTokensTable)
      .where(and(eq(passwordResetTokensTable.token, token), gt(passwordResetTokensTable.expiresAt, now), isNull(passwordResetTokensTable.usedAt)));

    if (!resetToken) { res.status(400).json({ error: "Reset link is invalid or expired" }); return; }

    const hashed = await bcrypt.hash(password, 12);
    await db.update(usersTable).set({ hashedPassword: hashed }).where(eq(usersTable.id, resetToken.userId));
    await db.update(passwordResetTokensTable).set({ usedAt: now }).where(eq(passwordResetTokensTable.id, resetToken.id));

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "reset password error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/auth/reset-password/verify", async (req, res) => {
  const token = req.query.token as string | undefined;
  if (!token) { res.status(400).json({ valid: false }); return; }
  try {
    const now = new Date();
    const [resetToken] = await db.select({ id: passwordResetTokensTable.id })
      .from(passwordResetTokensTable)
      .where(and(eq(passwordResetTokensTable.token, token), gt(passwordResetTokensTable.expiresAt, now), isNull(passwordResetTokensTable.usedAt)));
    res.json({ valid: !!resetToken });
  } catch {
    res.json({ valid: false });
  }
});

// ── Onboarding ────────────────────────────────────────────────────────────

const onboardingSchema = z.object({
  goal: z.string().max(200).optional(),
  level: z.string().max(50).optional(),
  dailyHours: z.number().min(0).max(24).optional(),
  preferredSessionLength: z.number().min(5).max(120).optional(),
}).strict();

router.post("/auth/onboarding", async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { data } = req.body as { data?: unknown };
  if (!data) { res.status(400).json({ error: "Missing onboarding data" }); return; }
  const parsed = onboardingSchema.safeParse(data);
  if (!parsed.success) { res.status(400).json({ error: "Invalid onboarding data", details: parsed.error.errors }); return; }
  try {
    await db.update(usersTable)
      .set({ onboardingCompleted: true, onboardingData: parsed.data })
      .where(eq(usersTable.id, userId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "onboarding save error");
    res.status(500).json({ error: "Internal error" });
  }
});

export { router as authRouter };
