import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { masterSecurityMiddleware } from "./security";

/**
 * Regression guard for the User-Agent blocklist.
 *
 * The previous filter blocked on `/bot/i`, `/spider/i`, `/crawl/i` with a
 * five-entry allowlist, which 403'd traffic the product depends on:
 *   • AdsBot-Google   → AdSense policy review never loaded the page, so ad
 *                       units stayed unapproved and earned nothing
 *   • UptimeRobot     → monitoring was blind to outages
 *   • Slackbot / facebookexternalhit / Discordbot → every shared FocusArx
 *                       link rendered with no preview
 * These tests pin the new behaviour in both directions.
 */

interface Harness {
  req: Partial<Request>;
  res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; setHeader: ReturnType<typeof vi.fn> };
  next: ReturnType<typeof vi.fn>;
}

function call(ua: string, path = "/api/healthz"): Harness {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  };
  const next = vi.fn();
  const req = { headers: { "user-agent": ua }, path, query: {} } as unknown as Partial<Request>;
  masterSecurityMiddleware(req as Request, res as unknown as Response, next as NextFunction);
  return { req, res, next };
}

const MUST_ALLOW = [
  "AdsBot-Google (+http://www.google.com/adsbot.html)",
  "AdsBot-Google-Mobile-Apps",
  "Mediapartners-Google",
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "DuckDuckBot/1.1",
  "UptimeRobot/2.0; http://www.uptimerobot.com/",
  "Better Stack Bot/1.0",
  "Pingdom.com_bot_version_1.4",
  "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
  "LinkedInBot/1.0",
  "Discordbot/2.0",
  "WhatsApp/2.23.20",
  "TelegramBot (like TwitterBot)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
];

const MUST_BLOCK = [
  "",
  "   ",
  "curl/8.5.0",
  "python-requests/2.31.0",
  "python-urllib/3.11",
  "Go-http-client/1.1",
  "Scrapy/2.11.0",
  "sqlmap/1.7",
  "Nikto/2.5.0",
  "masscan/1.3",
];

describe("masterSecurityMiddleware — User-Agent gate", () => {
  it.each(MUST_ALLOW)("allows %s", (ua) => {
    const { res, next } = call(ua);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(MUST_BLOCK)("blocks %j", (ua) => {
    const { res, next } = call(ua);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("never gates the sitemap / robots / ads / health paths", () => {
    for (const path of ["/sitemap.xml", "/sitemap-core.xml", "/api/robots.txt", "/ads.txt", "/healthz"]) {
      const { next } = call("curl/8.5.0", path);
      expect(next, `expected ${path} to bypass the UA gate`).toHaveBeenCalledTimes(1);
    }
  });
});

describe("masterSecurityMiddleware — cross-origin policy", () => {
  it("sets COEP to unsafe-none so AdSense iframes can load", () => {
    const { res } = call("Mozilla/5.0 Chrome/126.0");
    const headers = Object.fromEntries(res.setHeader.mock.calls.map(([k, v]) => [k, v]));
    // `credentialless` blocks the credentialed cross-origin requests ad
    // creatives need — ads then render blank with no console error.
    expect(headers["Cross-Origin-Embedder-Policy"]).toBe("unsafe-none");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });
});

describe("masterSecurityMiddleware — query hardening", () => {
  it("strips tag-shaped sequences but leaves ordinary text alone", () => {
    const { req } = call("Mozilla/5.0", "/api/search");
    (req as { query: Record<string, unknown> }).query = {
      attack: "<script>alert(1)</script>",
      benign: "a < b and b > c",
      handler: `<img src=x onerror="steal()">`,
    };
    masterSecurityMiddleware(
      req as Request,
      { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() } as unknown as Response,
      vi.fn() as unknown as NextFunction,
    );
    const q = (req as { query: Record<string, string> }).query;
    expect(q.attack).not.toMatch(/<script/i);
    expect(q.benign).toBe("a < b and b > c"); // old filter mangled this
    expect(q.handler).not.toMatch(/onerror\s*=/i);
  });

  it("collapses HTTP parameter pollution to a single value", () => {
    const { req } = call("Mozilla/5.0", "/api/search");
    (req as { query: Record<string, unknown> }).query = { id: ["1", "2", "3"] };
    masterSecurityMiddleware(
      req as Request,
      { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() } as unknown as Response,
      vi.fn() as unknown as NextFunction,
    );
    expect((req as { query: Record<string, unknown> }).query.id).toBe("1");
  });
});
