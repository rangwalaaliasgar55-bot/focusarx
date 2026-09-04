import { expect, test } from "@playwright/test";

/**
 * Timer survival contract (Phase 5.5 e2e).
 *
 * The two retention killers: (1) timer dies when the tab hides / the page
 * reloads, (2) streaks reset wrongly. These specs cover the timer half for
 * guests (the Instagram funnel) against the static preview server:
 *
 *  - deep links arm the idle timer (?duration= + ?task=)
 *  - a started guest session survives a full reload with wall-clock remaining
 *  - the timer starts and ticks while offline
 *
 * Component-agnostic assertions only: desktop renders <Timer/>, mobile
 * renders <FocusTimerMobileFirst/>. Both set document.title while running
 * ("MM:SS · FocusArx") and both honour the deep-link event.
 */

function isMobileWidth(width: number | undefined) {
  return (width ?? 1280) < 768;
}

test.describe("focus deep links", () => {
  test("/focus?duration=25&task=E2E arms the idle timer", async ({ page }) => {
    const response = await page.goto("/focus?duration=25&task=E2E", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByText("25:00").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("E2E").first()).toBeVisible({ timeout: 10_000 });
  });

  test("/go/ig lands on an armed focus session", async ({ page }) => {
    await page.goto("/go/ig", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("25:00").first()).toBeVisible({ timeout: 10_000 });
  });

  test("garbage durations never produce NaN", async ({ page }) => {
    await page.goto("/focus?duration=banana", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    expect(body).not.toMatch(/NaN/);
  });
});

test.describe("guest session survival", () => {
  test("a started session resumes after reload with remaining time", async ({ page }) => {
    await page.goto("/focus", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("25:00").first()).toBeVisible({ timeout: 10_000 });

    const width = page.viewportSize()?.width;
    if (isMobileWidth(width)) {
      await page.getByRole("button", { name: "Start focus session" }).click();
    } else {
      await page.keyboard.press("Space");
    }

    // Running state is component-agnostic: document.title becomes "MM:SS · FocusArx".
    await expect
      .poll(async () => page.title(), { timeout: 10_000 })
      .toMatch(/\d{1,3}:\d{2} · FocusArx/);

    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: "domcontentloaded" });

    // Guest snapshot restores: still running, still ~25:00 (not reset to idle).
    await expect
      .poll(async () => page.title(), { timeout: 10_000 })
      .toMatch(/2[34]:\d{2} · FocusArx/);
  });

  test("the timer starts while offline", async ({ page, context }) => {
    await page.goto("/focus", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("25:00").first()).toBeVisible({ timeout: 10_000 });
    await context.setOffline(true);
    try {
      const width = page.viewportSize()?.width;
      if (isMobileWidth(width)) {
        await page.getByRole("button", { name: "Start focus session" }).click();
      } else {
        await page.keyboard.press("Space");
      }
      await expect
        .poll(async () => page.title(), { timeout: 10_000 })
        .toMatch(/\d{1,3}:\d{2} · FocusArx/);
    } finally {
      await context.setOffline(false);
    }
  });
});
