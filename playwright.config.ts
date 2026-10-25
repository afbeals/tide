import { defineConfig } from "@playwright/test";

const defaultExport = defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:8777",
    trace: "retain-on-failure",
    actionTimeout: 10000,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    command: "node scripts/test-server.mjs",
    url: "http://127.0.0.1:8777/api/health",
    reuseExistingServer: false,
    timeout: 120000,
  },
  reporter: "list",
});

export default defaultExport;
