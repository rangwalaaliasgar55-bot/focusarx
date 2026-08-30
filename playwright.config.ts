import { defineConfig, devices } from "@playwright/test";

/**
 * Viewport widths the product has to hold up at. 320px is the narrowest real
 * viewport still in circulation (iPhone SE 1st gen, small Android); 414px is
 * the large-phone ceiling. Each width is its own project so a failure names the
 * device instead of just "mobile".
 */
const MOBILE_WIDTHS = [
  { name: "w320", width: 320, height: 640 },
  { name: "w360", width: 360, height: 740 },
  { name: "w375", width: 375, height: 667 },
  { name: "w390", width: 390, height: 844 },
  { name: "w414", width: 414, height: 896 },
];

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "corepack pnpm --filter @workspace/focusarx run serve -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    ...MOBILE_WIDTHS.map(({ name, width, height }) => ({
      name,
      use: {
        viewport: { width, height },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: devices["Pixel 5"].userAgent,
      },
    })),
  ],
});
