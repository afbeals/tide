import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { http, HttpResponse } from "msw";
import { TaskPanel } from "../components/TaskPanel";
import { WorkspaceProvider, useWorkspace } from "../components/workspace";
import { recordsOf } from "../lib/types";
import type { Task } from "../lib/types";
import {
  demoDay,
  editMockWorkspace,
  exampleTask,
  getMockWorkspace,
  patchMockTask,
  record,
  resetWorkspace,
} from "./fixtures";

function LivePanel(props: Omit<ComponentProps<typeof TaskPanel>, "task">) {
  const { workspace } = useWorkspace();
  return (
    <div className="story-inspector">
      <TaskPanel
        {...props}
        task={recordsOf<Task>(workspace.records, "task").find(
          (r) => r.id === "presentation",
        )!}
      />
    </div>
  );
}
function Inspector(props: ComponentProps<typeof LivePanel>) {
  return (
    <WorkspaceProvider>
      <LivePanel {...props} />
    </WorkspaceProvider>
  );
}
const meta = {
  title: "Workflows/Inspector recovery",
  component: Inspector,
  args: {
    personId: "alex",
    day: demoDay,
    onClose: fn(),
    onEdit: fn(),
    onOpen: fn(),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Inspector>;
export default meta;
type Story = StoryObj<typeof meta>;
const body = () => within(document.body);
const calls = fn();
const timerHandler = http.post("/api/timer", async ({ request }) => {
  const payload = (await request.json()) as {
    action: string;
    personId: string;
    taskId: string;
    durationSeconds: number;
    confirm: boolean;
    version?: number;
  };
  calls(payload);
  editMockWorkspace((w) => {
    const previous = w.records.find(
      (r) => r.kind === "timeLog" && !r.data.stoppedAt,
    );
    if (payload.action === "start")
      w.records.push(
        record("timeLog", "timer", {
          personId: payload.personId,
          taskId: payload.taskId,
          durationSeconds: payload.durationSeconds,
          startedAt: new Date().toISOString(),
          elapsedSeconds: 0,
          running: true,
          stoppedAt: "",
        }),
      );
    else if (previous) {
      previous.version++;
      previous.data = {
        ...previous.data,
        running: payload.action === "resume",
        stoppedAt: payload.action === "stop" ? new Date().toISOString() : "",
      };
    }
  });
  return HttpResponse.json({ ok: true });
});
export const TimerLifecycle: Story = {
  parameters: { msw: { handlers: [timerHandler] } },
  play: async () => {
    const minutes = await body().findByLabelText("Focus minutes");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "10");
    await userEvent.click(body().getByRole("button", { name: "Start" }));
    await userEvent.click(await body().findByRole("button", { name: "Pause" }));
    await userEvent.click(
      await body().findByRole("button", { name: "Resume" }),
    );
    await userEvent.click(await body().findByRole("button", { name: "Stop" }));
    await expect(
      await body().findByRole("button", { name: "Start" }),
    ).toBeEnabled();
    await expect(calls.mock.calls.map((c) => c[0].action)).toEqual([
      "start",
      "pause",
      "resume",
      "stop",
    ]);
    await expect(calls).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "presentation",
        personId: "alex",
        durationSeconds: 600,
      }),
    );
    await expect(calls).toHaveBeenLastCalledWith(
      expect.objectContaining({ version: 3 }),
    );
  },
};
export const TimerSwitchConfirmation: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/timer", async ({ request }) => {
          const payload = (await request.json()) as { confirm: boolean };
          calls(payload);
          return payload.confirm
            ? HttpResponse.json({ ok: true })
            : HttpResponse.json({ error: "Already active" }, { status: 409 });
        }),
      ],
    },
  },
  play: async () => {
    await userEvent.click(await body().findByRole("button", { name: "Start" }));
    const dialog = within(
      await body().findByRole("dialog", { name: "Switch active timer?" }),
    );
    await expect(calls).toHaveBeenCalledTimes(1);
    await userEvent.click(
      dialog.getByRole("button", { name: "Stop current & start this task" }),
    );
    await waitFor(() =>
      expect(calls).toHaveBeenLastCalledWith(
        expect.objectContaining({ confirm: true }),
      ),
    );
    await waitFor(() =>
      expect(body().queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};
export const TimerFailure: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/timer", () =>
          HttpResponse.json(
            { error: "Timer storage unavailable" },
            { status: 503 },
          ),
        ),
      ],
    },
  },
  play: async () => {
    await userEvent.click(await body().findByRole("button", { name: "Start" }));
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "Timer storage unavailable",
    );
  },
};
export const ChoosePersonForTimer: Story = {
  args: { personId: "all" },
  play: async () => {
    await expect(
      await body().findByRole("button", { name: "Start" }),
    ).toBeDisabled();
    await expect(
      body().getByText("Choose a planning person to use a timer."),
    ).toBeVisible();
  },
};
export const NotesAutosave: Story = {
  play: async () => {
    const input = await body().findByRole("textbox", {
      name: "Rich text notes",
    });
    await userEvent.clear(input);
    await userEvent.type(input, "A durable task note");
    await expect(body().getByRole("status")).toHaveTextContent(
      "Draft saved on this device",
    );
    await waitFor(
      () => expect(exampleTask().data.notes).toContain("A durable task note"),
      { timeout: 4000 },
    );
    await waitFor(() =>
      expect(body().getByRole("status")).toHaveTextContent("Saved"),
    );
    await expect(localStorage.getItem("tide:notes:presentation")).toBeNull();
  },
};
function recoveredNotes() {
  localStorage.setItem(
    "tide:notes:presentation",
    JSON.stringify({
      notes: "<p>Recovered draft text</p>",
      version: 1,
      generation: "storybook",
    }),
  );
}
export const NotesRecoveryPreview: Story = { beforeEach: recoveredNotes };
export const RecoveredNotesUseServer: Story = {
  beforeEach: recoveredNotes,
  play: async () => {
    await expect(await body().findByRole("status")).toHaveTextContent(
      "Recovered device draft",
    );
    await userEvent.click(
      body().getByRole("button", { name: "Use server notes" }),
    );
    await expect(
      body().getByRole("textbox", { name: "Rich text notes" }),
    ).toHaveTextContent("Lead with the customer problem.");
    await expect(localStorage.getItem("tide:notes:presentation")).toBeNull();
  },
};
export const RecoveredNotesSave: Story = {
  beforeEach: recoveredNotes,
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Save reviewed draft" }),
    );
    await waitFor(() =>
      expect(exampleTask().data.notes).toBe("<p>Recovered draft text</p>"),
    );
    await expect(localStorage.getItem("tide:notes:presentation")).toBeNull();
  },
};
export const NotesWriteFailure: Story = {
  beforeEach: () => resetWorkspace({ failWrites: true }),
  play: async () => {
    const input = await body().findByRole("textbox", {
      name: "Rich text notes",
    });
    await userEvent.clear(input);
    await userEvent.type(input, "Recover this after reconnecting");
    await expect(
      await body().findByRole("alert", {}, { timeout: 4000 }),
    ).toHaveTextContent("Your draft is preserved");
    await expect(
      body().getByRole("button", { name: "Save reviewed draft" }),
    ).toBeEnabled();
    await expect(
      JSON.parse(localStorage.getItem("tide:notes:presentation")!).notes,
    ).toContain("Recover this after reconnecting");
  },
};
export const NotesConflictUseServer: Story = {
  parameters: {
    msw: {
      handlers: [
        http.patch("/api/records/:id", () =>
          HttpResponse.json(
            {
              error: "Notes changed in another browser",
              current: {
                ...exampleTask(),
                version: 2,
                data: {
                  ...exampleTask().data,
                  notes: "<p>New server notes</p>",
                },
              },
            },
            { status: 409 },
          ),
        ),
      ],
    },
  },
  play: async () => {
    const input = await body().findByRole("textbox", {
      name: "Rich text notes",
    });
    await userEvent.clear(input);
    await userEvent.type(input, "My draft notes");
    await expect(
      await body().findByRole("alert", {}, { timeout: 4000 }),
    ).toHaveTextContent("Notes changed");
    await expect(
      body().getByRole("heading", { name: "Saved notes" }),
    ).toBeVisible();
    await userEvent.click(
      body().getByRole("button", { name: "Use server notes" }),
    );
    await expect(input).toHaveTextContent("New server notes");
    await expect(body().queryByRole("alert")).not.toBeInTheDocument();
  },
};
function recurrence() {
  patchMockTask("presentation", { seriesId: "walk", occurrenceDay: demoDay });
}
export const RecurrenceOccurrenceOnly: Story = {
  beforeEach: recurrence,
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByRole("button", { name: "Edit recurrence / scope" }),
    );
    await userEvent.click(
      body().getByRole("button", { name: "This occurrence only" }),
    );
    await expect(args.onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "presentation" }),
    );
  },
};
export const RecurrenceFutureScope: Story = {
  beforeEach: recurrence,
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByRole("button", { name: "Edit recurrence / scope" }),
    );
    await userEvent.click(
      body().getByRole("button", { name: "This and future occurrences" }),
    );
    await expect(args.onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: "walk" }),
      demoDay,
    );
  },
};
export const SkipOccurrence: Story = {
  beforeEach: recurrence,
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Skip this occurrence" }),
    );
    await waitFor(() => expect(exampleTask().data.outcome).toBe("skipped"));
  },
};
export const ReassignAndPlan: Story = {
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: /Owner · Alex/ }),
    );
    const dialog = within(
      await body().findByRole("dialog", { name: "Reassign task?" }),
    );
    await userEvent.selectOptions(dialog.getByLabelText("New owner"), "sam");
    await userEvent.click(dialog.getByRole("checkbox", { name: /Add to Sam/ }));
    await userEvent.click(
      dialog.getByRole("button", { name: "Confirm owner change" }),
    );
    await waitFor(() =>
      expect(
        getMockWorkspace().records.find((r) => r.kind === "plan")?.data,
      ).toEqual(
        expect.objectContaining({ personId: "sam", taskIds: ["presentation"] }),
      ),
    );
  },
};
