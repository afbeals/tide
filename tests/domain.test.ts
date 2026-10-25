import { describe, it, expect } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import {
  workspaceDay,
  parseData,
  dependencyCycle,
  occurrenceMatches,
  copyTask,
  workload,
  capacity,
  nextBackup,
  instantInZone,
  localDateTime,
  effectiveTask,
} from "../src/lib/domain";
import { taskDefaults, settingsDefaults } from "../src/lib/types";
import type { Entity, Task, Availability } from "../src/lib/types";
const entity = (id: string, data: Task) =>
  ({
    id,
    kind: "task",
    version: 1,
    data,
    createdAt: "",
    updatedAt: "",
  }) as Entity<Task>;
describe("planner invariants", () => {
  it("uses the configured boundary in workspace timezone through DST", () => {
    const cfg = { ...settingsDefaults, dayBoundary: "04:00" };
    expect(
      workspaceDay(cfg, Temporal.Instant.from("2026-03-08T10:30:00Z")),
    ).toBe("2026-03-07");
    expect(
      workspaceDay(cfg, Temporal.Instant.from("2026-03-08T11:00:00Z")),
    ).toBe("2026-03-08");
  });
  it("normalizes local schedule inputs across DST independent of server time zone", () => {
    expect(instantInZone("2026-07-01T09:30", "America/Los_Angeles")).toBe(
      "2026-07-01T16:30:00Z",
    );
    expect(instantInZone("2026-12-01T09:30", "America/Los_Angeles")).toBe(
      "2026-12-01T17:30:00Z",
    );
    expect(localDateTime("2026-12-01T17:30:00Z", "America/Los_Angeles")).toBe(
      "2026-12-01T09:30",
    );
  });
  it("inherits away context only from an explicit outing and includes its travel in capacity", () => {
    const t = entity("x", {
      ...taskDefaults("Inherited"),
      context: "Inherit",
      estimate: 20,
      travelMinutes: 10,
    });
    const rows = [
      t,
      {
        id: "outing",
        kind: "outing",
        data: {
          taskIds: ["x"],
          origin: "Work",
          travelMode: "WALK",
          departure: "",
          arrival: "",
        },
      },
    ] as unknown as Entity[];
    expect(effectiveTask(t.data, rows, t.id).context).toBe("Away from home");
    expect(workload([t], rows)).toBe(30);
    expect(workload([t])).toBe(20);
  });
  it("calculates the next selected backup weekday across a DST transition", () => {
    const cfg = {
      ...settingsDefaults,
      backupWeekdays: [0],
      backupTime: "03:00",
    };
    expect(nextBackup(cfg, Temporal.Instant.from("2026-03-08T09:00:00Z"))).toBe(
      "2026-03-08T10:00:00Z",
    );
    expect(nextBackup({ ...cfg, backupEnabled: false })).toBeNull();
  });
  it("rejects malformed dates, negative estimates, and invalid availability", () => {
    expect(() =>
      parseData("task", { ...taskDefaults("A"), plannedDay: "2026-02-30" }),
    ).toThrow();
    expect(() =>
      parseData("task", { ...taskDefaults("A"), estimate: -1 }),
    ).toThrow();
    expect(() =>
      parseData("availability", {
        personId: "a",
        date: "",
        weekdays: [1],
        start: "09:00",
        end: "17:00",
        breaks: [
          { start: "12:00", end: "13:00" },
          { start: "12:30", end: "13:30" },
        ],
      }),
    ).toThrow();
  });
  it("detects cycles including a future cycle through another prerequisite", () => {
    const a = entity("a", { ...taskDefaults("A"), dependencies: ["b"] });
    const b = entity("b", taskDefaults("B"));
    expect(dependencyCycle("b", ["a"], [a, b])).toBe(true);
    expect(dependencyCycle("a", ["b"], [a, b])).toBe(false);
  });
  it("honors weekday interval and occurrence count", () => {
    const t = {
      ...taskDefaults("Plants"),
      recurrence: {
        mode: "weekdays" as const,
        interval: 1,
        weekdays: [1, 3],
        rule: "",
        start: "2026-10-26",
        end: "",
        count: 2,
        paused: false,
      },
    };
    expect(occurrenceMatches(t, "2026-10-26")).toBe(true);
    expect(occurrenceMatches(t, "2026-10-28")).toBe(true);
    expect(occurrenceMatches(t, "2026-11-02")).toBe(false);
    expect(occurrenceMatches(t, "2026-10-27")).toBe(false);
  });
  it("honors custom RRULE and paused series", () => {
    const t = {
      ...taskDefaults("A"),
      recurrence: {
        mode: "custom" as const,
        interval: 1,
        weekdays: [],
        rule: "FREQ=WEEKLY;BYDAY=FR",
        start: "2026-10-26",
        end: "2026-11-01",
        count: null,
        paused: false,
      },
    };
    expect(occurrenceMatches(t, "2026-10-30")).toBe(true);
    expect(occurrenceMatches(t, "2026-11-06")).toBe(false);
    expect(
      occurrenceMatches(
        { ...t, recurrence: { ...t.recurrence, paused: true } },
        "2026-10-30",
      ),
    ).toBe(false);
  });
  it("copies content while resetting progress recurrence reminders and schedule", () => {
    const t = {
      ...taskDefaults("A"),
      status: "Done" as const,
      completedAt: "2026-10-24",
      scheduledStart: "2026-10-24T10:00:00Z",
      scheduledEnd: "2026-10-24T11:00:00Z",
      seriesId: "series",
      reminderAt: "2026-10-24T10:00:00Z",
      checklist: [{ id: "c", text: "Step", done: true }],
    };
    const c = copyTask(t, "2026-10-25");
    expect(c.status).toBe("Open");
    expect(c.checklist[0].done).toBe(false);
    expect(c.scheduledStart).toBe("");
    expect(c.seriesId).toBeNull();
    expect(c.reminderAt).toBe("");
    expect(c.title).toBe(t.title);
  });
  it("does not count both a scheduled duration and its estimate", () => {
    const t = entity("a", {
      ...taskDefaults("A"),
      estimate: 90,
      scheduledStart: "2026-10-24T10:00:00Z",
      scheduledEnd: "2026-10-24T11:00:00Z",
      context: "Away from home",
      travelMinutes: 20,
      arrivalMinutes: 10,
    });
    expect(workload([t])).toBe(90);
  });
  it("uses a date-specific capacity override before recurring hours", () => {
    const data = {
      personId: "p",
      date: "",
      weekdays: [1],
      start: "09:00",
      end: "17:00",
      breaks: [{ start: "12:00", end: "13:00" }],
    };
    const rows = [
      { data },
      { data: { ...data, date: "2026-10-26", end: "13:00", breaks: [] } },
    ] as Entity<Availability>[];
    expect(capacity("p", "2026-10-26", rows)).toBe(240);
  });
});
