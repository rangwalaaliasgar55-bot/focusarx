import rateLimit from "express-rate-limit";
import type { Response } from "express";
import { getRateLimitStore } from "./rateLimitStore";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Upstash-backed store when configured (global counters on serverless),
 * otherwise undefined → express-rate-limit's in-memory store (dev/self-host).
 * The prefix isolates each limiter's counters in Redis.
 */
function store(windowMs: number, prefix: string) {
  return getRateLimitStore(windowMs, prefix);
}

/**
 * Normalise `req.ip` into a stable key fragment.
 * Express's `trust proxy` gives us the real client IP behind Vercel's edge.
 */
function ipKey(req: { ip?: string }): string {
  const raw = req.ip ?? "unknown";
  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

/**
 * Identify a caller by its *user id* when authenticated, else by IP.
 *
 * The AI limiters used to key on the first 50 chars of the Bearer token. Since
 * access tokens rotate every 15 minutes, every rotation minted a fresh bucket
 * and the limit never actually applied. Keying on the stable `sub` claim (or
 * the user id attached by authMiddleware) makes the budget follow the user.
 */
function userKey(req: any): string {
  const userId = req?.userId as string | undefined;
  if (userId) return userId;
  const authHeader = (req?.headers as Record<string, string | undefined> | undefined)?.authorization;
  // Fall back to the token only to distinguish *unauthenticated* callers; this
  // never widens the budget because there is no budget for them anyway.
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7, 50) : null;
  return token ? `tok:${token}` : `ip:${ipKey(req)}`;
}

/** Ask a rate-limited response how long the caller must wait (best effort). */
function retryAfterSeconds(res: Response): number {
  const value = res.getHeader("Retry-After");
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 60;
}

/**
 * Sign-in attempts (login / register / change-password).
 *
 * `skipSuccessfulRequests` is the fix for a lockout that had nothing to do with
 * attackers: the bucket counted *every* request, so a successful sign-in cost
 * the same as a wrong password. With the old 10-per-15-minutes-per-IP limit,
 * one school lab, one shared family connection, one office NAT — or one person
 * who signs in from three devices and refreshes the page twice — burned the
 * whole window and everyone behind it was told "Too many attempts". Throttling
 * failures only keeps the brute-force protection (an attacker never produces a
 * 2xx) while legitimate logins stop costing budget.
 *
 * The response is the standard error envelope with `retryAfterSeconds`, so the
 * form can say *when* to come back instead of "try again later".
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 100 : 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: store(15 * 60 * 1000, "auth"),
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many sign-in attempts. Wait a few minutes and try again — your account is not locked and your data is safe.",
        retryAfterSeconds: retryAfterSeconds(res),
      },
    });
  },
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isDev ? 50 : 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: store(60 * 60 * 1000, "forgot-password"),
  message: { error: { code: "RATE_LIMITED", message: "Too many password-reset requests. Please wait an hour and try again." } },
});

/**
 * Reset-link work (the `verify` probe + the reset POST).
 *
 * These used to share `forgotPasswordLimiter`, so opening the reset page — a
 * plain GET the SPA fires before the form is even usable — consumed part of the
 * hourly "send me a reset email" budget. Two refreshes of the reset page plus a
 * forgotten-password click on a shared IP and the whole network was locked out
 * of password recovery. Separate window, separate counter, generous enough that
 * no real user reaches it.
 */
export const resetLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 200 : 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: store(15 * 60 * 1000, "reset-link"),
  message: { error: { code: "RATE_LIMITED", message: "Too many password-reset attempts. Please wait a few minutes." } },
});


/**
 * Guest account creation.
 *
 * `/auth/guest` previously had no limiter at all, so a single client could
 * mint unlimited guest users and JWTs — an unbounded write path into the
 * users table. Bounded per IP here.
 */
export const guestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many guest sessions, please try again later." } },
  keyGenerator: ipKey,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
});

/**
 * Token refresh.
 *
 * Also previously unlimited — an attacker holding one stolen refresh token
 * could hammer this endpoint to keep rotating it forever and to generate
 * load. Bounded per IP, generous enough that a legitimately busy multi-tab
 * session is never affected.
 */
export const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many refresh attempts, please sign in again." } },
  keyGenerator: ipKey,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  // Lighter than login: legitimate clients refresh every ~14 min per tab.
  // Only count requests that actually present a refresh credential — empty
  // 401s are cheap and usually just logged-out page loads.
  skip: (req) => {
    const cookies = (req as { cookies?: Record<string, string> }).cookies ?? {};
    return !cookies.refresh_token && !(req.body as { refreshToken?: string } | null)?.refreshToken;
  },
});

/**
 * Auth endpoints carry their own, stricter limiters (authLimiter, guestLimiter,
 * refreshLimiter, forgotPasswordLimiter, resetLinkLimiter). They are excluded
 * from the general bucket on purpose: `generalLimiter` is keyed on IP and
 * counts EVERY /api call a page makes, so one classroom, one family, or one
 * office behind a single address — each tab firing a dozen dashboard, session
 * and notification requests on load — can fill the window with ordinary
 * browsing. When that happens, the person who did nothing wrong is the one
 * typing a password, and the app answers their correct credentials with a 429.
 */
const SHARED_BUCKET_EXEMPT_AUTH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/guest",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/change-password",
];

function isOwnLimitedAuthPath(req: { path?: string; url?: string }): boolean {
  const path = req.path ?? req.url ?? "";
  return SHARED_BUCKET_EXEMPT_AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 120,
  store: store(60 * 1000, "general"),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isOwnLimitedAuthPath(req as { path?: string; url?: string }),
  message: { error: { code: "RATE_LIMITED", message: "Too many requests, slow down." } },
});

export const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 300 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many tracking requests." },
  // Keyed on IP only. This used to key on the client-supplied `body.visitorId`,
  // which any caller can rotate per request to get an unlimited budget. The IP
  // is the only part of the key the client cannot forge.
  keyGenerator: ipKey,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
});

/**
 * Focus-session completion. The endpoint is idempotent per clientNonce, but a
 * fresh nonce is generated per session, so a broken client loop could still
 * spam session rows. 30 completions / 5 min is far above legitimate human use
 * (pomodoro ≈ 12/h) while capping reward-farming write amplification.
 */
export const sessionCompleteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: isDev ? 200 : 30,
  store: store(5 * 60 * 1000, "session-complete"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many session submissions, please wait a moment." } },
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 20,
  store: store(15 * 60 * 1000, "admin"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many admin requests, please try again later." },
});

/** Premium users bypass this limiter (unlimited AI Roadmap generation). */
export const aiRoadmapLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 50 : 10,
  store: store(60 * 60 * 1000, "ai-roadmap"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Roadmap generation limit reached. Please try again in an hour." },
  skip: (req) => !!(req as any).isPremium,
  // Keyed on user id, not on the Bearer token prefix: tokens rotate every
  // 15 minutes and each rotation used to reset the caller's AI budget.
  keyGenerator: (req) => `roadmap:${userKey(req)}`,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
});

/** Premium users bypass this limiter (unlimited AI Coach messages). */
export const aiCoachLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 60 : 20,
  store: store(60 * 1000, "ai-coach"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Coach message limit reached. Please wait a moment." },
  skip: (req) => !!(req as any).isPremium,
  // Keyed on user id, not on the Bearer token prefix: tokens rotate every
  // 15 minutes and each rotation used to reset the caller's AI budget.
  keyGenerator: (req) => `coach:${userKey(req)}`,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
});
