import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

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
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
  skipSuccessfulRequests: false,
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 50 : 5,
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
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many refresh attempts, please sign in again." } },
  keyGenerator: ipKey,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 500 : 120,
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

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many admin requests, please try again later." },
});

/** Premium users bypass this limiter (unlimited AI Roadmap generation). */
export const aiRoadmapLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 50 : 10,
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
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Coach message limit reached. Please wait a moment." },
  skip: (req) => !!(req as any).isPremium,
  // Keyed on user id, not on the Bearer token prefix: tokens rotate every
  // 15 minutes and each rotation used to reset the caller's AI budget.
  keyGenerator: (req) => `coach:${userKey(req)}`,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
});
