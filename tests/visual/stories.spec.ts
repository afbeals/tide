import { expect, test } from "@playwright/test";

const screens = [
  ["today-desktop-dark", "screens-workspace--today", 1440, 1000, "dark"],
  ["today-desktop-light", "screens-workspace--today", 1440, 1000, "light"],
  ["today-tablet", "screens-workspace--today", 900, 1000, "dark"],
  ["today-mobile", "screens-workspace--today", 390, 844, "dark"],
  ["board-desktop", "screens-workspace--board", 1440, 1000, "dark"],
  [
    "timeline-travel-dark",
    "tasks-views--timeline-travel-and-open",
    1440,
    1000,
    "dark",
  ],
  [
    "timeline-travel-light",
    "tasks-views--timeline-travel-light",
    1440,
    1000,
    "light",
  ],
  [
    "inspector-desktop",
    "screens-workspace--task-inspector",
    1440,
    1000,
    "dark",
  ],
  ["inspector-mobile", "screens-workspace--task-inspector", 390, 844, "dark"],
  ["settings-light", "screens-workspace--settings", 1440, 1000, "light"],
  ["empty-workspace", "screens-workspace--empty-workspace", 1440, 1000, "dark"],
  ["task-editor", "editors-records--existing-task", 1440, 1000, "dark"],
  ["plan-capacity", "planning-plan-a-day--review-capacity", 1440, 1000, "dark"],
  ["long-title-mobile", "tasks-views--long-title", 390, 844, "light"],
  [
    "backup-restore-preview",
    "recovery-backups--restore-preview",
    1440,
    1000,
    "dark",
  ],
  [
    "editor-conflict",
    "editors-save-and-recovery--conflict-comparison",
    1440,
    1000,
    "dark",
  ],
  [
    "recovered-task-notes",
    "workflows-inspector-recovery--notes-recovery-preview",
    1440,
    1000,
    "dark",
  ],
  [
    "rainy-forecast",
    "travel-estimates-and-outings--rainy-forecast",
    900,
    1000,
    "light",
  ],
  [
    "outing-travel-conflict",
    "travel-estimates-and-outings--outing-route-legs-and-conflict",
    1440,
    1000,
    "dark",
  ],
  [
    "bulk-copy-preview",
    "screens-workspace-interactions--bulk-copy-preview",
    1440,
    1000,
    "light",
  ],
] as const;

for (const [name, id, width, height, theme] of screens) {
  test(name, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.clock.setFixedTime(new Date("2026-10-24T16:00:00Z"));
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      `/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`,
    );
    await expect(page.locator("html")).toHaveAttribute("data-story-ready", id);
    // Data-backed stories must finish loading, including the note editor.
    await expect(page.locator(".boot")).toHaveCount(0);
    await expect(
      page
        .locator(
          ".app-shell, .modal, .task-row, .travel-section, .itinerary, .task-inspector, .timeline-layout",
        )
        .first(),
    ).toBeVisible();
    if (id === "editors-records--existing-task")
      await expect(
        page.getByText("Draft saved on this device", { exact: true }),
      ).toBeVisible();
    if (id.startsWith("travel-estimates-and-outings--")) {
      // Synthetic story clicks and disabled controls can retain different focus
      // states after async work. Finish with native pointer focus consistently.
      await page.getByRole("heading").first().click();
    }
    await page.evaluate(async () => {
      await Promise.all(
        [400, 500, 600].map((weight) =>
          document.fonts.load(`${weight} 14px "IBM Plex Sans"`),
        ),
      );
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    await expect(page).toHaveScreenshot(`${name}.png`);
    expect(errors).toEqual([]);
  });
}
