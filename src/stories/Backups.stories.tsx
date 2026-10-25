import { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { delay, http, HttpResponse } from "msw";
import { Backups } from "../components/Backups";
import { WorkspaceProvider } from "../components/workspace";

function BackupScreen(props: ComponentProps<typeof Backups>) {
  return (
    <WorkspaceProvider>
      <Backups {...props} />
    </WorkspaceProvider>
  );
}
const meta = {
  title: "Recovery/Backups",
  component: BackupScreen,
  args: { onSettings: fn() },
  tags: ["autodocs"],
} satisfies Meta<typeof BackupScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
const body = () => within(document.body);
const preview = {
  token: "preview-token",
  manifest: { at: "2026-10-24T12:00:00Z", counts: { task: 8, attachment: 2 } },
};
const restore = fn();
const upload = http.post("/api/restore-upload", async ({ request }) => {
  const data = await request.formData();
  expect(data.get("file")).toBeInstanceOf(File);
  return HttpResponse.json(preview);
});
const download = http.get(
  "/api/backup/:id",
  () =>
    new HttpResponse("isolated ZIP fixture", {
      headers: { "Content-Type": "application/zip" },
    }),
);
const restored = http.post("/api/backups", async ({ request }) => {
  restore(await request.json());
  return HttpResponse.json({ ok: true, generation: "restored" });
});
const failed = http.post("/api/backups", () =>
  HttpResponse.json(
    { error: "Storage is unavailable. Retry after checking the volume." },
    { status: 503 },
  ),
);
async function openPreview() {
  await userEvent.upload(
    await body().findByLabelText("Upload a backup"),
    new File(["fixture"], "tide.zip", { type: "application/zip" }),
  );
  return within(
    await body().findByRole("dialog", {
      name: "Replace everyone’s workspace?",
    }),
  );
}
export const EmptyHistory: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/backups", () =>
          HttpResponse.json({ history: [], next: null }),
        ),
      ],
    },
  },
  play: async () => {
    await expect(
      await body().findByText("Your first safety net"),
    ).toBeVisible();
    await expect(
      body().getByText(/Automatic backups are paused/),
    ).toBeVisible();
  },
};
export const CreateFailure: Story = {
  parameters: { msw: { handlers: [failed] } },
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Run backup now" }),
    );
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "Storage is unavailable",
    );
    await expect(
      body().getByRole("button", { name: "Run backup now" }),
    ).toBeEnabled();
  },
};
export const FailedHistoryRetry: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/backups", () =>
          HttpResponse.json({
            history: [
              {
                id: "failed",
                type: "automatic",
                status: "failed",
                at: "2026-10-24T12:00:00Z",
                bytes: 0,
                error: "Interrupted process",
              },
            ],
            next: null,
          }),
        ),
        failed,
      ],
    },
  },
  play: async () => {
    await expect(await body().findByText("Interrupted process")).toBeVisible();
    await userEvent.click(body().getByRole("button", { name: "Retry backup" }));
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "Storage is unavailable",
    );
  },
};
export const InvalidUpload: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post("/api/restore-upload", () =>
          HttpResponse.json(
            { error: "Backup integrity verification failed" },
            { status: 422 },
          ),
        ),
      ],
    },
  },
  play: async () => {
    await userEvent.upload(
      await body().findByLabelText("Upload a backup"),
      new File(["damaged"], "bad.zip", { type: "application/zip" }),
    );
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "integrity verification failed",
    );
    await expect(body().queryByRole("dialog")).not.toBeInTheDocument();
  },
};
export const RestorePreview: Story = {
  parameters: { msw: { handlers: [upload, restored] } },
  play: async () => {
    const dialog = await openPreview();
    await expect(
      dialog.getByRole("button", { name: "Replace shared workspace" }),
    ).toBeDisabled();
    await expect(dialog.getByText("attachment", { exact: true })).toBeVisible();
    await expect(
      dialog.getByText(/A safety backup is created first/),
    ).toBeVisible();
  },
};
export const CancelRestore: Story = {
  parameters: { msw: { handlers: [upload, restored] } },
  play: async () => {
    const dialog = await openPreview();
    await userEvent.click(dialog.getByRole("button", { name: "Cancel" }));
    await expect(body().queryByRole("dialog")).not.toBeInTheDocument();
    await expect(restore).not.toHaveBeenCalled();
  },
};
export const ConfirmRestore: Story = {
  parameters: { msw: { handlers: [upload, restored] } },
  play: async () => {
    const dialog = await openPreview();
    await userEvent.click(
      dialog.getByRole("checkbox", { name: /I understand this replaces/ }),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Replace shared workspace" }),
    );
    await waitFor(() =>
      expect(restore).toHaveBeenCalledWith({
        action: "restore",
        token: preview.token,
        confirm: true,
      }),
    );
    await waitFor(() =>
      expect(body().queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
};
export const RestoreInterrupted: Story = {
  parameters: {
    msw: {
      handlers: [
        upload,
        http.post("/api/backups", async () => {
          await delay(200);
          return HttpResponse.json(
            { error: "Restore interrupted. Your active data is retained." },
            { status: 503 },
          );
        }),
      ],
    },
  },
  play: async () => {
    const dialog = await openPreview();
    await userEvent.click(
      dialog.getByRole("checkbox", { name: /I understand this replaces/ }),
    );
    await userEvent.click(
      dialog.getByRole("button", { name: "Replace shared workspace" }),
    );
    await expect(
      await body().findByRole("dialog", {
        name: "Restoring shared workspace…",
      }),
    ).toBeVisible();
    await expect(
      body().getByRole("button", { name: "Restoring…" }),
    ).toBeDisabled();
    await expect(body().getByRole("button", { name: "Cancel" })).toBeDisabled();
    await waitFor(() =>
      expect(
        body()
          .getAllByRole("alert")
          .some((element) =>
            element.textContent?.includes("active data is retained"),
          ),
      ).toBe(true),
    );
    await expect(
      body().getByRole("dialog", { name: "Replace everyone’s workspace?" }),
    ).toBeVisible();
  },
};
export const RestoreFromHistory: Story = {
  parameters: { msw: { handlers: [upload, download] } },
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Restore" }),
    );
    await expect(
      await body().findByRole("dialog", {
        name: "Replace everyone’s workspace?",
      }),
    ).toBeVisible();
  },
};
export const MissingHistoryFile: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(
          "/api/backup/:id",
          () => new HttpResponse(null, { status: 404 }),
        ),
      ],
    },
  },
  play: async () => {
    await userEvent.click(
      await body().findByRole("button", { name: "Restore" }),
    );
    await expect(await body().findByRole("alert")).toHaveTextContent(
      "Could not retrieve backup",
    );
  },
};
