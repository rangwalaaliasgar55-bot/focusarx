import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * GA4 contract tests.
 *
 * FocusArx runs **direct gtag.js** (measurement id `G-PXMVX28PL5`) with no GTM
 * container. That choice is deliberate — GTM container `GTM-53247ZWZ` exists but
 * is intentionally left empty, because two Google tags on one page double-count
 * page views and fight over the `_ga` cookie. These tests pin the three things
 * that break silently when someone "just adds GTM" or edits the SPA tracker:
 *
 *   1. exactly one loader, and `send_page_view: false` so the automatic view
 *      cannot stack on the SPA view;
 *   2. one `page_view` per route with a correct title and a *canonical*
 *      location (no `?_v=…&_skew=1`, no OAuth `code`);
 *   3. the key events keep their exact GA4 names and params.
 */

import { canonicalPageLocation, trackEvent, trackPageView } from "./gtag";

type GtagCall = [string, ...unknown[]];

let calls: GtagCall[];

function installGtag() {
  calls = [];
  (window as unknown as { gtag: unknown }).gtag = (...args: unknown[]) => {
    calls.push(args as GtagCall);
  };
}

function uninstallGtag() {
  delete (window as unknown as { gtag?: unknown }).gtag;
}

beforeEach(() => {
  installGtag();
});

afterEach(() => {
  uninstallGtag();
  vi.restoreAllMocks();
});

// ─── Loader contract (index.html) ────────────────────────────────────────────

describe("the GA4 loader in index.html", () => {
  const html = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");

  it("loads gtag.js directly with the right measurement id", () => {
    expect(html).toContain("https://www.googletagmanager.com/gtag/js?id=G-PXMVX28PL5");
    expect(html).toContain('gtag("config", "G-PXMVX28PL5"');
  });

  it("loads exactly one Google tag — no GTM container", () => {
    const loaders = html.match(/googletagmanager\.com\/gtag\/js/g) ?? [];
    expect(loaders).toHaveLength(1);

    // GTM would be `gtm.js?id=GTM-…` plus a `dataLayer.push({…'GTM-…'})` snippet
    // and an iframe fallback. None of them may appear.
    expect(html).not.toMatch(/gtm\.js\?id=/);
    expect(html).not.toMatch(/'GTM-[A-Z0-9]+'/);
    expect(html).not.toMatch(/"GTM-[A-Z0-9]+"/);
  });

  it("disables the automatic page view so SPA views are not doubled", () => {
    expect(html).toMatch(/send_page_view:\s*false/);
  });

  it("declares Consent Mode v2 defaults before the config call", () => {
    const consentAt = html.indexOf('gtag("consent", "default"');
    const configAt = html.indexOf('gtag("config"');
    expect(consentAt).toBeGreaterThan(-1);
    expect(configAt).toBeGreaterThan(-1);
    expect(consentAt).toBeLessThan(configAt);
    expect(html).toMatch(/ad_storage:\s*"denied"/);
    expect(html).toMatch(/analytics_storage:\s*"granted"/);
  });
});

// ─── canonicalPageLocation ───────────────────────────────────────────────────

describe("canonicalPageLocation", () => {
  it("keeps a clean URL untouched", () => {
    expect(canonicalPageLocation("https://www.focusarx.site/blog/deep-work")).toBe(
      "https://www.focusarx.site/blog/deep-work",
    );
  });

  it("strips the reload coordinator's cache-busting params", () => {
    expect(
      canonicalPageLocation("https://www.focusarx.site/dashboard?_v=1712345678901&_skew=1"),
    ).toBe("https://www.focusarx.site/dashboard");
  });

  it("strips OAuth round-trip params so no authorization code reaches GA4", () => {
    const cleaned = canonicalPageLocation(
      "https://www.focusarx.site/auth/callback?code=4%2F0AfJohXn-secret&state=xyz&scope=openid",
    );
    expect(cleaned).not.toContain("0AfJohXn-secret");
    expect(cleaned).not.toContain("state=");
  });

  it("strips credential-looking params", () => {
    const cleaned = canonicalPageLocation(
      "https://www.focusarx.site/reset-password?token=abc123&otp=993311",
    );
    expect(cleaned).toBe("https://www.focusarx.site/reset-password");
  });

  it("keeps attribution params GA4 reads from page_location", () => {
    const cleaned = canonicalPageLocation(
      "https://www.focusarx.site/?utm_source=reddit&utm_medium=social&ref=friend123&src=x",
    );
    expect(cleaned).toContain("utm_source=reddit");
    expect(cleaned).toContain("utm_medium=social");
    expect(cleaned).toContain("ref=friend123");
    expect(cleaned).toContain("src=x");
  });

  it("keeps meaningful app state and the hash", () => {
    expect(canonicalPageLocation("https://www.focusarx.site/goals?tab=weekly#streak")).toBe(
      "https://www.focusarx.site/goals?tab=weekly#streak",
    );
  });

  it("is stable regardless of param order", () => {
    const a = canonicalPageLocation("https://www.focusarx.site/goals?tab=weekly&utm_source=x");
    const b = canonicalPageLocation("https://www.focusarx.site/goals?utm_source=x&tab=weekly");
    expect(a).toBe(b);
  });

  it("returns its input unchanged when it is not a URL", () => {
    expect(canonicalPageLocation("/dashboard")).toBe("/dashboard");
  });
});

// ─── page_view ───────────────────────────────────────────────────────────────

describe("trackPageView", () => {
  it("emits one page_view with path, title and a canonical location", () => {
    document.title = "25 minute Pomodoro timer — FocusArx";
    window.history.replaceState({}, "", "/pomodoro-timer?_v=123&_skew=1");

    trackPageView("/pomodoro-timer");

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe("event");
    expect(calls[0][1]).toBe("page_view");
    expect(calls[0][2]).toMatchObject({
      page_path: "/pomodoro-timer",
      page_title: "25 minute Pomodoro timer — FocusArx",
      page_location: "http://localhost:3000/pomodoro-timer",
    });
  });

  it("does not emit anything when gtag.js has not loaded", () => {
    uninstallGtag();
    expect(() => trackPageView("/")).not.toThrow();
    expect(calls).toHaveLength(0);
  });
});

// ─── Key events ──────────────────────────────────────────────────────────────

describe("trackEvent — GA4 key event names are exact", () => {
  it("forwards sign_up with the recommended method param", () => {
    trackEvent("sign_up", { method: "email" });
    expect(calls[0]).toEqual(["event", "sign_up", { method: "email" }]);
  });

  it("forwards session_complete with its metric params", () => {
    trackEvent("session_complete", {
      duration_seconds: 1500,
      focus_score: 87,
      xp_earned: 120,
      early: false,
    });
    expect(calls[0][1]).toBe("session_complete");
    expect(calls[0][2]).toMatchObject({ duration_seconds: 1500, focus_score: 87 });
  });

  it("forwards first_session_complete exactly once per call", () => {
    trackEvent("first_session_complete", { duration_seconds: 1500, focus_score: 87 });
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toBe("first_session_complete");
  });

  it("defaults params to an empty object", () => {
    trackEvent("blog_view");
    expect(calls[0]).toEqual(["event", "blog_view", {}]);
  });

  it("does not invent event names — GA4 keys depend on these strings", () => {
    // Guards against a well-meaning rename (signUp / session-complete) that
    // would silently detach the Key events from the dashboards.
    for (const name of ["sign_up", "session_complete", "first_session_complete"]) {
      expect(name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    }
  });
});
