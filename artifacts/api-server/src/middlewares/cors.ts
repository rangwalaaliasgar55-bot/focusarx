import type { NextFunction, Request, Response } from "express";
import { getEnv } from "../lib/env";
import { getServerConfig } from "../lib/config";
import { logger } from "../lib/logger";

/**
 * Same-origin-aware CORS middleware (replaces the `cors` package).
 *
 * ── Why this exists ─────────────────────────────────────────────────────
 * The previous setup used the `cors` package with a strict allowlist of
 * exact origins (`APP_URL` + Vercel URLs + `CORS_ALLOWED_ORIGINS`). Browsers
 * only send an `Origin` header on mutating requests (POST/PUT/PATCH/DELETE)
 * and on CORS preflights — same-origin GETs carry none. So when the
 * allowlist drifted from the real host (custom domain attached after the env
 * was set, `www.` vs apex, a preview alias, `APP_URL` never updated), every
 * POST failed with `403 CORS_FORBIDDEN` while GETs kept working:
 *
 *   GET  /api/auth/session → 401 (normal, reached the handler)
 *   POST /api/auth/login   → 403 (blocked by CORS, never reached auth)
 *   POST /api/auth/refresh → 403
 *   POST /api/track        → 403
 *
 * From the user's perspective "login is broken" with no actionable message,
 * because a rejected origin also means the browser hides the response body.
 *
 * This middleware keeps the locked-down posture (no `*`, credentials only
 * for approved origins) but additionally allows:
 *   1. Same-origin requests — `Origin` host === request `Host`. The SPA and
 *      the API are served from the same deployment, so the page talking to
 *      its own host is legitimate by definition, whatever the env says.
 *   2. `www.`/apex counterparts of every configured origin — so
 *      `https://focusarx.site` and `https://www.focusarx.site` never diverge.
 *
 * A genuine cross-origin attacker (`Origin: https://evil.example` against
 * `Host: focusarx.site`) still fails all three checks and gets the same
 * `403 CORS_FORBIDDEN` contract as before.
 */

export const CORS_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

export const CORS_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Requested-With",
  "X-Request-Id",
  "X-FocusArx-Deployment",
  "Idempotency-Key",
];

export const CORS_EXPOSED_HEADERS = ["X-Request-Id", "X-FocusArx-Deployment", "X-FocusArx-Deploy-Env"];

export const CORS_MAX_AGE_SECONDS = 86400;

/** Normalise a URL to `protocol//host` (lowercased host, no path/trailing slash). */
export function toOrigin(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url.replace(/\/+$/, "");
  }
}

/** Lowercased hostname of an `Origin` header value, or `null` when unparsable. */
export function hostOfOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Toggle the `www.` subdomain: `www.a.com` → `a.com`, `a.com` → `www.a.com`. */
export function toggleWww(host: string): string {
  const lower = host.toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : `www.${lower}`;
}

/**
 * The host the client actually reached, honouring Vercel's forwarded header.
 * Lowercased, port stripped. `null` when neither header is present.
 */
export function requestHost(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-host"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const raw = (firstForwarded ?? req.headers.host ?? "").split(",")[0]?.trim() ?? "";
  if (!raw) return null;
  const host = raw.split(":")[0]?.toLowerCase() ?? "";
  // Strip a trailing dot (`example.com.` is the same host) and IPv6 brackets noise.
  const cleaned = host.endsWith(".") ? host.slice(0, -1) : host;
  return cleaned || null;
}

/**
 * Exact origin strings the deployment is configured to serve. Mirrors the
 * previous `cors`-package `origin` callback: canonical app URL, Vercel URLs,
 * and the operator-supplied extra list.
 */
export function buildAllowedOrigins(): string[] {
  try {
    const env = getEnv();
    return [
      getServerConfig().appUrl,
      env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null,
      env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
      ...(env.CORS_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? []),
      ...(process.env.CORS_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? []),
    ].filter((v): v is string => Boolean(v));
  } catch {
    return [
      getServerConfig().appUrl,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
      ...(process.env.CORS_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? []),
    ].filter((v): v is string => Boolean(v));
  }
}

