import { defineConfig } from "@playwright/test";

const defaultExport = defineConfig({
  testDir: "tests/visual",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  timeout: 30000,
  // Never silently create missing baselines during a comparison or CI run.
  updateSnapshots: "none",
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}",
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  use: {
    baseURL: "http://127.0.0.1:6007",
    viewport: { width: 1440, height: 1000 },
    timezoneId: "UTC",
    locale: "en-US",
    colorScheme: "dark",
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      // Native select text can differ slightly between Chromium paints.
      maxDiffPixels: 300,
    },
  },
  webServer: {
    command: "node scripts/storybook-server.mjs",
    url: "http://127.0.0.1:6007/iframe.html",
    reuseExistingServer: false,
    timeout: 10000,
  },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
});

export default defaultExport;
