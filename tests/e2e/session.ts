import type { Page } from "@playwright/test";

/**
 * A signed-in session, without a database.
 *
 * The preview server in these specs is the static build: there is no API, so
 * every `/api/*` call 404s unless a spec stubs it. The app reads sign-in state
 * from exactly two things — the `focusarx_session_hint` cookie (which decides
 * whether the auth provider probes at all) and `/api/auth/session` — so stubbing
 * those two is enough to render the authenticated product: the shell, the
 * bottom navigation, the real timer.
 *
 * `onboardingCompleted: true` matters on mobile: `MobileWelcomeGate` bounces a
 * fresh account to `/welcome`, and a spec that asserts the timer would then be
 * measuring the welcome funnel instead.
 *
 * This lived inside `responsive.spec.ts` until the timer started requiring a
 * session; three specs need it now, so it is shared rather than copied — a
 * second copy is exactly how one spec ends up authenticated and another quietly
 * measuring the login page.
 */

const ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173";

export const SESSION_USER = {
  id: "e2e-session-user",
  email: "e2e@example.invalid",
  name: "E2E User",
  role: "user",
  onboardingCompleted: true,
} as const;

/** Stub the session probe and seed the hint cookie the provider checks first. */
export async function authenticate(page: Page): Promise<void> {
  await page.context().addCookies([{ name: "focusarx_session_hint", value: "1", url: ORIGIN }]);
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { user: SESSION_USER } }));
}
