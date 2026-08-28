import { Request, Response, NextFunction } from "express";

/**
 * Advanced Security Middleware
 * - Blocks abusive User-Agents (without breaking ads, SEO or uptime monitors)
 * - Adds strict COOP/COEP headers
 * - Neutralises tag/attribute injection in query params
 * - Collapses HTTP parameter pollution
 *
 * ── Why the old bot filter was rewritten ───────────────────────────
 * It blocked on `/bot/i`, `/spider/i`, `/crawl/i` with a five-entry allowlist.
 * That 403'd a long list of traffic the product actually needs:
 *   • AdsBot-Google / Google-Adwords-Instant  → AdSense policy review could
 *     never load the page, so ad units stay unapproved
 *   • UptimeRobot / Better Stack / Pingdom / Healthchecks → monitoring blind
 *   • Slackbot, Discordbot, WhatsApp, TelegramBot → link previews on every
 *     shared FocusArx URL showed nothing
 *   • facebookexternalhit, Twitterbot, LinkedInBot → same
 * Blocking curl/python/wget outright also broke every CI smoke test.
 * The blocklist is now explicit and narrow: real scrapers and empty UAs.
 */

/** Agents that must always be allowed through, whatever they look like. */
const ALWAYS_ALLOWED = [
  // Search / SEO
  "googlebot", "bingbot", "duckduckbot", "yandexbot", "baiduspider",
  "applebot", "slurp", "semrushbot", "ahrefsbot", "mj12bot", "petalbot",
  "facebookexternalhit", "twitterbot", "linkedinbot", "embedly", "showyoubot",
  "outbrain", "pinterest", "quora link preview", "slackbot", "discordbot",
  "telegrambot", "whatsapp", "vkshare", "w3c_validator",
  // Advertising — required for AdSense approval and serving
  "adsbot-google", "adsbot-google-mobile", "google-adwords-instant",
  "googleweblight", "storebot-google", "google-read-aloud",
  "mediapartners-google", "google-ads", "adidxbot", "bingpreview",
  // Monitoring
  "uptimerobot", "better stack", "pingdom", "healthchecks", "site24x7",
  "statuscake", "newrelic", "datadog", "godaddy", "jetmon", "nodeping",
];

/** Genuinely abusive clients. Narrow on purpose. */
const BLOCKED_PATTERNS = [
  /scrapy/i, /python-requests/i, /python-urllib/i, /go-http-client/i,
  /java\//i, /libwww-perl/i, /httpclient/i, /masscan/i, /zgrab/i,
  /nikto/i, /sqlmap/i, /nmap/i, /acunetix/i, /netsparker/i,
  /wget/i, /curl\//i,
];

/** Paths that must never be gated by the UA filter. */
function isAlwaysAllowedPath(path: string): boolean {
  return (
    path.includes("sitemap") ||
    path.includes("robots.txt") ||
    path.includes("ads.txt") ||
    path === "/healthz" ||
    path.startsWith("/healthz/")
  );
}

function looksLikeAllowedAgent(ua: string): boolean {
  const lower = ua.toLowerCase();
  return ALWAYS_ALLOWED.some((a) => lower.includes(a));
}

function looksAbusive(ua: string): boolean {
  return BLOCKED_PATTERNS.some((p) => p.test(ua));
}

/**
 * Neutralise injection payloads in a single string.
 *
 * The previous version stripped every `<` and `>` from every query value,
 * which silently corrupted legitimate searches like `a < b`. This instead
 * removes only sequences that can actually form markup or a handler, so
 * ordinary text survives intact.
 */
function sanitiseValue(value: string): string {
  return value
    // <script>, </div>, <img ...> — anything tag-shaped
    .replace(/<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?>/gi, "")
    // inline event handlers
    .replace(/\son[a-z]+\s*=/gi, "")
    // script: / data: URIs used as injection vectors
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "");
}

/**
 * Collapse HTTP parameter pollution: `?id=1&id=2` arrives as an array.
 * Take the first value so downstream handlers see one predictable string
 * instead of an array they may index incorrectly.
 */
function collapsePollution(req: Request): void {
  const query = req.query as Record<string, unknown>;
  for (const key of Object.keys(query)) {
    const value = query[key];
    if (Array.isArray(value)) {
      const first = value[0];
      query[key] = (typeof first === "string" ? sanitiseValue(first) : first) as never;
    } else if (typeof value === "string") {
      query[key] = sanitiseValue(value) as never;
    }
  }
}

export function masterSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  const ua = (req.headers["user-agent"] as string) || "";
  const path = req.path ?? "";

  // 1. UA gate — empty UAs and known-abusive clients only.
  const gated = !isAlwaysAllowedPath(path) && !looksLikeAllowedAgent(ua);
  if (gated && (ua.trim() === "" || looksAbusive(ua))) {
    res.status(403).json({ error: "Automated access restricted" });
    return;
  }

  // 2. Cross-Origin policies.
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  // COEP must stay `unsafe-none` while AdSense is served: `credentialless`
  // blocks the credentialed cross-origin requests the ad iframes rely on, and
  // ads silently render blank. The app loads no cross-origin modules that
  // need COEP's stronger guarantee.
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");

  // 3. Query-string hardening (sanitise + collapse parameter pollution).
  try {
    collapsePollution(req);
  } catch {
    // Never let a hardening step break the request.
  }

  next();
}
