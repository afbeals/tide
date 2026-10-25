"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Upload } from "lucide-react";
import { ApiError, request, useWorkspace } from "./workspace";
import { Modal, Field, Checklist, ErrorMessage } from "./ui";
import { RichText } from "./RichText";
import { parseData, workspaceDay, localDateTime, copyTask } from "@/lib/domain";
import {
  taskDefaults,
  settingsDefaults,
  defaultFilters,
  recordsOf,
} from "@/lib/types";
import type {
  Entity,
  Kind,
  Settings,
  Person,
  Task,
  Routine,
  CheckItem,
  Attachment,
} from "@/lib/types";

export function defaultsFor(
  kind: Kind,
  personId = "",
  day = "",
): Record<string, unknown> {
  switch (kind) {
    case "task":
      return { ...taskDefaults(), ownerId: personId || null, plannedDay: day };
    case "person":
      return { name: "", color: "#e8ba72", retired: false };
    case "area":
      return { title: "", notes: "" };
    case "project":
      return {
        title: "",
        notes: "",
        areaId: null,
        targetDay: "",
        referenceIds: [],
        archived: false,
      };
    case "routine":
      return { title: "", notes: "", templates: [] };
    case "reference":
      return {
        title: "",
        type: "Note",
        notes: "",
        url: "",
        checklist: [],
        attachmentIds: [],
        tags: [],
      };
    case "place":
      return {
        name: "",
        address: "",
        placeId: "",
        latitude: null,
        longitude: null,
      };
    case "view":
      return { title: "", filters: { ...defaultFilters } };
    case "availability":
      return {
        personId,
        date: "",
        weekdays: [1, 2, 3, 4, 5],
        start: "09:00",
        end: "17:00",
        breaks: [],
      };
    case "outing":
      return {
        title: "",
        notes: "",
        context: "Away from home",
        taskIds: [],
        origin: "Home",
        travelMode: "DRIVE",
        departure: "",
        arrival: "",
        returnTrip: false,
        returnAddress: "Home",
        bring: [],
      };
    case "settings":
      return { ...settingsDefaults };
    default:
      return {};
  }
}
export function EntityEditor({
  kind,
  entity,
  initial,
  scopeFrom,
  onClose,
  onSaved,
  personId = "",
  day = "",
}: {
  kind: Kind;
  entity?: Entity;
  initial?: Record<string, unknown>;
  scopeFrom?: string;
  onClose: () => void;
  onSaved?: (entity: Entity) => void;
  personId?: string;
  day?: string;
}) {
  const { workspace, save, notify, mutate } = useWorkspace();
  const draftKey = `tide:draft:${entity?.id || `new-${kind}`}`;
  const [draft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) || "null");
    } catch {
      return null;
    }
  });
  const [data, setData] = useState<Record<string, unknown>>(
    () =>
      draft?.data ||
      entity?.data || { ...defaultsFor(kind, personId, day), ...initial },
  );
  const [version, setVersion] = useState(
    draft ? draft.version : entity?.version,
  );
  const [baseGeneration, setBaseGeneration] = useState(
    draft?.generation || workspace.generation,
  );
  const [dependencySearch, setDependencySearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [conflict, setConflict] = useState<Entity | null>(null);
  const [uploading, setUploading] = useState(false);
  const [draftStatus, setDraftStatus] = useState(
    draft ? "Recovered device draft" : "",
  );
  const cfg =
    recordsOf<Settings>(workspace.records, "settings")[0]?.data ||
    settingsDefaults;
  const today = day || workspaceDay(cfg);
  const taskList = recordsOf<Task>(workspace.records, "task").filter(
    (t) => !t.data.deletedAt && !t.data.archived && !t.data.recurrence,
  );
  const title =
    kind === "settings"
      ? "Workspace preferences"
      : `${entity ? "Edit" : "Create"} ${kind === "view" ? "saved view" : kind}`;
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            data,
            version,
            generation: workspace.generation,
            at: Date.now(),
          }),
        );
        setDraftStatus("Draft saved on this device");
      } catch {
        setDraftStatus("Device storage unavailable; keep this editor open");
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [data, version, draftKey, workspace.generation]);
  const set = (name: string, value: unknown) =>
    setData((d) => ({ ...d, [name]: value }));
  const str = (key: string) => String(data[key] ?? "");
  const ids = (key: string) => (data[key] || []) as string[];
  const input = (name: string, label: string, type = "text", hint?: string) => (
    <Field label={label} hint={hint}>
      <input
        type={type}
        value={
          type === "datetime-local"
            ? localDateTime(str(name), cfg.timezone)
            : str(name)
        }
        min={
          type === "number"
            ? name === "latitude"
              ? -90
              : name === "longitude"
                ? -180
                : 0
            : undefined
        }
        max={name === "latitude" ? 90 : name === "longitude" ? 180 : undefined}
        step={name === "latitude" || name === "longitude" ? "any" : undefined}
        onChange={(e) =>
          set(
            name,
            type === "number"
              ? e.target.value === "" &&
                ["latitude", "longitude"].includes(name)
                ? null
                : Number(e.target.value)
              : name === "weekStart"
                ? Number(e.target.value)
                : e.target.value,
          )
        }
      />
    </Field>
  );
  const choice = (name: string, label: string, options: string[]) => (
    <Field label={label}>
      <select
        value={str(name)}
        onChange={(e) =>
          set(
            name,
            name === "weekStart" ? Number(e.target.value) : e.target.value,
          )
        }
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );
  const relation = (
    name: string,
    label: string,
    relatedKind: Kind,
    empty = "None",
  ) => (
    <Field label={label}>
      <select
        value={str(name)}
        onChange={(e) => set(name, e.target.value || null)}
      >
        <option value="">{empty}</option>
        {workspace.records
          .filter((r) => r.kind === relatedKind)
          .map((r) => (
            <option value={r.id} key={r.id}>
              {String(r.data.title || r.data.name)}
            </option>
          ))}
      </select>
    </Field>
  );
  const multi = (
    name: string,
    label: string,
    relatedKind: Kind,
    options?: Entity[],
  ) => (
    <fieldset className="multi-select">
      <legend>{label}</legend>
      {(options || workspace.records.filter((r) => r.kind === relatedKind)).map(
        (r) => (
          <label key={r.id}>
            <input
              type="checkbox"
              checked={ids(name).includes(r.id)}
              onChange={(e) =>
                set(
                  name,
                  e.target.checked
                    ? [...ids(name), r.id]
                    : ids(name).filter((id) => id !== r.id),
                )
              }
            />
            {String(r.data.title || r.data.name)}
          </label>
        ),
      )}
      {!(options || workspace.records.filter((r) => r.kind === relatedKind))
        .length && <p className="muted">No items available yet.</p>}
    </fieldset>
  );
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (baseGeneration !== workspace.generation) {
        setError(
          "This draft predates a workspace restore. Compare it with the current server version before saving.",
        );
        if (entity)
          setConflict(
            workspace.records.find((r) => r.id === entity.id) || entity,
          );
        return;
      }
      const parsed = parseData(kind, data);
      const result = await save(
        kind,
        parsed,
        entity ? { ...entity, version } : undefined,
        scopeFrom,
      );
      localStorage.removeItem(draftKey);
      onSaved?.(result);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setMissing(true);
        setError(
          "The saved record was deleted. Your draft is preserved. You can save it as a new record.",
        );
      } else if (err instanceof ApiError && err.status === 409 && err.current)
        setConflict(err.current);
      else setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }
  async function saveAsNew() {
    setBusy(true);
    try {
      const next =
        kind === "task"
          ? copyTask(data as unknown as Task, String(data.plannedDay || ""))
          : data;
      const result = await save(kind, parseData(kind, next));
      localStorage.removeItem(draftKey);
      onSaved?.(result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save a new record");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const attachment = await mutate<Entity<Attachment>>("attachment", form);
      set("attachmentIds", [...ids("attachmentIds"), attachment.id]);
      notify("Attachment uploaded");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setUploading(false);
    }
  }
  const attachments = () => (
    <section>
      <h3>Files and images</h3>
      {ids("attachmentIds").map((id) => {
        const a = workspace.records.find((r) => r.id === id);
        return (
          <div className="attachment-line" key={id}>
            <a href={`/api/attachment/${id}`} target="_blank" rel="noreferrer">
              {String(a?.data.title || "Uploaded attachment")}
            </a>
            <button
              type="button"
              className="icon-button"
              aria-label="Remove attachment"
              onClick={() =>
                set(
                  "attachmentIds",
                  ids("attachmentIds").filter((x) => x !== id),
                )
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      })}
      <label className="upload-button">
        <Upload size={15} />
        {uploading ? "Uploading…" : "Add file or image"}
        <input
          type="file"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files?.[0]) void upload(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </label>
      <small>Up to 20 MB per file. Keep the editor open while uploading.</small>
    </section>
  );
  const weekdays = (key = "weekdays") => (
    <div className="weekday-picker">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, index) => (
        <label key={label}>
          <input
            type="checkbox"
            checked={((data[key] as number[]) || []).includes(index)}
            onChange={(e) =>
              set(
                key,
                e.target.checked
                  ? [...((data[key] as number[]) || []), index]
                  : ((data[key] as number[]) || []).filter((d) => d !== index),
              )
            }
          />
          {label}
        </label>
      ))}
    </div>
  );
  return (
    <Modal
      title={title}
      description="Shared workspace · Everyone can edit"
      onClose={onClose}
      wide={kind === "task" || kind === "routine"}
      footer={
        <>
          <small>{draftStatus}</small>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            form="entity-form"
            disabled={busy || uploading}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="entity-form" onSubmit={submit}>
        <ErrorMessage error={error} />
        {missing && (
          <button type="button" onClick={() => void saveAsNew()}>
            Save draft as new {kind}
          </button>
        )}
        {draft && (
          <div className="info-message">
            Recovered a device draft
            {draft.generation !== workspace.generation
              ? " from before the workspace was restored. Review it before saving."
              : ". Review and save when ready."}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                localStorage.removeItem(draftKey);
                setData(entity?.data || defaultsFor(kind, personId, day));
                setVersion(entity?.version);
                setBaseGeneration(workspace.generation);
              }}
            >
              Use server version
            </button>
          </div>
        )}
        {kind === "person" ? (
          <>
            {input("name", "Name *")}
            {input("color", "Person color", "color")}
            <label className="check-label">
              <input
                type="checkbox"
                checked={!!data.retired}
                onChange={(e) => {
                  if (
                    !e.target.checked ||
                    window.confirm(
                      "Retire this person? Their history and task ownership will be retained.",
                    )
                  )
                    set("retired", e.target.checked);
                }}
              />
              Retired
            </label>
          </>
        ) : (
          kind !== "settings" &&
          kind !== "availability" &&
          input(
            kind === "place" ? "name" : "title",
            `${kind === "task" ? "Task title" : "Name"} *`,
          )
        )}
        {kind === "task" && (
          <>
            <div className="form-grid">
              {choice("status", "Status", [
                "Open",
                "In progress",
                "Waiting/blocked",
                "Done",
              ])}
              {relation("ownerId", "Owner", "person", "Unassigned")}
              {relation("projectId", "Project", "project")}
              {relation("areaId", "Area", "area")}
              {choice("priority", "Priority", [
                "Low",
                "Normal",
                "High",
                "Urgent",
              ])}
              {choice("effort", "Effort", ["Low", "Medium", "High"])}
              {input("estimate", "Estimate (minutes)", "number")}
            </div>
            <Field label="Tags, separated by commas">
              <input
                value={ids("tags").join(", ")}
                onChange={(e) =>
                  set(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
            <details open>
              <summary>Dates and schedule</summary>
              <div className="form-grid">
                {input("plannedDay", "Planned day", "date")}
                {input("startDay", "Start date", "date")}
                {input("deadline", "Deadline", "date")}
                {input("scheduledStart", "Scheduled start", "datetime-local")}
                {input("scheduledEnd", "Scheduled end", "datetime-local")}
                {choice("dayPart", "Untimed grouping", [
                  "",
                  "Morning",
                  "Afternoon",
                  "Evening",
                ])}
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!data.fixed}
                  onChange={(e) => set("fixed", e.target.checked)}
                />
                Fixed appointment
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!data.someday}
                  onChange={(e) => set("someday", e.target.checked)}
                />
                Keep in Someday
              </label>
            </details>
          </>
        )}
        {["task", "area", "project", "routine", "reference", "outing"].includes(
          kind,
        ) && (
          <Field
            label={kind === "project" ? "Purpose and project notes" : "Notes"}
          >
            <RichText
              value={str("notes")}
              onChange={(value) => set("notes", value)}
            />
          </Field>
        )}
        {kind === "task" && (
          <>
            <h3>Checklist</h3>
            <Checklist
              items={(data.checklist || []) as CheckItem[]}
              onChange={(v) => set("checklist", v)}
            />
            {attachments()}
            {multi("referenceIds", "Linked references", "reference")}
            <details>
              <summary>Dependencies and blocking</summary>
              <Field label="Find prerequisites">
                <input
                  type="search"
                  value={dependencySearch}
                  onChange={(e) => setDependencySearch(e.target.value)}
                />
              </Field>
              {multi(
                "dependencies",
                "Prerequisites",
                "task",
                taskList.filter(
                  (t) =>
                    t.id !== entity?.id &&
                    t.data.title
                      .toLowerCase()
                      .includes(dependencySearch.toLowerCase()),
                ) as unknown as Entity[],
              )}
              <Field label="Blocking note">
                <textarea
                  value={str("blockingNote")}
                  onChange={(e) => set("blockingNote", e.target.value)}
                />
              </Field>
            </details>
            <details>
              <summary>Recurrence</summary>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!data.recurrence}
                  onChange={(e) =>
                    set(
                      "recurrence",
                      e.target.checked
                        ? {
                            mode: "daily",
                            interval: 1,
                            weekdays: [1, 2, 3, 4, 5],
                            rule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
                            start: today,
                            end: "",
                            count: null,
                            paused: false,
                          }
                        : null,
                    )
                  }
                />
                Repeat this task
              </label>
              {!!data.recurrence && (
                <RecurrenceFields
                  value={data.recurrence as unknown as Task["recurrence"]}
                  onChange={(v) => set("recurrence", v)}
                />
              )}
            </details>
            <details>
              <summary>Location and travel</summary>
              {choice("context", "Location context", [
                "At home",
                "Away from home",
                "Anywhere",
                "Inherit",
              ])}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!data.outdoor}
                  onChange={(e) => set("outdoor", e.target.checked)}
                />
                Outdoor task
              </label>
              {relation("placeId", "Saved destination", "place")}
              {input("destination", "Destination address")}
              {input("origin", "Starting address or saved place name")}
              {choice("travelMode", "Travel mode", [
                "DRIVE",
                "WALK",
                "BICYCLE",
                "TRANSIT",
              ])}
              <div className="form-grid">
                {input("latitude", "Latitude", "number")}
                {input("longitude", "Longitude", "number")}
                {input("departure", "Planned departure", "datetime-local")}
                {input("arrival", "Desired arrival", "datetime-local")}
                {input("prepMinutes", "Preparation (minutes)", "number")}
                {input("arrivalMinutes", "Arrival buffer (minutes)", "number")}
                {input(
                  "travelMinutes",
                  "Manual travel estimate (minutes)",
                  "number",
                )}
                {input(
                  "returnMinutes",
                  "Return/onward travel (minutes)",
                  "number",
                )}
              </div>
            </details>
            <details>
              <summary>Reminder</summary>
              {input(
                "reminderAt",
                "Alert at",
                "datetime-local",
                "Alerts run while the app is open. Missed alerts appear on reopening.",
              )}
            </details>
          </>
        )}
        {kind === "project" && (
          <>
            {relation("areaId", "Area", "area")}
            {input(
              "targetDay",
              "Project target date",
              "date",
              "Task deadlines remain separate.",
            )}
            {multi("referenceIds", "Project references", "reference")}
            <label className="check-label">
              <input
                type="checkbox"
                checked={!!data.archived}
                onChange={(e) => set("archived", e.target.checked)}
              />
              Archived
            </label>
          </>
        )}
        {kind === "reference" && (
          <>
            {choice("type", "Reference type", [
              "Note",
              "Link",
              "File",
              "Image",
              "Checklist",
            ])}
            {data.type === "Link" && input("url", "Link URL", "url")}
            {data.type === "Checklist" && (
              <Checklist
                items={(data.checklist || []) as CheckItem[]}
                onChange={(v) => set("checklist", v)}
              />
            )}
            <Field label="Tags">
              <input
                value={ids("tags").join(", ")}
                onChange={(e) =>
                  set(
                    "tags",
                    e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  )
                }
              />
            </Field>
            {attachments()}
          </>
        )}
        {kind === "place" && (
          <>
            {input("address", "Address *")}
            {input("placeId", "Google place ID (optional)")}
            <div className="form-grid">
              {input("latitude", "Latitude", "number")}
              {input("longitude", "Longitude", "number")}
            </div>
            <PlaceSearch
              onChoose={(p) =>
                setData((d) => ({
                  ...d,
                  address: p.formattedAddress,
                  placeId: p.id,
                  latitude: p.location?.latitude ?? null,
                  longitude: p.location?.longitude ?? null,
                }))
              }
            />
          </>
        )}
        {kind === "routine" && (
          <RoutineTemplates
            templates={(data.templates || []) as Routine["templates"]}
            onChange={(v) => set("templates", v)}
          />
        )}
        {kind === "view" && (
          <FilterFields
            value={data.filters as unknown as typeof defaultFilters}
            onChange={(v) => set("filters", v)}
          />
        )}
        {kind === "availability" && (
          <>
            {relation("personId", "Planning person", "person")}
            {input(
              "date",
              "Date exception (leave empty for recurring hours)",
              "date",
            )}
            {!data.date && weekdays()}
            <div className="form-grid">
              {input("start", "Start time", "time")}
              {input("end", "End time", "time")}
            </div>
            <h3>Unavailable periods</h3>
            {((data.breaks || []) as { start: string; end: string }[]).map(
              (b, i) => (
                <div className="inline-fields" key={i}>
                  <input
                    type="time"
                    aria-label="Break start"
                    value={b.start}
                    onChange={(e) =>
                      set(
                        "breaks",
                        (data.breaks as (typeof b)[]).map((x, j) =>
                          j === i ? { ...x, start: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <input
                    type="time"
                    aria-label="Break end"
                    value={b.end}
                    onChange={(e) =>
                      set(
                        "breaks",
                        (data.breaks as (typeof b)[]).map((x, j) =>
                          j === i ? { ...x, end: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label="Remove unavailable period"
                    onClick={() =>
                      set(
                        "breaks",
                        (data.breaks as (typeof b)[]).filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            )}
            <button
              type="button"
              onClick={() =>
                set("breaks", [
                  ...(data.breaks as unknown[]),
                  { start: "12:00", end: "13:00" },
                ])
              }
            >
              Add unavailable period
            </button>
          </>
        )}
        {kind === "outing" && (
          <>
            {input("origin", "Starting address / saved place")}
            {choice("travelMode", "Travel mode", [
              "DRIVE",
              "WALK",
              "BICYCLE",
              "TRANSIT",
            ])}
            <div className="form-grid">
              {input("departure", "Departure", "datetime-local")}
              {input("arrival", "Desired arrival", "datetime-local")}
            </div>
            {multi(
              "taskIds",
              "Away tasks / stops",
              "task",
              taskList.filter(
                (t) =>
                  t.data.context === "Away from home" ||
                  t.data.context === "Inherit",
              ) as unknown as Entity[],
            )}
            <label className="check-label">
              <input
                type="checkbox"
                checked={!!data.returnTrip}
                onChange={(e) => set("returnTrip", e.target.checked)}
              />
              Include return journey
            </label>
            {!!data.returnTrip &&
              input("returnAddress", "Return address / saved place")}
            <h3>Bring this</h3>
            <Checklist
              items={(data.bring || []) as CheckItem[]}
              onChange={(v) => set("bring", v)}
            />
          </>
        )}
        {kind === "settings" && (
          <>
            <h3>Dates</h3>
            {input("timezone", "Workspace time zone")}
            {choice("weekStart", "Week starts", [
              "0",
              "1",
              "2",
              "3",
              "4",
              "5",
              "6",
            ])}
            {input("dayBoundary", "Day boundary", "time")}
            <h3>Automatic backups</h3>
            <label className="check-label">
              <input
                type="checkbox"
                checked={!!data.backupEnabled}
                onChange={(e) => set("backupEnabled", e.target.checked)}
              />
              Enable scheduled backups
            </label>
            {input("backupTime", "Run at", "time")}
            {weekdays("backupWeekdays")}
            <div className="form-grid">
              {input("retentionDaily", "Keep daily backups", "number")}
              {input("retentionWeekly", "Keep weekly backups", "number")}
              {input("retentionSafety", "Keep safety backups", "number")}
            </div>
            <h3>Google services</h3>
            <label className="check-label">
              <input
                type="checkbox"
                checked={!!data.googleEnabled}
                onChange={(e) => set("googleEnabled", e.target.checked)}
              />
              Enable Google requests
            </label>
            {input("googleDailyLimit", "Daily request allowance", "number")}
            <p className="muted">
              API keys are configured on the server. Requests pause when this
              limit is reached. Google pricing also depends on the services
              used.
            </p>
          </>
        )}
      </form>
      {conflict && (
        <Modal
          title="Another browser changed this record"
          description="Compare the saved version with your device draft."
          onClose={() => setConflict(null)}
          footer={
            <>
              <button
                onClick={() => {
                  setData(conflict.data);
                  setVersion(conflict.version);
                  setBaseGeneration(workspace.generation);
                  setConflict(null);
                }}
              >
                Use server version
              </button>
              <button
                className="primary"
                onClick={() => {
                  setVersion(conflict.version);
                  setBaseGeneration(workspace.generation);
                  setConflict(null);
                  setError(
                    "Review your recovered draft, then Save to replace the version shown.",
                  );
                }}
              >
                Review & edit draft
              </button>
            </>
          }
        >
          <h3>Server version</h3>
          <pre
            className="comparison"
            role="region"
            aria-label="Server version"
            tabIndex={0}
          >
            {JSON.stringify(conflict.data, null, 2)}
          </pre>
          <h3>Your draft</h3>
          <pre
            className="comparison"
            role="region"
            aria-label="Your draft"
            tabIndex={0}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </Modal>
      )}
    </Modal>
  );
}
export function FilterFields({
  value,
  onChange,
}: {
  value: typeof defaultFilters;
  onChange: (v: typeof defaultFilters) => void;
}) {
  const { workspace } = useWorkspace();
  const field = (
    key: keyof typeof defaultFilters,
    label: string,
    options: string[],
  ) => (
    <Field label={label}>
      <select
        value={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );
  return (
    <div className="form-grid">
      <Field label="Search">
        <input
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
        />
      </Field>
      <Field label="Owner">
        <select
          value={value.owner}
          onChange={(e) => onChange({ ...value, owner: e.target.value })}
        >
          <option value="all">All people</option>
          <option value="unassigned">Unassigned</option>
          {recordsOf<Person>(workspace.records, "person").map((p) => (
            <option key={p.id} value={p.id}>
              {p.data.name}
            </option>
          ))}
        </select>
      </Field>
      {field("status", "Status", [
        "Open",
        "In progress",
        "Waiting/blocked",
        "Done",
      ])}
      {field("priority", "Priority", ["Low", "Normal", "High", "Urgent"])}
      {field("effort", "Effort", ["Low", "Medium", "High"])}
      {field("context", "Context", ["At home", "Away from home", "Anywhere"])}
      <Field label="Tag">
        <input
          value={value.tag}
          onChange={(e) => onChange({ ...value, tag: e.target.value })}
        />
      </Field>
      <Field label="Available time (minutes)">
        <input
          type="number"
          min="0"
          value={value.maxMinutes}
          onChange={(e) => onChange({ ...value, maxMinutes: e.target.value })}
        />
      </Field>
      <Field label="Planned date">
        <input
          type="date"
          value={value.plannedDay}
          onChange={(e) => onChange({ ...value, plannedDay: e.target.value })}
        />
      </Field>
      {(["projectId", "areaId"] as const).map((k) => (
        <Field label={k === "projectId" ? "Project" : "Area"} key={k}>
          <select
            value={value[k]}
            onChange={(e) => onChange({ ...value, [k]: e.target.value })}
          >
            <option value="">Any</option>
            {workspace.records
              .filter(
                (r) => r.kind === (k === "projectId" ? "project" : "area"),
              )
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {String(r.data.title)}
                </option>
              ))}
          </select>
        </Field>
      ))}
      {field("sort", "Sort", ["priority", "deadline", "estimate", "title"])}
    </div>
  );
}
function RecurrenceFields({
  value,
  onChange,
}: {
  value: Task["recurrence"];
  onChange: (v: Task["recurrence"]) => void;
}) {
  if (!value) return null;
  return (
    <>
      <div className="form-grid">
        <Field label="Schedule">
          <select
            value={value.mode}
            onChange={(e) =>
              onChange({ ...value, mode: e.target.value as typeof value.mode })
            }
          >
            <option value="daily">Daily</option>
            <option value="weekdays">Selected weekdays</option>
            <option value="custom">Custom RRULE</option>
            <option value="relative">After completion</option>
          </select>
        </Field>
        <Field
          label={value.mode === "weekdays" ? "Every (weeks)" : "Every (days)"}
        >
          <input
            type="number"
            min="1"
            value={value.interval}
            onChange={(e) =>
              onChange({ ...value, interval: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Start">
          <input
            type="date"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
          />
        </Field>
        <Field label="End date (optional)">
          <input
            type="date"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
          />
        </Field>
        <Field label="Occurrence limit (optional)">
          <input
            type="number"
            min="1"
            value={value.count || ""}
            onChange={(e) =>
              onChange({
                ...value,
                count: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </Field>
      </div>
      {value.mode === "weekdays" && (
        <div className="weekday-picker">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
            <label key={d}>
              <input
                type="checkbox"
                checked={value.weekdays.includes(i)}
                onChange={(e) =>
                  onChange({
                    ...value,
                    weekdays: e.target.checked
                      ? [...value.weekdays, i]
                      : value.weekdays.filter((x) => x !== i),
                  })
                }
              />
              {d}
            </label>
          ))}
        </div>
      )}
      {value.mode === "custom" && (
        <Field label="RRULE">
          <input
            value={value.rule}
            onChange={(e) => onChange({ ...value, rule: e.target.value })}
          />
        </Field>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={value.paused}
          onChange={(e) => onChange({ ...value, paused: e.target.checked })}
        />
        Pause future occurrences
      </label>
      <p className="muted">
        Completed, missed, and skipped history is kept. Calendar occurrences do
        not accumulate as overdue copies.
      </p>
    </>
  );
}
function RoutineTemplates({
  templates,
  onChange,
}: {
  templates: Routine["templates"];
  onChange: (t: Routine["templates"]) => void;
}) {
  return (
    <section>
      <h3>Ordered task templates</h3>
      {templates.map((t, i) => (
        <details key={i} open>
          <summary>
            {i + 1}. {t.title || "New task template"}
          </summary>
          <Field label="Task title">
            <input
              value={t.title || ""}
              onChange={(e) =>
                onChange(
                  templates.map((x, j) =>
                    j === i ? { ...x, title: e.target.value } : x,
                  ),
                )
              }
            />
          </Field>
          <div className="form-grid">
            <Field label="Estimate (minutes)">
              <input
                type="number"
                min="0"
                value={t.estimate || 0}
                onChange={(e) =>
                  onChange(
                    templates.map((x, j) =>
                      j === i ? { ...x, estimate: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Effort">
              <select
                value={t.effort || "Medium"}
                onChange={(e) =>
                  onChange(
                    templates.map((x, j) =>
                      j === i
                        ? { ...x, effort: e.target.value as Task["effort"] }
                        : x,
                    ),
                  )
                }
              >
                {["Low", "Medium", "High"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Context">
              <select
                value={t.context || "At home"}
                onChange={(e) =>
                  onChange(
                    templates.map((x, j) =>
                      j === i
                        ? { ...x, context: e.target.value as Task["context"] }
                        : x,
                    ),
                  )
                }
              >
                {["At home", "Away from home", "Anywhere"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <RichText
            value={t.notes || ""}
            onChange={(value) =>
              onChange(
                templates.map((x, j) => (j === i ? { ...x, notes: value } : x)),
              )
            }
          />
          <Checklist
            items={t.checklist || []}
            onChange={(v) =>
              onChange(
                templates.map((x, j) => (j === i ? { ...x, checklist: v } : x)),
              )
            }
          />
          <div className="button-row">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => {
                const next = [...templates];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
            >
              <ArrowUp size={14} />
              Up
            </button>
            <button
              type="button"
              disabled={i === templates.length - 1}
              onClick={() => {
                const next = [...templates];
                [next[i + 1], next[i]] = [next[i], next[i + 1]];
                onChange(next);
              }}
            >
              <ArrowDown size={14} />
              Down
            </button>
            <button
              type="button"
              onClick={() => onChange(templates.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} />
              Remove
            </button>
          </div>
        </details>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...templates,
            {
              title: "",
              estimate: 15,
              effort: "Low",
              context: "At home",
              notes: "",
              checklist: [],
            },
          ])
        }
      >
        <Plus size={15} />
        Add task template
      </button>
    </section>
  );
}
interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
}
export function PlaceSearch({
  onChoose,
}: {
  onChoose: (place: GooglePlace) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GooglePlace[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section>
      <Field label="Search Google Places">
        <div className="inline-fields">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or address"
          />
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const result = await request<{ places: GooglePlace[] }>(
                  "provider",
                  { action: "places", query },
                );
                setResults(result.places || []);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Search unavailable",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Searching…" : "Search"}
          </button>
        </div>
      </Field>
      <ErrorMessage error={error} />
      {results.map((p) => (
        <button
          className="place-result"
          type="button"
          key={p.id}
          onClick={() => onChoose(p)}
        >
          <strong>{p.displayName?.text}</strong>
          <span>{p.formattedAddress}</span>
          {p.regularOpeningHours?.weekdayDescriptions && (
            <small>
              {p.regularOpeningHours.weekdayDescriptions.join(" · ")}
            </small>
          )}
        </button>
      ))}
    </section>
  );
}
