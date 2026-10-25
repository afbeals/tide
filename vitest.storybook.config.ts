import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
export default defineConfig({
  plugins: [
    storybookTest({
      configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
    }),
  ],
  test: {
    name: "storybook",
    testTimeout: 30000,
    allowOnly: !process.env.CI,
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : {},
      }),
      instances: [{ browser: "chromium" }],
      viewport: { width: 1440, height: 1000 },
    },
    coverage: {
      provider: "v8",
      include: ["src/components/**/*.tsx"],
      reportsDirectory: "coverage/components",
      reporter: ["text", "json-summary", "html", "lcov"],
      thresholds: { lines: 75, statements: 75, functions: 70, branches: 70 },
    },
  },
});
