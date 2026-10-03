import { expect, test } from "@playwright/test";
import { authenticate } from "./session";

/**
 * The timer is not a public page.
 *
 * It used to be: an Instagram or shared link landed straight on a runnable
 * timer with no account, and everything the timer is worth — history, streaks,
 * analytics, the companion — was left behind by whoever used it that way. So
 * /focus now sits behind `ProtectedRoute`, and these are the three properties
 * that make that gate honest rather than annoying:
 *
 *  1. a guest is sent to /login, not shown a broken timers;
 *  2. the destination survives the trip, including its query string, so a deep
 *     link like /focus?duration=50&task=Thermo still opens that exact session
 *     once the sign-in finishes;
 *  3. a signed-in visitor gets the timer, so the gate is not simply a wall.
 *
 * The logged-out assertions matter more than they look: a redirect that lost
 * the query would silently drop every shared deep link, and that is invisible
 * to any test that only checks "the timer renders when signed in".
 */

test.describe("the focus timer requires a session", () => {
  test("a guest is redirected to the sign-in page", async ({ page }) => {
    const response = await page.goto("/focus", { waitUntil: "domcontentloaded" });
    // The static preview server answers with the SPA shell; the redirect is
    // done by the router on mount, so the response itself is a 200.
    expect(response?.status()).toBeLessThan(400);

    await expect(page).toHaveURL(/\/login\?redirect=%2Ffocus$/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible({ timeout: 10_000 });
    // The timer itself must not be reachable underneath the redirect.
    await expect(page.getByText("25:00")).toHaveCount(0);
  });

  test("the redirect keeps the deep link, query string and all", async ({ page }) => {
    await page.goto("/focus?duration=50&task=Thermo", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(
      /\/login\?redirect=%2Ffocus%3Fduration%3D50%26task%3DThermo$/,
      { timeout: 10_000 },
    );
  });

  test("a signed-in visitor gets the timer, not the gate", async ({ page }) => {
    await authenticate(page);
    await page.goto("/focus?duration=50&task=Thermo", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/focus/, { timeout: 10_000 });
    // The deep link is honoured end to end: the clock is armed at 50:00 and the
    // task came through with it.
    await expect(page.getByText("50:00").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Thermo").first()).toBeVisible({ timeout: 10_000 });
  });
});
