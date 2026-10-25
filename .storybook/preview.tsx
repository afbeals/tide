import { useEffect } from "react";
import type { Preview } from "@storybook/nextjs-vite";
import { setupWorker } from "msw/browser";
import { mswLoader } from "msw-storybook-addon/csf3";
import { handlers, resetWorkspace } from "../src/stories/fixtures";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "../src/app/globals.css";
import "./preview.css";
function Frame({
  children,
  theme,
  density,
  full,
}: {
  children: React.ReactNode;
  theme: string;
  density: string;
  full: boolean;
}) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.motion = "reduced";
    localStorage.setItem("tide:theme", theme);
    localStorage.setItem("tide:density", density);
    return () => {
      document.documentElement.removeAttribute("data-motion");
    };
  }, [theme, density]);
  return (
    <div className={full ? "story-stage story-fullscreen" : "story-stage"}>
      {children}
    </div>
  );
}
const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: {
        icon: "paintbrush",
        items: ["dark", "light"],
        dynamicTitle: true,
      },
    },
    density: {
      description: "Density",
      toolbar: {
        icon: "component",
        items: ["comfortable", "compact"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "dark", density: "comfortable" },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/",
        query: { day: "2026-10-24", person: "alex" },
      },
    },
    a11y: {
      test: "error",
      options: {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      },
    },
  },
  loaders: [
    // Native selects can retain fallback-font metrics if mounted before fonts load.
    async () => {
      await Promise.all(
        [400, 500, 600].map((weight) =>
          document.fonts.load(`${weight} 14px "IBM Plex Sans"`),
        ),
      );
      return {};
    },
    mswLoader(async () => {
      const worker = setupWorker(...handlers);
      await worker.start({
        quiet: true,
        onUnhandledRequest(request, print) {
          if (new URL(request.url).pathname.startsWith("/api/")) print.error();
        },
      });
      return worker;
    }),
  ],
  beforeEach({ globals }) {
    delete document.documentElement.dataset.storyReady;
    localStorage.clear();
    sessionStorage.clear();
    resetWorkspace();
    localStorage.setItem("tide:theme", globals.theme);
    localStorage.setItem("tide:density", globals.density);
  },
  afterEach({ id }) {
    document.documentElement.dataset.storyReady = id;
  },
  decorators: [
    (Story, context) => (
      <Frame
        theme={context.globals.theme}
        density={context.globals.density}
        full={!!context.parameters.fullscreen}
      >
        <Story />
      </Frame>
    ),
  ],
};
export default preview;
