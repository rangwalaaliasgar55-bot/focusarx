import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

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
  keyGenerator: (req) => {
    const body = req.body as { visitorId?: string } | undefined;
    const vid = body?.visitorId;
    const rawIp = req.ip ?? "unknown";
    const ip = rawIp.startsWith("::ffff:") ? rawIp.slice(7) : rawIp;
    return vid ? `${vid}:${ip}` : ip;
  },
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
  keyGenerator: (req) => {
    const authHeader = (req.headers as Record<string, string | undefined>).authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7, 50) : null;
    const rawIp = req.ip ?? "unknown";
    const ip = rawIp.startsWith("::ffff:") ? rawIp.slice(7) : rawIp;
    return token ? `roadmap:${token}:${ip}` : `roadmap:${ip}`;
  },
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
  keyGenerator: (req) => {
    const authHeader = (req.headers as Record<string, string | undefined>).authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7, 50) : null;
    const rawIp = req.ip ?? "unknown";
    const ip = rawIp.startsWith("::ffff:") ? rawIp.slice(7) : rawIp;
    return token ? `coach:${token}:${ip}` : `coach:${ip}`;
  },
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
});
