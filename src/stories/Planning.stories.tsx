import { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { http, HttpResponse } from "msw";
import {
  DailyContent,
  PlanningWizard,
  RoutineApply,
} from "../components/Planning";
import { WorkspaceProvider } from "../components/workspace";
import {
  demoDay,
  editMockWorkspace,
  getMockWorkspace,
  record,
} from "./fixtures";
import { recordsOf } from "../lib/types";
import type { Routine } from "../lib/types";
function Planner(props: ComponentProps<typeof PlanningWizard>) {
  return (
    <WorkspaceProvider>
      <PlanningWizard {...props} />
    </WorkspaceProvider>
  );
}
const meta = {
  title: "Planning/Plan a day",
  component: Planner,
  args: { personId: "alex", day: demoDay, onClose: fn(), onOpen: fn() },
  tags: ["autodocs"],
} satisfies Meta<typeof Planner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SelectTasks: Story = {};
export const ShapeDay: Story = {
  beforeEach: () =>
    localStorage.setItem(
      `tide:planning:alex:${demoDay}`,
      JSON.stringify({
        step: 2,
        ids: ["presentation", "walk"],
        focus: ["presentation"],
        edits: {},
        generation: "storybook",
        version: 1,
      }),
    ),
};
export const ReviewCapacity: Story = {
  beforeEach: () =>
    localStorage.setItem(
      `tide:planning:alex:${demoDay}`,
      JSON.stringify({
        step: 3,
        ids: ["presentation", "walk"],
        focus: ["presentation"],
        edits: {},
        generation: "storybook",
        version: 1,
      }),
    ),
};
export const SavePlan: Story = {
  play: async ({ args }) => {
    const dialog = within(
      await within(document.body).findByRole("dialog", {
        name: "Plan Alex’s day",
      }),
    );
    for (let i = 0; i < 3; i++)
      await userEvent.click(dialog.getByRole("button", { name: "Continue" }));
    await userEvent.click(dialog.getByRole("button", { name: "Save plan" }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};
const body = () => within(document.body);
const savedPlan = fn();
const capturePlan = http.post("/api/plan", async ({ request }) => {
  const payload = (await request.json()) as { data: Record<string, unknown> };
  savedPlan(payload);
  return HttpResponse.json(
    record("plan", `plan-alex-${demoDay}`, payload.data),
  );
});
export const ShapeAndSaveChanges: Story = {
  parameters: { msw: { handlers: [capturePlan] } },
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByRole("button", { name: "Continue" }),
    );
    await userEvent.click(
      body().getAllByRole("button", { name: "Move task down" })[0],
    );
    await userEvent.click(
      body().getAllByRole("button", { name: "Move task up" })[1],
    );
    const estimates = body().getAllByLabelText("Estimate (minutes)");
    await userEvent.clear(estimates[0]);
    await userEvent.type(estimates[0], "45");
    await userEvent.selectOptions(
      body().getAllByLabelText("Untimed grouping")[0],
      "Morning",
    );
    await userEvent.click(
      body().getAllByRole("checkbox", { name: "Today’s focus" })[1],
    );
    await userEvent.click(body().getByRole("button", { name: "Continue" }));
    await userEvent.click(
      body().getByRole("button", {
        name: "Review weather / travel: Walk through the park",
      }),
    );
    await expect(args.onOpen).toHaveBeenCalledWith("walk");
    await userEvent.click(body().getByRole("button", { name: "Back" }));
    await expect(body().getAllByLabelText("Estimate (minutes)")[0]).toHaveValue(
      45,
    );
    await userEvent.click(body().getByRole("button", { name: "Continue" }));
    await userEvent.click(body().getByRole("button", { name: "Continue" }));
    await userEvent.click(body().getByRole("button", { name: "Save plan" }));
    await waitFor(() =>
      expect(savedPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          data: expect.objectContaining({
            taskIds: ["presentation", "walk"],
            focusIds: ["presentation"],
          }),
          taskEdits: expect.arrayContaining([
            expect.objectContaining({
              id: "presentation",
              version: 1,
              data: expect.objectContaining({
                estimate: 45,
                dayPart: "Morning",
                ownerId: "alex",
                plannedDay: demoDay,
              }),
            }),
          ]),
        }),
      ),
    );
  },
};
export const InterruptedPlanAfterRestore: Story = {
  beforeEach: () =>
    localStorage.setItem(
      `tide:planning:alex:${demoDay}`,
      JSON.stringify({
        step: 4,
        ids: ["presentation"],
        focus: [],
        edits: {},
        version: 1,
        generation: "before-restore",
      }),
    ),
  parameters: { msw: { handlers: [capturePlan] } },
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByRole("button", { name: "Save plan" }),
    );
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "The workspace was restored",
    );
    await expect(savedPlan).not.toHaveBeenCalled();
    await expect(args.onClose).not.toHaveBeenCalled();
    await userEvent.click(
      body().getByRole("button", {
        name: "I have reviewed the current plan; retry my selections",
      }),
    );
    await userEvent.click(body().getByRole("button", { name: "Save plan" }));
    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
    await expect(
      localStorage.getItem(`tide:planning:alex:${demoDay}`),
    ).toBeNull();
  },
};
export const PlanServerFailure: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/plan", () =>
          HttpResponse.json(
            { error: "A task changed; review the plan" },
            { status: 409 },
          ),
        ),
      ],
    },
  },
  play: async ({ args }) => {
    await body().findByRole("button", { name: "Continue" });
    for (let i = 0; i < 3; i++)
      await userEvent.click(body().getByRole("button", { name: "Continue" }));
    await userEvent.click(body().getByRole("button", { name: "Save plan" }));
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "A task changed",
    );
    await expect(
      localStorage.getItem(`tide:planning:alex:${demoDay}`),
    ).not.toBeNull();
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};
const routineCall = fn();
export const ApplyRoutineFromPlanner: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/routine-apply", async ({ request }) => {
          routineCall(await request.json());
          const task = record("task", "from-routine", {
            ...getMockWorkspace().records.find((r) => r.id === "presentation")!
              .data,
            title: "Clear surfaces",
          });
          editMockWorkspace((w) => w.records.push(task));
          return HttpResponse.json([task]);
        }),
      ],
    },
  },
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Sunday reset" }),
    );
    const dialog = within(
      await body().findByRole("dialog", { name: "Add Sunday reset" }),
    );
    await userEvent.click(dialog.getByRole("button", { name: "Add 1 tasks" }));
    await waitFor(() =>
      expect(routineCall).toHaveBeenCalledWith(
        expect.objectContaining({
          routineId: "reset",
          personId: "alex",
          day: demoDay,
          indices: [0],
          operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
      ),
    );
    await userEvent.click(body().getByRole("button", { name: "Continue" }));
    await expect(
      body().getByText("Clear surfaces", { exact: true }),
    ).toBeVisible();
  },
};
export const RoutineApplyFailure: Story = {
  render: ({ onClose }) => (
    <WorkspaceProvider>
      <RoutineApply
        routine={recordsOf<Routine>(getMockWorkspace().records, "routine")[0]}
        personId="alex"
        day={demoDay}
        onClose={onClose}
      />
    </WorkspaceProvider>
  ),
  parameters: {
    msw: {
      handlers: [
        http.post("/api/routine-apply", () =>
          HttpResponse.json(
            { error: "Routine was changed. Review templates." },
            { status: 409 },
          ),
        ),
      ],
    },
  },
  play: async ({ args }) => {
    await userEvent.click(
      await body().findByRole("button", { name: "Add 1 tasks" }),
    );
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "Review templates",
    );
    await expect(args.onClose).not.toHaveBeenCalled();
    await expect(
      body().getByRole("button", { name: "Add 1 tasks" }),
    ).toBeEnabled();
  },
};
const reviewCall = fn();
export const ReviewSavesExplicitDecisions: Story = {
  render: ({ onClose }) => (
    <WorkspaceProvider>
      <DailyContent
        mode="review"
        personId="alex"
        day={demoDay}
        onClose={onClose}
      />
    </WorkspaceProvider>
  ),
  parameters: {
    msw: {
      handlers: [
        http.post("/api/review", async ({ request }) => {
          reviewCall(await request.json());
          return HttpResponse.json({ ok: true });
        }),
      ],
    },
  },
  play: async ({ args }) => {
    await userEvent.selectOptions(
      await body().findByLabelText("Review Prepare team presentation"),
      "tomorrow",
    );
    await userEvent.selectOptions(
      body().getByLabelText("Review Walk through the park"),
      "archive",
    );
    await userEvent.type(
      body().getByLabelText("Reflection and accomplishments"),
      "Made space for tomorrow.",
    );
    await userEvent.click(body().getByRole("button", { name: "Save" }));
    await waitFor(() => expect(args.onClose).toHaveBeenCalled());
    await expect(reviewCall).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewed: true,
          reflection: "Made space for tomorrow.",
        }),
        version: 1,
        decisions: [
          { id: "presentation", version: 1, action: "move", day: "2026-10-25" },
          { id: "walk", version: 1, action: "archive", day: "2026-10-25" },
        ],
      }),
    );
  },
};
export const DailyNoteFailure: Story = {
  render: ({ onClose }) => (
    <WorkspaceProvider>
      <DailyContent
        mode="notes"
        personId="alex"
        day={demoDay}
        onClose={onClose}
      />
    </WorkspaceProvider>
  ),
  parameters: {
    msw: {
      handlers: [
        http.post("/api/plan", () =>
          HttpResponse.json(
            { error: "Plan changed in another browser" },
            { status: 409 },
          ),
        ),
      ],
    },
  },
  play: async ({ args }) => {
    const input = await body().findByRole("textbox", { name: "Daily note" });
    await userEvent.type(input, " Keep this text.");
    await userEvent.click(body().getByRole("button", { name: "Save" }));
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "Plan changed",
    );
    await expect(input).toHaveValue(
      "Leave room between things. Keep this text.",
    );
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};
