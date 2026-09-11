/**
 * Canonical URL middleware — lowercase 301 for page paths.
 * ══════════════════════════════════════════════════════════════════
 * Every FocusArx route is lowercase, and the site serves exactly one form of
 * each URL. A link typed as `/Blog/` or shared as `/POMODORO-TIMER` used to
 * land on the SPA catch-all and answer **200 with the homepage prerender**, so
 * Google could index three spellings of one page and split the signals between
 * them (the "Duplicate, Google chose different canonical" family of issues).
 *
 * vercel.json now routes that traffic here:
 *
 *   { "src": "/([-A-Za-z0-9._~%/@]*[A-Z][-A-Za-z0-9._~%/@]*)",
 *     "dest": "/api/index.mjs?canonicalize=/$1" }
 *
 * The rule fires only for paths that (a) missed the filesystem and (b) contain
 * an uppercase letter, so it never sees a real page, a real asset, or
 * `/BingSiteAuth.xml`. A path-to-regexp `redirects` entry cannot express this:
 * with the default `caseSensitive: false` it also matches the lowercase
 * canonical and loops forever, and with `caseSensitive: true` you would need
 * one entry per spelling of every route.
 *
 * Answers 301 (permanent) — the lowercase URL is not going to change, and a
 * 301 is what consolidates ranking signals rather than merely hiding the
 * duplicate.
 */

import type { NextFunction, Request, Response } from "express";

/**
 * Paths that must never be rewritten.
 *
 * `/api/*` endpoints are matched case-sensitively by Express and a 301 there
 * would turn a client's POST into a GET (and leak a redirect into every SDK).
 * Vercel routes `/api/(.*)` before this rule can fire, but a standalone API
 * deployment has no such route — so the guard lives here too.
 */
function isExempt(path: string): boolean {
  return path === "/api" || path.startsWith("/api/");
}

/**
 * A same-origin relative path only. The value comes from a URL capture group,
 * so it is treated as untrusted input: it must start with exactly one `/` and
 * must not look like a scheme-relative URL (`//evil.com`), or the redirect
 * becomes an open one.
 */
export function isSafeRelativePath(value: string): boolean {
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  // Control characters and CR/LF would allow response splitting.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return value.length <= 2048;
}

/**
 * The canonical (lowercase) form of a path, or null when nothing needs to
 * change. Exported for tests.
 */
export function canonicalPathFor(path: string): string | null {
  if (!isSafeRelativePath(path)) return null;
  if (isExempt(path)) return null;
  const lower = path.toLowerCase();
  return lower === path ? null : lower;
}

export function canonicalUrlRedirect(req: Request, res: Response, next: NextFunction): void {
  // Only idempotent methods: a 301 on a POST is re-sent as a GET by most
  // clients, which silently changes the request.
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }

  // vercel.json passes the matched path as `?canonicalize=/Blog/`; a
  // standalone deployment sees the original path in `req.path`. Accept either.
  const hinted = typeof req.query.canonicalize === "string" ? req.query.canonicalize : "";
  const candidate = isSafeRelativePath(hinted) ? hinted : req.path;

  const canonical = canonicalPathFor(candidate);
  if (!canonical) {
    next();
    return;
  }

  // Preserve any real query string, dropping our own routing hint. Built with
  // URLSearchParams rather than string surgery so `?canonicalize=…&ref=abc`
  // cannot come out as `&ref=abc`.
  const search = new URLSearchParams(req.url.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "");
  search.delete("canonicalize");
  const query = search.toString();

  // Keep the redirect cheap to cache and never store it on the client: the
  // canonical spelling is a server decision, and a cached 301 would survive a
  // future route rename.
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.setHeader("Vary", "Accept-Encoding");
  res.redirect(301, query ? `${canonical}?${query}` : canonical);
}
