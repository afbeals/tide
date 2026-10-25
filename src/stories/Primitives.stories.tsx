import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  Checklist,
  Empty,
  ErrorMessage,
  Field,
  Minutes,
  Modal,
  StatusBadge,
} from "../components/ui";
import { RichText } from "../components/RichText";
import { statuses } from "../lib/types";

function ChecklistExample() {
  const [items, setItems] = useState([
    { id: "one", text: "Choose examples", done: false },
    { id: "two", text: "Check the outline", done: true },
  ]);
  return (
    <div className="story-panel">
      <h2>Presentation checklist</h2>
      <Checklist items={items} onChange={setItems} />
      <p role="status">
        {items.filter((i) => i.done).length} of {items.length} completed
      </p>
    </div>
  );
}
function NotesExample() {
  const [value, setValue] = useState("<p>Start with the customer.</p>");
  return (
    <div className="story-panel">
      <h2>Notes</h2>
      <RichText value={value} onChange={setValue} />
    </div>
  );
}
function ModalExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open confirmation</button>
      {open && (
        <Modal
          title="Move selected tasks?"
          description="Scheduled times will be cleared."
          onClose={() => setOpen(false)}
          footer={<button onClick={() => setOpen(false)}>Confirm move</button>}
        >
          <p>Your task history will be retained.</p>
        </Modal>
      )}
    </>
  );
}
const meta = {
  title: "Foundations/Components",
  tags: ["autodocs"],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Statuses: Story = {
  render: () => (
    <div className="story-stack">
      <h2>Task statuses</h2>
      {statuses.map((s) => (
        <StatusBadge key={s} status={s} />
      ))}
      <p>
        Estimates: <Minutes value={0} /> · <Minutes value={30} /> ·{" "}
        <Minutes value={60} /> · <Minutes value={95} />
      </p>
    </div>
  ),
};
export const EmptyState: Story = {
  render: () => (
    <Empty
      title="A little room to breathe"
      description="Add a task when something comes to mind."
      action={<button onClick={fn()}>Add a task</button>}
    />
  ),
};
export const Validation: Story = {
  render: () => (
    <div className="story-panel">
      <h2>Task details</h2>
      <Field label="Task title" hint="Choose a useful, specific title.">
        <input
          aria-invalid="true"
          aria-describedby="title-error"
          defaultValue=""
        />
      </Field>
      <div id="title-error">
        <ErrorMessage error="A title is required." />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Task title")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "A title is required.",
    );
  },
};
export const EditableChecklist: Story = {
  render: () => <ChecklistExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Complete Choose examples"));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "2 of 2 completed",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Add checklist item" }),
    );
    await expect(canvas.getAllByLabelText("Checklist item")).toHaveLength(3);
    await userEvent.type(
      canvas.getAllByLabelText("Checklist item")[2],
      "Practice the opening",
    );
    await userEvent.click(
      canvas.getAllByRole("button", { name: "Move item up" })[2],
    );
    await expect(canvas.getAllByLabelText("Checklist item")[1]).toHaveValue(
      "Practice the opening",
    );
    await userEvent.click(
      canvas.getAllByRole("button", { name: "Remove item" })[1],
    );
    await expect(canvas.getAllByLabelText("Checklist item")).toHaveLength(2);
  },
};
export const RichNotes: Story = {
  render: () => <NotesExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole("textbox", {
      name: "Rich text notes",
    });
    await userEvent.clear(input);
    await userEvent.type(input, "A clearer opening.");
    await expect(input).toHaveTextContent("A clearer opening.");
    await userEvent.click(canvas.getByRole("button", { name: "Bold" }));
    await expect(canvas.getByRole("button", { name: "Bold" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
export const ReadOnlyNotes: Story = {
  render: () => (
    <div className="story-panel">
      <h2>Reference material</h2>
      <RichText
        value="<h3>Start here</h3><p>Bring the outline and three useful examples.</p>"
        readOnly
      />
    </div>
  ),
};
export const Confirmation: Story = {
  render: () => <ModalExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Open confirmation" });
    await userEvent.click(button);
    const body = within(document.body);
    await expect(
      body.getByRole("dialog", { name: "Move selected tasks?" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(body.queryByRole("dialog")).not.toBeInTheDocument();
    await expect(button).toHaveFocus();
  },
};
export const FormattedNotes: Story = {
  render: () => <NotesExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole("textbox", {
      name: "Rich text notes",
    });
    await userEvent.clear(input);
    await userEvent.click(canvas.getByRole("button", { name: "Italic" }));
    await userEvent.type(input, "A useful thought");
    await expect(input.querySelector("em")).toHaveTextContent(
      "A useful thought",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Italic" }));
    await userEvent.click(canvas.getByRole("button", { name: "Heading" }));
    await expect(
      within(input).getByRole("heading", { name: "A useful thought" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Heading" }));
    await userEvent.click(canvas.getByRole("button", { name: "List" }));
    await expect(within(input).getByRole("listitem")).toHaveTextContent(
      "A useful thought",
    );
  },
};
export const SafeNoteLinks: Story = {
  render: () => <NotesExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole("textbox", {
      name: "Rich text notes",
    });
    const previous = window.prompt;
    try {
      await userEvent.clear(input);
      window.prompt = () => "javascript:alert(1)";
      await userEvent.click(canvas.getByRole("button", { name: "Link" }));
      await userEvent.type(input, "Safe text ");
      await expect(within(input).queryByRole("link")).not.toBeInTheDocument();
      window.prompt = () => "https://example.com/guide";
      await userEvent.click(canvas.getByRole("button", { name: "Link" }));
      await userEvent.type(input, "Read the guide");
      await expect(
        within(input).getByRole("link", { name: "Read" }),
      ).toHaveAttribute("href", "https://example.com/guide");
    } finally {
      window.prompt = previous;
    }
  },
};
