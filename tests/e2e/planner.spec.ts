import { test, expect } from "@playwright/test";

test("capture, real persistence, shared views, and task details", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add task", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Task title *", { exact: true })
    .fill("Browser verification task");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("complementary", {
      name: "Task details: Browser verification task",
    }),
  ).toBeVisible();
  await page
    .locator(".task-inspector")
    .getByLabel("Status", { exact: true })
    .selectOption("In progress");
  await expect(
    page.locator(".toast").filter({ hasText: "Saved" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("complementary", {
      name: "Task details: Browser verification task",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.getByRole("button", { name: "Board view" }).click();
  await expect(
    page
      .locator(".board-column")
      .filter({ has: page.getByRole("heading", { name: /In progress/ }) })
      .getByRole("button", { name: "Browser verification task", exact: true }),
  ).toBeVisible();
});
test("keeps project scope and allows independent theme and density", async ({
  page,
}) => {
  await page.goto("/?section=projects&project=presentation&view=board");
  await expect(page.locator("h1")).toHaveText("Team presentation");
  await page.getByRole("button", { name: "Timeline view" }).click();
  await expect(page).toHaveURL(/project=presentation/);
  await page.goto("/?section=settings");
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  await page.getByLabel("Density", { exact: true }).selectOption("compact");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("mobile navigation and full-screen editor fit without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add task", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box?.width).toBe(390);
  await page.getByLabel("Task title *", { exact: true }).fill("Mobile task");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Task details: Mobile task" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "More" })
    .click();
  await page
    .getByRole("button", { name: "Reference library", exact: true })
    .click();
  await expect(page.locator("h1")).toHaveText("Reference library");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("backup round-trip includes a validated replacement preview", async ({
  page,
}) => {
  await page.goto("/?section=backups");
  await page.getByRole("button", { name: "Run backup now" }).click();
  await expect(page.locator(".backup-record").first()).toContainText(
    "succeeded",
  );
  await page
    .locator(".backup-record")
    .first()
    .getByRole("button", { name: "Restore", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Replace everyone’s workspace?",
  );
  await expect(
    page.getByRole("button", { name: "Replace shared workspace", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /I understand/ }).check();
  await page
    .getByRole("button", { name: "Replace shared workspace", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".toast")).toContainText("Workspace restored");
});

test("edits notes, uploads a real file, persists a timer and completes the task", async ({
  page,
}) => {
  await page.goto("/?task=team-task");
  const panel = page.locator(".task-inspector");
  await expect(panel).toBeVisible();
  await panel
    .getByRole("textbox", { name: "Rich text notes", exact: true })
    .fill("Notes written during browser verification.");
  await expect(panel.locator(".save-hint")).toHaveText("Saved");
  await expect
    .poll(async () => {
      const w = await (await page.request.get("/api/workspace")).json();
      return w.records.find((r: { id: string }) => r.id === "team-task").data
        .notes;
    })
    .toContain("Notes written during browser verification.");
  await panel
    .getByRole("button", { name: "Edit all details", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "browser-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("A real uploaded attachment.\n"),
  });
  await expect(
    page.getByRole("link", { name: "browser-note.txt", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    panel.getByRole("link", { name: "browser-note.txt", exact: true }),
  ).toBeVisible();
  await panel.getByLabel("Focus minutes").fill("1");
  await panel.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    panel.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  await panel.getByLabel("Status", { exact: true }).selectOption("Done");
  await expect(panel.getByLabel("Status", { exact: true })).toHaveValue("Done");
});

test("plans older and Someday work with selected independent routine templates", async ({
  page,
}) => {
  await page.goto("/?day=2027-03-15");
  await page.getByRole("button", { name: "Plan My Day", exact: true }).click();
  const wizard = page.getByRole("dialog").first();
  await wizard.getByRole("checkbox", { name: /Sort the spare cables/ }).check();
  await wizard.getByRole("checkbox", { name: /Research a bicycle/ }).check();
  await wizard
    .getByRole("button", { name: "Sunday reset", exact: true })
    .click();
  const routine = page.getByRole("dialog", {
    name: "Add Sunday reset",
    exact: true,
  });
  await routine.getByRole("checkbox", { name: /Prepare lunches/ }).uncheck();
  await routine
    .getByRole("button", { name: "Add 2 tasks", exact: true })
    .click();
  await expect(routine).not.toBeVisible();
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await wizard
    .getByRole("checkbox", { name: "Today’s focus", exact: true })
    .first()
    .check();
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(wizard).toContainText("A quick look at the whole day");
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await wizard.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(wizard).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open Sort the spare cables",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Tidy living room", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open Research a bicycle", exact: true }),
  ).toBeVisible();
});

test("links a reference, previews an image, and restores a deleted task", async ({
  page,
}) => {
  await page.goto("/?section=library&task=insurance");
  const reference = page.getByRole("dialog", {
    name: "Insurance card reminder",
    exact: true,
  });
  await expect(
    reference.getByRole("img", { name: "Demo insurance card" }),
  ).toBeVisible();
  await reference
    .getByRole("button", { name: "Link to task", exact: true })
    .click();
  const link = page.getByRole("dialog", {
    name: "Link reference to a task",
    exact: true,
  });
  await link.getByLabel("Find target task").fill("contractor");
  await link.getByLabel("Choose target task").selectOption("contractor");
  await link.getByRole("button", { name: "Confirm link", exact: true }).click();
  const panel = page.locator(".task-inspector");
  await expect(
    panel.getByRole("button", { name: "Insurance card reminder", exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Move to Trash", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Restore from Trash", exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Restore from Trash", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Move to Trash", exact: true }),
  ).toBeVisible();
});

test("edits one occurrence, pauses and resumes a series without losing its editor", async ({
  page,
}) => {
  await page.goto("/?section=routines");
  const card = page.locator(".collection-card").filter({
    has: page.getByRole("button", {
      name: "Water balcony plants",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Edit series", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Edit task");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await card.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open Water balcony plants", exact: true })
    .click();
  await page
    .locator(".task-inspector")
    .getByRole("button", { name: "Edit recurrence / scope", exact: true })
    .click();
  await page
    .getByRole("button", { name: "This occurrence only", exact: true })
    .click();
  await page
    .getByLabel("Task title *", { exact: true })
    .fill("Water plants — one occurrence");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".task-inspector h2")).toHaveText(
    "Water plants — one occurrence",
  );
  const workspace = await (await page.request.get("/api/workspace")).json();
  expect(
    workspace.records.find((r: { id: string }) => r.id === "plants-series").data
      .title,
  ).toBe("Water balcony plants");
});

test("uses an outing, preserves manual planning during provider failure and opens directions", async ({
  page,
}) => {
  await page.goto("/?section=outings&task=errands");
  const outing = page.getByRole("dialog", {
    name: "Saturday errands",
    exact: true,
  });
  await outing
    .getByRole("button", { name: "Use manual estimates", exact: true })
    .click();
  await expect(outing).toContainText("Manual estimates");
  await outing
    .getByRole("button", { name: "Estimate outing", exact: true })
    .click();
  await expect(outing.getByRole("alert")).toContainText(
    "Google is not configured",
  );
  await expect(
    outing.getByRole("link", { name: /Open in Google Maps/ }),
  ).toHaveAttribute("href", /google.com\/maps\/dir/);
  await outing.getByRole("button", { name: "Map", exact: true }).click();
  await expect(outing).toContainText("Configure the browser Google Maps key");
  await outing
    .getByRole("button", { name: "Move stop down", exact: true })
    .first()
    .click();
  await expect(outing.locator(".itinerary-stop").first()).toContainText(
    "Collect prescription",
  );
  await page.goto("/?task=dentist");
  await page.getByRole("button", { name: "Check route", exact: true }).click();
  await expect(
    page.locator(".task-inspector").getByRole("alert"),
  ).toContainText("Google is not configured");
});

test("bulk copies share a preview and offer safe undo", async ({ page }) => {
  await page.goto("/?section=all");
  await page
    .getByRole("checkbox", { name: "Select Dentist appointment", exact: true })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Select Waiting for contractor quote",
      exact: true,
    })
    .check();
  await page
    .locator(".bulk-toolbar")
    .getByRole("button", { name: "Copy", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Copy 2 tasks",
    exact: true,
  });
  await dialog.getByLabel("Destination day").fill("2027-04-01");
  await expect(dialog).toContainText("Copies keep useful content");
  await dialog
    .getByRole("button", { name: "Confirm copy", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Operation undone");
});

for (const width of [390, 900, 1024, 1180, 1440])
  test(`responsive ${width}px shell, details, and timeline`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?task=dentist");
    const panel = page.locator(".task-inspector");
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(Math.round(box!.width)).toBe(width < 768 ? width : 352);
    if (width < 1024) {
      await expect(panel).toHaveAttribute("aria-modal", "true");
      await expect(
        page.getByRole("button", { name: "Close inspector" }),
      ).toBeFocused();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Close inspector" }).click();
    await page.getByRole("button", { name: "Timeline view" }).click();
    await expect(page.locator(".fc-timegrid")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .locator(".workspace-scroll")
      .evaluate((node) => (node.scrollTop = 0));
    await page.screenshot({
      path: `test-results/layout-${width}.png`,
      fullPage: true,
    });
  });

test("captures in Inbox and organizes the task into a day and project", async ({
  page,
}) => {
  await page.goto("/?section=inbox");
  const workspace = await (await page.request.get("/api/workspace")).json();
  const day = workspace.records.find(
    (r: { id: string }) => r.id === "team-task",
  ).data.plannedDay;
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByLabel("Task title *", { exact: true })
    .fill("Inbox to planned work");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const panel = page.locator(".task-inspector");
  await expect(panel).toContainText("Unplanned");
  await panel
    .getByRole("button", { name: "Edit all details", exact: true })
    .click();
  await page.getByLabel("Planned day", { exact: true }).fill(day);
  await page
    .getByLabel("Project", { exact: true })
    .selectOption("presentation");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.goto("/");
  await expect(
    page.getByRole("button", {
      name: "Open Inbox to planned work",
      exact: true,
    }),
  ).toBeVisible();
});

test("reviews a day and applies an explicit bulk decision without restoring old plan members", async ({
  page,
}) => {
  await page.goto("/?day=2027-03-15");
  await page
    .getByRole("button", { name: "Review your day", exact: true })
    .click();
  const review = page.getByRole("dialog", {
    name: "Review your day",
    exact: true,
  });
  await expect(review).toContainText("Estimate and actual time");
  await review
    .getByLabel("Apply to all unfinished one-off tasks")
    .selectOption("tomorrow");
  await review
    .getByLabel("Reflection and accomplishments")
    .fill("A useful day, with room for tomorrow.");
  await review.getByRole("button", { name: "Save", exact: true }).click();
  await expect(review).not.toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open Sort the spare cables",
      exact: true,
    }),
  ).not.toBeVisible();
  const workspace = await (await page.request.get("/api/workspace")).json();
  expect(
    workspace.records.find(
      (r: { id: string }) => r.id === "plan-alex-2027-03-15",
    ).data.taskIds,
  ).toEqual([]);
});

test("creates an away group with explicit stops", async ({ page }) => {
  await page.goto("/?section=outings");
  await page
    .getByRole("button", { name: "Create outing", exact: true })
    .click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Name *", { exact: true }).fill("A new errand group");
  await editor
    .getByRole("checkbox", { name: "Pick up groceries", exact: true })
    .check();
  await editor
    .getByRole("checkbox", { name: "Drop off parcel", exact: true })
    .check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", { name: "A new errand group", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("2 stops");
});

test("shows unavailable weather while keeping task details editable", async ({
  page,
}) => {
  const workspace = await (await page.request.get("/api/workspace")).json();
  const plant = workspace.records.find(
    (r: {
      data: { seriesId: string; outcome: string | null; plannedDay: string };
    }) => r.data.seriesId === "plants-series" && !r.data.outcome,
  );
  await page.route("**/api/provider", async (route) => {
    if (route.request().postDataJSON().action === "weather")
      await route.fulfill({
        status: 503,
        json: {
          error: "Weather temporarily unavailable. Your task remains editable.",
        },
      });
    else await route.continue();
  });
  await page.goto("/?task=" + encodeURIComponent(plant.id));
  await page
    .getByRole("button", { name: "Check weather", exact: true })
    .click();
  await expect(
    page.locator(".task-inspector").getByRole("alert"),
  ).toContainText("Weather temporarily unavailable");
  await expect(
    page.getByRole("button", { name: "Edit all details", exact: true }),
  ).toBeEnabled();
});

test("compares a concurrent server change before explicitly saving the reviewed draft", async ({
  page,
  context,
}) => {
  await page.goto("/?task=contractor");
  await page
    .getByRole("button", { name: "Edit all details", exact: true })
    .click();
  await page
    .getByLabel("Task title *", { exact: true })
    .fill("A reviewed local draft");
  const other = await context.newPage();
  await other.goto("/?task=contractor");
  await other
    .locator(".task-inspector")
    .getByLabel("Status", { exact: true })
    .selectOption("In progress");
  await expect(other.locator(".toast")).toHaveText(/Saved/);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const comparison = page.getByRole("dialog", {
    name: "Another browser changed this record",
    exact: true,
  });
  await expect(comparison).toContainText("Server version");
  await expect(comparison).toContainText("A reviewed local draft");
  await comparison
    .getByRole("button", { name: "Review & edit draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".task-inspector h2")).toHaveText(
    "A reviewed local draft",
  );
  await other.close();
});

test("preserves a failed write as a recovered device draft and retries explicitly", async ({
  page,
}) => {
  await page.goto("/?section=inbox");
  await page.route("**/api/records", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error:
          "The server is temporarily unavailable. Your draft is preserved.",
      },
    }),
  );
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByLabel("Task title *", { exact: true })
    .fill("Recovered browser draft");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("tide:draft:new-task") || "{}").data
            ?.title,
      ),
    )
    .toBe("Recovered browser draft");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.locator(".sync-status")).toContainText("Unsaved changes");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.unroute("**/api/records");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByLabel("Task title *", { exact: true })).toHaveValue(
    "Recovered browser draft",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "Recovered a device draft",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".task-inspector h2")).toHaveText(
    "Recovered browser draft",
  );
});

