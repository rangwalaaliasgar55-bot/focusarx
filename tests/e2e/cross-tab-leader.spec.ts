import { expect, test } from "@playwright/test";

/**
 * Single-timer contract across tabs (P0.3 e2e).
 *
 * Two pages in one browser context share `navigator.locks`, the
 * `BroadcastChannel` mirror, and localStorage — exactly like two tabs.
 * The second tab must stand down (no duplicate clock) and mirror the
 * leader's live session instead.
 *
 * Component-agnostic assertions only: desktop renders <Timer/>, mobile
 * renders <FocusTimerMobileFirst/>. Both set document.title while running
 * ("MM:SS · FocusArx") and both render the follower chip.
 */

function isMobileWidth(width: number | undefined) {
  return (width ?? 1280) < 768;
}

test.describe("cross-tab single timer", () => {
  test("second tab stands down and mirrors the leader", async ({ page, context }) => {
    const second = await context.newPage();
    try {
      // Leader tab starts a session.
      await page.goto("/focus", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("25:00").first()).toBeVisible({ timeout: 10_000 });
      await page.getByRole("button", { name: "Dismiss cookie notice" }).click();

      const width = page.viewportSize()?.width;
      if (isMobileWidth(width)) {
        await page.getByRole("button", { name: "Start focus session" }).click();
      } else {
        await page.keyboard.press("Space");
      }
      await expect
        .poll(async () => page.title(), { timeout: 10_000 })
        .toMatch(/\d{1,3}:\d{2} · FocusArx/);

      // Follower tab opens the same session. It may briefly restore the
      // leader's snapshot as running — let the election settle (~600 ms),
      // then force the race explicitly.
      await second.goto("/focus", { waitUntil: "domcontentloaded" });
      await second.getByRole("button", { name: "Dismiss cookie notice" }).click();
      await expect
        .poll(async () => second.title(), { timeout: 10_000 })
        .not.toMatch(/\d{1,3}:\d{2} · FocusArx/);
      await second.getByRole("button", { name: /^(Start focus session|Resume)$/ }).click();

      // Follower stands down and shows the leader's live clock.
      await expect(second.getByText(/Running in another tab/)).toBeVisible({ timeout: 15_000 });

      // Exactly one running clock: the leader's.
      await expect
        .poll(async () => page.title(), { timeout: 10_000 })
        .toMatch(/\d{1,3}:\d{2} · FocusArx/);
      await expect
        .poll(async () => second.title())
        .not.toMatch(/\d{1,3}:\d{2} · FocusArx/);
    } finally {
      await second.close();
    }
  });
});
