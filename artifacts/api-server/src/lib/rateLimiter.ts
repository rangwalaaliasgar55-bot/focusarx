import rateLimit from "express-rate-limit";
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

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  store: store(15 * 60 * 1000, "auth"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
  skipSuccessfulRequests: false,
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 50 : 5,
  store: store(60 * 60 * 1000, "forgot-password"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset requests, please wait an hour." },
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

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 120,
  store: store(60 * 1000, "general"),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
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