test("keeps different people’s timers independent across browsers", async ({
  page,
  context,
}) => {
  await page.goto("/?person=alex&task=dentist");
  await page
    .locator(".task-inspector")
    .getByRole("button", { name: "Start", exact: true })
    .click();
  const other = await context.newPage();
  await other.goto("/?person=sam&task=sam-dinner");
  await other
    .locator(".task-inspector")
    .getByRole("button", { name: "Start", exact: true })
    .click();
  await expect(
    other
      .locator(".task-inspector")
      .getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  const workspace = await (await page.request.get("/api/workspace")).json();
  expect(
    workspace.records
      .filter(
        (r: { kind: string; data: { stoppedAt: string } }) =>
          r.kind === "timeLog" && !r.data.stoppedAt,
      )
      .map((r: { data: { personId: string } }) => r.data.personId)
      .sort(),
  ).toEqual(["alex", "sam"]);
  await page
    .locator(".task-inspector")
    .getByRole("button", { name: "Stop", exact: true })
    .click();
  await expect(
    other
      .locator(".task-inspector")
      .getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await other
    .locator(".task-inspector")
    .getByRole("button", { name: "Stop", exact: true })
    .click();
  await other.close();
});

test("assigns unowned work explicitly and adds it to the selected new-owner plan", async ({
  page,
}) => {
  await page.goto("/?section=inbox&person=all");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page
    .getByLabel("Task title *", { exact: true })
    .fill("Shared unassigned work");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("button", { name: "Owner · Unassigned Change", exact: true })
    .click();
  const owner = page.getByRole("dialog");
  await owner.getByLabel("New owner").selectOption("sam");
  await owner.getByRole("checkbox", { name: /Add to Sam/ }).check();
  await owner
    .getByRole("button", { name: "Confirm owner change", exact: true })
    .click();
  await expect(page.locator(".task-inspector")).toContainText("Owner · Sam");
  const workspace = await (await page.request.get("/api/workspace")).json();
  const task = workspace.records.find(
    (r: { data: { title: string } }) =>
      r.data.title === "Shared unassigned work",
  );
  expect(task.data.ownerId).toBe("sam");
  expect(
    workspace.records.some(
      (r: { kind: string; data: { personId: string; taskIds: string[] } }) =>
        r.kind === "plan" &&
        r.data.personId === "sam" &&
        r.data.taskIds.includes(task.id),
    ),
  ).toBe(true);
});

for (const theme of ["light", "dark"])
  test(`${theme} theme has accessible labels, structure and contrast`, async ({
    page,
  }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await page.addInitScript(
      (value) => localStorage.setItem("tide:theme", value),
      theme,
    );
    for (const url of ["/", "/?task=dentist", "/?section=settings"]) {
      await page.goto(url);
      await expect(page.locator(".workspace-scroll")).toBeVisible();
      if (url.includes("task="))
        await expect(page.locator(".task-inspector")).toBeVisible();
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            reason: n.failureSummary,
          })),
        })),
        url,
      ).toEqual([]);
    }
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/theme-${theme}.png`,
      fullPage: true,
    });
  });

test("recovers missed reminders on reopen and persists browser preferences and dismissal", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const workspace = await (await page.request.get("/api/workspace")).json();
  const { taskDefaults } = await import("../../src/lib/types");
  const response = await page.request.post("/api/records", {
    headers: { "X-Tide-Generation": workspace.generation },
    data: {
      kind: "task",
      data: {
        ...taskDefaults("Missed reminder verification"),
        ownerId: "alex",
        reminderAt: new Date(Date.now() - 60000).toISOString(),
      },
    },
  });
  expect(response.ok()).toBe(true);
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  const banner = reopened.locator(".reminder-banner");
  await expect(banner).toContainText("Missed reminder verification");
  await reopened.goto("/?section=settings");
  await reopened.getByLabel("Show reminders in this browser").uncheck();
  await reopened.reload();
  await expect(banner).not.toBeVisible();
  await reopened.getByLabel("Show reminders in this browser").check();
  await banner
    .getByRole("button", { name: "Missed reminder verification", exact: true })
    .click();
  await expect(
    reopened.getByRole("complementary", {
      name: "Task details: Missed reminder verification",
    }),
  ).toBeVisible();
  await reopened.getByRole("button", { name: "Close inspector" }).click();
  await banner.getByRole("button", { name: "Dismiss", exact: true }).click();
  await reopened.reload();
  await expect(banner).not.toBeVisible();
});

test("creates and edits management records with persisted relationships and signed decimal coordinates", async ({
  page,
}) => {
  const cases = [
    { section: "areas", kind: "area", button: "Create area" },
    { section: "projects", kind: "project", button: "Create project" },
    { section: "routines", kind: "routine", button: "Create routine" },
    { section: "saved", kind: "view", button: "Create saved view" },
    { section: "places", kind: "place", button: "Add saved place" },
    { section: "people", kind: "person", button: "Create person" },
    { section: "library", kind: "reference", button: "Create reference" },
    { section: "outings", kind: "outing", button: "Create outing" },
  ];
  for (const item of cases) {
    const title = `Management ${item.kind}`;
    await page.goto(`/?section=${item.section}&person=alex`);
    await page
      .getByRole("button", { name: item.button, exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name *", { exact: true }).fill(title);
    if (item.kind === "project") {
      await dialog
        .getByLabel("Area", { exact: true })
        .selectOption({ label: "Management area updated" });
      await dialog
        .getByLabel("Project target date", { exact: true })
        .fill("2026-11-10");
    }
    if (item.kind === "routine") {
      await dialog
        .getByRole("button", { name: "Add task template", exact: true })
        .click();
      await dialog
        .getByLabel("Task title", { exact: true })
        .fill("Management routine step");
    }
    if (item.kind === "view")
      await dialog
        .getByLabel("Status", { exact: true })
        .selectOption("In progress");
    if (item.kind === "place") {
      await dialog
        .getByLabel("Address *", { exact: true })
        .fill("San Francisco, CA");
      await dialog.getByLabel("Latitude", { exact: true }).fill("37.7749");
      await dialog.getByLabel("Longitude", { exact: true }).fill("-122.4194");
    }
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const card = page.locator(".collection-card").filter({
      has: page.getByRole("button", { name: title, exact: true }),
    });
    await card.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog.getByLabel("Name *", { exact: true }).fill(title + " updated");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: title + " updated", exact: true }),
    ).toBeVisible();
    const workspace = await (await page.request.get("/api/workspace")).json();
    const record = workspace.records.find(
      (r: { kind: string; data: { title?: string; name?: string } }) =>
        r.kind === item.kind &&
        (r.data.title || r.data.name) === title + " updated",
    );
    expect(record?.version).toBe(2);
    if (item.kind === "project") {
      expect(record.data.areaId).toBeTruthy();
      expect(record.data.targetDay).toBe("2026-11-10");
    }
    if (item.kind === "routine")
      expect(record.data.templates[0].title).toBe("Management routine step");
    if (item.kind === "view")
      expect(record.data.filters.status).toBe("In progress");
    if (item.kind === "place") {
      expect(record.data.latitude).toBe(37.7749);
      expect(record.data.longitude).toBe(-122.4194);
    }
  }
  await page.goto("/?section=settings&person=alex");
  await page
    .getByRole("button", { name: "Add availability / exception", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Date exception (leave empty for recurring hours)", {
      exact: true,
    })
    .fill("2026-11-20");
  await dialog.getByLabel("Start time", { exact: true }).fill("10:00");
  await dialog.getByLabel("End time", { exact: true }).fill("14:00");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const exception = page.getByRole("button", { name: /Alex · 2026-11-20/ });
  await exception.click();
  await dialog.getByLabel("End time", { exact: true }).fill("15:00");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(exception).toContainText("10:00–15:00");
  await page
    .getByRole("button", { name: "Dates, backups & integrations", exact: true })
    .click();
  await dialog
    .getByLabel("Daily request allowance", { exact: true })
    .fill("99");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  const workspace = await (await page.request.get("/api/workspace")).json();
  expect(
    workspace.records.find((r: { kind: string }) => r.kind === "settings").data
      .googleDailyLimit,
  ).toBe(99);
});
