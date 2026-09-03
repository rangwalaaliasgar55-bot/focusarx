import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  hostOfOrigin,
  requestHost,
  resolveCorsDecision,
  toOrigin,
  toggleWww,
} from "./cors";

/**
 * Regression guard for the production CORS 403s on the SPA's own POSTs.
 *
 * Incident: browsers send `Origin` only on mutating requests, so when the
 * allowlist drifted from the real host every POST failed while GETs worked:
 *
 *   GET  /api/auth/session → 401 (normal, reached the handler)
 *   POST /api/auth/login   → 403 CORS_FORBIDDEN (never reached auth)
 *   POST /api/auth/refresh → 403
 *   POST /api/track        → 403
 *
 * These tests pin the fix in both directions: the deployment talking to
 * itself is always allowed (same-origin, www/apex), a real cross-origin
 * attacker is still rejected.
 */

const PROD = "production";

function decide(origin: string, reqHost: string | null, allowedOrigins: string[]) {
  return resolveCorsDecision({ origin, reqHost, nodeEnv: PROD, allowedOrigins });
}

describe("resolveCorsDecision — exact allowlist matches (old behaviour preserved)", () => {
  const allowed = ["https://focusarx.site"];

  it("allows the configured canonical origin", () => {
    expect(decide("https://focusarx.site", "focusarx.site", allowed)).toBe(true);
  });

  it("tolerates trailing slashes and paths on the Origin", () => {
    expect(decide("https://focusarx.site/", "other.example", allowed)).toBe(true);
  });

  it("rejects a lookalike domain", () => {
    expect(decide("https://focusarx.site.evil.example", "focusarx.site.evil.example", allowed)).toBe(true); // same-origin!
    expect(decide("https://focusarx.site.evil.example", "focusarx.site", allowed)).toBe(false);
  });

  it("rejects a genuine cross-origin attacker", () => {
    expect(decide("https://evil.example", "focusarx.site", allowed)).toBe(false);
  });

  it("rejects http downgrade of an https allowlist entry from another host", () => {
    expect(decide("http://focusarx.site", "attacker.example", allowed)).toBe(false);
  });
});

describe("resolveCorsDecision — www/apex counterparts", () => {
  it("allows www when the apex is configured", () => {
    expect(decide("https://www.focusarx.site", "unrelated.example", ["https://focusarx.site"])).toBe(true);
  });

  it("allows the apex when www is configured", () => {
    expect(decide("https://focusarx.site", "unrelated.example", ["https://www.focusarx.site"])).toBe(true);
  });

  it("does not allow www of a different domain", () => {
    expect(decide("https://www.evil.example", "unrelated.example", ["https://focusarx.site"])).toBe(false);
  });

  it("does not mix schemes on the counterpart", () => {
    expect(decide("http://www.focusarx.site", "unrelated.example", ["https://focusarx.site"])).toBe(false);
  });
});

describe("resolveCorsDecision — same-origin (the reported bug)", () => {
  it("allows the SPA talking to its own host even when the env was never updated", () => {
    // APP_URL still points at the old host (or the vercel.app fallback) while
    // the user visits the custom domain — the request IS same-origin.
    expect(decide("https://focusarx.site", "focusarx.site", ["https://focusarx.vercel.app"])).toBe(true);
  });

  it("allows preview deployments talking to themselves", () => {
    expect(
      decide("https://focusarx-git-branch-user.vercel.app", "focusarx-git-branch-user.vercel.app", [
        "https://focusarx.vercel.app",
      ]),
    ).toBe(true);
  });

  it("matches hosts case-insensitively", () => {
    expect(decide("https://FocusArx.Site", "focusarx.site", ["https://focusarx.vercel.app"])).toBe(true);
  });

  it("still rejects cross-origin when hosts differ and nothing is configured", () => {
    expect(decide("https://evil.example", "focusarx.site", ["https://focusarx.vercel.app"])).toBe(false);
  });

  it("still rejects when the request host is unknown", () => {
    expect(decide("https://evil.example", null, ["https://focusarx.site"])).toBe(false);
  });
});

describe("resolveCorsDecision — non-production reflects (dev parity)", () => {
  it.each(["development", "test"])("allows anything in %s", (nodeEnv) => {
    expect(
      resolveCorsDecision({ origin: "https://anything.example", reqHost: null, nodeEnv, allowedOrigins: [] }),
    ).toBe(true);
  });
});

describe("requestHost", () => {
  const reqWith = (headers: Record<string, unknown>) => ({ headers }) as unknown as Request;

  it("prefers x-forwarded-host (Vercel) over host", () => {
    expect(requestHost(reqWith({ "x-forwarded-host": "focusarx.site", host: "internal:8080" }))).toBe(
      "focusarx.site",
    );
  });

  it("takes the first entry of a forwarded chain and strips the port", () => {
    expect(requestHost(reqWith({ host: "FocusArx.Site:443" }))).toBe("focusarx.site");
    expect(
      requestHost(reqWith({ "x-forwarded-host": "a.example, b.example", host: "a.example" })),
    ).toBe("a.example");
  });

  it("returns null when no host headers exist", () => {
    expect(requestHost(reqWith({}))).toBeNull();
  });
});

describe("origin helpers", () => {
  it("toOrigin normalises to protocol//host", () => {
    expect(toOrigin("https://focusarx.site/some/path?q=1")).toBe("https://focusarx.site");
    expect(toOrigin("https://FOCUSARX.site")).toBe("https://focusarx.site");
  });

  it("toggleWww flips both directions", () => {
    expect(toggleWww("www.focusarx.site")).toBe("focusarx.site");
    expect(toggleWww("focusarx.site")).toBe("www.focusarx.site");
  });

  it("hostOfOrigin returns null for garbage", () => {
    expect(hostOfOrigin("https://focusarx.site")).toBe("focusarx.site");
    expect(hostOfOrigin("not a url")).toBeNull();
  });
});

describe("corsMiddleware — wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  function harness(opts: { origin?: string; host?: string; method?: string }) {
    const headers: Record<string, string> = {};
    if (opts.origin) headers.origin = opts.origin;
    if (opts.host) headers.host = opts.host;
    const req = { headers, method: opts.method ?? "POST" } as unknown as Request;
    const store = new Map<string, string>();
    const res = {
      setHeader: vi.fn((k: string, v: string) => void store.set(k, v)),
      getHeader: vi.fn((k: string) => store.get(k)),
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    return { req, res, next, store };
  }

  it("passes requests without an Origin header straight through", async () => {
    const { corsMiddleware } = await import("./cors");
    const { req, res, next } = harness({ host: "focusarx.site" });
    corsMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("reflects any origin in non-production (dev parity)", async () => {
    const { corsMiddleware } = await import("./cors");
    const { req, res, next, store } = harness({ origin: "http://localhost:5173", host: "localhost:8080" });
    corsMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(store.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(store.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("answers preflights in non-production without touching the routers", async () => {
    const { corsMiddleware } = await import("./cors");
    const { req, res, next } = harness({
      origin: "http://localhost:5173",
      host: "localhost:8080",
      method: "OPTIONS",
    });
    corsMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });

  it("keeps the 403 CORS_FORBIDDEN contract for real cross-origin attackers in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { corsMiddleware } = await import("./cors");
    const { req, res, next } = harness({ origin: "https://evil.example", host: "focusarx.site" });
    corsMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/^CORS/);
    // No allow headers leak to a rejected origin.
    expect(res.setHeader).not.toHaveBeenCalledWith("Access-Control-Allow-Origin", expect.anything());
  });
});
