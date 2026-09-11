import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { canonicalPathFor, canonicalUrlRedirect, isSafeRelativePath } from "./canonicalUrl";

/**
 * Case canonicalisation — the server half of the soft-404 fix.
 *
 * `/Blog/` used to be answered by vercel.json's catch-all with **200 and the
 * homepage prerender**, so Google could index `/blog`, `/Blog` and `/BLOG` as
 * three pages with one canonical. These tests pin the 301, and pin the things
 * that must NOT be redirected (API paths, already-lowercase paths, unsafe
 * values that would turn the redirect into an open one).
 */

function harness(req: Partial<Request>) {
  const res = {
    redirect: vi.fn(),
    setHeader: vi.fn(),
  };
  const next = vi.fn();
  canonicalUrlRedirect(req as Request, res as unknown as Response, next as NextFunction);
  return { res, next };
}

describe("canonicalPathFor", () => {
  it("lowercases a page path that has capitals", () => {
    expect(canonicalPathFor("/Blog")).toBe("/blog");
    expect(canonicalPathFor("/Blog/")).toBe("/blog/");
    expect(canonicalPathFor("/POMODORO-TIMER")).toBe("/pomodoro-timer");
    expect(canonicalPathFor("/exam/JEE-Main")).toBe("/exam/jee-main");
  });

  it("returns null when the path is already canonical", () => {
    expect(canonicalPathFor("/blog")).toBeNull();
    expect(canonicalPathFor("/")).toBeNull();
    expect(canonicalPathFor("/exam/jee-main")).toBeNull();
  });

  it("never rewrites API paths", () => {
    expect(canonicalPathFor("/api/Study-Rooms")).toBeNull();
    expect(canonicalPathFor("/api")).toBeNull();
  });

  it("rejects values that are not safe same-origin paths", () => {
    // An attacker-controlled capture group must not become an open redirect.
    expect(canonicalPathFor("//evil.com/Blog")).toBeNull();
    expect(canonicalPathFor("https://evil.com")).toBeNull();
    expect(canonicalPathFor("/Blog\\..")).toBeNull();
    expect(canonicalPathFor("/Blog\r\nSet-Cookie: x=1")).toBeNull();
    expect(canonicalPathFor("")).toBeNull();
  });
});

describe("isSafeRelativePath", () => {
  it("accepts ordinary relative paths", () => {
    expect(isSafeRelativePath("/blog")).toBe(true);
    expect(isSafeRelativePath("/exam/jee-main")).toBe(true);
    expect(isSafeRelativePath("/a".repeat(100))).toBe(true);
  });

  it("rejects scheme-relative, absolute and oversized values", () => {
    expect(isSafeRelativePath("//evil.com")).toBe(false);
    expect(isSafeRelativePath("blog")).toBe(false);
    expect(isSafeRelativePath(`/${"a".repeat(3000)}`)).toBe(false);
    expect(isSafeRelativePath("/\u0000")).toBe(false);
  });
});

describe("canonicalUrlRedirect middleware", () => {
  it("301s an uppercase page path, using the vercel.json hint when present", () => {
    const { res, next } = harness({
      method: "GET",
      path: "/api/index.mjs",
      url: "/api/index.mjs?canonicalize=/Blog/",
      query: { canonicalize: "/Blog/" },
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(301, "/blog/");
  });

  it("301s from the original path on a standalone deployment", () => {
    const { res } = harness({ method: "GET", path: "/Exam/JEE-Main", url: "/Exam/JEE-Main", query: {} });
    expect(res.redirect).toHaveBeenCalledWith(301, "/exam/jee-main");
  });

  it("preserves real query parameters and drops the routing hint", () => {
    const { res } = harness({
      method: "GET",
      path: "/Blog",
      url: "/Blog?canonicalize=%2FBlog&ref=aliasgar&utm_source=whatsapp",
      query: { canonicalize: "/Blog", ref: "aliasgar", utm_source: "whatsapp" },
    });
    const location = res.redirect.mock.calls[0]?.[1] as string;
    expect(location.startsWith("/blog?")).toBe(true);
    expect(location).toContain("ref=aliasgar");
    expect(location).toContain("utm_source=whatsapp");
    expect(location).not.toContain("canonicalize");
  });

  it("passes through when the path is already canonical", () => {
    const { res, next } = harness({ method: "GET", path: "/blog", url: "/blog", query: {} });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("never redirects a mutation — a 301 turns POST into GET", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const { res, next } = harness({ method, path: "/Blog", url: "/Blog", query: {} });
      expect(next, method).toHaveBeenCalledTimes(1);
      expect(res.redirect, method).not.toHaveBeenCalled();
    }
  });

  it("never redirects an API path even when it has capitals", () => {
    const { res, next } = harness({ method: "GET", path: "/api/Study-Rooms", url: "/api/Study-Rooms", query: {} });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("ignores an unsafe hint and falls back to the request path", () => {
    const { res } = harness({
      method: "GET",
      path: "/Blog",
      url: "/Blog?canonicalize=//evil.com",
      query: { canonicalize: "//evil.com" },
    });
    expect(res.redirect).toHaveBeenCalledWith(301, "/blog");
  });

  it("caches the redirect briefly and never permanently on the client", () => {
    const { res } = harness({ method: "GET", path: "/Blog", url: "/Blog", query: {} });
    const headers = new Map(res.setHeader.mock.calls.map(([k, v]) => [String(k), String(v)]));
    expect(headers.get("Cache-Control")).toContain("max-age=3600");
  });
});
