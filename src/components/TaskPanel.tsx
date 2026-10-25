"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  X,
  Play,
  Pause,
  Square,
  ArrowUpRight,
  Copy,
  Archive,
  Trash2,
  RotateCcw,
  Paperclip,
  Repeat,
} from "lucide-react";
import { useWorkspace, ApiError } from "./workspace";
import {
  Modal,
  StatusBadge,
  Minutes,
  Checklist,
  Field,
  ErrorMessage,
} from "./ui";
import { RichText } from "./RichText";
import { TaskLocation } from "./Travel";
import { recordsOf, settingsDefaults } from "@/lib/types";
import type {
  Task,
  Entity,
  Person,
  TimeLog,
  Attachment,
  Reference,
  Plan,
  Settings,
} from "@/lib/types";
import { newPlan, workspaceDay, effectiveTask, dayTime } from "@/lib/domain";

export function TaskPanel({
  task,
  onClose,
  onEdit,
  onOpen,
  personId,
  day,
}: {
  task: Entity<Task>;
  onClose: () => void;
  onEdit: (entity: Entity, scopeFrom?: string) => void;
  onOpen: (id: string) => void;
  personId: string;
  day: string;
}) {
  const { workspace, save, mutate, notify } = useWorkspace();
  const [tab, setTab] = useState("details");
  const [owner, setOwner] = useState<string | undefined>();
  const [addToPlan, setAddToPlan] = useState(false);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(25);
  const [timerSwitch, setTimerSwitch] = useState(false);
  const [scope, setScope] = useState(false);
  const [tick, setTick] = useState(() => Date.now());
  const t = task.data;
  const locationTask = {
    ...task,
    data: effectiveTask(t, workspace.records, task.id),
  };
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const media = window.matchMedia("(max-width:1023px)");
    const panel = panelRef.current!;
    const background = document.querySelector<HTMLElement>(".workspace-column");
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    const bottom = document.querySelector<HTMLElement>(".mobile-bottom-nav");
    const update = () => {
      panel.setAttribute("role", media.matches ? "dialog" : "complementary");
      if (media.matches) panel.setAttribute("aria-modal", "true");
      else panel.removeAttribute("aria-modal");
      if (background) background.inert = media.matches;
      if (sidebar) sidebar.inert = media.matches;
      if (bottom) bottom.inert = media.matches;
    };
    update();
    if (media.matches)
      panel.querySelector<HTMLButtonElement>("button")?.focus();
    media.addEventListener("change", update);
    const keydown = (e: KeyboardEvent) => {
      if (!media.matches || document.querySelector('.modal[role="dialog"]'))
        return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[contenteditable="true"]',
        ),
      ).filter((n) => n.getClientRects().length);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      media.removeEventListener("change", update);
      if (background) background.inert = false;
      if (sidebar) sidebar.inert = false;
      if (bottom) bottom.inert = false;
      if (trigger?.isConnected) trigger.focus();
      else document.querySelector<HTMLElement>(".topbar button")?.focus();
    };
  }, []);
  const cfg =
    recordsOf<Settings>(workspace.records, "settings")[0]?.data ||
    settingsDefaults;
  const today = workspaceDay(cfg);
  const timer = recordsOf<TimeLog>(workspace.records, "timeLog").find(
    (log) => log.data.personId === personId && !log.data.stoppedAt,
  );
  const active = timer?.data.taskId === task.id ? timer : undefined;
  const logs = recordsOf<TimeLog>(workspace.records, "timeLog").filter(
    (log) => log.data.taskId === task.id,
  );
  const people = recordsOf<Person>(workspace.records, "person");
  const ownerName =
    people.find((p) => p.id === t.ownerId)?.data.name || "Unassigned";
  const [undo, setUndo] = useState<{ data: Task; version: number } | null>(
    null,
  );
  useEffect(() => {
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const elapsed = (log: TimeLog) =>
    log.elapsedSeconds +
    (log.running ? Math.max(0, (tick - Date.parse(log.startedAt)) / 1000) : 0);
  async function patch(changes: Partial<Task>) {
    try {
      const result = await save("task", { ...t, ...changes }, task);
      setError("");
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      return null;
    }
  }
  async function timerAction(action: string, confirm = false) {
    try {
      await mutate("timer", {
        action,
        personId,
        taskId: task.id,
        durationSeconds: duration * 60,
        confirm,
        version: active?.version,
      });
      setTimerSwitch(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && action === "start")
        setTimerSwitch(true);
      else setError(e instanceof Error ? e.message : "Timer unavailable");
    }
  }
  async function archiveOrDelete(action: "archive" | "delete") {
    const old = { ...t };
    const result = await patch(
      action === "archive"
        ? { archived: true }
        : { deletedAt: new Date().toISOString() },
    );
    if (result) {
      setUndo({ data: old, version: result.version });
      notify(action === "archive" ? "Archived" : "Moved to Trash");
    }
  }
  const spent = logs.reduce((n, log) => n + elapsed(log.data), 0) / 60;
  return (
    <aside
      ref={panelRef}
      className="task-inspector"
      aria-label={`Task details: ${t.title}`}
    >
      <header className="inspector-top">
        <span className="eyebrow">Task details</span>
        <button
          className="icon-button"
          aria-label="Close inspector"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="inspector-body">
        <h2>{t.title}</h2>
        <div className="button-row">
          <StatusBadge status={t.status} />
          {t.seriesId && (
            <span className="badge">
              <Repeat size={12} />
              Occurrence · {t.occurrenceDay}
            </span>
          )}
        </div>
        <Field label="Status">
          <select
            value={t.status}
            onChange={(e) =>
              void patch({ status: e.target.value as Task["status"] })
            }
          >
            {["Open", "In progress", "Waiting/blocked", "Done"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <button
          className="owner-control"
          onClick={() => {
            setOwner(t.ownerId || "");
            setAddToPlan(false);
          }}
        >
          <span className="owner-chip">Owner · {ownerName}</span>
          <span>Change</span>
        </button>
        <div className="segmented">
          <button
            className={tab === "details" ? "active" : ""}
            onClick={() => setTab("details")}
          >
            Details
          </button>
          <button
            className={tab === "activity" ? "active" : ""}
            onClick={() => setTab("activity")}
          >
            Activity
          </button>
        </div>
        <ErrorMessage error={error} />
        {undo && (
          <div className="info-message">
            Task updated.{" "}
            <button
              onClick={async () => {
                try {
                  await save("task", undo.data, {
                    ...task,
                    version: undo.version,
                  });
                  setUndo(null);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Undo could not be applied",
                  );
                }
              }}
            >
              Undo
            </button>
          </div>
        )}
        {tab === "activity" ? (
          <div className="activity-list">
            {workspace.activities
              .filter((a) => a.recordId === task.id)
              .map((a) => (
                <div key={a.id}>
                  <strong>{a.action}</strong>
                  <p>{a.detail}</p>
                  <time>{new Date(a.createdAt).toLocaleString()}</time>
                </div>
              ))}
            {!workspace.activities.some((a) => a.recordId === task.id) && (
              <p className="muted">This task’s story starts here.</p>
            )}
          </div>
        ) : (
          <>
            <dl className="task-facts">
              <dt>Planned day</dt>
              <dd>{t.plannedDay || "Unplanned"}</dd>
              <dt>Start date</dt>
              <dd>{t.startDay || "None"}</dd>
              <dt>Deadline</dt>
              <dd>
                {t.deadline || "None"}
                {t.deadline && (
                  <small>
                    {Math.ceil(
                      (Date.parse(dayTime(t.deadline, "23:59", cfg.timezone)) -
                        tick) /
                        86400000,
                    )}{" "}
                    days remaining
                  </small>
                )}
              </dd>
              <dt>Scheduled</dt>
              <dd>
                {t.scheduledStart
                  ? new Date(t.scheduledStart).toLocaleTimeString([], {
                      timeZone: cfg.timezone,
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Untimed"}
                {t.fixed ? " · Fixed" : ""}
              </dd>
              <dt>Estimate / effort</dt>
              <dd>
                <Minutes value={t.estimate} /> · {t.effort}
              </dd>
              <dt>Priority</dt>
              <dd>{t.priority}</dd>
            </dl>
            <button
              className="text-button"
              onClick={() => onEdit(task as unknown as Entity)}
            >
              Edit dates & details <ArrowUpRight size={14} />
            </button>
            <section className="inspector-section">
              <h3>Notes</h3>
              <AutoNotes entity={task} onError={setError} />
            </section>
            <section className="inspector-section">
              <h3>
                Checklist{" "}
                <span className="count">
                  {t.checklist.filter((c) => c.done).length}/
                  {t.checklist.length}
                </span>
              </h3>
              <Checklist
                items={t.checklist}
                onChange={(items) => void patch({ checklist: items })}
              />
            </section>
            {!!t.attachmentIds.length && (
              <section className="inspector-section">
                <h3>Attachments</h3>
                {t.attachmentIds.map((id) => {
                  const file = recordsOf<Attachment>(
                    workspace.records,
                    "attachment",
                  ).find((a) => a.id === id);
                  return (
                    <div key={id} className="attachment-preview">
                      {file?.data.mime.startsWith("image/") && (
                        <a
                          href={`/api/attachment/${id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Image
                            unoptimized
                            width={600}
                            height={360}
                            style={{ width: "100%", height: "auto" }}
                            src={`/api/attachment/${id}`}
                            alt={file.data.title}
                          />
                        </a>
                      )}
                      <a
                        href={`/api/attachment/${id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Paperclip size={14} />
                        {file?.data.title || "Attachment unavailable"}
                      </a>
                    </div>
                  );
                })}
              </section>
            )}
            {!!t.referenceIds.length && (
              <section className="inspector-section">
                <h3>Linked references</h3>
                {t.referenceIds.map((id) => {
                  const ref = recordsOf<Reference>(
                    workspace.records,
                    "reference",
                  ).find((r) => r.id === id);
                  return (
                    <button
                      className="linked-item"
                      key={id}
                      onClick={() => onOpen(id)}
                    >
                      {ref?.data.title || "Reference no longer available"}
                      <ArrowUpRight size={13} />
                    </button>
                  );
                })}
              </section>
            )}
            {(t.dependencies.length > 0 || t.blockingNote) && (
              <section className="inspector-section">
                <h3>Dependencies</h3>
                {t.blockingNote && <p>{t.blockingNote}</p>}
                {t.dependencies.map((id) => {
                  const dep = recordsOf<Task>(workspace.records, "task").find(
                    (r) => r.id === id,
                  );
                  return (
                    <button
                      className="linked-item"
                      key={id}
                      onClick={() => onOpen(id)}
                    >
                      {dep?.data.title || "Prerequisite unavailable"}
                      <span>{dep?.data.status}</span>
                    </button>
                  );
                })}
              </section>
            )}
            <section className="timer-card">
              <span className="eyebrow">Focus countdown</span>
              <div className="timer-digits">
                {active
                  ? `${String(Math.floor(Math.max(0, active.data.durationSeconds - elapsed(active.data)) / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, active.data.durationSeconds - elapsed(active.data)) % 60)).padStart(2, "0")}`
                  : `${duration}:00`}
              </div>
              <p className="muted">
                <Minutes value={spent} /> spent on this task
              </p>
              {!active ? (
                <div className="inline-fields">
                  <input
                    type="number"
                    aria-label="Focus minutes"
                    min="1"
                    max="1440"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                  <button
                    disabled={!personId || personId === "all"}
                    onClick={() => void timerAction("start")}
                  >
                    <Play size={14} />
                    Start
                  </button>
                </div>
              ) : (
                <div className="button-row">
                  <button
                    onClick={() =>
                      void timerAction(active.data.running ? "pause" : "resume")
                    }
                  >
                    {active.data.running ? (
                      <Pause size={14} />
                    ) : (
                      <Play size={14} />
                    )}{" "}
                    {active.data.running ? "Pause" : "Resume"}
                  </button>
                  <button onClick={() => void timerAction("stop")}>
                    <Square size={14} />
                    Stop
                  </button>
                </div>
              )}
              {(!personId || personId === "all") && (
                <small>Choose a planning person to use a timer.</small>
              )}
            </section>
            {(t.seriesId || t.recurrence) && (
              <section className="inspector-section">
                <h3>Recurring task</h3>
                <button onClick={() => setScope(true)}>
                  Edit recurrence / scope
                </button>
                {t.seriesId && (
                  <button
                    className="text-button"
                    onClick={() => void patch({ outcome: "skipped" })}
                  >
                    Skip this occurrence
                  </button>
                )}
                <details>
                  <summary>Occurrence history</summary>
                  {recordsOf<Task>(workspace.records, "task")
                    .filter((r) => r.data.seriesId === (t.seriesId || task.id))
                    .sort((a, b) =>
                      b.data.occurrenceDay.localeCompare(a.data.occurrenceDay),
                    )
                    .map((r) => (
                      <button
                        className="linked-item"
                        key={r.id}
                        onClick={() => onOpen(r.id)}
                      >
                        {r.data.occurrenceDay}
                        <span>{r.data.outcome || r.data.status}</span>
                      </button>
                    ))}
                </details>
              </section>
            )}
            {(locationTask.data.context === "Away from home" || t.outdoor) && (
              <TaskLocation
                task={locationTask}
                onSaved={(changes) => void patch(changes)}
              />
            )}
            <section className="inspector-section task-actions">
              <h3>Task actions</h3>
              <button onClick={() => onEdit(task as unknown as Entity)}>
                Edit all details
              </button>
              <button
                onClick={async () => {
                  try {
                    await mutate("bulk", {
                      operationId: crypto.randomUUID(),
                      action: "copy",
                      items: [{ id: task.id, version: task.version }],
                      day: day || today,
                    });
                    notify("Independent copy added with progress reset");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Copy failed");
                  }
                }}
              >
                <Copy size={14} />
                Copy to selected day
              </button>
              {t.archived ? (
                <button onClick={() => void patch({ archived: false })}>
                  <RotateCcw size={14} />
                  Unarchive
                </button>
              ) : (
                <button onClick={() => void archiveOrDelete("archive")}>
                  <Archive size={14} />
                  Archive
                </button>
              )}
              {t.deletedAt ? (
                <button onClick={() => void patch({ deletedAt: "" })}>
                  <RotateCcw size={14} />
                  Restore from Trash
                </button>
              ) : (
                <button
                  className="danger-text"
                  onClick={() => void archiveOrDelete("delete")}
                >
                  <Trash2 size={14} />
                  Move to Trash
                </button>
              )}
            </section>
          </>
        )}
      </div>
      {owner !== undefined && (
        <Modal
          title={owner ? "Reassign task?" : "Remove task owner?"}
          description={t.title}
          onClose={() => setOwner(undefined)}
          footer={
            <>
              <button onClick={() => setOwner(undefined)}>Cancel</button>
              <button
                className="primary"
                onClick={async () => {
                  const changed = await patch({
                    ownerId: owner || null,
                    ...(addToPlan ? { plannedDay: day } : {}),
                  });
                  if (changed && addToPlan && owner) {
                    const existing = recordsOf<Plan>(
                      workspace.records,
                      "plan",
                    ).find(
                      (p) => p.data.personId === owner && p.data.day === day,
                    );
                    const plan = existing?.data || newPlan(owner, day);
                    try {
                      await mutate("plan", {
                        data: {
                          ...plan,
                          taskIds: [...new Set([...plan.taskIds, task.id])],
                        },
                        version: existing?.version,
                      });
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Owner changed, but the plan could not be saved",
                      );
                    }
                  }
                  if (changed) setOwner(undefined);
                }}
              >
                Confirm owner change
              </button>
            </>
          }
        >
          <Field label="New owner">
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Unassigned</option>
              {people
                .filter((p) => !p.data.retired || p.id === t.ownerId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.data.name}
                  </option>
                ))}
            </select>
          </Field>
          <p>
            The task leaves its previous owner’s plan and focus selection.
            Content, dates, and status are kept. No timer is transferred.
          </p>
          {owner && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={addToPlan}
                onChange={(e) => setAddToPlan(e.target.checked)}
              />
              Add to {people.find((p) => p.id === owner)?.data.name}’s {day}{" "}
              plan
            </label>
          )}
        </Modal>
      )}
      {timerSwitch && (
        <Modal
          title="Switch active timer?"
          description="Only this person’s timer will change."
          onClose={() => setTimerSwitch(false)}
          footer={
            <>
              <button onClick={() => setTimerSwitch(false)}>Cancel</button>
              <button
                className="primary"
                onClick={() => void timerAction("start", true)}
              >
                Stop current & start this task
              </button>
            </>
          }
        >
          <p>Time already recorded is kept. Other people’s timers continue.</p>
        </Modal>
      )}
      {scope && (
        <Modal title="Edit recurring task" onClose={() => setScope(false)}>
          <p>
            Choose whether to edit this occurrence or the series. Previous
            occurrence outcomes are retained.
          </p>
          <div className="stack">
            <button
              onClick={() => {
                onEdit(task as unknown as Entity);
                setScope(false);
              }}
            >
              This occurrence only
            </button>
            <button
              onClick={() => {
                const series = workspace.records.find(
                  (r) => r.id === (t.seriesId || task.id),
                );
                if (series) onEdit(series, t.occurrenceDay || today);
                setScope(false);
              }}
            >
              This and future occurrences
            </button>
          </div>
        </Modal>
      )}
    </aside>
  );
}
function AutoNotes({
  entity,
  onError,
}: {
  entity: Entity<Task>;
  onError: (message: string) => void;
}) {
  const { save, workspace } = useWorkspace();
  const key = `tide:notes:${entity.id}`;
  const [recovered] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  });
  const [value, setValue] = useState(recovered?.notes ?? entity.data.notes);
  const [review, setReview] = useState(!!recovered);
  const [conflict, setConflict] = useState<Entity<Task> | null>(null);
  const [state, setState] = useState(
    recovered ? "Recovered device draft — review before saving" : "Saved",
  );
  const current = useRef(entity);
  const epoch = useRef(workspace.generation);
  const draft = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(!!recovered);
  useEffect(() => {
    if (!dirty.current) {
      current.current = entity;
      setValue(entity.data.notes);
    }
  }, [entity]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  async function persist(next: string, reviewed = false) {
    if (
      !reviewed &&
      (epoch.current !== workspace.generation ||
        current.current.version !== entity.version)
    ) {
      setConflict(entity);
      setReview(true);
      return;
    }
    setState("Saving…");
    try {
      const result = await save(
        "task",
        { ...current.current.data, notes: next },
        current.current,
      );
      current.current = result;
      if (draft.current === next) {
        dirty.current = false;
        localStorage.removeItem(key);
        setState("Saved");
        setReview(false);
        setConflict(null);
      }
    } catch (error) {
      setState("Draft saved on this device");
      if (error instanceof ApiError && error.current)
        setConflict(error.current as unknown as Entity<Task>);
      setReview(true);
      onError(
        error instanceof Error
          ? error.message
          : "Your notes draft is preserved.",
      );
    }
  }
  function change(next: string) {
    setValue(next);
    draft.current = next;
    dirty.current = true;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          notes: next,
          version: current.current.version,
          generation: epoch.current,
        }),
      );
    } catch {}
    setState("Draft saved on this device");
    if (timer.current) clearTimeout(timer.current);
    if (!review) timer.current = setTimeout(() => void persist(next), 1000);
  }
  return (
    <>
      <RichText value={value} onChange={change} />
      <small className="save-hint" role="status">
        {state}
      </small>
      {review && (
        <div className="info-message">
          <p>A device draft needs your review.</p>
          <details open={!!conflict}>
            <summary>Compare with server notes</summary>
            <h4>Saved notes</h4>
            <RichText value={(conflict || entity).data.notes} readOnly />
            <h4>Your draft</h4>
            <RichText value={value} readOnly />
          </details>
          <div className="button-row">
            <button
              onClick={() => {
                const server = conflict || entity;
                current.current = server;
                epoch.current = workspace.generation;
                dirty.current = false;
                localStorage.removeItem(key);
                setValue(server.data.notes);
                draft.current = server.data.notes;
                setReview(false);
                setConflict(null);
                setState("Saved");
                onError("");
              }}
            >
              Use server notes
            </button>
            <button
              onClick={() => {
                current.current = conflict || entity;
                epoch.current = workspace.generation;
                void persist(value, true);
              }}
            >
              Save reviewed draft
            </button>
          </div>
        </div>
      )}
    </>
  );
}
