import { Temporal } from "@js-temporal/polyfill";
import * as rrule from "rrule";
// rrule publishes CommonJS; support native Node ESM and Next's bundled namespace.
const { RRule } =
  (rrule as unknown as { default?: typeof rrule }).default || rrule;
import { z } from "zod";
import { kinds, statuses, taskDefaults, settingsDefaults } from "./types";
import type {
  Task,
  Entity,
  Filters,
  Availability,
  Kind,
  Plan,
  Settings,
} from "./types";

const day = z.string().refine(
  (v) =>
    !v ||
    (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
      (() => {
        try {
          Temporal.PlainDate.from(v);
          return true;
        } catch {
          return false;
        }
      })()),
  "Choose a valid date",
);
const time = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time");
const minute = z.number().int().min(0).max(10080);
const title = z.string().trim().min(1, "A title is required").max(500);
const checkItem = z.object({
  id: z.string(),
  text: z.string().max(2000),
  done: z.boolean(),
});
const recurrenceSchema = z
  .object({
    mode: z.enum(["daily", "weekdays", "custom", "relative"]),
    interval: z.number().int().min(1).max(365),
    weekdays: z.array(z.number().int().min(0).max(6)),
    rule: z.string(),
    start: day,
    end: day,
    count: z.number().int().min(1).max(10000).nullable(),
    paused: z.boolean(),
    pausedSince: day.optional(),
    excludedPeriods: z.array(z.object({ start: day, end: day })).optional(),
  })
  .superRefine((v, c) => {
    if (v.mode === "weekdays" && !v.weekdays.length)
      c.addIssue({ code: "custom", message: "Choose at least one weekday" });
    if (v.end && v.start && v.end < v.start)
      c.addIssue({
        code: "custom",
        message: "Recurrence end must follow its start",
      });
    if (v.mode === "custom")
      try {
        RRule.fromString(v.rule);
      } catch {
        c.addIssue({ code: "custom", message: "Enter a valid RRULE" });
      }
  });
