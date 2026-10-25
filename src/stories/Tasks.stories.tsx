import type { ComponentProps } from "react";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { WorkspaceProvider, useWorkspace } from "../components/workspace";
import {
  TaskRow,
  TaskList,
  TaskBoard,
  TaskTimeline,
} from "../components/TaskViews";
import { recordsOf } from "../lib/types";
import type { Task } from "../lib/types";
import {
  demoDay,
  exampleTask,
  patchMockTask,
  resetWorkspace,
} from "./fixtures";

function LiveTasks({
  mode,
  taskId,
  onOpen,
}: {
  mode: "row" | "list" | "board" | "timeline" | "empty";
  taskId: string;
  onOpen: (id: string) => void;
}) {
  const { workspace } = useWorkspace();
  const [selected, setSelected] = useState(new Set<string>());
  const tasks = recordsOf<Task>(workspace.records, "task");
  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  if (mode === "row")
    return (
      <TaskRow
        task={tasks.find((t) => t.id === taskId)!}
        onOpen={onOpen}
        selected={selected.has(taskId)}
        onSelect={toggle}
      />
    );
  if (mode === "board") return <TaskBoard tasks={tasks} onOpen={onOpen} />;
  if (mode === "timeline")
    return (
      <TaskTimeline
        tasks={tasks}
        onOpen={onOpen}
        day={demoDay}
        personId="alex"
      />
    );
  return (
    <TaskList
      tasks={mode === "empty" ? [] : tasks}
      onOpen={onOpen}
      selection={selected}
      onSelect={toggle}
    />
  );
}
function TaskShowcase(props: ComponentProps<typeof LiveTasks>) {
  return (
    <WorkspaceProvider>
      <LiveTasks {...props} />
      <TaskNotice />
    </WorkspaceProvider>
  );
}
function TaskNotice() {
  const { notice } = useWorkspace();
  return notice ? <p role="status">{notice}</p> : null;
}
const meta = {
  title: "Tasks/Views",
  component: TaskShowcase,
  tags: ["autodocs"],
  args: { mode: "row", taskId: "presentation", onOpen: fn() },
} satisfies Meta<typeof TaskShowcase>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OpenTask: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Open Prepare team presentation",
      }),
    );
    await expect(args.onOpen).toHaveBeenCalledWith("presentation");
    await userEvent.click(
      canvas.getByLabelText("Select Prepare team presentation"),
    );
    await expect(
      canvas.getByLabelText("Select Prepare team presentation"),
    ).toBeChecked();
  },
};
export const CompleteAndReopen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Complete Prepare team presentation",
      }),
    );
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Reopen Prepare team presentation",
      }),
    );
    await expect(
      await canvas.findByRole("button", {
        name: "Complete Prepare team presentation",
      }),
    ).toBeVisible();
  },
};
export const Unassigned: Story = { args: { taskId: "waiting" } };
export const Completed: Story = { args: { taskId: "done" } };
export const LongTitle: Story = {
  beforeEach: () =>
    patchMockTask("presentation", {
      title:
        "Prepare a thoughtful presentation with several customer examples and a longer explanation that still needs to remain readable on a small screen",
    }),
};
export const List: Story = {
  args: { mode: "list" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: /Completed · 1/ }),
    );
    await expect(
      canvas.getByRole("button", { name: "Reopen Clear the desk" }),
    ).toBeVisible();
  },
};
export const Board: Story = {
  args: { mode: "board" },
  beforeEach: () => resetWorkspace({ writeDelay: 250 }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      await canvas.findByRole("combobox", {
        name: "Status for Prepare team presentation",
      }),
      "In progress",
    );
    const heading = canvas.getByRole("heading", { name: /In progress/ });
    await expect(
      await within(heading.closest("section")!).findByRole("button", {
        name: "Prepare team presentation",
      }),
    ).toBeVisible();
  },
};
export const Timeline: Story = {
  args: { mode: "timeline" },
  beforeEach: () =>
    patchMockTask("presentation", {
      scheduledStart: "2026-10-24T16:00:00Z",
      scheduledEnd: "2026-10-24T17:00:00Z",
    }),
};
export const EmptyList: Story = { args: { mode: "empty" } };
export const KeepSomeday: Story = {
  args: { taskId: "someday" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Keep" }));
    await waitFor(() =>
      expect(exampleTask("someday").data.reviewedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T/,
      ),
    );
    await expect(canvas.getByText(/^Reviewed /)).toBeVisible();
  },
};
export const CompletionFailure: Story = {
  beforeEach: () => resetWorkspace({ failWrites: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Complete Prepare team presentation",
      }),
    );
    await expect(
      await within(document.body).findByText(
        "The server is unavailable. Your draft is preserved.",
      ),
    ).toHaveTextContent("Your draft is preserved");
    await expect(exampleTask().data.status).toBe("Open");
  },
};
export const BoardWriteFailure: Story = {
  args: { mode: "board" },
  beforeEach: () => resetWorkspace({ failWrites: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(
      await canvas.findByLabelText("Status for Prepare team presentation"),
      "Done",
    );
    await expect(
      await within(document.body).findByText(
        "The server is unavailable. Your draft is preserved.",
      ),
    ).toHaveTextContent("Your draft is preserved");
    await expect(exampleTask().data.status).toBe("Open");
  },
};
export const BoardPointerMove: Story = {
  args: { mode: "board" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const handle = await canvas.findByRole("button", {
      name: "Drag Prepare team presentation",
    });
    const column = canvas
      .getByRole("heading", { name: /^In progress/ })
      .closest("section")!;
    const from = handle.getBoundingClientRect();
    const to = column.getBoundingClientRect();
    const pointer = userEvent.setup();
    await pointer.pointer([
      {
        target: handle,
        keys: "[MouseLeft>]",
        coords: { clientX: from.x + 8, clientY: from.y + 8 },
      },
      { target: handle, coords: { clientX: from.x + 28, clientY: from.y + 8 } },
    ]);
    await waitFor(() =>
      expect(handle.closest("article")).toHaveClass("dragging"),
    );
    await pointer.pointer({
      target: column,
      coords: { clientX: to.x + to.width / 2, clientY: to.y + 80 },
    });
    await waitFor(() => expect(column).toHaveClass("drop-target"));
    await pointer.pointer({
      keys: "[/MouseLeft]",
      target: column,
      coords: { clientX: to.x + to.width / 2, clientY: to.y + 80 },
    });
    await waitFor(() => expect(exampleTask().data.status).toBe("In progress"));
  },
};
export const TimelineTravelAndOpen: Story = {
  args: { mode: "timeline" },
  beforeEach: () =>
    patchMockTask("walk", {
      scheduledStart: "2026-10-24T16:00:00Z",
      scheduledEnd: "",
      prepMinutes: 5,
      arrivalMinutes: 10,
    }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const travel = await canvas.findByText(
      "Travel & preparation · Walk through the park",
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    travel.closest("a")!.focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onOpen).toHaveBeenCalledWith("walk");
    await userEvent.click(
      canvas.getByRole("button", { name: /^Prepare team presentation/ }),
    );
    await expect(args.onOpen).toHaveBeenCalledWith("presentation");
  },
};
export const TimelineTravelLight: Story = {
  ...TimelineTravelAndOpen,
  globals: { theme: "light" },
};
