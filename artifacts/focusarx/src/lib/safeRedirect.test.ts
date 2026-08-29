import { describe, expect, it } from "vitest";
import { redirectFromSearch, safeRedirect } from "./safeRedirect";

/**
 * Regression tests for the open redirect in the login flow.
 *
 * `navigate(new URLSearchParams(location.search).get("redirect"))` sent the
 * freshly authenticated user to whatever host the URL named. A link like
 * `https://focusarx.app/login?redirect=https://evil.example` is a convincing
 * phishing vector precisely because the host is ours.
 */
describe("safeRedirect", () => {
  it("accepts ordinary in-app paths", () => {
    expect(safeRedirect("/dashboard")).toBe("/dashboard");
    expect(safeRedirect("/focus?session=deep_work")).toBe("/focus?session=deep_work");
    expect(safeRedirect("/city#district")).toBe("/city#district");
  });

  it("falls back when there is no redirect", () => {
    expect(safeRedirect(null)).toBe("/dashboard");
    expect(safeRedirect(undefined)).toBe("/dashboard");
    expect(safeRedirect("")).toBe("/dashboard");
    expect(safeRedirect(null, "/focus")).toBe("/focus");
  });

  // ── The attack cases ──────────────────────────────────────────────────────

  it("rejects absolute URLs to other origins", () => {
    expect(safeRedirect("https://evil.example")).toBe("/dashboard");
    expect(safeRedirect("http://evil.example/steal")).toBe("/dashboard");
    expect(safeRedirect("https://evil.example#/dashboard")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirect("//evil.example")).toBe("/dashboard");
    expect(safeRedirect("//evil.example/dashboard")).toBe("/dashboard");
  });

  it("rejects the backslash variant browsers normalise to a cross-origin URL", () => {
    expect(safeRedirect("/\\evil.example")).toBe("/dashboard");
  });

  it("rejects javascript and data URLs", () => {
    expect(safeRedirect("javascript:alert(1)")).toBe("/dashboard");
    expect(safeRedirect("data:text/html,<script>alert(1)</script>")).toBe("/dashboard");
  });

  it("rejects encoded payloads that decode to an off-origin URL", () => {
    expect(safeRedirect("%2F%2Fevil.example")).toBe("/dashboard");
    expect(safeRedirect("%68%74%74%70%73%3A%2F%2Fevil.example")).toBe("/dashboard");
  });

  it("rejects control characters used to smuggle a scheme", () => {
    expect(safeRedirect("/\u0000javascript:alert(1)")).toBe("/dashboard");
    expect(safeRedirect("/\u007Fevil.example")).toBe("/dashboard");
  });

  it("rejects malformed percent-encoding instead of guessing", () => {
    expect(safeRedirect("%E0%A4%A")).toBe("/dashboard");
    expect(safeRedirect("%")).toBe("/dashboard");
  });

  // ── Loop prevention ───────────────────────────────────────────────────────

  it("never redirects back to an auth page", () => {
    expect(safeRedirect("/login")).toBe("/dashboard");
    expect(safeRedirect("/login?redirect=/dashboard")).toBe("/dashboard");
    expect(safeRedirect("/signup")).toBe("/dashboard");
    expect(safeRedirect("/forgot-password")).toBe("/dashboard");
  });
});

describe("redirectFromSearch", () => {
  it("reads a safe redirect out of a query string", () => {
    expect(redirectFromSearch("?redirect=%2Ffocus")).toBe("/focus");
  });

  it("ignores a hostile redirect in a query string", () => {
    expect(redirectFromSearch("?redirect=https%3A%2F%2Fevil.example")).toBe("/dashboard");
  });

  it("falls back when the parameter is absent", () => {
    expect(redirectFromSearch("")).toBe("/dashboard");
    expect(redirectFromSearch("?foo=bar")).toBe("/dashboard");
  });
});