const taskSchema = z
  .object({
    suspended: z.boolean().optional(),
    occurrenceOverrides: z.array(z.string()).optional(),
    title,
    status: z.enum(statuses),
    ownerId: z.string().nullable(),
    projectId: z.string().nullable(),
    areaId: z.string().nullable(),
    plannedDay: day,
    startDay: day,
    deadline: day,
    scheduledStart: z.string(),
    scheduledEnd: z.string(),
    fixed: z.boolean(),
    dayPart: z.string(),
    priority: z.enum(["Low", "Normal", "High", "Urgent"]),
    tags: z.array(z.string().max(100)),
    estimate: minute,
    effort: z.enum(["Low", "Medium", "High"]),
    notes: z.string().max(500000),
    checklist: z.array(checkItem),
    dependencies: z.array(z.string()),
    blockingNote: z.string(),
    referenceIds: z.array(z.string()),
    attachmentIds: z.array(z.string()),
    context: z.enum(["At home", "Away from home", "Anywhere", "Inherit"]),
    outdoor: z.boolean(),
    placeId: z.string().nullable(),
    destination: z.string(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    origin: z.string(),
    travelMode: z.enum(["DRIVE", "WALK", "BICYCLE", "TRANSIT"]),
    departure: z.string(),
    arrival: z.string(),
    prepMinutes: minute,
    arrivalMinutes: minute,
    travelMinutes: minute,
    returnMinutes: minute,
    reminderAt: z.string(),
    recurrence: recurrenceSchema.nullable(),
    seriesId: z.string().nullable(),
    occurrenceDay: day,
    outcome: z.enum(["done", "skipped", "missed"]).nullable(),
    completedAt: z.string(),
    archived: z.boolean(),
    deletedAt: z.string(),
    someday: z.boolean(),
    reviewedAt: z.string(),
  })
  .superRefine((v, c) => {
    for (const k of [
      "scheduledStart",
      "scheduledEnd",
      "departure",
      "arrival",
      "reminderAt",
    ] as const)
      if (v[k] && !Number.isFinite(Date.parse(v[k])))
        c.addIssue({
          code: "custom",
          path: [k],
          message: "Choose a valid date and time",
        });
    if (
      v.scheduledStart &&
      v.scheduledEnd &&
      new Date(v.scheduledEnd) <= new Date(v.scheduledStart)
    )
      c.addIssue({
        code: "custom",
        path: ["scheduledEnd"],
        message: "End must follow start",
      });
    if (v.startDay && v.deadline && v.startDay > v.deadline)
      c.addIssue({
        code: "custom",
        path: ["deadline"],
        message: "Deadline cannot precede start date",
      });
  });
const template = z.object({
  title,
  estimate: minute.default(0),
  effort: z.enum(["Low", "Medium", "High"]).default("Medium"),
  context: z
    .enum(["At home", "Away from home", "Anywhere", "Inherit"])
    .default("At home"),
  notes: z.string().default(""),
  checklist: z.array(checkItem).default([]),
});
const filters = z.object({
  query: z.string(),
  owner: z.string(),
  status: z.string(),
  priority: z.string(),
  effort: z.string(),
  context: z.string(),
  tag: z.string(),
  projectId: z.string(),
  areaId: z.string(),
  maxMinutes: z
    .string()
    .refine((v) => !v || /^\d+$/.test(v), "Enter whole minutes"),
  plannedDay: z.string(),
  sort: z.string(),
});
const schemas = {
  task: taskSchema,
  person: z.object({
    name: title,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    retired: z.boolean(),
  }),
  area: z.object({ title, notes: z.string() }),
  project: z.object({
    title,
    areaId: z.string().nullable(),
    notes: z.string(),
    targetDay: day,
    referenceIds: z.array(z.string()),
    archived: z.boolean(),
  }),
  routine: z.object({
    title,
    notes: z.string(),
    templates: z.array(template).max(100),
  }),
  reference: z.object({
    title,
    type: z.enum(["Note", "Link", "File", "Image", "Checklist"]),
    notes: z.string(),
    url: z
      .string()
      .refine(
        (v) => !v || /^https?:\/\//i.test(v),
        "Use an http or https link",
      ),
    checklist: z.array(checkItem),
    attachmentIds: z.array(z.string()),
    tags: z.array(z.string()),
  }),
  place: z.object({
    name: title,
    address: z.string().trim().min(1, "Address is required"),
    placeId: z.string(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
  }),
  view: z.object({ title, filters }),
  plan: z.object({
    personId: z.string(),
    day,
    taskIds: z.array(z.string()),
    focusIds: z.array(z.string()).max(3, "Choose at most three focus tasks"),
    notes: z.string(),
    reflection: z.string(),
    essentials: z.array(checkItem),
    essentialsPinned: z.boolean(),
    reviewed: z.boolean(),
    planningStep: z.number().int().min(0).max(4),
  }),
  availability: z
    .object({
      personId: z.string(),
      date: day,
      weekdays: z.array(z.number().int().min(0).max(6)),
      start: time,
      end: time,
      breaks: z.array(z.object({ start: time, end: time })),
    })
    .superRefine((v, c) => {
      if (v.end <= v.start)
        c.addIssue({
          code: "custom",
          message: "Availability end must follow start",
        });
      const b = [...v.breaks].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 0; i < b.length; i++)
        if (
          b[i].end <= b[i].start ||
          b[i].start < v.start ||
          b[i].end > v.end ||
          (i > 0 && b[i].start < b[i - 1].end)
        )
          c.addIssue({
            code: "custom",
            message: "Breaks must be within availability and cannot overlap",
          });
    }),
  outing: z.object({
    title,
    notes: z.string(),
    context: z.literal("Away from home"),
    taskIds: z.array(z.string()),
    origin: z.string(),
    travelMode: z.enum(["DRIVE", "WALK", "BICYCLE", "TRANSIT"]),
    departure: z.string(),
    arrival: z.string(),
    returnTrip: z.boolean(),
    returnAddress: z.string(),
    bring: z.array(checkItem),
  }),
  settings: z.object({
    title,
    timezone: z.string().refine((v) => {
      try {
        Temporal.Now.zonedDateTimeISO(v);
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid IANA time zone"),
    weekStart: z.number().int().min(0).max(6),
    dayBoundary: time,
    backupEnabled: z.boolean(),
    backupTime: time,
    backupWeekdays: z.array(z.number().int().min(0).max(6)),
    retentionDaily: z.number().int().min(1).max(365),
    retentionWeekly: z.number().int().min(0).max(52),
    retentionSafety: z.number().int().min(1).max(30),
    googleEnabled: z.boolean(),
    googleDailyLimit: z.number().int().min(0).max(100000),
  }),
  attachment: z.object({
    title,
    filename: z.string(),
    mime: z.string(),
    bytes: z.number().int().min(0),
    storageKey: z.string(),
  }),
  timeLog: z.object({
    personId: z.string(),
    taskId: z.string(),
    startedAt: z.string(),
    pausedAt: z.string(),
    elapsedSeconds: z.number().min(0),
    durationSeconds: z.number().int().min(60).max(86400),
    running: z.boolean(),
    stoppedAt: z.string(),
  }),
  reminder: z.object({
    taskId: z.string(),
    at: z.string(),
    dismissed: z.boolean(),
  }),
};
export const envelopeSchema = z.object({
  kind: z.enum(kinds),
  data: z.record(z.string(), z.unknown()),
  version: z.number().int().positive().optional(),
});
export function parseData(kind: Kind, input: unknown): Record<string, unknown> {
  return schemas[kind].parse(input) as Record<string, unknown>;
}
export function workspaceDay(
  settings: Settings = settingsDefaults,
  now: Temporal.Instant = Temporal.Now.instant(),
) {
  const z = now.toZonedDateTimeISO(settings.timezone);
  return z.toPlainTime().toString().slice(0, 5) < settings.dayBoundary
    ? z.toPlainDate().subtract({ days: 1 }).toString()
    : z.toPlainDate().toString();
}
export function addDays(day: string, n: number) {
  return Temporal.PlainDate.from(day).add({ days: n }).toString();
}
export function weekday(day: string) {
  return Temporal.PlainDate.from(day).dayOfWeek % 7;
}
export function dayTime(day: string, time: string, timezone: string) {
  return Temporal.PlainDateTime.from(`${day}T${time}`)
    .toZonedDateTime(timezone)
    .toInstant()
    .toString();
}
export function newPlan(personId: string, day: string): Plan {
  return {
    personId,
    day,
    taskIds: [],
    focusIds: [],
    notes: "",
    reflection: "",
    essentials: [],
    essentialsPinned: true,
    reviewed: false,
    planningStep: 0,
  };
}
export function occurrenceMatches(task: Task, target: string) {
  const r = task.recurrence;
  if (
    !r ||
    r.paused ||
    r.mode === "relative" ||
    target < (r.start || target) ||
    (r.end && target > r.end)
  )
    return false;
  if (r.excludedPeriods?.some((p) => target >= p.start && target < p.end))
    return false;
  const start = r.start || target;
  const delta = Temporal.PlainDate.from(target).since(
    Temporal.PlainDate.from(start),
  ).days;
  let match =
    r.mode === "daily"
      ? delta % r.interval === 0
      : r.mode === "weekdays"
        ? r.weekdays.includes(weekday(target)) &&
          Math.floor(delta / 7) % r.interval === 0
        : false;
  const anchor = new Date(`${start}T00:00:00Z`);
  const date = new Date(`${target}T00:00:00Z`);
  if (r.mode === "custom") {
    const rule = new RRule({ ...RRule.parseString(r.rule), dtstart: anchor });
    match =
      rule.between(date, new Date(date.getTime() + 86399999), true).length > 0;
  }
  if (match && r.count) {
    let count = 0;
    for (let d = start; d <= target; d = addDays(d, 1)) {
      const copy = { ...task, recurrence: { ...r, count: null } };
      if (occurrenceMatches(copy, d)) count++;
      if (count > r.count) return false;
    }
  }
  return match;
}
export function dependencyCycle(
  id: string,
  deps: string[],
  tasks: Entity<Task>[],
) {
  const edges = new Map(tasks.map((t) => [t.id, t.data.dependencies]));
  edges.set(id, deps);
  const visit = (node: string, path: Set<string>): boolean => {
    if (path.has(node)) return true;
    const next = new Set(path).add(node);
    return (edges.get(node) || []).some((d) => visit(d, next));
  };
  return visit(id, new Set());
}
export function minutesBetween(start: string, end: string) {
  const to = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
  return Math.max(0, to(end) - to(start));
}
export function capacity(
  personId: string,
  day: string,
  availability: Entity<Availability>[],
) {
  const a =
    availability.find(
      (a) => a.data.personId === personId && a.data.date === day,
    )?.data ||
    availability.find(
      (a) =>
        a.data.personId === personId &&
        !a.data.date &&
        a.data.weekdays.includes(weekday(day)),
    )?.data;
  return a
    ? Math.max(
        0,
        minutesBetween(a.start, a.end) -
          a.breaks.reduce((sum, b) => sum + minutesBetween(b.start, b.end), 0),
      )
    : 0;
}
export function workload(tasks: Entity<Task>[], records: Entity[] = []) {
  return tasks.reduce((sum, entity) => {
    const t = effectiveTask(entity.data, records, entity.id);
    return (
      sum +
      (t.scheduledStart && t.scheduledEnd
        ? Math.max(
            0,
            (Date.parse(t.scheduledEnd) - Date.parse(t.scheduledStart)) / 60000,
          )
        : t.estimate) +
      (t.context === "Away from home"
        ? t.prepMinutes + t.arrivalMinutes + t.travelMinutes + t.returnMinutes
        : 0)
    );
  }, 0);
}
export function filterTasks(
  tasks: Entity<Task>[],
  f: Filters,
  records: Entity[] = [],
) {
  const priority = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
  return tasks
    .filter(({ data: t }) => !t.seriesId || !!t.occurrenceDay)
    .filter((entity) => {
      const t = effectiveTask(entity.data, records, entity.id);
      const areaId =
        t.areaId || records.find((r) => r.id === t.projectId)?.data.areaId;
      const text = `${t.title} ${t.notes} ${t.tags.join(" ")}`.toLowerCase();
      return (
        (!f.query || text.includes(f.query.toLowerCase())) &&
        (f.owner === "all" ||
          (f.owner === "unassigned" ? !t.ownerId : t.ownerId === f.owner)) &&
        (!f.status || t.status === f.status) &&
        (!f.priority || t.priority === f.priority) &&
        (!f.effort || t.effort === f.effort) &&
        (!f.context ||
          t.context === f.context ||
          (f.context === "At home" && t.context === "Anywhere")) &&
        (!f.tag || t.tags.includes(f.tag)) &&
        (!f.projectId || t.projectId === f.projectId) &&
        (!f.areaId || areaId === f.areaId) &&
        (!f.maxMinutes || t.estimate <= Number(f.maxMinutes)) &&
        (!f.plannedDay || t.plannedDay === f.plannedDay)
      );
    })
    .sort((a, b) =>
      f.sort === "title"
        ? a.data.title.localeCompare(b.data.title)
        : f.sort === "deadline"
          ? (a.data.deadline || "9999").localeCompare(b.data.deadline || "9999")
          : f.sort === "estimate"
            ? a.data.estimate - b.data.estimate
            : priority[a.data.priority] - priority[b.data.priority],
    );
}
export function copyTask(task: Task, day: string): Task {
  return {
    ...taskDefaults(),
    ...structuredClone(task),
    suspended: false,
    occurrenceOverrides: [],
    status: "Open",
    plannedDay: day,
    scheduledStart: "",
    scheduledEnd: "",
    completedAt: "",
    deletedAt: "",
    archived: false,
    someday: false,
    seriesId: null,
    recurrence: null,
    occurrenceDay: "",
    outcome: null,
    reminderAt: "",
    checklist: task.checklist.map((c) => ({ ...c, done: false })),
  };
}

/** Convert a datetime-local value using workspace time, independent of the server/device zone. */
export function instantInZone(value: string, timezone: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value))
    return Temporal.PlainDateTime.from(value)
      .toZonedDateTime(timezone, { disambiguation: "compatible" })
      .toInstant()
      .toString();
  return Temporal.Instant.from(value).toString();
}
export function localDateTime(value: string, timezone: string) {
  if (!value) return "";
  if (!/Z$|[+-]\d{2}:\d{2}$/.test(value)) return value.slice(0, 16);
  return Temporal.Instant.from(value)
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime()
    .toString()
    .slice(0, 16);
}
export function normalizeTimes(kind: Kind, input: unknown, timezone: string) {
  const data = { ...(input as Record<string, unknown>) };
  for (const key of kind === "task"
    ? ["scheduledStart", "scheduledEnd", "departure", "arrival", "reminderAt"]
    : kind === "outing"
      ? ["departure", "arrival"]
      : [])
    if (typeof data[key] === "string" && data[key])
      data[key] = instantInZone(data[key] as string, timezone);
  return data;
}
export function occurrenceData(
  series: Task,
  day: string,
  timezone: string,
): Task {
  const result = { ...copyTask(series, day), seriesId: "", occurrenceDay: day };
  for (const key of [
    "scheduledStart",
    "scheduledEnd",
    "departure",
    "arrival",
    "reminderAt",
  ] as const) {
    const local = localDateTime(series[key], timezone);
    if (local) {
      // Keep overnight end offsets relative to the appointment's start date.
      const anchor =
        localDateTime(series.scheduledStart, timezone).slice(0, 10) ||
        local.slice(0, 10);
      const offset = Temporal.PlainDate.from(local.slice(0, 10)).since(
        Temporal.PlainDate.from(anchor),
      ).days;
      result[key] = instantInZone(
        addDays(day, offset) + local.slice(10),
        timezone,
      );
    }
  }
  return result;
}
export function effectiveTask(
  task: Task,
  records: Entity[],
  taskId: string,
): Task {
  if (task.context !== "Inherit") return task;
  const outing = records.find(
    (r) => r.kind === "outing" && (r.data.taskIds as string[]).includes(taskId),
  );
  if (!outing) return { ...task, context: "Anywhere" };
  return {
    ...task,
    context: "Away from home",
    origin: task.origin === "Home" ? String(outing.data.origin) : task.origin,
    travelMode: String(outing.data.travelMode),
    departure: task.departure || String(outing.data.departure),
    arrival: task.arrival || String(outing.data.arrival),
  };
}

export function nextBackup(
  settings: Settings,
  now: Temporal.Instant = Temporal.Now.instant(),
) {
  if (!settings.backupEnabled || !settings.backupWeekdays.length) return null;
  const local = now.toZonedDateTimeISO(settings.timezone);
  for (let i = 0; i < 8; i++) {
    const date = local.toPlainDate().add({ days: i }).toString();
    if (!settings.backupWeekdays.includes(weekday(date))) continue;
    const candidate = dayTime(date, settings.backupTime, settings.timezone);
    if (Temporal.Instant.compare(Temporal.Instant.from(candidate), now) > 0)
      return candidate;
  }
  return null;
}
