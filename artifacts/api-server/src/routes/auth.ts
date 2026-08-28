import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db, usersTable, passwordResetTokensTable, emailLogsTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getServerConfig } from "../lib/config";
import { authLimiter, forgotPasswordLimiter } from "../lib/rateLimiter";
import { createRefreshFamily, rotateRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens } from "../lib/refreshTokens";
import { issueSocketTicket } from "../lib/socketTickets";
import { sendUnauthorized } from "../lib/httpErrors";

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

const IS_PROD = process.env.NODE_ENV === "production";

function jwtSecretOrRespond(res: { status: (code: number) => { json: (body: unknown) => void } }): string | null {
  const secret = getServerConfig().jwtSecret;
  if (!secret) {
    res.status(503).json({
      error: {
        code: "CONFIG_ERROR",
        message: "Authentication is not configured",
        hint: "Set AUTH_SECRET in your environment variables",
      },
    });
    return null;
  }
  return secret;
}

function makeAccessToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId, type: "access" }, secret, {
    algorithm: "HS256",
    issuer: "focusarx-api",
    audience: "focusarx-web",
    expiresIn: "15m",
  });
}

// Legacy 7d token for backward compat during migration — will be removed
function makeLegacyToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId, type: "access" }, secret, {
    algorithm: "HS256",
    issuer: "focusarx-api",
    audience: "focusarx-web",
    expiresIn: "7d",
  });
}

function verifyToken(token: string, secret: string, expectedType: "access" | "refresh" = "access"): { sub: string; type: string } | null {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "focusarx-api",
      audience: "focusarx-web",
    }) as { sub?: unknown; type?: unknown };
    if (typeof payload.sub !== "string") return null;
    if (payload.type !== expectedType) return null;
    return { sub: payload.sub, type: payload.type as string };
  } catch {
    return null;
  }
}

function verifyAnyAccessToken(token: string, secret: string): { sub: string } | null {
  // Accept both short-lived and legacy long-lived access tokens
  const result = verifyToken(token, secret, "access");
  return result ? { sub: result.sub } : null;
}

export function extractUserId(req: { headers: { authorization?: string; cookie?: string }; cookies?: Record<string, string> }): string | null {
  const secret = getServerConfig().jwtSecret;
  if (!secret) return null;

  // 1. Try Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyAnyAccessToken(token, secret);
    if (payload?.sub) return payload.sub;
  }

  // 2. Try httpOnly cookie (secure path)
  const cookies = (req as any).cookies ?? {};
  const cookieToken = cookies["access_token"] ?? cookies["focusarx_token"];
  if (cookieToken) {
    const payload = verifyAnyAccessToken(cookieToken, secret);
    if (payload?.sub) return payload.sub;
  }

  // 3. Fallback: parse cookie header manually if cookie-parser not applied
  const cookieHeader = req.headers.cookie ?? "";
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)(?:access_token|focusarx_token)=([^;]+)/);
    if (match?.[1]) {
      try {
        const payload = verifyAnyAccessToken(decodeURIComponent(match[1]), secret);
        if (payload?.sub) return payload.sub;
      } catch {
        // ignore
      }
    }
  }

  return null;
}

