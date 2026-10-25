import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { delay, http, HttpResponse } from "msw";
import { Tide } from "../components/Tide";
import {
  demoDay,
  editMockWorkspace,
  exampleWorkspace,
  exampleTask,
  getMockWorkspace,
  patchMockTask,
} from "./fixtures";

const page = (section: string, more: Record<string, string> = {}) => ({
  fullscreen: true,
  nextjs: {
    appDirectory: true,
    navigation: {
      pathname: "/",
      query: { section, person: "alex", day: demoDay, ...more },
    },
  },
});
const meta = {
  title: "Screens/Workspace interactions",
  component: Tide,
  parameters: page("all"),
  tags: ["autodocs"],
} satisfies Meta<typeof Tide>;
export default meta;
type Story = StoryObj<typeof meta>;
const body = () => within(document.body);
export const FilterAndReset: Story = {
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Filters" }),
    );
    const dialog = within(
      await body().findByRole("dialog", { name: "Filter your tasks" }),
    );
    await userEvent.selectOptions(
      dialog.getByLabelText("Status", { exact: true }),
      "Waiting/blocked",
    );
    await userEvent.type(
      dialog.getByLabelText("Search", { exact: true }),
      "contractor",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Clear filters" }),
    );
    await expect(dialog.getByLabelText("Status", { exact: true })).toHaveValue(
      "",
    );
    await userEvent.selectOptions(
      dialog.getByLabelText("Priority", { exact: true }),
      "High",
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Apply filters" }),
    );
    await expect(
      body().getByRole("button", { name: "Filters · Active" }),
    ).toBeVisible();
    await expect(getRouter().push).toHaveBeenCalledWith(
      expect.stringContaining("High"),
      { scroll: false },
    );
  },
};
export const SaveFilterAsView: Story = {
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Filters" }),
    );
    const dialog = within(
      await body().findByRole("dialog", { name: "Filter your tasks" }),
    );
    await userEvent.selectOptions(
      dialog.getByLabelText("Effort", { exact: true }),
      "Low",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Save as view" }));
    const editor = within(
      await body().findByRole("dialog", { name: "Create saved view" }),
    );
    await expect(editor.getByLabelText("Effort", { exact: true })).toHaveValue(
      "Low",
    );
    await userEvent.type(
      editor.getByLabelText("Name *", { exact: true }),
      "Gentle tasks",
    );
    await userEvent.click(editor.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(
        getMockWorkspace().records.some(
          (r) => r.kind === "view" && r.data.title === "Gentle tasks",
        ),
      ).toBe(true),
    );
  },
};
export const BrowserPreferences: Story = {
  parameters: page("settings"),
  play: async () => {
    await userEvent.selectOptions(
      await body().findByLabelText("Theme", { exact: true }),
      "light",
    );
    await userEvent.selectOptions(
      body().getByLabelText("Density", { exact: true }),
      "compact",
    );
    await userEvent.selectOptions(
      body().getByLabelText("Motion", { exact: true }),
      "reduced",
    );
    await userEvent.click(
      body().getByRole("checkbox", { name: "Show reminders in this browser" }),
    );
    await waitFor(() =>
      expect(document.documentElement.dataset).toEqual(
        expect.objectContaining({
          theme: "light",
          density: "compact",
          motion: "reduced",
        }),
      ),
    );
    await expect(localStorage.getItem("tide:reminders")).toBe("off");
    await userEvent.click(
      body().getByRole("button", { name: "Dates, backups & integrations" }),
    );
    await expect(
      await body().findByRole("dialog", { name: "Workspace preferences" }),
    ).toBeVisible();
  },
};
export const ArchivedTasks: Story = {
  beforeEach: () => patchMockTask("presentation", { archived: true }),
  play: async () => {
    await body().findByRole("checkbox", { name: "Archived" });
    await expect(
      body().queryByRole("button", { name: "Open Prepare team presentation" }),
    ).not.toBeInTheDocument();
    await userEvent.click(body().getByRole("checkbox", { name: "Archived" }));
    await expect(
      await body().findByRole("button", {
        name: "Open Prepare team presentation",
      }),
    ).toBeVisible();
  },
};
export const RestoreTrashedTask: Story = {
  parameters: page("trash"),
  beforeEach: () =>
    patchMockTask("presentation", { deletedAt: "2026-10-24T12:00:00Z" }),
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Restore" }),
    );
    await waitFor(() => expect(exampleTask().data.deletedAt).toBe(""));
    await expect(
      await body().findByRole("heading", { name: "Nothing in Trash" }),
    ).toBeVisible();
  },
};
const bulk = fn();
export const BulkCopyPreview: Story = {
  play: async () => {
    await userEvent.click(
      await body().findByLabelText("Select Prepare team presentation"),
    );
    await userEvent.click(
      body().getByLabelText("Select Walk through the park"),
    );
    await userEvent.click(body().getByRole("button", { name: "Copy" }));
    await expect(
      await body().findByRole("dialog", { name: "Copy 2 tasks" }),
    ).toBeVisible();
    await expect(bulk).not.toHaveBeenCalled();
  },
};
const bulkHandler = http.post("/api/bulk", async ({ request }) => {
  const payload = await request.json();
  bulk(payload);
  return HttpResponse.json({ operationId: "operation", ids: [] });
});
export const BulkCopyConfirmation: Story = {
  parameters: { msw: { handlers: [bulkHandler] } },
  play: async () => {
    await userEvent.click(
      await body().findByLabelText("Select Prepare team presentation"),
    );
    await userEvent.click(
      body().getByLabelText("Select Walk through the park"),
    );
    await userEvent.click(body().getByRole("button", { name: "Copy" }));
    const dialog = within(
      await body().findByRole("dialog", { name: "Copy 2 tasks" }),
    );
    await expect(
      dialog.getByText(/reset completion, checklist progress/),
    ).toBeVisible();
    await expect(bulk).not.toHaveBeenCalled();
    await userEvent.click(dialog.getByRole("button", { name: "Confirm copy" }));
    await waitFor(() =>
      expect(bulk).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "copy",
          day: "2026-10-25",
          items: [
            { id: "presentation", version: 1 },
            { id: "walk", version: 1 },
          ],
        }),
      ),
    );
    await expect(body().queryByRole("dialog")).not.toBeInTheDocument();
  },
};
export const BulkFailureRetainsSelection: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/bulk", () =>
          HttpResponse.json(
            { error: "A selected task changed. Review and retry." },
            { status: 409 },
          ),
        ),
      ],
    },
  },
  play: async () => {
    await userEvent.click(
      await body().findByLabelText("Select Prepare team presentation"),
    );
    await userEvent.click(body().getByRole("button", { name: "Move" }));
    const dialog = within(
      await body().findByRole("dialog", { name: "Move 1 tasks" }),
    );
    await userEvent.click(dialog.getByRole("button", { name: "Confirm move" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "A selected task changed",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect(
      body().getByLabelText("Select Prepare team presentation"),
    ).toBeChecked();
    await userEvent.click(body().getByRole("button", { name: "Clear" }));
    await expect(
      body().getByLabelText("Select Prepare team presentation"),
    ).not.toBeChecked();
  },
};
export const LinkReference: Story = {
  parameters: page("library", { task: "outline" }),
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Link to task" }),
    );
    const dialog = within(
      await body().findByRole("dialog", { name: "Link reference to a task" }),
    );
    await userEvent.click(dialog.getByRole("button", { name: "Confirm link" }));
    await expect(dialog.getByRole("alert")).toHaveTextContent(
      "Choose a target task",
    );
    await userEvent.type(dialog.getByLabelText("Find target task"), "park");
    await userEvent.selectOptions(
      dialog.getByLabelText("Choose target task"),
      "walk",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Confirm link" }));
    await waitFor(() =>
      expect(exampleTask("walk").data.referenceIds).toEqual(["outline"]),
    );
  },
};
export const CopyReferenceContent: Story = {
  parameters: page("library", { task: "outline" }),
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Copy content to task" }),
    );
    const dialog = within(
      await body().findByRole("dialog", { name: "Copy reference content" }),
    );
    await userEvent.selectOptions(
      dialog.getByLabelText("Choose target task"),
      "walk",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Confirm copy" }));
    await waitFor(() =>
      expect(exampleTask("walk").data.notes).toContain(
        "One problem, three examples",
      ),
    );
    await expect(exampleTask("walk").data.referenceIds).toEqual([]);
  },
};
export const NavigationControls: Story = {
  parameters: page("today"),
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Next day" }),
    );
    await expect(getRouter().push).toHaveBeenLastCalledWith(
      expect.stringContaining("day=2026-10-25"),
      { scroll: false },
    );
    await userEvent.click(body().getByRole("button", { name: "Previous day" }));
    await expect(getRouter().push).toHaveBeenLastCalledWith(
      expect.stringContaining("day=2026-10-23"),
      { scroll: false },
    );
    await userEvent.click(body().getByRole("button", { name: "Board view" }));
    await expect(getRouter().push).toHaveBeenLastCalledWith(
      expect.stringContaining("view=board"),
      { scroll: false },
    );
    await userEvent.click(body().getByRole("button", { name: "Add task" }));
    await expect(
      await body().findByRole("dialog", { name: "Create task" }),
    ).toBeVisible();
  },
};
let connectionReads = 0;
export const ConnectionFailureAndRetry: Story = {
  beforeEach: () => {
    connectionReads = 0;
  },
  parameters: {
    msw: {
      handlers: [
        (() => {
          return http.get("/api/workspace", () =>
            ++connectionReads <= 2
              ? HttpResponse.json(
                  { error: "Server unavailable" },
                  { status: 503 },
                )
              : HttpResponse.json(exampleWorkspace()),
          );
        })(),
      ],
    },
  },
  play: async () => {
    await expect(
      await body().findByText(
        "Couldn’t reach your workspace. Check the server and retry.",
        {},
        { timeout: 5000 },
      ),
    ).toBeVisible();
    await userEvent.click(
      body().getByRole("button", { name: "Retry connection" }),
    );
    await expect(
      await body().findByRole("heading", { name: "All Tasks" }),
    ).toBeVisible();
  },
};
export const LoadingWorkspace: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/workspace", async () => {
          await delay(600);
          return HttpResponse.json(exampleWorkspace());
        }),
      ],
    },
  },
  play: async () => {
    await expect(
      await body().findByText("Making room for your day…"),
    ).toBeVisible();
    await expect(
      await body().findByRole("heading", { name: "All Tasks" }),
    ).toBeVisible();
  },
};
export const DeleteSavedViewConfirmation: Story = {
  parameters: {
    ...page("saved"),
    msw: {
      handlers: [
        http.delete("/api/records/:id", async ({ request, params }) => {
          expect(await request.json()).toEqual({ version: 1 });
          editMockWorkspace((w) => {
            w.records = w.records.filter((r) => r.id !== params.id);
          });
          return HttpResponse.json({ ok: true });
        }),
      ],
    },
  },
  play: async () => {
    const button = await body().findByRole("button", { name: "Delete view" });
    const previous = window.confirm;
    try {
      window.confirm = () => false;
      await userEvent.click(button);
      await expect(
        getMockWorkspace().records.some((r) => r.id === "short"),
      ).toBe(true);
      window.confirm = () => true;
      await userEvent.click(button);
      await waitFor(() =>
        expect(getMockWorkspace().records.some((r) => r.id === "short")).toBe(
          false,
        ),
      );
      await expect(
        await body().findByRole("heading", {
          name: "Your saved views start here",
        }),
      ).toBeVisible();
    } finally {
      window.confirm = previous;
    }
  },
};
