import { expect, test, type Page } from "@playwright/test";

/**
 * Responsive contract for the mobile-first build.
 *
 * These assertions exist because the failure modes they catch are the ones that
 * are invisible on a desktop monitor and fatal on a phone:
 *
 *  - horizontal scrolling, usually one wide table or a fixed-width card
 *  - touch targets under 44px, which are unhittable for a thumb
 *  - content hidden behind the fixed bottom nav or the iOS home indicator
 *
 * Public routes are swept below; the signed-in timer is swept in the second
 * describe, because a logged-out visit to it now lands on /login and a failure
 * measured there would be ambiguous for exactly the reason this note used to
 * give.
 */

const PUBLIC_ROUTES = [
  "/",
  // "/focus" left this list when the timer started requiring a session: as a
  // guest it now redirects to /login, and an overflow measured on the login
  // page would say nothing about the timer. It is covered below instead, signed
  // in, and its gate is asserted in `auth-gate.spec.ts`.
  "/go/ig",
  "/blog",
  "/changelog",
  "/pomodoro-timer",
  "/study-timer",
  "/exam",
  "/login",
  "/signup",
  "/pricing",
  "/about",
  "/support",
  "/privacy",
  "/terms",
  "/guides",
];

/** Apple's HIG / WCAG 2.5.8 minimum for a comfortably hittable control. */
const MIN_TOUCH_TARGET = 44;

/** Matches the aria-label rendered by `components/mobile/MobileBottomNav`. */
const BOTTOM_NAV = "nav[aria-label='Mobile navigation']";

test.beforeEach(async ({ context }) => {
  // Pre-record a cookie-consent choice so the consent banner never shows. It is
  // fixed to the bottom of the viewport, so on a phone it would otherwise
  // confound the very things this suite measures — horizontal overflow, tap
  // targets, and content hidden behind the bottom nav.
  await context.addInitScript(() => {
    try {
      localStorage.setItem("focusarx-cookie-consent", "essential");
    } catch {
      /* private mode — the banner simply stays hidden for this view */
    }
  });
});

/**
 * Sign the page in for the tests that need authenticated app chrome.
 *
 * The mobile bottom navigation lives in AppShell, which App.tsx mounts *only*
 * for `status === "authenticated"` (guests get PublicDialogBoundary with no
 * shell). The auth provider also skips its session probe unless a token or the
 * `focusarx_session_hint` cookie is present, so we seed that hint and stub the
 * session endpoint — no database fixture required. `onboardingCompleted: true`
 * keeps MobileWelcomeGate from bouncing a mobile visitor to /welcome.
 */
async function authenticate(page: Page) {
  await page.context().addCookies([
    { name: "focusarx_session_hint", value: "1", url: "http://127.0.0.1:4173" },
  ]);
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "responsive-nav-test",
          email: "nav@example.invalid",
          name: "Nav Test",
          role: "user",
          onboardingCompleted: true,
        },
      },
    }),
  );
}