function setAuthCookies(res: any, accessToken: string, refreshToken: string) {
  const baseOpts = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax" as const,
    path: "/",
  };

  res.cookie("access_token", accessToken, {
    ...baseOpts,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Path is "/" (not /api/auth/refresh) so POST /api/auth/logout can read and
  // revoke the presented token server-side. Still httpOnly + SameSite=Lax.
  res.cookie("refresh_token", refreshToken, {
    ...baseOpts,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Legacy cookie for backward compat
  res.cookie("focusarx_token", accessToken, {
    ...baseOpts,
    maxAge: 15 * 60 * 1000,
  });
}

function clearAuthCookies(res: any) {
  const baseOpts = {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax" as const,
    path: "/",
  };
  res.cookie("access_token", "", { ...baseOpts, maxAge: 0 });
  res.cookie("refresh_token", "", { ...baseOpts, maxAge: 0 });
  res.cookie("focusarx_token", "", { ...baseOpts, maxAge: 0 });
}

/**
 * Issue a DB-backed refresh token (opaque, hashed at rest) + short access
 * token, and set cookies. Stateless JWT refresh tokens are no longer minted.
 */
async function issueRefreshCredentials(
  res: { cookie: (name: string, value: string, opts: Record<string, unknown>) => void },
  userId: string,
  secret: string,
  req: { headers: { "user-agent"?: string }; ip?: string },
): Promise<{ accessToken: string; legacyToken: string }> {
  const refresh = await createRefreshFamily(userId, {
    userAgent: req.headers["user-agent"] ?? null,
    ip: req.ip ?? null,
  });
  const accessToken = makeAccessToken(userId, secret);
  const legacyToken = makeLegacyToken(userId, secret); // migrate clients off this gradually
  setAuthCookies(res, accessToken, refresh.token);
  return { accessToken, legacyToken };
}

router.get("/auth/session", async (req, res) => {
  if (!jwtSecretOrRespond(res)) return;
  const userId = extractUserId(req);
  if (!userId) {
    sendUnauthorized(res);
    return;
  }
  try {
    const [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      isGuest: usersTable.isGuest,
      role: usersTable.role,
      onboardingCompleted: usersTable.onboardingCompleted,
      bio: usersTable.bio,
      timezone: usersTable.timezone
    }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      sendUnauthorized(res, "User not found");
      return;
    }
    res.json({ user });
  } catch (err) {
    logger.error({ err }, "session error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.post("/auth/login", authLimiter, async (req, res) => {
  const secret = jwtSecretOrRespond(res);
  if (!secret) return;
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid email or password format" } });
    return;
  }
  const { email, password } = parsed.data;
  try {
    const [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      isGuest: usersTable.isGuest,
      hashedPassword: usersTable.hashedPassword,
    }).from(usersTable).where(eq(usersTable.email, email));
    if (!user?.hashedPassword) {
      res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } });
      return;
    }
    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } });
      return;
    }
    const { accessToken, legacyToken } = await issueRefreshCredentials(res, user.id, secret, req);

    res.json({
      token: legacyToken,
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, isGuest: user.isGuest }
    });
  } catch (err) {
    logger.error({ err }, "login error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.post("/auth/register", authLimiter, async (req, res) => {
  const secret = jwtSecretOrRespond(res);
  if (!secret) return;
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid input";
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: msg } });
    return;
  }
  const { email, password, name } = parsed.data;
  try {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing) {
      res.status(400).json({ error: { code: "EMAIL_EXISTS", message: "Email already registered" } });
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({ email, name: name || null, hashedPassword, isGuest: false }).returning({ id: usersTable.id, email: usersTable.email });
    if (!user) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create user" } });
      return;
    }
    res.status(201).json({ message: "Account created", user: { id: user.id, email: user.email } });
  } catch (err) {
    logger.error({ err }, "register error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.post("/auth/guest", authLimiter, async (req, res) => {
  const secret = jwtSecretOrRespond(res);
  if (!secret) return;
  const { guestKey } = req.body as { guestKey?: string };
  if (!guestKey || guestKey.length < 8) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid guest key" } });
    return;
  }
  const safeKey = guestKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
  const guestEmail = `guest_${safeKey}@guest.focusarx.internal`;
  try {
    let [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      isGuest: usersTable.isGuest,
    }).from(usersTable).where(eq(usersTable.guestKey, safeKey));
    if (!user) {
      const [created] = await db.insert(usersTable).values({ email: guestEmail, guestKey: safeKey, isGuest: true, name: "Guest" }).returning({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        isGuest: usersTable.isGuest,
      });
      user = created;
    }
    if (!user) {
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create guest" } });
      return;
    }
    const { accessToken, legacyToken } = await issueRefreshCredentials(res, user.id, secret, req);

    res.json({
      token: legacyToken,
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, isGuest: true }
    });
  } catch (err) {
    logger.error({ err }, "guest error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

// Lighter than login: legitimate clients refresh every ~14 min per tab.
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 30 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only count requests that actually present a refresh credential —
    // empty 401s are cheap and usually just logged-out page loads.
    const cookies = (req as { cookies?: Record<string, string> }).cookies ?? {};
    return !cookies.refresh_token && !(req.body as { refreshToken?: string } | null)?.refreshToken;
  },
});

