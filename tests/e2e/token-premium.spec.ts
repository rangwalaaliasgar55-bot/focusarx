import { test, expect } from "@playwright/test";
import { authenticate } from "./session";

/** Browser UI contracts. Ledger atomicity is tested against PostgreSQL, not here. */
test.beforeEach(async ({ context }) => {
  // Pre-record a cookie-consent choice so the consent banner never shows and
  // cannot cover UI or add stray elements to the overflow/metadata assertions.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("focusarx-cookie-consent", "essential");
    } catch {
      /* private mode — the banner simply stays hidden for this view */
    }
  });
});

test.describe("Premium economy UI", () => {
  test("premium page requires sign-in for anonymous visitors", async ({ page }) => {
    await page.goto("/premium");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  });

  test("free users see cost, balance and earn actions without issuing AI requests", async ({ page, context }) => {
    // The auth provider skips the session probe entirely unless a token or the
    // `focusarx_session_hint` cookie is present (it avoids a guaranteed 401 on a
    // first, signed-out visit). Without this hint the mocked /api/auth/session
    // below is never read, the user reads as signed-out, and ProtectedRoute
    // bounces /ai-insights to /login before the gate can render.
    await context.addCookies([
      { name: "focusarx_session_hint", value: "1", url: "http://127.0.0.1:4173" },
    ]);
    // Fixtures only replace API responses; the real route, auth provider,
    // premium hook, gate and querying components still run in the browser.
    await page.route("**/api/auth/session", (route) => route.fulfill({ json: {
      user: { id: "premium-ui-test", email: "ui@example.invalid", name: "UI Test", role: "user", onboardingCompleted: true },
    } }));
    await page.route("**/api/premium/status", (route) => route.fulfill({ json: {
      isPremium: false, balance: 250, plans: [{ tokenCost: 10000 }], benefits: [],
    } }));
    const aiRequests: string[] = [];
    // Attach BEFORE navigation so a request on mount cannot evade the assertion.
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/ai/")) aiRequests.push(request.url());
    });
    await page.goto("/ai-insights");
    await expect(page.getByRole("heading", { name: "AI Coach is Premium" })).toBeVisible();
    await expect(page.getByText("Your Balance", { exact: true })).toBeVisible();
    await expect(page.getByText("Premium Cost", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Earn Tokens", exact: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(aiRequests).toEqual([]);
  });

  test("focus-timer public page has H1, title, canonical and Open Graph metadata", async ({ page }) => {
    await page.goto("/focus-timer");
    await expect(page.locator("h1").first()).toContainText(/focus timer/i);
    await expect(page).toHaveTitle(/focus timer/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/focus-timer$/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /focus timer/i);
  });

  test("private pages redirect anonymous visitors to sign-in", async ({ page }) => {
    for (const path of ["/pets", "/battle-pass", "/quests", "/profile", "/analytics"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
      await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    }
  });

  test("mobile public and protected entry points have no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/", "/premium"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    }
  });

  test("robots and the segmented sitemap index exist", async ({ page }) => {
    const robots = await page.request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    const robotsText = await robots.text();
    expect(robotsText).toContain("Disallow: /dashboard");
    expect(robotsText).toContain("Sitemap:");

    const sitemap = await page.request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(sitemap.headers()["content-type"]).toContain("xml");
    const xml = await sitemap.text();
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("<loc>https://www.focusarx.site/sitemap-core.xml</loc>");
    expect(xml).toContain("<loc>https://www.focusarx.site/sitemap-guides.xml</loc>");
    // Protected account pages do not belong in a public sitemap.
    expect(xml).not.toContain("<loc>https://www.focusarx.site/premium</loc>");
  });

  test("reduced-motion visitors reach the focus timer without page errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    // The timer requires a session now (see `auth-gate.spec.ts`). This test is
    // about the animating ring and its live region under `prefers-reduced-
    // motion`, so it signs in first rather than measuring the login redirect.
    await authenticate(page);
    await page.goto("/focus?duration=25");
    // Match the recovery budget used by timer-persistence.spec.ts: an absent
    // API can take several seconds to settle into the timer.
    await expect(page.getByText("25:00").first()).toBeVisible({ timeout: 10_000 });
    expect(errors).toEqual([]);
  });
});
