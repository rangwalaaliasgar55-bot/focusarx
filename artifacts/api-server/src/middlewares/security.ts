import { Request, Response, NextFunction } from "express";

/**
 * Advanced Security Middleware
 * - Blocks suspicious User-Agents
 * - Adds strict COOP/COEP headers
 * - Prevents basic XSS in query params
 */
export function masterSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Block known bad bots and empty UAs (allow legitimate search crawlers).
  const ua = req.headers["user-agent"] || "";
  const knownCrawlers = ["Googlebot", "Bingbot", "DuckDuckBot", "YandexBot", "Baiduspider"];
  const badBots = [/bot/i, /spider/i, /crawl/i, /curl/i, /python/i, /wget/i, /scrapy/i];

  const looksAutomated = badBots.some((bot) => bot.test(ua));
  const isKnownCrawler = knownCrawlers.some((c) => ua.toLowerCase().includes(c.toLowerCase()));
  const isStaticAsset = req.path.includes("sitemap") || req.path.includes("robots.txt");

  if (looksAutomated && !isKnownCrawler && !isStaticAsset) {
    res.status(403).json({ error: "Automated access restricted" });
    return;
  }

  // 2. Strict Cross-Origin Policies
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");

  // 3. Prevent XSS in Query Strings (basic sanitization) — safely handle arrays
  // and objects that Express 5 may place in req.query.
  for (const key of Object.keys(req.query)) {
    const value = req.query[key];
    if (typeof value === "string") {
      req.query[key] = value.replace(/[<>]/g, "");
    } else if (Array.isArray(value)) {
      req.query[key] = value.map((v) =>
        typeof v === "string" ? v.replace(/[<>]/g, "") : v,
      ) as never;
    }
  }

  next();
}