export interface CorsDecisionInput {
  /** Raw `Origin` request header (already known to be present). */
  origin: string;
  /** Result of `requestHost(req)` — may be `null` behind exotic proxies. */
  reqHost: string | null;
  /** Effective `NODE_ENV` (`"production"` locks down, anything else reflects). */
  nodeEnv: string;
  /** Result of `buildAllowedOrigins()`. */
  allowedOrigins: string[];
}

/**
 * Pure allow/deny decision — no env access, so it is trivially unit-testable.
 *
 * Allow when ANY of these hold:
 *   1. Non-production environment (dev/test reflect the origin, as before).
 *   2. Exact origin match against the configured allowlist.
 *   3. `www.`/apex counterpart match (same scheme as the configured origin).
 *   4. Same-origin: the `Origin` host equals the request `Host`.
 */
export function resolveCorsDecision({ origin, reqHost, nodeEnv, allowedOrigins }: CorsDecisionInput): boolean {
  if (nodeEnv !== "production") return true;

  const requestOrigin = toOrigin(origin);
  const allowedSet = new Set(allowedOrigins.map(toOrigin));
  if (allowedSet.has(requestOrigin)) return true;

  // www ↔ apex counterparts of every configured origin (scheme-preserving).
  for (const allowed of allowedSet) {
    try {
      const u = new URL(allowed);
      if (`${u.protocol}//${toggleWww(u.hostname)}` === requestOrigin.toLowerCase()) return true;
    } catch {
      // Non-URL allowlist entries can only match exactly (checked above).
    }
  }

  // Same deployment talking to itself (custom domain, preview alias, or an
  // env that was never updated after a domain move).
  const originHost = hostOfOrigin(origin);
  if (originHost && reqHost && originHost === reqHost) return true;

  return false;
}

function setCorsAllowHeaders(res: Response, origin: string): void {
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Expose-Headers", CORS_EXPOSED_HEADERS.join(", "));
  const existingVary = res.getHeader("Vary");
  if (typeof existingVary === "string") {
    if (!/\borigin\b/i.test(existingVary)) res.setHeader("Vary", `${existingVary}, Origin`);
  } else if (existingVary === undefined) {
    res.setHeader("Vary", "Origin");
  }
  // When Vary is an array/number (set by another middleware), leave it alone
  // rather than clobbering it — caches stay correct either way.
}

/**
 * Express middleware. On success it attaches the CORS response headers (and
 * short-circuits preflight `OPTIONS` with a `204`); on rejection it forwards
 * an `Error("CORS: origin not allowed")` so the central error handler in
 * `app.ts` keeps answering `403 { error: { code: "CORS_FORBIDDEN" } }`.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const rawOrigin = req.headers.origin;
  const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;

  // No `Origin` header: same-origin GET / non-browser client — nothing to do.
  if (!origin) {
    next();
    return;
  }

  let nodeEnv = "development";
  try {
    nodeEnv = getEnv().NODE_ENV;
  } catch {
    nodeEnv = process.env.NODE_ENV === "production" ? "production" : "development";
  }

  let allowedOrigins: string[] = [];
  try {
    allowedOrigins = buildAllowedOrigins();
  } catch {
    allowedOrigins = [];
  }

  const allowed = resolveCorsDecision({ origin, reqHost: requestHost(req), nodeEnv, allowedOrigins });

  if (!allowed) {
    logger.warn({ origin, requestHost: requestHost(req), allowedOrigins }, "CORS origin rejected");
    next(new Error("CORS: origin not allowed"));
    return;
  }

  setCorsAllowHeaders(res, origin);

  // CORS preflight: answer here so it never reaches the routers or the
  // rate limiters (a preflight is not a real request and must not consume
  // budget or require auth).
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", CORS_METHODS.join(", "));
    res.setHeader("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS.join(", "));
    res.setHeader("Access-Control-Max-Age", String(CORS_MAX_AGE_SECONDS));
    res.status(204).end();
    return;
  }

  next();
}
