import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: ["../src/stories/**/*.stories.tsx"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
    "msw-storybook-addon",
  ],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  staticDirs: ["../public", "./public"],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(config, {
      resolve: {
        alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
      },
    });
  },
};
export default config;
