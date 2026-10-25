import { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { WorkspaceProvider, useWorkspace } from "../components/workspace";
import { TaskPanel } from "../components/TaskPanel";
import { DailyContent, RoutineApply } from "../components/Planning";
import { Backups } from "../components/Backups";
import { TaskLocation } from "../components/Travel";
import { recordsOf } from "../lib/types";
import type { Routine, Task } from "../lib/types";
import {
  demoDay,
  exampleTask,
  getMockWorkspace,
  patchMockTask,
} from "./fixtures";

function Content({
  screen,
  taskId,
  onClose,
  onEdit,
  onOpen,
}: {
  screen:
    | "inspector"
    | "notes"
    | "essentials"
    | "review"
    | "routine"
    | "backups"
    | "travel";
  taskId: string;
  onClose: () => void;
  onEdit: () => void;
  onOpen: (id: string) => void;
}) {
  const { workspace } = useWorkspace();
  const task = recordsOf<Task>(workspace.records, "task").find(
    (t) => t.id === taskId,
  )!;
  if (screen === "backups") return <Backups onSettings={onEdit} />;
  if (screen === "routine")
    return (
      <RoutineApply
        routine={recordsOf<Routine>(workspace.records, "routine")[0]}
        personId="alex"
        day={demoDay}
        onClose={onClose}
      />
    );
  if (screen === "travel") return <TaskLocation task={task} onSaved={fn()} />;
  if (screen !== "inspector")
    return (
      <DailyContent
        personId="alex"
        day={demoDay}
        mode={screen}
        onClose={onClose}
      />
    );
  return (
    <div className="story-inspector">
      <TaskPanel
        task={task}
        personId="alex"
        day={demoDay}
        onClose={onClose}
        onEdit={onEdit}
        onOpen={onOpen}
      />
    </div>
  );
}
function Workflow(props: ComponentProps<typeof Content>) {
  return (
    <WorkspaceProvider>
      <Content {...props} />
    </WorkspaceProvider>
  );
}
const meta = {
  title: "Workflows/Interactions",
  component: Workflow,
  args: {
    screen: "inspector",
    taskId: "presentation",
    onClose: fn(),
    onEdit: fn(),
    onOpen: fn(),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Workflow>;
export default meta;
type Story = StoryObj<typeof meta>;
const body = () => within(document.body);
export const CompleteTask: Story = {
  play: async () => {
    await userEvent.selectOptions(
      await body().findByLabelText("Status"),
      "Done",
    );
    await waitFor(() => expect(exampleTask().data.status).toBe("Done"));
    await expect(body().getByLabelText("Status")).toHaveValue("Done");
  },
};
export const ChecklistAndReferences: Story = {
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByLabelText("Complete Choose examples"),
    );
    await waitFor(() =>
      expect(exampleTask().data.checklist[0].done).toBe(true),
    );
    await userEvent.click(
      body().getByRole("button", { name: "Presentation outline" }),
    );
    await expect(args.onOpen).toHaveBeenCalledWith("outline");
    await userEvent.click(
      body().getByRole("button", { name: "Edit all details" }),
    );
    await expect(args.onEdit).toHaveBeenCalled();
  },
};
export const Activity: Story = {
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Activity" }),
    );
    await expect(body().getByText("Added a task")).toBeVisible();
    await userEvent.click(body().getByRole("button", { name: "Details" }));
    await expect(
      body().getByRole("heading", { name: "Task actions" }),
    ).toBeVisible();
  },
};
export const ArchiveAndUndo: Story = {
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Archive" }),
    );
    await waitFor(() => expect(exampleTask().data.archived).toBe(true));
    await userEvent.click(await body().findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(exampleTask().data.archived).toBe(false));
  },
};
export const RestoreFromTrash: Story = {
  beforeEach: () =>
    patchMockTask("presentation", { deletedAt: "2026-10-24T12:00:00Z" }),
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Restore from Trash" }),
    );
    await waitFor(() => expect(exampleTask().data.deletedAt).toBe(""));
  },
};
export const ReassignWithConfirmation: Story = {
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: /Owner · Alex/ }),
    );
    const dialog = within(
      await body().findByRole("dialog", { name: "Reassign task?" }),
    );
    await userEvent.selectOptions(dialog.getByLabelText("New owner"), "sam");
    expect(exampleTask().data.ownerId).toBe("alex");
    await userEvent.click(
      dialog.getByRole("button", { name: "Confirm owner change" }),
    );
    await waitFor(() => expect(exampleTask().data.ownerId).toBe("sam"));
    await expect(
      await body().findByRole("button", { name: /Owner · Sam/ }),
    ).toBeVisible();
  },
};
export const DailyNote: Story = {
  args: { screen: "notes" },
  play: async ({ args }) => {
    const field = await body().findByRole("textbox", { name: "Daily note" });
    await userEvent.clear(field);
    await userEvent.type(field, "Keep the afternoon open.");
    await userEvent.click(body().getByRole("button", { name: "Save" }));
    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
    expect(
      getMockWorkspace().records.find((r) => r.id === `plan-alex-${demoDay}`)
        ?.data.notes,
    ).toBe("Keep the afternoon open.");
  },
};
export const DailyEssentials: Story = {
  args: { screen: "essentials" },
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByLabelText("Complete Water bottle"),
    );
    await userEvent.click(body().getByLabelText("Pin on Today"));
    await userEvent.click(body().getByRole("button", { name: "Save" }));
    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
    const plan = getMockWorkspace().records.find(
      (r) => r.id === `plan-alex-${demoDay}`,
    )!;
    expect(plan.data.essentials).toEqual([
      expect.objectContaining({ done: true }),
    ]);
  },
};
export const ReviewDecisions: Story = {
  args: { screen: "review" },
  play: async () => {
    await userEvent.selectOptions(
      await body().findByLabelText("Apply to all unfinished one-off tasks"),
      "someday",
    );
    await expect(
      body().getByLabelText("Review Prepare team presentation"),
    ).toHaveValue("someday");
    await expect(
      body().getByLabelText("Review Walk through the park"),
    ).toHaveValue("someday");
    await userEvent.selectOptions(
      body().getByLabelText("Review Walk through the park"),
      "unchanged",
    );
    await expect(
      body().getByLabelText("Review Prepare team presentation"),
    ).toHaveValue("someday");
    await expect(
      body().getByLabelText("Review Walk through the park"),
    ).toHaveValue("unchanged");
    await userEvent.type(
      body().getByLabelText("Reflection and accomplishments"),
      "The presentation is ready.",
    );
  },
};
export const RoutineSelection: Story = {
  args: { screen: "routine" },
  play: async () => {
    const button = await body().findByRole("button", { name: "Add 1 tasks" });
    await userEvent.click(
      body().getByRole("checkbox", { name: /Clear surfaces/ }),
    );
    await expect(
      body().getByRole("button", { name: "Add 0 tasks" }),
    ).toBeDisabled();
    await userEvent.click(
      body().getByRole("checkbox", { name: /Clear surfaces/ }),
    );
    await expect(button).toBeEnabled();
    await userEvent.selectOptions(body().getByLabelText("Person"), "");
    await expect(button).toBeDisabled();
    await userEvent.selectOptions(body().getByLabelText("Person"), "sam");
    await expect(button).toBeEnabled();
  },
};
export const BackupControls: Story = {
  args: { screen: "backups" },
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByRole("button", { name: "Run backup now" }),
    );
    await waitFor(() =>
      expect(
        body().queryByText("Backing up records and attachments…"),
      ).not.toBeInTheDocument(),
    );
    await expect(
      body().getByRole("link", { name: "Export CSV" }),
    ).toHaveAttribute("href", "/api/export?format=csv");
    await userEvent.click(
      body().getByRole("button", { name: "Schedule & retention" }),
    );
    await expect(args.onEdit).toHaveBeenCalled();
  },
};
export const RouteUnavailable: Story = {
  args: { screen: "travel", taskId: "walk" },
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Check route" }),
    );
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "manual travel estimate",
    );
    await expect(
      body().getByText(/travel$/, { selector: "strong" }),
    ).toHaveTextContent("15 min");
    await expect(
      body().getByRole("link", { name: "Directions" }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("destination=Golden%20Gate%20Park"),
    );
  },
};
export const WeatherMissingCoordinates: Story = {
  args: { screen: "travel", taskId: "walk" },
  beforeEach: () => patchMockTask("walk", { latitude: null, longitude: null }),
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Check weather" }),
    );
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "Add coordinates",
    );
    await expect(
      body().getByRole("link", { name: "Directions" }),
    ).toBeVisible();
  },
};
