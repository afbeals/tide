import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { EntityEditor } from "../components/EntityEditor";
import { WorkspaceProvider } from "../components/workspace";
import { demoDay, exampleTask, resetWorkspace } from "./fixtures";
function EditorShowcase(props: React.ComponentProps<typeof EntityEditor>) {
  return (
    <WorkspaceProvider>
      <EntityEditor {...props} />
    </WorkspaceProvider>
  );
}
const meta = {
  title: "Editors/Records",
  component: EditorShowcase,
  args: {
    kind: "task",
    personId: "alex",
    day: demoDay,
    onClose: fn(),
    onSaved: fn(),
  },
  tags: ["autodocs"],
} satisfies Meta<typeof EditorShowcase>;
export default meta;
type Story = StoryObj<typeof meta>;
const body = () => within(document.body);
export const NewTask: Story = {};
export const ExistingTask: Story = {
  args: { entity: { ...exampleTask(), data: { ...exampleTask().data } } },
};
export const ValidationAndSave: Story = {
  play: async ({ args }) => {
    const dialog = within(
      await body().findByRole("dialog", { name: "Create task" }),
    );
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(dialog.getByRole("alert")).toHaveTextContent(
      "A title is required",
    );
    await userEvent.type(
      dialog.getByLabelText("Task title *", { exact: true }),
      "A useful new task",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(args.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "A useful new task",
            ownerId: "alex",
          }),
        }),
      ),
    );
  },
};
export const SaveFailure: Story = {
  beforeEach: () => resetWorkspace({ failWrites: true }),
  play: async () => {
    const dialog = within(
      await body().findByRole("dialog", { name: "Create task" }),
    );
    await userEvent.type(
      dialog.getByLabelText("Task title *", { exact: true }),
      "Keep my interrupted work",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Your draft is preserved",
    );
    await expect(
      dialog.getByLabelText("Task title *", { exact: true }),
    ).toHaveValue("Keep my interrupted work");
  },
};
export const Saving: Story = {
  beforeEach: () => resetWorkspace({ writeDelay: 600 }),
  play: async ({ args }) => {
    const dialog = within(
      await body().findByRole("dialog", { name: "Create task" }),
    );
    await userEvent.type(
      dialog.getByLabelText("Task title *", { exact: true }),
      "Wait for server acceptance",
    );
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(
      await dialog.findByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
    await waitFor(() => expect(args.onSaved).toHaveBeenCalled());
  },
};
export const RecoveredDraft: Story = {
  beforeEach: () => {
    localStorage.setItem(
      "tide:draft:new-task",
      JSON.stringify({
        data: { ...exampleTask().data, title: "Recovered device note" },
        generation: "storybook",
      }),
    );
  },
};
export const Project: Story = { args: { kind: "project" } };
export const Routine: Story = { args: { kind: "routine" } };
export const Reference: Story = {
  args: { kind: "reference", initial: { type: "Checklist" } },
};
export const SavedPlace: Story = {
  args: {
    kind: "place",
    initial: {
      name: "Park",
      address: "San Francisco, CA",
      latitude: 37.7694,
      longitude: -122.4862,
    },
  },
  play: async () => {
    const dialog = within(
      await body().findByRole("dialog", { name: "Create place" }),
    );
    await expect(
      dialog.getByLabelText("Longitude", { exact: true }),
    ).toHaveValue(-122.4862);
    await expect(
      dialog.getByLabelText("Longitude", { exact: true }),
    ).toBeValid();
  },
};
export const Availability: Story = {
  args: { kind: "availability", initial: { personId: "alex" } },
};
export const Person: Story = { args: { kind: "person" } };
export const SavedView: Story = { args: { kind: "view" } };
export const Outing: Story = { args: { kind: "outing" } };
export const WorkspaceSettings: Story = { args: { kind: "settings" } };
