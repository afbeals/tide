"use client";

import { useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import luxonPlugin from "@fullcalendar/luxon3";
import interactionPlugin from "@fullcalendar/interaction";
import { Circle, Check, Repeat, Clock, Flag, ChevronRight } from "lucide-react";
import { useWorkspace } from "./workspace";
import { Empty, Minutes, StatusBadge } from "./ui";
import { recordsOf, statuses } from "@/lib/types";
import type { Entity, Task, Person, Availability, Settings } from "@/lib/types";
import { dayTime, weekday, effectiveTask } from "@/lib/domain";

export function TaskRow({
  task,
  onOpen,
  selected,
  onSelect,
  compact = false,
}: {
  task: Entity<Task>;
  onOpen: (id: string) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
  compact?: boolean;
}) {
  const { workspace, save, notify } = useWorkspace();
  const owner = recordsOf<Person>(workspace.records, "person").find(
    (p) => p.id === task.data.ownerId,
  );
  const t = task.data;
  async function complete() {
    try {
      await save(
        "task",
        { ...t, status: t.status === "Done" ? "Open" : "Done" },
        task,
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not change status");
    }
  }
  return (
    <div
      className={`task-row ${selected ? "selected " : ""}${t.status === "Done" ? "task-done " : ""}${compact ? "compact" : ""}`}
    >
      <button
        className={`complete-button ${t.status === "Done" ? "is-done" : ""}`}
        aria-label={(t.status === "Done" ? "Reopen " : "Complete ") + t.title}
        onClick={() => void complete()}
      >
        {t.status === "Done" ? <Check size={14} /> : <Circle size={18} />}
      </button>
      <button className="task-row-main" onClick={() => onOpen(task.id)}>
        <span className="task-row-title">{t.title}</span>
        <span className="task-meta">
          <StatusBadge status={t.status} />
          {t.projectId && (
            <span>
              {String(
                workspace.records.find((r) => r.id === t.projectId)?.data
                  .title || "Project",
              )}
            </span>
          )}
          {t.deadline && (
            <span
              className={
                t.deadline < new Date().toISOString().slice(0, 10)
                  ? "overdue"
                  : ""
              }
            >
              Due {t.deadline}
            </span>
          )}
          {t.seriesId && (
            <span>
              <Repeat size={12} />
              Recurring
            </span>
          )}
          {t.outcome && t.outcome !== "done" && <span>{t.outcome}</span>}
          {t.someday && (
            <span>
              {t.reviewedAt
                ? "Reviewed " + t.reviewedAt.slice(0, 10)
                : "Added " + task.createdAt.slice(0, 10)}
            </span>
          )}
        </span>
      </button>
      <div className="task-row-end">
        {t.someday && (
          <button
            className="text-button"
            onClick={async () => {
              try {
                await save(
                  "task",
                  { ...t, reviewedAt: new Date().toISOString() },
                  task,
                );
                notify("Kept in Someday");
              } catch (e) {
                notify(
                  e instanceof Error ? e.message : "Could not retain task",
                );
              }
            }}
          >
            Keep
          </button>
        )}
        {t.priority !== "Normal" && (
          <Flag
            size={13}
            className={t.priority === "Urgent" ? "overdue" : "amber"}
          />
        )}
        <span className="estimate">
          <Clock size={12} />
          <Minutes value={t.estimate} />
        </span>
        {owner ? (
          <span className="owner-chip" title={owner.data.name}>
            <i style={{ background: owner.data.color }} />
            {owner.data.name}
          </span>
        ) : (
          <span className="owner-chip">Unassigned</span>
        )}
        {onSelect && (
          <input
            type="checkbox"
            aria-label={`Select ${t.title}`}
            checked={!!selected}
            onChange={() => onSelect(task.id)}
          />
        )}
        <button
          className="icon-button"
          aria-label={`Open ${t.title}`}
          onClick={() => onOpen(task.id)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function TaskList({
  tasks,
  onOpen,
  selection,
  onSelect,
}: {
  tasks: Entity<Task>[];
  onOpen: (id: string) => void;
  selection?: Set<string>;
  onSelect?: (id: string) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const open = tasks.filter((t) => t.data.status !== "Done");
  const done = tasks.filter((t) => t.data.status === "Done");
  return (
    <div className="task-list">
      {!tasks.length && (
        <Empty
          title="A little room to breathe"
          description="Add a task, adjust your filters, or leave some space in your day."
        />
      )}
      {open.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          onOpen={onOpen}
          selected={selection?.has(t.id)}
          onSelect={onSelect}
        />
      ))}
      {!!done.length && (
        <>
          <button
            className="completed-toggle"
            onClick={() => setShowDone(!showDone)}
          >
            {showDone ? "▾" : "▸"} Completed · {done.length}
          </button>
          {showDone &&
            done.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onOpen={onOpen}
                selected={selection?.has(t.id)}
                onSelect={onSelect}
              />
            ))}
        </>
      )}
    </div>
  );
}
function BoardCard({
  task,
  onOpen,
}: {
  task: Entity<Task>;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const { workspace, save, notify } = useWorkspace();
  const t = task.data;
  const owner = recordsOf<Person>(workspace.records, "person").find(
    (p) => p.id === t.ownerId,
  );
  return (
    <article
      ref={setNodeRef}
      className={`board-card ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <button
        className="drag-handle"
        aria-label={`Drag ${t.title}`}
        {...listeners}
        {...attributes}
      >
        ⠿
      </button>
      <button className="card-title" onClick={() => onOpen(task.id)}>
        {t.title}
      </button>
      <p className="task-meta">
        {t.deadline && <span>Due {t.deadline}</span>}
        {t.seriesId && <Repeat size={12} />}
        <Minutes value={t.estimate} />
      </p>
      {t.checklist.length > 0 && (
        <small className="muted">
          Checklist {t.checklist.filter((c) => c.done).length}/
          {t.checklist.length}
        </small>
      )}
      <div className="card-bottom">
        <span className="owner-chip">{owner?.data.name || "Unassigned"}</span>
        <select
          aria-label={`Status for ${t.title}`}
          value={t.status}
          onChange={async (e) => {
            try {
              await save(
                "task",
                { ...t, status: e.target.value as Task["status"] },
                task,
              );
            } catch (error) {
              notify(
                error instanceof Error
                  ? error.message
                  : "Could not change status",
              );
            }
          }}
        >
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
    </article>
  );
}
function BoardColumn({
  status,
  tasks,
  onOpen,
}: {
  status: string;
  tasks: Entity<Task>[];
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver ? "drop-target" : ""}`}
    >
      <h3>
        <span
          className={`status-dot status-${status.replaceAll(/[^a-z]/gi, "").toLowerCase()}`}
        />
        {status}
        <span className="count">{tasks.length}</span>
      </h3>
      {tasks.map((t) => (
        <BoardCard key={t.id} task={t} onOpen={onOpen} />
      ))}
      {!tasks.length && (
        <div className="column-empty">Room for what’s next</div>
      )}
    </section>
  );
}
export function TaskBoard({
  tasks,
  onOpen,
}: {
  tasks: Entity<Task>[];
  onOpen: (id: string) => void;
}) {
  const { save, notify } = useWorkspace();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  async function end(event: DragEndEvent) {
    const status = event.over?.id;
    if (!statuses.includes(status as Task["status"])) return;
    const task = tasks.find((t) => t.id === event.active.id);
    if (task && task.data.status !== status)
      try {
        await save(
          "task",
          { ...task.data, status: status as Task["status"] },
          task,
        );
      } catch (e) {
        notify(e instanceof Error ? e.message : "Move failed");
      }
  }
  return (
    <DndContext sensors={sensors} onDragEnd={end}>
      <div className="board">
        {statuses.map((s) => (
          <BoardColumn
            key={s}
            status={s}
            tasks={tasks.filter((t) => t.data.status === s)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </DndContext>
  );
}
export function TaskTimeline({
  tasks,
  day,
  onOpen,
  personId,
}: {
  tasks: Entity<Task>[];
  day: string;
  onOpen: (id: string) => void;
  personId: string;
}) {
  const { workspace, save, notify } = useWorkspace();
  const [tray, setTray] = useState(false);
  const cfg = recordsOf<Settings>(workspace.records, "settings")[0]?.data;
  const availability =
    recordsOf<Availability>(workspace.records, "availability").find(
      (a) => a.data.personId === personId && a.data.date === day,
    )?.data ||
    recordsOf<Availability>(workspace.records, "availability").find(
      (a) =>
        a.data.personId === personId &&
        !a.data.date &&
        a.data.weekdays.includes(weekday(day)),
    )?.data;
  const events = tasks.flatMap((t) => {
    if (!t.data.scheduledStart) return [];
    const start = t.data.scheduledStart;
    const end =
      t.data.scheduledEnd ||
      new Date(
        Date.parse(start) + Math.max(t.data.estimate, 15) * 60000,
      ).toISOString();
    const result = [
      {
        id: t.id,
        title: t.data.title,
        start,
        end,
        backgroundColor: t.data.fixed
          ? "#665a85"
          : t.data.status === "Done"
            ? "#425e50"
            : "#775f36",
        borderColor: "transparent",
        editable: !t.data.fixed,
      },
    ];
    const travel =
      effectiveTask(t.data, workspace.records, t.id).context ===
      "Away from home"
        ? t.data.travelMinutes + t.data.arrivalMinutes + t.data.prepMinutes
        : 0;
    if (travel)
      result.push({
        id: `travel-${t.id}`,
        title: `Travel & preparation · ${t.data.title}`,
        start: new Date(Date.parse(start) - travel * 60000).toISOString(),
        end: start,
        backgroundColor: "#324e5d",
        borderColor: "transparent",
        editable: false,
      });
    return result;
  });
  return (
    <div className={`timeline-layout ${tray ? "show-tray" : ""}`}>
      <button className="mobile-tray-toggle" onClick={() => setTray(!tray)}>
        {tray
          ? "Show timeline"
          : `Unscheduled · ${tasks.filter((t) => !t.data.scheduledStart).length}`}
      </button>
      <div className="calendar-wrap">
        <FullCalendar
          key={day + personId}
          plugins={[timeGridPlugin, interactionPlugin, luxonPlugin]}
          timeZone={cfg?.timezone || "UTC"}
          initialView="timeGridDay"
          initialDate={day}
          headerToolbar={false}
          height="auto"
          allDaySlot={false}
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          nowIndicator
          editable
          firstDay={cfg?.weekStart || 1}
          events={[
            ...events,
            ...(!availability
              ? []
              : [
                  {
                    id: "before-hours",
                    title: "Outside availability",
                    start: dayTime(day, "00:00", cfg?.timezone || "UTC"),
                    end: dayTime(
                      day,
                      availability.start,
                      cfg?.timezone || "UTC",
                    ),
                    display: "background",
                    backgroundColor: "var(--canvas)",
                    editable: false,
                  },
                  {
                    id: "after-hours",
                    title: "Outside availability",
                    start: dayTime(
                      day,
                      availability.end,
                      cfg?.timezone || "UTC",
                    ),
                    end: dayTime(day, "23:59", cfg?.timezone || "UTC"),
                    display: "background",
                    backgroundColor: "var(--canvas)",
                    editable: false,
                  },
                ]),
            ...(availability?.breaks || []).map((b, i) => ({
              id: `break-${i}`,
              title: "Unavailable",
              start: dayTime(day, b.start, cfg?.timezone || "UTC"),
              end: dayTime(day, b.end, cfg?.timezone || "UTC"),
              display: "background",
              backgroundColor: "var(--canvas)",
              editable: false,
            })),
          ]}
          eventClick={(event) => onOpen(event.event.id.replace("travel-", ""))}
          eventDrop={async (event) => {
            const task = tasks.find((t) => t.id === event.event.id);
            if (!task) return;
            try {
              await save(
                "task",
                {
                  ...task.data,
                  plannedDay: day,
                  scheduledStart: event.event.start?.toISOString() || "",
                  scheduledEnd: event.event.end?.toISOString() || "",
                },
                task,
              );
            } catch (error) {
              event.revert();
              notify(
                error instanceof Error ? error.message : "Could not reschedule",
              );
            }
          }}
          eventResize={async (event) => {
            const task = tasks.find((t) => t.id === event.event.id);
            if (!task) return;
            try {
              await save(
                "task",
                {
                  ...task.data,
                  scheduledEnd: event.event.end?.toISOString() || "",
                },
                task,
              );
            } catch (error) {
              event.revert();
              notify(
                error instanceof Error ? error.message : "Could not resize",
              );
            }
          }}
        />
      </div>
      <aside className="unscheduled">
        <h3>
          Unscheduled{" "}
          <span className="count">
            {tasks.filter((t) => !t.data.scheduledStart).length}
          </span>
        </h3>
        <p className="muted">
          Keep these untimed, or open a task to choose a time.
        </p>
        {tasks
          .filter((t) => !t.data.scheduledStart)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => onOpen(t.id)}
              className="tray-card"
            >
              <strong>{t.data.title}</strong>
              <span>
                <Minutes value={t.data.estimate} /> · {t.data.status}
              </span>
            </button>
          ))}
      </aside>
    </div>
  );
}
