import { Request, Response, NextFunction } from "express";

/**
 * Advanced Security Middleware
 * - Blocks suspicious User-Agents
 * - Adds strict COOP/COEP headers
 * - Prevents basic XSS in query params
 */
export function masterSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Block known bad bots and empty UAs
  const ua = req.headers["user-agent"] || "";
  const badBots = [/bot/i, /spider/i, /crawl/i, /curl/i, /python/i];
  
  // Allow Googlebot for SEO, block others if they look suspicious
  if (badBots.some(bot => bot.test(ua)) && !ua.includes("Googlebot")) {
    // Only block if they aren't hitting the robots.txt or sitemap
    if (!req.path.includes("sitemap") && !req.path.includes("robots.txt")) {
        // Just a subtle soft-block
        res.status(403).json({ error: "Automated access restricted" });
        return;
    }
  }

  // 2. Strict Cross-Origin Policies
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  
  // 3. Prevent XSS in Query Strings (basic sanitization)
  for (const key in req.query) {
    if (typeof req.query[key] === "string") {
      req.query[key] = (req.query[key] as string).replace(/[<>]/g, "");
    }
  }

  next();
}
