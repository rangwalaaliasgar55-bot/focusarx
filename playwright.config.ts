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
  // Timing-sensitive specs (reload resume, offline start) flake on loaded
  // runners; one retry distinguishes product bugs from infrastructure noise.
  retries: process.env.CI ? 2 : 0,
  // `list` keeps the console readable; the HTML report (uploaded as a CI
  // artifact) is the only way to see which axe rule / which element failed on a
  // headless runner, because GitHub's raw job logs are not always retrievable.
  // `github` emits `::error::` workflow commands that surface as check-run
  // annotations — the one failure channel retrievable via the API when both the
  // raw job log and the HTML-report artifact are served from blob storage that
  // is not always reachable. It carries the spec's verbose per-violation message
  // (rule + offending selector). `html` is still uploaded for humans.
  reporter: process.env.CI
    ? [["list"], ["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    // The GitHub runners were crashing chrome-headless-shell with a SIGSEGV
    // inside the GPU process ("InitializeSandbox() called with multiple threads
    // in process gpu-process" → signal 11), which surfaced as spurious
    // "Target page/context/browser has been closed" and 30 s test timeouts on
    // whichever spec happened to be running. Disabling the GPU process removes
    // that crash path entirely; on a headless runner there is nothing to
    // accelerate anyway.
    launchOptions: { args: ["--disable-gpu"] },
  },
  webServer: {
    command: "corepack pnpm --filter @workspace/focusarx run serve -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "desktop-reduced-motion",
      use: { ...devices["Desktop Chrome"], reducedMotion: "reduce" },
    },
    {
      name: "landscape-phone",
      use: {
        viewport: { width: 850, height: 380 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: devices["Pixel 5"].userAgent,
      },
    },
    {
      name: "tablet",
      use: {
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: devices["iPad (gen 7)"].userAgent,
      },
    },
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