async function gotoRoute(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  // Some routes are prerendered at build time; a 404 on those is a real bug
  // rather than a test artefact, so fail loudly instead of silently passing.
  expect(response?.status(), `${route} should load`).toBeLessThan(400);
  // Prerendered pages ship a static SEO/i18n shell inside #root (`.fa-seo`,
  // including the compact `.fa-edition` locale-switcher pills) purely for
  // crawlers. React clears and replaces #root on mount, so real users never see
  // it. Wait for that swap before measuring — otherwise the touch-target audit
  // reads the crawler-only 17px pills instead of the hydrated app. On routes
  // that were never prerendered `.fa-seo` is absent and this resolves at once.
  await page.waitForFunction(() => !document.querySelector(".fa-seo"), null, {
    timeout: 10_000,
  });
  // Let fonts settle — a late font swap can change measured widths.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

test.describe("no horizontal overflow", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} fits the viewport width`, async ({ page }) => {
      await gotoRoute(page, route);

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        scrollWidth,
        `${route} scrolls horizontally: content is ${scrollWidth}px in a ${clientWidth}px viewport`,
      ).toBeLessThanOrEqual(clientWidth + 1);
    });
  }
});

test.describe("no horizontal overflow, signed in", () => {
  // The timer moved behind the session, so the guest sweep above can no longer
  // measure it. Same contract, one authenticated route.
  test("/focus fits the viewport width", async ({ page }) => {
    await authenticate(page);
    await gotoRoute(page, "/focus");

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(
      scrollWidth,
      `/focus scrolls horizontally: content is ${scrollWidth}px in a ${clientWidth}px viewport`,
    ).toBeLessThanOrEqual(clientWidth + 1);
  });
});

test.describe("mobile layout", () => {
  // Skip on desktop: this is specifically the phone contract.
  // Keyed off viewport width rather than project name so the contract still
  // holds if someone runs these with an ad-hoc --viewport override.
  test.skip(({ viewport }) => (viewport?.width ?? 1280) > 500, "mobile-only contract");

  test("renders the bottom navigation", async ({ page }) => {
    // The mobile bottom nav is authenticated-only chrome (AppShell), so sign in
    // first. /focus sits idle here (no session started), so the nav is not in
    // its auto-hidden focus-mode state and stays visible.
    await authenticate(page);
    await gotoRoute(page, "/focus");
    await expect(page.locator(BOTTOM_NAV)).toBeVisible();
  });

  test("bottom nav targets meet the 44px minimum", async ({ page }) => {
    await authenticate(page);
    await gotoRoute(page, "/focus");
    await expect(page.locator(BOTTOM_NAV)).toBeVisible();

    const targets = page.locator(`${BOTTOM_NAV} a, ${BOTTOM_NAV} button`);
    const count = await targets.count();
    expect(count, "bottom nav should expose several destinations").toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const box = await targets.nth(index).boundingBox();
      if (!box) continue; // hidden at this breakpoint
      expect(box.height, `bottom nav item ${index} is too short`).toBeGreaterThanOrEqual(
        MIN_TOUCH_TARGET,
      );
      expect(box.width, `bottom nav item ${index} is too narrow`).toBeGreaterThanOrEqual(
        MIN_TOUCH_TARGET,
      );
    }
  });

  test("primary controls meet the 44px minimum", async ({ page }) => {
    // Reduce motion before navigating: the login page's framer-motion mount
    // animation otherwise keeps both the geometry and the set of `:visible`
    // controls in flux, which made per-index locator reads (boundingBox and even
    // evaluate on locator.nth()) wait on a moving DOM until the 30s timeout.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoRoute(page, "/login");

    // Measure every control in a single browser-side pass rather than looping
    // Playwright locators — one snapshot, no re-querying a live/animating tree.
    //
    // WCAG 2.5.8 exempts plain text links (the target is the text itself, and
    // forcing 44px would wreck the typography). We can't key that off
    // `display: inline`: a text link that sits in a flex row (e.g. "Forgot
    // password?") is blockified to `display: block`. Instead every <button> is a
    // real control that must meet 44px, and an <a> is exempt only when it is a
    // bare text link — no button chrome (no background fill and no border).
    const tooSmall = await page
      .locator("button:visible, a[href]:visible")
      .evaluateAll((nodes, min) =>
        nodes.flatMap((node) => {
          const r = node.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return [];
          const style = window.getComputedStyle(node);
          const bg = style.backgroundColor;
          const hasFill = bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)";
          const hasBorder =
            style.borderStyle !== "none" && Number.parseFloat(style.borderTopWidth) > 0;
          const isTextLink = node.tagName === "A" && !hasFill && !hasBorder;
          if (isTextLink) return [];
          if (r.height < min || r.width < min) {
            const label = (node.textContent ?? "").trim().slice(0, 40);
            return [`${label} (${Math.round(r.width)}x${Math.round(r.height)})`];
          }
          return [];
        }),
        MIN_TOUCH_TARGET,
      );

    expect(tooSmall, `controls under ${MIN_TOUCH_TARGET}px:\n${tooSmall.join("\n")}`).toEqual([]);
  });

  test("inputs use a 16px font so iOS does not zoom on focus", async ({ page }) => {
    await gotoRoute(page, "/login");

    const inputs = page.locator("input:visible, textarea:visible, select:visible");
    const count = await inputs.count();

    for (let index = 0; index < count; index += 1) {
      const fontSize = await inputs
        .nth(index)
        .evaluate((node) => Number.parseFloat(window.getComputedStyle(node).fontSize));
      expect(
        fontSize,
        `input ${index} is ${fontSize}px — iOS Safari zooms the viewport on focus below 16px`,
      ).toBeGreaterThanOrEqual(16);
    }
  });

  test("marks Timer as the only active tab on the public focus route", async ({ page }) => {
    // The bottom nav is authenticated-only chrome (see authenticate()).
    await authenticate(page);
    await gotoRoute(page, "/focus");
    const nav = page.locator(BOTTOM_NAV);
    const timer = nav.getByRole("link", { name: "Timer", exact: true });
    await expect(timer).toHaveAttribute("href", "/");
    await expect(timer).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test("focus mode hides navigation from assistive technology and prevents focus", async ({ page }) => {
    // The bottom nav is authenticated-only chrome (see authenticate()).
    await authenticate(page);
    await gotoRoute(page, "/focus");
    const nav = page.locator(BOTTOM_NAV);
    await expect(nav).toBeVisible();
    const controls = nav.locator("a, button");
    expect(await controls.count()).toBeGreaterThan(0);

    // Exercise the shared event contract used by both timer implementations.
    await page.evaluate(() => window.dispatchEvent(new Event("fx:focus-start")));
    await expect(nav).toHaveAttribute("aria-hidden", "true");
    await expect(nav).toHaveAttribute("inert", "");
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toHaveCount(0);
    for (let index = 0; index < await controls.count(); index += 1) {
      await controls.nth(index).evaluate((node) => (node as HTMLElement).focus());
      await expect(controls.nth(index)).not.toBeFocused();
    }

    await page.evaluate(() => window.dispatchEvent(new Event("fx:focus-stop")));
    await expect(nav).not.toHaveAttribute("inert", "");
    await expect(nav).not.toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    const timer = nav.getByRole("link", { name: "Timer", exact: true });
    await timer.focus();
    await expect(timer).toBeFocused();
  });

  test("navigation transitions respect reduced motion", async ({ page }) => {
    // The bottom nav is authenticated-only chrome (see authenticate()).
    await authenticate(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoRoute(page, "/focus");
    const nav = page.locator(BOTTOM_NAV);
    await expect(nav).toBeVisible();
    const durations = await nav.evaluate((node) =>
      [node, ...node.querySelectorAll(".mobile-tab, .mobile-tab-icon")].flatMap((element) =>
        getComputedStyle(element).transitionDuration.split(",").map((value) => Number.parseFloat(value)),
      ),
    );
    for (const duration of durations) {
      expect(duration, "navigation should not animate with reduced motion").toBeLessThanOrEqual(0.001);
    }
  });
});

test.describe("the thumb-sized minimum, beyond the bottom bar", () => {
  // The audit above measures the login page, and the bottom-nav test measures
  // the bar. Everything else a phone actually touches in a session was outside
  // both: the tasks drawer's rows, the sheet's close button, the timer's own
  // controls. Two of those were 32px and 36px until they were fixed, which is
  // exactly the size a one-handed thumb misses.
  test.skip(({ viewport }) => (viewport?.width ?? 1280) > 500, "mobile-only contract");

  test("every control on the timer and in its drawer meets 44px", async ({ page }) => {
    // Reduced motion first: the page's mount animations otherwise keep the
    // geometry (and the set of `:visible` controls) in flux while measuring.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await authenticate(page);
    await gotoRoute(page, "/focus");

    const measure = () =>
      page.locator("button:visible, [role='radio']:visible").evaluateAll((nodes, min) =>
        nodes
          .filter((node) => !node.closest("nav[aria-label='Mobile navigation']"))
          .flatMap((node) => {
            const r = node.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return [];
            // 44px is a target *size*, not a requirement to be square: a wide
            // pill only has to be tall enough to hit.
            if (r.height >= min) return [];
            return [`${(node.textContent ?? node.getAttribute("aria-label") ?? "").trim().slice(0, 32)} (${Math.round(r.width)}x${Math.round(r.height)})`];
          }),
        MIN_TOUCH_TARGET,
      );

    const small = await measure();
    expect(small, `controls under ${MIN_TOUCH_TARGET}px:\n${small.join("\n")}`).toEqual([]);

    // …and inside the tasks drawer, which is where the 32px rows lived.
    await page.getByRole("button", { name: "Open tasks & stats" }).click();
    await expect(page.locator("#mobile-panel-sheet")).toBeVisible();

    const inDrawer = await page
      .locator("button:visible")
      .evaluateAll((nodes, min) =>
        nodes
          .filter((node) => node.closest("#mobile-panel-sheet") !== null)
          .flatMap((node) => {
            const r = node.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return [];
            if (r.height >= min) return [];
            return [`${(node.textContent ?? node.getAttribute("aria-label") ?? "").trim().slice(0, 32)} (${Math.round(r.width)}x${Math.round(r.height)})`];
          }),
        MIN_TOUCH_TARGET,
      );
    expect(inDrawer, `drawer controls under ${MIN_TOUCH_TARGET}px:\n${inDrawer.join("\n")}`).toEqual([]);
  });
});