router.post("/auth/refresh", refreshLimiter, async (req, res) => {
  const secret = jwtSecretOrRespond(res);
  if (!secret) return;

  const cookies = (req as any).cookies ?? {};
  const presented = cookies["refresh_token"] ?? (req.body as any)?.refreshToken;

  if (!presented || typeof presented !== "string") {
    sendUnauthorized(res, "Refresh token required");
    return;
  }

  const meta = { userAgent: req.headers["user-agent"] ?? null, ip: req.ip ?? null };

  // Legacy stateless JWT refresh cookie (pre-store deployment): exchange it for
  // a revocable DB-backed family. It expires naturally within 7 days.
  const legacyPayload = verifyToken(presented, secret, "refresh");
  if (legacyPayload?.sub) {
    try {
      const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, legacyPayload.sub));
      if (!user) {
        clearAuthCookies(res);
        sendUnauthorized(res, "User not found");
        return;
      }
      const { legacyToken } = await issueRefreshCredentials(res, user.id, secret, req);
      res.json({ token: legacyToken, accessToken: legacyToken });
    } catch (err) {
      logger.error({ err }, "refresh error (legacy exchange)");
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
    }
    return;
  }

  try {
    const result = await rotateRefreshToken(presented, meta);
    if (result.status !== "ok") {
      // unknown / expired / reused (reuse already burned the whole family)
      clearAuthCookies(res);
      res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Invalid refresh token" } });
      return;
    }
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, result.userId));
    if (!user) {
      clearAuthCookies(res);
      sendUnauthorized(res, "User not found");
      return;
    }
    const accessToken = makeAccessToken(user.id, secret);
    const legacyToken = makeLegacyToken(user.id, secret);
    setAuthCookies(res, accessToken, result.token);
    res.json({ token: legacyToken, accessToken });
  } catch (err) {
    logger.error({ err }, "refresh error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.post("/auth/logout", async (req, res) => {
  // Revoke the presented refresh token so a stolen/copied cookie cannot be
  // replayed after "sign out". Cookies are cleared regardless.
  const cookies = (req as any).cookies ?? {};
  const presented = cookies["refresh_token"];
  if (typeof presented === "string" && presented) {
    try {
      await revokeRefreshToken(presented);
    } catch (err) {
      logger.warn({ err }, "logout revoke failed (cookies still cleared)");
    }
  }
  clearAuthCookies(res);
  res.json({ ok: true });
});

// ── Socket tickets (short-lived handshake credentials) ────────────────────
// The SPA exchanges its session for a 60s socket-scoped ticket, so the
// long-lived bearer token never rides the Socket.IO handshake.

router.get("/auth/socket-ticket", async (req, res) => {
  const secret = jwtSecretOrRespond(res);
  if (!secret) return;
  const userId = extractUserId(req);
  if (!userId) {
    sendUnauthorized(res);
    return;
  }
  res.json(issueSocketTicket(userId, secret));
});

// ── Password change (authenticated) ───────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(128),
}).strict();

