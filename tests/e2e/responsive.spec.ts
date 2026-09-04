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
 * Only public routes are covered. Authenticated pages would need a real session
 * fixture, and a logged-out redirect would make every failure ambiguous.
 */

const PUBLIC_ROUTES = [
  "/",
  "/focus",
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

async function gotoRoute(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  // Some routes are prerendered at build time; a 404 on those is a real bug
  // rather than a test artefact, so fail loudly instead of silently passing.
  expect(response?.status(), `${route} should load`).toBeLessThan(400);
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

test.describe("mobile layout", () => {
  // Skip on desktop: this is specifically the phone contract.
  // Keyed off viewport width rather than project name so the contract still
  // holds if someone runs these with an ad-hoc --viewport override.
  test.skip(({ viewport }) => (viewport?.width ?? 1280) > 500, "mobile-only contract");

  test("renders the bottom navigation", async ({ page }) => {
    await gotoRoute(page, "/login");
    await expect(page.locator(BOTTOM_NAV)).toBeVisible();
  });

  test("bottom nav targets meet the 44px minimum", async ({ page }) => {
    await gotoRoute(page, "/login");

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
    await gotoRoute(page, "/login");

    const controls = page.locator("button:visible, a[href]:visible");
    const count = await controls.count();

    const tooSmall: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const element = controls.nth(index);
      const box = await element.boundingBox();
      if (!box || box.height === 0 || box.width === 0) continue;

      // Inline text links inside a paragraph are exempt: WCAG 2.5.8 explicitly
      // excludes them, and forcing 44px on them would wreck the typography.
      const isInlineLink = await element.evaluate((node) => {
        const display = window.getComputedStyle(node).display;
        return node.tagName === "A" && display === "inline";
      });
      if (isInlineLink) continue;

      if (box.height < MIN_TOUCH_TARGET || box.width < MIN_TOUCH_TARGET) {
        const label = (await element.textContent())?.trim().slice(0, 40) ?? element.toString();
        tooSmall.push(`${label} (${Math.round(box.width)}x${Math.round(box.height)})`);
      }
    }

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
});
