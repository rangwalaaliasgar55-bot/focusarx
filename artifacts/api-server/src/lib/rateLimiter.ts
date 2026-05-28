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
