"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Upload, ShieldCheck, RefreshCw } from "lucide-react";
import { request, useWorkspace } from "./workspace";
import { Modal, ErrorMessage, Empty } from "./ui";

interface Backup {
  id: string;
  type: string;
  at: string;
  status: string;
  bytes: number;
  error?: string;
}
interface Preview {
  token: string;
  manifest: { at: string; counts: Record<string, number> };
}
export function Backups({ onSettings }: { onSettings: () => void }) {
  const { refresh, notify } = useWorkspace();
  const backups = useQuery({
    queryKey: ["backups"],
    queryFn: () =>
      request<{ history: Backup[]; next: string | null }>("backups"),
    refetchInterval: 5000,
  });
  const history = backups.data?.history || [];
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);
  async function load() {
    await backups.refetch();
  }
  async function validate(file: File) {
    setBusy("Validating backup…");
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      setPreview(await request<Preview>("restore-upload", form));
      setConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup validation failed");
    } finally {
      setBusy("");
    }
  }
  async function restoreFromHistory(id: string) {
    setBusy("Loading backup…");
    try {
      const response = await fetch(`/api/backup/${id}`);
      if (!response.ok) throw new Error("Could not retrieve backup");
      await validate(
        new File([await response.blob()], "tide.zip", {
          type: "application/zip",
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load backup");
    } finally {
      setBusy("");
    }
  }
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Shared workspace · Unraid server</span>
          <h2>Automatic backups</h2>
          <p className="muted">
            A little peace of mind, kept with your workspace.
          </p>
        </div>
        <button onClick={onSettings}>Schedule & retention</button>
      </div>
      <ErrorMessage error={error} />
      <div className="button-row">
        <button
          className="primary"
          disabled={!!busy}
          onClick={async () => {
            setBusy("Backing up records and attachments…");
            setError("");
            try {
              await request("backups", { action: "create" });
              await load();
              notify("Backup complete");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Backup failed");
            } finally {
              setBusy("");
            }
          }}
        >
          <ShieldCheck size={15} />
          Run backup now
        </button>
        <label className="upload-button">
          <Upload size={15} />
          Upload a backup
          <input
            type="file"
            accept=".zip"
            disabled={!!busy}
            onChange={(e) =>
              e.target.files?.[0] && void validate(e.target.files[0])
            }
          />
        </label>
        <a className="button" download="tide-export.json" href="/api/export">
          Export JSON
        </a>
        <a
          className="button"
          download="tide-export.csv"
          href="/api/export?format=csv"
        >
          Export CSV
        </a>
      </div>
      {busy && (
        <div className="info-message" role="status">
          {busy}
        </div>
      )}
      <p className="muted">
        Full backups include everyone’s records and attachments. JSON and CSV
        exports are for inspection and portability; restore uses a full Tide ZIP
        backup.
      </p>
      <div className="context-card">
        <p>
          Last successful backup:{" "}
          {history.find((b) => b.status === "succeeded")
            ? new Date(
                history.find((b) => b.status === "succeeded")!.at,
              ).toLocaleString()
            : "None yet"}
        </p>
        <p>
          Next scheduled backup:{" "}
          {backups.data?.next
            ? new Date(backups.data.next).toLocaleString()
            : "Automatic backups are paused or no weekdays are selected."}
        </p>
      </div>
      <h3>Backup history</h3>
      {!history.length && (
        <Empty
          title="Your first safety net"
          description="Run a backup now, or let the configured schedule create one."
        />
      )}
      {history.map((b) => (
        <article className="backup-record" key={b.id}>
          <div>
            <strong>{new Date(b.at).toLocaleString()}</strong>
            <p>
              {b.type} · {b.status} · {(b.bytes / 1024 / 1024).toFixed(1)} MB
            </p>
            {b.error && <p className="error-text">{b.error}</p>}
          </div>
          {b.status === "succeeded" ? (
            <div className="button-row">
              <a className="button" href={`/api/backup/${b.id}`}>
                <Download size={14} />
                Download
              </a>
              <button
                disabled={!!busy}
                onClick={() => void restoreFromHistory(b.id)}
              >
                Restore
              </button>
            </div>
          ) : (
            b.status === "failed" && (
              <button
                disabled={!!busy}
                onClick={async () => {
                  try {
                    await request("backups", { action: "create" });
                    await load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Retry failed");
                  }
                }}
              >
                <RefreshCw size={14} />
                Retry backup
              </button>
            )
          )}
        </article>
      ))}
      {preview && (
        <Modal
          title={
            restoring
              ? "Restoring shared workspace…"
              : "Replace everyone’s workspace?"
          }
          description="Full-workspace restoration"
          onClose={() => {
            if (!restoring) setPreview(null);
          }}
          footer={
            <>
              <button disabled={restoring} onClick={() => setPreview(null)}>
                Cancel
              </button>
              <button
                className="danger"
                disabled={!confirm || restoring}
                onClick={async () => {
                  setRestoring(true);
                  setError("");
                  try {
                    await request("backups", {
                      action: "restore",
                      token: preview.token,
                      confirm: true,
                    });
                    await refresh();
                    setPreview(null);
                    notify(
                      "Workspace restored. Review any recovered device drafts before saving.",
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Restore interrupted. Retry connection before editing.",
                    );
                  } finally {
                    setRestoring(false);
                  }
                }}
              >
                {restoring ? "Restoring…" : "Replace shared workspace"}
              </button>
            </>
          }
        >
          <ErrorMessage error={error} />
          <p>
            Backup created {new Date(preview.manifest.at).toLocaleString()}.
          </p>
          <dl className="task-facts">
            {Object.entries(preview.manifest.counts).map(([kind, count]) => (
              <div className="contents-pair" key={kind}>
                <dt>{kind}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          <p>
            This replaces all people’s tasks, owners, plans, focus tasks,
            timers, notes, essentials, settings, references, and attachments.
            Other browsers temporarily reconnect.
          </p>
          <p>
            A safety backup is created first. Device drafts remain local and
            must be reviewed afterward.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirm}
              disabled={restoring}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            I understand this replaces everyone’s workspace.
          </label>
          {restoring && (
            <div className="info-message" role="status">
              Restoring records and attachments. Editing is temporarily
              unavailable. Keep the server running.
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
