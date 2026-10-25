import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import {
  addDays,
  capacity,
  effectiveTask,
  filterTasks,
  instantInZone,
  localDateTime,
  nextBackup,
  normalizeTimes,
  occurrenceData,
  occurrenceMatches,
  parseData,
} from "../src/lib/domain";
import {
  defaultFilters,
  settingsDefaults,
  taskDefaults,
} from "../src/lib/types";
import type { Entity, Filters, Kind, Task } from "../src/lib/types";
const entity = (id: string, fields: Partial<Task>): Entity<Task> => ({
  id,
  kind: "task",
  version: 1,
  data: { ...taskDefaults(id), ...fields },
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-10-01T12:00:00Z",
});
const tasks = [
  entity("Alpha", {
    ownerId: "a",
    priority: "High",
    estimate: 15,
    tags: ["work"],
    plannedDay: "2026-10-24",
    deadline: "2026-10-25",
    projectId: "project",
    effort: "Low",
    context: "Anywhere",
    notes: "Customer research",
  }),
  entity("Beta", {
    ownerId: "b",
    priority: "Urgent",
    estimate: 60,
    status: "Waiting/blocked",
    deadline: "2026-10-24",
    areaId: "home",
    context: "Away from home",
  }),
  entity("Gamma", { ownerId: null, estimate: 30, context: "At home" }),
];
const project = {
  id: "project",
  kind: "project",
  data: { areaId: "work" },
} as unknown as Entity;
describe("planning selection, validation and dates", () => {
  it.each<[Partial<Filters>, string[]]>([
    [{ query: "CUSTOMER" }, ["Alpha"]],
    [{ owner: "unassigned" }, ["Gamma"]],
    [{ owner: "b" }, ["Beta"]],
    [{ status: "Waiting/blocked" }, ["Beta"]],
    [{ priority: "High" }, ["Alpha"]],
    [{ effort: "Low" }, ["Alpha"]],
    [{ context: "At home" }, ["Alpha", "Gamma"]],
    [{ tag: "work" }, ["Alpha"]],
    [{ projectId: "project" }, ["Alpha"]],
    [{ areaId: "work" }, ["Alpha"]],
    [{ maxMinutes: "20" }, ["Alpha"]],
    [{ plannedDay: "2026-10-24" }, ["Alpha"]],
    [{ query: "no match" }, []],
  ])("filters the intended work for %j", (filters, ids) => {
    expect(
      filterTasks(tasks, { ...defaultFilters, ...filters, sort: "title" }, [
        project,
      ]).map((t) => t.id),
    ).toEqual(ids);
  });
  it.each<[string, string[]]>([
    ["priority", ["Beta", "Alpha", "Gamma"]],
    ["title", ["Alpha", "Beta", "Gamma"]],
    ["deadline", ["Beta", "Alpha", "Gamma"]],
    ["estimate", ["Alpha", "Gamma", "Beta"]],
  ])("sorts by %s, including tasks without deadlines", (sort, ids) => {
    expect(
      filterTasks(tasks, { ...defaultFilters, sort }).map((t) => t.id),
    ).toEqual(ids);
  });
  it("hides malformed series links and resolves inherited outing context before filtering", () => {
    const inherited = entity("Inherited", {
      context: "Inherit",
      origin: "Home",
    });
    const outing = {
      id: "outing",
      kind: "outing",
      data: {
        taskIds: [inherited.id],
        origin: "Work",
        travelMode: "WALK",
        departure: "",
        arrival: "",
      },
    } as unknown as Entity;
    expect(effectiveTask(inherited.data, [], inherited.id).context).toBe(
      "Anywhere",
    );
    expect(effectiveTask(inherited.data, [outing], inherited.id)).toMatchObject(
      { context: "Away from home", origin: "Work", travelMode: "WALK" },
    );
    expect(
      filterTasks(
        [inherited, entity("Bad series", { seriesId: "s" })],
        { ...defaultFilters, context: "Away from home" },
        [outing],
      ).map((t) => t.id),
    ).toEqual([inherited.id]);
    expect(capacity("missing", "2026-10-24", [])).toBe(0);
  });
  it.each<Partial<Task>>([
    { scheduledStart: "bad" },
    {
      scheduledStart: "2026-10-24T12:00:00Z",
      scheduledEnd: "2026-10-24T11:00:00Z",
    },
    { startDay: "2026-10-25", deadline: "2026-10-24" },
    {
      recurrence: {
        mode: "weekdays",
        interval: 1,
        weekdays: [],
        rule: "",
        start: "2026-10-24",
        end: "",
        count: null,
        paused: false,
      },
    },
    {
      recurrence: {
        mode: "custom",
        interval: 1,
        weekdays: [],
        rule: "NOT_A_RULE",
        start: "2026-10-24",
        end: "",
        count: null,
        paused: false,
      },
    },
    {
      recurrence: {
        mode: "daily",
        interval: 1,
        weekdays: [],
        rule: "",
        start: "2026-10-25",
        end: "2026-10-24",
        count: null,
        paused: false,
      },
    },
  ])("rejects invalid task dates or recurrence %j", (fields) => {
    expect(() =>
      parseData("task", { ...taskDefaults("Invalid"), ...fields }),
    ).toThrow();
  });
  it("validates availability bounds and IANA time zones", () => {
    const available = {
      personId: "a",
      date: "",
      weekdays: [1],
      start: "09:00",
      end: "17:00",
      breaks: [],
    };
    expect(() =>
      parseData("availability", { ...available, end: "08:00" }),
    ).toThrow();
    expect(() =>
      parseData("availability", {
        ...available,
        breaks: [{ start: "08:30", end: "10:00" }],
      }),
    ).toThrow();
    expect(() =>
      parseData("settings", {
        ...settingsDefaults,
        timezone: "not/a/timezone",
      }),
    ).toThrow();
  });
  it("normalizes outing datetimes, leaves ordinary records alone and formats empty or offset values", () => {
    expect(instantInZone("", "America/Los_Angeles")).toBe("");
    expect(localDateTime("", "America/Los_Angeles")).toBe("");
    expect(localDateTime("2026-10-24T09:30", "America/Los_Angeles")).toBe(
      "2026-10-24T09:30",
    );
    expect(
      instantInZone("2026-10-24T09:30:00-07:00", "America/Los_Angeles"),
    ).toBe("2026-10-24T16:30:00Z");
    expect(
      normalizeTimes(
        "outing",
        { departure: "2026-10-24T09:30", arrival: "" },
        "America/Los_Angeles",
      ),
    ).toEqual({ departure: "2026-10-24T16:30:00Z", arrival: "" });
    expect(
      normalizeTimes(
        "project" as Kind,
        { title: "Project" },
        "America/Los_Angeles",
      ),
    ).toEqual({ title: "Project" });
  });
  it("preserves an overnight recurring appointment through the DST change", () => {
    const occurrence = occurrenceData(
      {
        ...taskDefaults("Night shift"),
        scheduledStart: "2026-10-31T23:30",
        scheduledEnd: "2026-11-01T03:30",
        reminderAt: "2026-10-31T22:30",
      },
      "2026-11-07",
      "America/Los_Angeles",
    );
    expect(
      localDateTime(occurrence.scheduledStart, "America/Los_Angeles"),
    ).toBe("2026-11-07T23:30");
    expect(localDateTime(occurrence.scheduledEnd, "America/Los_Angeles")).toBe(
      "2026-11-08T03:30",
    );
    expect(occurrence.status).toBe("Open");
  });
  it("respects excluded recurrence intervals, daily intervals and non-calendar tasks", () => {
    const t = {
      ...taskDefaults("Daily"),
      recurrence: {
        mode: "daily" as const,
        interval: 2,
        weekdays: [],
        rule: "",
        start: "2026-10-24",
        end: "",
        count: null,
        paused: false,
        excludedPeriods: [{ start: "2026-10-26", end: "2026-10-28" }],
      },
    };
    expect(occurrenceMatches(t, "2026-10-24")).toBe(true);
    expect(occurrenceMatches(t, "2026-10-25")).toBe(false);
    expect(occurrenceMatches(t, "2026-10-26")).toBe(false);
    expect(occurrenceMatches(taskDefaults("One off"), "2026-10-24")).toBe(
      false,
    );
    expect(
      occurrenceMatches(
        { ...t, recurrence: { ...t.recurrence, mode: "relative" } },
        "2026-10-24",
      ),
    ).toBe(false);
  });
  it("finds next-week schedules and disables schedules with no selected weekdays", () => {
    const now = Temporal.Instant.from("2026-10-24T20:00:00Z");
    expect(
      nextBackup({ ...settingsDefaults, backupWeekdays: [] }, now),
    ).toBeNull();
    expect(
      nextBackup(
        { ...settingsDefaults, backupWeekdays: [6], backupTime: "03:00" },
        now,
      ),
    ).toBe("2026-10-31T10:00:00Z");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