router.post("/auth/change-password", authLimiter, async (req, res) => {
  const secret = jwtSecretOrRespond(res);
  if (!secret) return;
  const userId = extractUserId(req);
  if (!userId) {
    sendUnauthorized(res);
    return;
  }
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Current password and a new password of at least 8 characters are required" } });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;

  try {
    const [user] = await db.select({ id: usersTable.id, hashedPassword: usersTable.hashedPassword, isGuest: usersTable.isGuest })
      .from(usersTable).where(eq(usersTable.id, userId));
    if (!user?.hashedPassword) {
      // Guests and OAuth-only accounts have no password to change.
      res.status(400).json({ error: { code: "NO_PASSWORD", message: "This account does not use a password" } });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!valid) {
      res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect" } });
      return;
    }
    if (await bcrypt.compare(newPassword, user.hashedPassword)) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "New password must differ from the current password" } });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.transaction(async (tx) => {
      await tx.update(usersTable).set({ hashedPassword }).where(eq(usersTable.id, userId));
    });

    // Invalidate every refresh family — all devices must re-authenticate with
    // the new password. (Stateless legacy access tokens wind down naturally;
    // refresh-based sessions die immediately.)
    await revokeAllUserRefreshTokens(userId);
    clearAuthCookies(res);
    logger.info({ userId }, "password changed — all refresh tokens revoked");
    res.json({ ok: true, message: "Password updated. Please sign in again." });
  } catch (err) {
    logger.error({ err }, "change password error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

// ── Account deletion (authenticated, password-confirmed) ──────────────────

router.delete("/auth/account", authLimiter, async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) {
    sendUnauthorized(res);
    return;
  }

  try {
    const [user] = await db.select({ id: usersTable.id, hashedPassword: usersTable.hashedPassword, isGuest: usersTable.isGuest, email: usersTable.email, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Account not found" } });
      return;
    }
    if (user.role?.toLowerCase() === "admin") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin accounts cannot self-delete" } });
      return;
    }

    // Password confirmation (non-guest accounts with a password). Guests prove
    // nothing — their account is ephemeral by design.
    if (!user.isGuest && user.hashedPassword) {
      const { password } = req.body as { password?: string };
      if (!password || typeof password !== "string" || !(await bcrypt.compare(password, user.hashedPassword))) {
        res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Password confirmation required" } });
        return;
      }
    }

    // Scrub PII that would survive the cascade via ON DELETE SET NULL — must
    // happen BEFORE the delete (the link is lost afterwards).
    await db.transaction(async (tx) => {
      await tx.update(emailLogsTable).set({ recipientEmail: "[deleted]" }).where(eq(emailLogsTable.recipientId, userId));
      await tx.delete(usersTable).where(eq(usersTable.id, userId));
    });

    clearAuthCookies(res);
    logger.info({ userId, isGuest: user.isGuest }, "account deleted");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "account deletion error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

// ── Password reset ────────────────────────────────────────────────────────

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const RESET_EMAIL_SUBJECT = "Reset your FocusArx password";
const resetEmailText = (resetUrl: string) =>
  `Click the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`;
const resetEmailHtml = (resetUrl: string) =>
  `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, ignore this email.</p>`;

/** Preferred path: Resend HTTP API (no SMTP credentials needed). */
async function sendResetEmailViaResend(to: string, resetUrl: string): Promise<boolean | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null; // not configured — let caller fall back to SMTP
  const from = process.env.EMAIL_FROM ?? "FocusArx <onboarding@resend.dev>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: RESET_EMAIL_SUBJECT,
        text: resetEmailText(resetUrl),
        html: resetEmailHtml(resetUrl),
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.warn({ status: response.status, body }, "Resend reset-email send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err }, "Resend reset-email request error");
    return false;
  }
}

/** Fallback path: classic SMTP via nodemailer. */
async function sendResetEmailViaSmtp(to: string, resetUrl: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user ?? "focusarx@gmail.com";

  if (!host || !user || !pass) return false;

  try {
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({
      from: `"FocusArx" <${from}>`,
      to,
      subject: RESET_EMAIL_SUBJECT,
      text: resetEmailText(resetUrl),
      html: resetEmailHtml(resetUrl),
    });
    return true;
  } catch (err) {
    logger.warn({ err }, "failed to send reset email");
    return false;
  }
}

/** Send the password-reset email via Resend when configured, else SMTP. */
async function sendResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const viaResend = await sendResetEmailViaResend(to, resetUrl);
  if (viaResend !== null) return viaResend;
  return sendResetEmailViaSmtp(to, resetUrl);
}

router.post("/auth/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Valid email required" } });
    return;
  }
  const { email } = parsed.data;
  const { appUrl } = getServerConfig();

  try {
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable).where(and(eq(usersTable.email, email.toLowerCase().trim()), eq(usersTable.isGuest, false)));

    if (!user) {
      // Uniform response for known and unknown emails — do not leak account
      // existence (the client shows a generic "check your inbox" message).
      res.json({ ok: true });
      return;
    }

    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3600_000);

    await db.insert(passwordResetTokensTable).values({ userId: user.id, token: hashResetToken(token), expiresAt });

    const resetUrl = `${appUrl}/reset-password?token=${token}`;
    const emailSent = await sendResetEmail(user.email, resetUrl);

    if (process.env.NODE_ENV !== "production" && !emailSent) {
      logger.info({ devResetUrl: resetUrl }, "dev: password reset URL (not sent by email)");
    }
    // Uniform response — never reveal whether the account exists.
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "forgot password error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.post("/auth/reset-password", authLimiter, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Token and a password of at least 8 characters are required" } });
    return;
  }
  const { token, password } = parsed.data;

  try {
    const now = new Date();
    const hashedPassword = await bcrypt.hash(password, 12);
    const resetToken = await db.transaction(async (tx) => {
      const [row] = await tx.update(passwordResetTokensTable)
        .set({ usedAt: now })
        .where(and(
          eq(passwordResetTokensTable.token, hashResetToken(token)),
          gt(passwordResetTokensTable.expiresAt, now),
          isNull(passwordResetTokensTable.usedAt),
        ))
        .returning({ id: passwordResetTokensTable.id, userId: passwordResetTokensTable.userId });
      if (!row) return null;
      await tx.update(usersTable).set({ hashedPassword }).where(eq(usersTable.id, row.userId));
      return row;
    });

    if (!resetToken) {
      res.status(400).json({ error: { code: "INVALID_TOKEN", message: "Reset link is invalid or expired" } });
      return;
    }
    // A password reset means the credential changed (usually a lockout) —
    // every refresh family dies here so stolen sessions cannot survive it.
    await revokeAllUserRefreshTokens(resetToken.userId);
    logger.info({ userId: resetToken.userId }, "password reset — all refresh tokens revoked");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "reset password error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.get("/auth/reset-password/verify", forgotPasswordLimiter, async (req, res) => {
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(400).json({ valid: false });
    return;
  }
  try {
    const now = new Date();
    const [resetToken] = await db.select({ id: passwordResetTokensTable.id })
      .from(passwordResetTokensTable)
      .where(and(eq(passwordResetTokensTable.token, hashResetToken(token)), gt(passwordResetTokensTable.expiresAt, now), isNull(passwordResetTokensTable.usedAt)));
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
  if (!userId) {
    sendUnauthorized(res);
    return;
  }
  const { data } = req.body as { data?: unknown };
  if (!data) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing onboarding data" } });
    return;
  }
  const parsed = onboardingSchema.safeParse(data);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid onboarding data", details: parsed.error.errors } });
    return;
  }
  try {
    await db.update(usersTable)
      .set({ onboardingCompleted: true, onboardingData: parsed.data })
      .where(eq(usersTable.id, userId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "onboarding save error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

router.patch("/auth/profile", async (req, res) => {
  const userId = extractUserId(req);
  if (!userId) {
    sendUnauthorized(res);
    return;
  }
  const { name, bio, timezone } = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim().slice(0, 60);
  if (typeof bio === "string") updates.bio = bio.slice(0, 300);
  if (typeof timezone === "string") updates.timezone = timezone;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No valid fields to update" } });
    return;
  }
  try {
    await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
    const [user] = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
    res.json({ ok: true, user });
  } catch (err) {
    logger.error({ err }, "profile update error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal error" } });
  }
});

export { router as authRouter };
