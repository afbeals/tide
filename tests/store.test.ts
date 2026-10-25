import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { taskDefaults } from "../src/lib/types";
import type { Entity, Task, TimeLog } from "../src/lib/types";
import { newPlan, workspaceDay, addDays } from "../src/lib/domain";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "tide-store-test-"));
process.env.TIDE_DATA_DIR = root;
process.env.DATABASE_URL = `file:${path.join(root, "workspace.db")}`;
let store: typeof import("../src/server/store");
let backup: typeof import("../src/server/backups");
let database: typeof import("../src/server/db");
beforeAll(async () => {
  const sqlite = new Database(path.join(root, "workspace.db"));
  sqlite.exec(
    fs.readFileSync(
      "prisma/migrations/20261024000000_initial/migration.sql",
      "utf8",
    ),
  );
  sqlite.close();
  store = await import("../src/server/store");
  database = await import("../src/server/db");
  backup = await import("../src/server/backups");
  await store.initialize();
  await store.createRecord(
    "person",
    { name: "A", color: "#e8ba72", retired: false },
    "a",
  );
  await store.createRecord(
    "person",
    { name: "B", color: "#a6b3d2", retired: false },
    "b",
  );
});
afterAll(async () => {
  await database.runtime.client?.$disconnect();
  fs.rmSync(root, { recursive: true, force: true });
});
describe.sequential("persisted workspace", () => {
  it("rejects stale task writes without overwriting the server version", async () => {
    const a = await store.createRecord("task", taskDefaults("Versioned"));
    await store.updateRecord(a.id, a.version, {
      ...a.data,
      title: "Saved first",
    });
    await expect(
      store.updateRecord(a.id, a.version, { ...a.data, title: "Stale" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await store.entities()).find((r) => r.id === a.id)?.data.title,
    ).toBe("Saved first");
  });
  it("removes prior-owner plan/focus membership on reassignment", async () => {
    const t = await store.createRecord("task", {
      ...taskDefaults("Owned"),
      ownerId: "a",
    });
    const day = workspaceDay();
    await store.savePlan({
      ...newPlan("a", day),
      taskIds: [t.id],
      focusIds: [t.id],
    });
    await store.updateRecord(t.id, t.version, { ...t.data, ownerId: "b" });
    const plan = (await store.entities()).find(
      (r) => r.id === `plan-a-${day}`,
    )!;
    expect(plan.data.taskIds).toEqual([]);
    expect(plan.data.focusIds).toEqual([]);
  });
  it("requires explicit ownership and detects cyclic dependencies", async () => {
    const t = await store.createRecord("task", taskDefaults("Unassigned"));
    await expect(
      store.savePlan({
        ...newPlan("a", addDays(workspaceDay(), 1)),
        taskIds: [t.id],
      }),
    ).rejects.toMatchObject({ status: 422 });
    const dep = await store.createRecord("task", {
      ...taskDefaults("Dependent"),
      dependencies: [t.id],
    });
    await expect(
      store.updateRecord(t.id, t.version, {
        ...t.data,
        dependencies: [dep.id],
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("retries bulk copies idempotently and clears scheduled progress", async () => {
    const t = await store.createRecord("task", {
      ...taskDefaults("Copy me"),
      status: "Done",
      checklist: [{ id: "x", text: "Finished", done: true }],
      scheduledStart: new Date().toISOString(),
      scheduledEnd: new Date(Date.now() + 60000).toISOString(),
    });
    const operation = {
      operationId: randomUUID(),
      action: "copy" as const,
      items: [{ id: t.id, version: t.version }],
      day: workspaceDay(),
    };
    const one = (await store.bulk(operation)) as unknown as Entity<Task>[];
    const two = (await store.bulk(operation)) as unknown as Entity<Task>[];
    expect(one[0].id).toBe(two[0].id);
    expect(one[0].data.status).toBe("Open");
    expect(one[0].data.scheduledStart).toBe("");
    expect(one[0].data.checklist[0].done).toBe(false);
  });
  it("allows independent people timers but rejects an unconfirmed switch", async () => {
    const t = await store.createRecord("task", taskDefaults("Focus"));
    const a = (await store.timerAction({
      action: "start",
      personId: "a",
      taskId: t.id,
    })) as unknown as Entity<TimeLog>;
    const b = (await store.timerAction({
      action: "start",
      personId: "b",
      taskId: t.id,
    })) as unknown as Entity<TimeLog>;
    await expect(
      store.timerAction({ action: "start", personId: "a", taskId: t.id }),
    ).rejects.toMatchObject({ status: 409 });
    await store.timerAction({
      action: "pause",
      personId: "a",
      version: a.version,
    });
    const logs = (await store.entities()).filter((r) => r.kind === "timeLog");
    expect(logs.find((r) => r.id === b.id)?.data.running).toBe(true);
    await expect(
      store.timerAction({ action: "stop", personId: "a", version: a.version }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("materializes calendar occurrences once and keeps outcomes independent", async () => {
    const day = workspaceDay();
    const s = await store.createRecord("task", {
      ...taskDefaults("Repeat"),
      recurrence: {
        mode: "daily",
        interval: 1,
        weekdays: [],
        rule: "",
        start: addDays(day, -1),
        end: addDays(day, 1),
        count: null,
        paused: false,
      },
    });
    await store.materialize();
    await store.materialize();
    const rows = (await store.entities()).filter(
      (r) => r.data.seriesId === s.id,
    );
    expect(rows).toHaveLength(3);
    expect(
      rows.find((r) => String(r.data.occurrenceDay) < day)?.data.outcome,
    ).toBe("missed");
    const today = rows.find((r) => r.data.occurrenceDay === day)!;
    await store.updateRecord(today.id, today.version, {
      ...today.data,
      status: "Done",
    });
    expect(
      (await store.entities()).find((r) => r.id === s.id)?.data.status,
    ).toBe("Open");
  });

  it("validates bulk dates and duplicate selections before writing", async () => {
    const t = await store.createRecord("task", taskDefaults("Validate bulk"));
    const item = { id: t.id, version: t.version };
    await expect(
      store.bulk({
        operationId: randomUUID(),
        action: "copy",
        items: [item],
        day: "2026-02-30",
      }),
    ).rejects.toThrow();
    await expect(
      store.bulk({
        operationId: randomUUID(),
        action: "move",
        items: [item, item],
        day: workspaceDay(),
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("persists naive schedule fields as workspace-zone instants", async () => {
    const t = await store.createRecord("task", {
      ...taskDefaults("Time zone"),
      scheduledStart: "2026-12-01T09:30",
      scheduledEnd: "2026-12-01T10:00",
    });
    expect(t.data.scheduledStart).toBe("2026-12-01T17:30:00Z");
  });
  it("executes a failed serialized mutation once and recovers its queue", async () => {
    let calls = 0;
    await expect(
      database.serialize(async () => {
        calls++;
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    expect(calls).toBe(1);
    expect(await database.serialize(async () => 42)).toBe(42);
  });
  it("removes multiple moved tasks from one plan and offers version-aware undo", async () => {
    const day = addDays(workspaceDay(), 5);
    const a = await store.createRecord("task", {
      ...taskDefaults("Bulk A"),
      ownerId: "a",
      plannedDay: day,
    });
    const b = await store.createRecord("task", {
      ...taskDefaults("Bulk B"),
      ownerId: "a",
      plannedDay: day,
    });
    await store.savePlan({
      ...newPlan("a", day),
      taskIds: [a.id, b.id],
      focusIds: [a.id, b.id],
    });
    const operationId = randomUUID();
    await store.bulk({
      operationId,
      action: "move",
      items: [a, b].map((t) => ({ id: t.id, version: t.version })),
      day: addDays(day, 1),
    });
    expect(
      (await store.entities()).find((r) => r.id === `plan-a-${day}`)?.data
        .taskIds,
    ).toEqual([]);
    await store.undoBulk(operationId);
    expect(
      (await store.entities()).find((r) => r.id === `plan-a-${day}`)?.data
        .taskIds,
    ).toEqual([a.id, b.id]);
    const current = (await store.entities()).find((r) => r.id === a.id)!;
    const second = randomUUID();
    await store.bulk({
      operationId: second,
      action: "move",
      items: [{ id: a.id, version: current.version }],
      day: addDays(day, 2),
    });
    const updated = (await store.entities()).find((r) => r.id === a.id)!;
    await store.updateRecord(a.id, updated.version, {
      ...updated.data,
      title: "Edited after move",
    });
    await expect(store.undoBulk(second)).rejects.toMatchObject({ status: 409 });
  });
  it("propagates future series fields while retaining one-occurrence overrides and history", async () => {
    const day = workspaceDay();
    const series = await store.createRecord("task", {
      ...taskDefaults("Original series"),
      recurrence: {
        mode: "daily",
        interval: 1,
        weekdays: [],
        rule: "",
        start: addDays(day, -1),
        end: addDays(day, 2),
        count: null,
        paused: false,
      },
    });
    await store.materialize();
    const occurrence = (await store.entities()).find(
      (r) => r.id === `${series.id}@${day}`,
    )!;
    await store.updateRecord(occurrence.id, occurrence.version, {
      ...occurrence.data,
      title: "Only this occurrence",
    });
    await store.updateRecord(
      series.id,
      series.version,
      { ...series.data, title: "New series", estimate: 30 },
      day,
    );
    const rows = await store.entities();
    expect(rows.find((r) => r.id === occurrence.id)?.data.title).toBe(
      "Only this occurrence",
    );
    expect(rows.find((r) => r.id === occurrence.id)?.data.estimate).toBe(30);
    expect(
      rows.find((r) => r.id === `${series.id}@${addDays(day, 1)}`)?.data.title,
    ).toBe("New series");
    expect(
      rows.find((r) => r.id === `${series.id}@${addDays(day, -1)}`)?.data.title,
    ).toBe("Original series");
  });
  it("pauses existing future occurrences and resumes without a paused-day backlog", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2027-01-10T20:00:00Z"));
      const day = workspaceDay();
      const series = await store.createRecord("task", {
        ...taskDefaults("Pause test"),
        recurrence: {
          mode: "daily",
          interval: 1,
          weekdays: [],
          rule: "",
          start: day,
          end: "",
          count: null,
          paused: false,
        },
      });
      await store.materialize();
      const paused = await store.updateRecord(series.id, series.version, {
        ...series.data,
        recurrence: { ...(series.data.recurrence as object), paused: true },
      });
      expect(
        (await store.entities()).find((r) => r.id === `${series.id}@${day}`)
          ?.data.suspended,
      ).toBe(true);
      vi.setSystemTime(new Date("2027-01-12T20:00:00Z"));
      await store.updateRecord(paused.id, paused.version, {
        ...paused.data,
        recurrence: { ...(paused.data.recurrence as object), paused: false },
      });
      await store.materialize();
      const children = (await store.entities()).filter(
        (r) => r.data.seriesId === series.id,
      );
      expect(
        children.filter(
          (r) =>
            !r.data.suspended && String(r.data.occurrenceDay) < workspaceDay(),
        ),
      ).toHaveLength(0);
      expect(
        children.find((r) => r.data.occurrenceDay === workspaceDay())?.data
          .suspended,
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps completion-relative work actionable and schedules from its actual completion", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2027-02-10T20:00:00Z"));
      const series = await store.createRecord("task", {
        ...taskDefaults("Relative"),
        recurrence: {
          mode: "relative",
          interval: 3,
          weekdays: [],
          rule: "",
          start: workspaceDay(),
          end: "",
          count: 3,
          paused: false,
        },
      });
      await store.materialize();
      vi.setSystemTime(new Date("2027-02-12T20:00:00Z"));
      await store.materialize();
      const first = (await store.entities()).find(
        (r) => r.data.seriesId === series.id,
      )!;
      expect(first.data.outcome).toBeNull();
      await store.updateRecord(first.id, first.version, {
        ...first.data,
        status: "Done",
      });
      await store.materialize();
      expect(
        (await store.entities()).find(
          (r) => r.data.seriesId === series.id && !r.data.outcome,
        )?.data.occurrenceDay,
      ).toBe("2027-02-15");
      const next = (await store.entities()).find(
        (r) => r.data.seriesId === series.id && !r.data.outcome,
      )!;
      await store.updateRecord(next.id, next.version, {
        ...next.data,
        outcome: "skipped",
      });
      await store.materialize();
      expect(
        (await store.entities()).filter(
          (r) => r.data.seriesId === series.id && !r.data.outcome,
        ),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it("saves review decisions and plan membership atomically", async () => {
    const day = addDays(workspaceDay(), 9);
    const t = await store.createRecord("task", {
      ...taskDefaults("Review"),
      ownerId: "b",
      plannedDay: day,
    });
    const p = await store.savePlan({
      ...newPlan("b", day),
      taskIds: [t.id],
      focusIds: [t.id],
    });
    await store.saveReview({
      data: {
        ...(p.data as unknown as import("../src/lib/types").Plan),
        reflection: "A good day.",
      },
      version: p.version,
      decisions: [{ id: t.id, version: t.version, action: "someday", day: "" }],
    });
    const rows = await store.entities();
    expect(rows.find((r) => r.id === t.id)?.data.someday).toBe(true);
    expect(rows.find((r) => r.id === p.id)?.data.focusIds).toEqual([]);
    expect(rows.find((r) => r.id === p.id)?.data.reflection).toBe(
      "A good day.",
    );
  });
  it("backs up and restores database and files as one generation", async () => {
    const t = await store.createRecord(
      "task",
      taskDefaults("Included in snapshot"),
    );
    const dir = path.join(database.activeDir(), "attachments");
    fs.mkdirSync(dir, { recursive: true });
    const id = randomUUID();
    fs.writeFileSync(path.join(dir, id), "attachment contents");
    await database.db().record.create({
      data: {
        id,
        kind: "attachment",
        data: {
          title: "note.txt",
          filename: "note.txt",
          mime: "text/plain",
          bytes: 19,
          storageKey: id,
        },
      },
    });
    const full = await backup.createBackup();
    const validated = await backup.validateArchive(
      fs.readFileSync(backup.backupFile(full.id)),
    );
    await store.updateRecord(t.id, t.version, {
      ...t.data,
      title: "Changed after snapshot",
    });
    await backup.restoreArchive(validated.token);
    expect(
      (await store.entities()).find((r) => r.id === t.id)?.data.title,
    ).toBe("Included in snapshot");
    expect(
      fs.readFileSync(
        path.join(database.activeDir(), "attachments", id),
        "utf8",
      ),
    ).toBe("attachment contents");
    expect(database.generation()).toMatch(/^restore-/);
  });
  it("rejects invalid archives before changing the active generation", async () => {
    const before = database.generation();
    await expect(
      database.requestGeneration.run("old-generation", () =>
        store.createRecord("task", taskDefaults("Stale tab")),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      backup.validateArchive(Buffer.from("not a zip")),
    ).rejects.toMatchObject({ status: 422 });
    expect(database.generation()).toBe(before);
  });
});
