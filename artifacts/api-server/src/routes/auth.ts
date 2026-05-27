import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getServerConfig } from "../lib/config";

const router = Router();

function jwtSecretOrRespond(res: { status: (code: number) => { json: (body: unknown) => void } }): string | null {
  const secret = getServerConfig().jwtSecret;
  if (!secret) {
    res.status(503).json({
      error: "Authentication is not configured",
      hint: "Set AUTH_SECRET in Vercel environment variables",
    });
    return null;
  }
  return secret;
}

function makeToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, { expiresIn: "400d" });
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
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, isGuest: usersTable.isGuest, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(401).json({ error: "User not found" }); return; }
    res.json({ user });
  } catch (err) {
    logger.error({ err }, "session error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/auth/login", async (req, res) => {
  const secret = jwtSecretOrRespond(res);
  if (!secret) return;
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
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

router.post("/auth/register", async (req, res) => {
  const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
  if (!email || !password) { res.status(400).json({ error: "Email and password required" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
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

// ── Google OAuth debug (dev only) ─────────────────────────────────────────

router.get("/auth/google/debug", (req, res) => {
  const { googleClientId, appUrl } = getServerConfig();
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  res.json({
    clientIdSet: !!googleClientId,
    clientIdPrefix: googleClientId ? googleClientId.slice(0, 12) + "..." : null,
    appUrl,
    redirectUri,
    oauthUrl: googleClientId
      ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId.slice(0, 12)}...&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid+email+profile`
      : null,
  });
});

// ── Google OAuth ──────────────────────────────────────────────────────────

router.get("/auth/google", (req, res) => {
  const { googleClientId, appUrl } = getServerConfig();
  if (!googleClientId) {
    // Redirect back to login with a friendly error instead of JSON 503
    res.redirect(`${appUrl}/login?error=google_not_configured`);
    return;
  }
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/auth/google/callback", async (req, res) => {
  const secret = jwtSecretOrRespond(res);
  if (!secret) return;
  const { googleClientId, googleClientSecret, appUrl } = getServerConfig();
  const code = req.query.code as string | undefined;
  if (!code || !googleClientId || !googleClientSecret) { res.status(400).json({ error: "OAuth callback failed" }); return; }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) { res.status(401).json({ error: "Failed to get Google token" }); return; }

    // Fetch user profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json() as { id: string; email: string; name?: string; picture?: string };
    if (!profile.email) { res.status(401).json({ error: "Could not retrieve email from Google" }); return; }

    // Find or create user
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, profile.email));
    let user = existing;
    if (!user) {
      const [created] = await db.insert(usersTable).values({
        email: profile.email,
        name: profile.name ?? null,
        isGuest: false,
      }).returning();
      user = created;
    }
    if (!user) { res.status(500).json({ error: "Failed to create user" }); return; }

    // Redirect to frontend with token
    const token = makeToken(user.id, secret);
    res.redirect(`${appUrl}/auth/callback?token=${token}`);
  } catch (err) {
    logger.error({ err }, "google oauth error");
    res.status(500).json({ error: "OAuth failed" });
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

router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }
  const { appUrl } = getServerConfig();

  try {
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable).where(and(eq(usersTable.email, email.toLowerCase().trim()), eq(usersTable.isGuest, false)));

    // Always respond with the same message (don't reveal if email exists)
    if (!user) {
      res.json({ ok: true, emailSent: false });
      return;
    }

    // Generate a secure token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3600_000); // 1 hour

    await db.insert(passwordResetTokensTable).values({ userId: user.id, token, expiresAt });

    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    const emailSent = await sendResetEmail(user.email, resetUrl);

    // In development, return the link directly if email isn't configured
    const isDev = process.env.NODE_ENV !== "production";
    res.json({ ok: true, emailSent, ...(isDev && !emailSent ? { devResetUrl: resetUrl } : {}) });
  } catch (err) {
    logger.error({ err }, "forgot password error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) { res.status(400).json({ error: "Token and password are required" }); return; }
  if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }

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

export { router as authRouter };
