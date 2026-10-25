import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { http, HttpResponse } from "msw";
import { EntityEditor } from "../components/EntityEditor";
import { WorkspaceProvider } from "../components/workspace";
import {
  demoDay,
  editMockWorkspace,
  exampleTask,
  getMockWorkspace,
} from "./fixtures";

function Editor(props: ComponentProps<typeof EntityEditor>) {
  return (
    <WorkspaceProvider>
      <EntityEditor {...props} />
    </WorkspaceProvider>
  );
}
const meta = {
  title: "Editors/Save and recovery",
  component: Editor,
  args: {
    kind: "task",
    personId: "alex",
    day: demoDay,
    onClose: fn(),
    onSaved: fn(),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Editor>;
export default meta;
type Story = StoryObj<typeof meta>;
const body = () => within(document.body);
const existing = {
  ...structuredClone(exampleTask()),
  data: { ...exampleTask().data },
};
async function save() {
  await userEvent.click(body().getByRole("button", { name: "Save" }));
}
async function named(name: string) {
  await userEvent.type(
    await body().findByLabelText("Name *", { exact: true }),
    name,
  );
}
async function changedTitle() {
  const input = await body().findByLabelText("Task title *", { exact: true });
  await userEvent.clear(input);
  await userEvent.type(input, "My reviewed changes");
}
function newerServer() {
  editMockWorkspace((w) => {
    const t = w.records.find((r) => r.id === existing.id)!;
    t.version = 2;
    t.data = { ...t.data, title: "Updated in another browser" };
  });
}
export const ConflictComparison: Story = {
  args: { entity: existing },
  beforeEach: newerServer,
  play: async () => {
    await changedTitle();
    await save();
    await expect(
      await body().findByRole("dialog", {
        name: "Another browser changed this record",
      }),
    ).toBeVisible();
    await userEvent.tab();
    await userEvent.tab();
    await expect(
      body().getByRole("region", { name: "Server version" }),
    ).toHaveFocus();
    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
  },
};
export const ConflictUseServer: Story = {
  args: { entity: existing },
  beforeEach: newerServer,
  play: async ({ args }) => {
    await changedTitle();
    await save();
    const dialog = within(
      await body().findByRole("dialog", {
        name: "Another browser changed this record",
      }),
    );
    await expect(
      dialog.getByText(/Updated in another browser/, { selector: "pre" }),
    ).toBeVisible();
    await expect(args.onSaved).not.toHaveBeenCalled();
    await userEvent.click(
      dialog.getByRole("button", { name: "Use server version" }),
    );
    await expect(
      body().getByLabelText("Task title *", { exact: true }),
    ).toHaveValue("Updated in another browser");
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ version: 3 }),
      ),
    );
  },
};
export const ConflictReviewDraft: Story = {
  args: { entity: existing },
  beforeEach: newerServer,
  play: async ({ args }) => {
    await changedTitle();
    await save();
    const dialog = within(
      await body().findByRole("dialog", {
        name: "Another browser changed this record",
      }),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Review & edit draft" }),
    );
    await expect(body().getByRole("alert")).toHaveTextContent(
      "Review your recovered draft",
    );
    await expect(args.onSaved).not.toHaveBeenCalled();
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 3,
          data: expect.objectContaining({ title: "My reviewed changes" }),
        }),
      ),
    );
  },
};
export const DeletedRecordSaveAsNew: Story = {
  args: { entity: existing },
  parameters: {
    msw: {
      handlers: [
        http.patch("/api/records/:id", () =>
          HttpResponse.json({ error: "Deleted" }, { status: 404 }),
        ),
      ],
    },
  },
  play: async ({ args }) => {
    await changedTitle();
    await save();
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "Your draft is preserved",
    );
    await userEvent.click(
      body().getByRole("button", { name: "Save draft as new task" }),
    );
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.not.stringMatching(/^presentation$/),
          data: expect.objectContaining({
            title: "My reviewed changes",
            status: "Open",
          }),
        }),
      ),
    );
  },
};
export const DraftBeforeRestore: Story = {
  args: { entity: existing },
  beforeEach: () =>
    localStorage.setItem(
      "tide:draft:presentation",
      JSON.stringify({
        data: { ...existing.data, title: "Before restore" },
        version: 1,
        generation: "old-generation",
      }),
    ),
  play: async ({ args }) => {
    await body().findByLabelText("Task title *", { exact: true });
    await save();
    await expect(
      await body().findByRole("dialog", {
        name: "Another browser changed this record",
      }),
    ).toBeVisible();
    await expect(args.onSaved).not.toHaveBeenCalled();
    await userEvent.click(
      within(
        body().getByRole("dialog", {
          name: "Another browser changed this record",
        }),
      ).getByRole("button", { name: "Use server version" }),
    );
    await expect(
      body().getByLabelText("Task title *", { exact: true }),
    ).toHaveValue(existing.data.title);
  },
};
export const ProjectReferences: Story = {
  args: { kind: "project" },
  play: async ({ args }) => {
    await named("Weekend plans");
    await userEvent.selectOptions(
      body().getByLabelText("Area", { exact: true }),
      "work",
    );
    await userEvent.click(
      body().getByRole("checkbox", { name: "Presentation outline" }),
    );
    await userEvent.click(body().getByRole("checkbox", { name: "Archived" }));
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            areaId: "work",
            referenceIds: ["outline"],
            archived: true,
          }),
        }),
      ),
    );
  },
};
export const ReferenceLink: Story = {
  args: { kind: "reference" },
  play: async ({ args }) => {
    await named("Useful documentation");
    await userEvent.selectOptions(
      body().getByLabelText("Reference type"),
      "Link",
    );
    await userEvent.type(
      body().getByLabelText("Link URL"),
      "https://example.com/guide",
    );
    await userEvent.type(
      body().getByLabelText("Tags", { exact: true }),
      "guide",
    );
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "Link",
            url: "https://example.com/guide",
            tags: ["guide"],
          }),
        }),
      ),
    );
  },
};
export const SavedFilters: Story = {
  args: { kind: "view" },
  play: async ({ args }) => {
    await named("Small outdoor tasks");
    for (const [label, value] of [
      ["Owner", "alex"],
      ["Status", "Open"],
      ["Priority", "High"],
      ["Effort", "Low"],
      ["Context", "Away from home"],
      ["Project", "team"],
      ["Area", "work"],
      ["Sort", "estimate"],
    ])
      await userEvent.selectOptions(
        body().getByLabelText(label, { exact: true }),
        value,
      );
    await userEvent.type(
      body().getByLabelText("Search", { exact: true }),
      "park",
    );
    await userEvent.type(
      body().getByLabelText("Tag", { exact: true }),
      "outside",
    );
    await userEvent.type(
      body().getByLabelText("Available time (minutes)"),
      "30",
    );
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            filters: expect.objectContaining({
              owner: "alex",
              query: "park",
              maxMinutes: "30",
              context: "Away from home",
              sort: "estimate",
            }),
          }),
        }),
      ),
    );
  },
};
export const OutingStopsAndReturn: Story = {
  args: { kind: "outing" },
  play: async ({ args }) => {
    await named("Park and home");
    await userEvent.selectOptions(body().getByLabelText("Travel mode"), "WALK");
    await userEvent.click(
      body().getByRole("checkbox", { name: "Walk through the park" }),
    );
    await userEvent.click(
      body().getByRole("checkbox", { name: "Include return journey" }),
    );
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskIds: ["walk"],
            returnTrip: true,
            travelMode: "WALK",
          }),
        }),
      ),
    );
  },
};
export const AvailabilityBreaks: Story = {
  args: { kind: "availability" },
  play: async ({ args }) => {
    await userEvent.selectOptions(
      await body().findByLabelText("Planning person"),
      "alex",
    );
    await userEvent.click(body().getByRole("checkbox", { name: "Sat" }));
    await userEvent.click(body().getByRole("checkbox", { name: "Mon" }));
    await userEvent.click(
      body().getByRole("button", { name: "Add unavailable period" }),
    );
    await userEvent.click(
      body().getByRole("button", { name: "Remove unavailable period" }),
    );
    await userEvent.click(
      body().getByRole("button", { name: "Add unavailable period" }),
    );
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            personId: "alex",
            weekdays: [2, 3, 4, 5, 6],
            breaks: [{ start: "12:00", end: "13:00" }],
          }),
        }),
      ),
    );
  },
};
export const BackupAndGoogleSettings: Story = {
  args: {
    kind: "settings",
    entity: getMockWorkspace().records.find((r) => r.kind === "settings"),
  },
  play: async ({ args }) => {
    await userEvent.selectOptions(
      await body().findByLabelText("Week starts"),
      "0",
    );
    await userEvent.click(
      body().getByRole("checkbox", { name: "Enable scheduled backups" }),
    );
    await userEvent.click(
      body().getByRole("checkbox", { name: "Enable Google requests" }),
    );
    const limit = body().getByLabelText("Daily request allowance");
    await userEvent.clear(limit);
    await userEvent.type(limit, "25");
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ weekStart: 0, googleDailyLimit: 25 }),
        }),
      ),
    );
  },
};
export const WeekdayRecurrence: Story = {
  play: async ({ args }) => {
    await userEvent.type(
      await body().findByLabelText("Task title *", { exact: true }),
      "Take a walk",
    );
    await userEvent.click(
      body().getByText("Recurrence", { selector: "summary" }),
    );
    await userEvent.click(
      body().getByRole("checkbox", { name: "Repeat this task" }),
    );
    await userEvent.selectOptions(
      body().getByLabelText("Schedule", { exact: true }),
      "weekdays",
    );
    await userEvent.click(body().getByRole("checkbox", { name: "Sat" }));
    await userEvent.click(body().getByRole("checkbox", { name: "Mon" }));
    await userEvent.click(
      body().getByRole("checkbox", { name: "Pause future occurrences" }),
    );
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recurrence: expect.objectContaining({
              mode: "weekdays",
              weekdays: [2, 3, 4, 5, 6],
              paused: true,
            }),
          }),
        }),
      ),
    );
  },
};
export const RoutineTemplateOrder: Story = {
  args: { kind: "routine" },
  play: async ({ args }) => {
    await named("Evening reset");
    await userEvent.click(
      body().getByRole("button", { name: "Add task template" }),
    );
    await userEvent.type(
      body().getByLabelText("Task title", { exact: true }),
      "Put things away",
    );
    await userEvent.selectOptions(
      body().getByLabelText("Effort", { exact: true }),
      "Medium",
    );
    await userEvent.selectOptions(
      body().getByLabelText("Context", { exact: true }),
      "Anywhere",
    );
    await userEvent.click(
      body().getByRole("button", { name: "Add task template" }),
    );
    await userEvent.type(
      body().getAllByLabelText("Task title", { exact: true })[1],
      "Prepare tomorrow",
    );
    await userEvent.click(body().getAllByRole("button", { name: "Up" })[1]);
    await expect(
      body().getAllByLabelText("Task title", { exact: true })[0],
    ).toHaveValue("Prepare tomorrow");
    await userEvent.click(body().getAllByRole("button", { name: "Down" })[0]);
    await userEvent.click(body().getAllByRole("button", { name: "Remove" })[1]);
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            templates: [
              expect.objectContaining({
                title: "Put things away",
                effort: "Medium",
                context: "Anywhere",
              }),
            ],
          }),
        }),
      ),
    );
  },
};
export const GooglePlaceSelection: Story = {
  args: { kind: "place" },
  parameters: {
    msw: {
      handlers: [
        http.post("/api/provider", async ({ request }) => {
          expect(await request.json()).toEqual(
            expect.objectContaining({ action: "places", query: "Library" }),
          );
          return HttpResponse.json({
            places: [
              {
                id: "library-place",
                displayName: { text: "City Library" },
                formattedAddress: "100 Main Street",
                location: { latitude: 37.77, longitude: -122.41 },
                regularOpeningHours: { weekdayDescriptions: ["Monday: 9–5"] },
              },
            ],
          });
        }),
      ],
    },
  },
  play: async ({ args }) => {
    await named("Library");
    await userEvent.type(
      body().getByLabelText("Search Google Places"),
      "Library",
    );
    await userEvent.click(body().getByRole("button", { name: "Search" }));
    await userEvent.click(
      await body().findByRole("button", {
        name: /City Library 100 Main Street/,
      }),
    );
    await expect(body().getByLabelText("Address *")).toHaveValue(
      "100 Main Street",
    );
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            placeId: "library-place",
            latitude: 37.77,
            longitude: -122.41,
          }),
        }),
      ),
    );
  },
};
export const AttachmentUploadAndRemove: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/attachment", async ({ request }) => {
          const form = await request.formData();
          expect((form.get("file") as File).name).toBe("note.txt");
          return HttpResponse.json({ id: "uploaded" });
        }),
      ],
    },
  },
  play: async ({ args }) => {
    await userEvent.type(
      await body().findByLabelText("Task title *", { exact: true }),
      "Bring a note",
    );
    await userEvent.upload(
      body().getByLabelText("Add file or image"),
      new File(["A useful note"], "note.txt", { type: "text/plain" }),
    );
    await expect(
      await body().findByRole("link", { name: "Uploaded attachment" }),
    ).toHaveAttribute("href", "/api/attachment/uploaded");
    await userEvent.click(
      body().getByRole("button", { name: "Remove attachment" }),
    );
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ attachmentIds: [] }),
        }),
      ),
    );
  },
};
export const AttachmentFailurePreservesEditor: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/attachment", () =>
          HttpResponse.json(
            { error: "File exceeds the upload limit" },
            { status: 413 },
          ),
        ),
      ],
    },
  },
  play: async () => {
    await userEvent.type(
      await body().findByLabelText("Task title *", { exact: true }),
      "Keep my task",
    );
    await userEvent.upload(
      body().getByLabelText("Add file or image"),
      new File(["fixture"], "large.txt", { type: "text/plain" }),
    );
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "File exceeds the upload limit",
    );
    await expect(body().getByRole("button", { name: "Save" })).toBeEnabled();
    await expect(
      body().getByLabelText("Task title *", { exact: true }),
    ).toHaveValue("Keep my task");
  },
};
export const TaskDependenciesAndTravel: Story = {
  play: async ({ args }) => {
    await userEvent.type(
      await body().findByLabelText("Task title *", { exact: true }),
      "Pick up supplies",
    );
    await userEvent.selectOptions(
      body().getByLabelText("Owner", { exact: true }),
      "sam",
    );
    await userEvent.selectOptions(
      body().getByLabelText("Project", { exact: true }),
      "team",
    );
    await userEvent.selectOptions(
      body().getByLabelText("Priority", { exact: true }),
      "High",
    );
    await userEvent.click(
      body().getByText("Dependencies and blocking", { selector: "summary" }),
    );
    await userEvent.type(
      body().getByLabelText("Find prerequisites"),
      "contractor",
    );
    await userEvent.click(
      body().getByRole("checkbox", { name: "Confirm contractor date" }),
    );
    await userEvent.type(
      body().getByLabelText("Blocking note"),
      "Wait for confirmation",
    );
    await userEvent.click(
      body().getByText("Location and travel", { selector: "summary" }),
    );
    await userEvent.selectOptions(
      body().getByLabelText("Location context"),
      "Away from home",
    );
    await userEvent.click(
      body().getByRole("checkbox", { name: "Outdoor task" }),
    );
    await userEvent.selectOptions(
      body().getByLabelText("Travel mode"),
      "BICYCLE",
    );
    await userEvent.type(
      body().getByLabelText("Destination address"),
      "100 Main Street",
    );
    await save();
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: "sam",
            dependencies: ["waiting"],
            blockingNote: "Wait for confirmation",
            context: "Away from home",
            travelMode: "BICYCLE",
            outdoor: true,
          }),
        }),
      ),
    );
  },
};
