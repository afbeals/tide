import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    allowOnly: !process.env.CI,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**/*.ts",
        "src/server/**/*.ts",
        "src/app/api/**/route.ts",
      ],
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      reportsDirectory: "coverage/core",
      thresholds: { lines: 95, statements: 94, functions: 90, branches: 88 },
    },
  },
});
