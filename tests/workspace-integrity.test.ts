import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { newPlan } from "../src/lib/domain";
import { taskDefaults } from "../src/lib/types";
import type { Plan, Task } from "../src/lib/types";
import { temporaryDatabase } from "./helpers/database";

const fixture = temporaryDatabase("integrity");
let store: typeof import("../src/server/store");
let database: typeof import("../src/server/db");
const day = "2026-10-24";
beforeAll(async () => {
  database = await import("../src/server/db");
  store = await import("../src/server/store");
  await store.initialize();
});
beforeEach(async () => {
  await database.db().activity.deleteMany();
  await database.db().operation.deleteMany();
  await database
    .db()
    .record.deleteMany({ where: { kind: { not: "settings" } } });
  await store.createRecord(
    "person",
    { name: "Alex", color: "#e8ba72", retired: false },
    "alex",
  );
  await store.createRecord(
    "person",
    { name: "Retired", color: "#a6b3d2", retired: true },
    "retired",
  );
});
afterAll(async () => fixture.close(database));
async function task(fields: Partial<Task> = {}) {
  return store.createRecord("task", {
    ...taskDefaults("Useful task"),
    ownerId: "alex",
    plannedDay: day,
    ...fields,
  });
}
const outing = (taskIds: string[]) => ({
  title: "Errands",
  notes: "",
  context: "Away from home",
  taskIds,
  origin: "Home",
  travelMode: "WALK",
  departure: "",
  arrival: "",
  returnTrip: false,
  returnAddress: "Home",
  bring: [],
});
describe("workspace relationships and atomic recovery", () => {
  it.each<Partial<Task>>([
    { dependencies: ["missing"] },
    { ownerId: "missing" },
    { projectId: "missing" },
    { areaId: "missing" },
    { placeId: "missing" },
    { referenceIds: ["missing"] },
    { attachmentIds: ["missing"] },
  ])(
    "rejects missing task relationships without inserting a record: %j",
    async (fields) => {
      await expect(task(fields)).rejects.toMatchObject({ status: 422 });
      expect((await store.entities()).filter((r) => r.kind === "task")).toEqual(
        [],
      );
    },
  );
  it("refuses reassignment to retired people without losing plan membership", async () => {
    const t = await task();
    const p = await store.savePlan({
      ...newPlan("alex", day),
      taskIds: [t.id],
      focusIds: [t.id],
    });
    await expect(
      store.updateRecord(t.id, t.version, { ...t.data, ownerId: "retired" }),
    ).rejects.toMatchObject({ status: 422 });
    const rows = await store.entities();
    expect(rows.find((r) => r.id === t.id)).toEqual(t);
    expect(rows.find((r) => r.id === p.id)).toEqual(p);
  });
  it("rejects a focus selection outside its plan", async () => {
    const t = await task();
    await expect(
      store.savePlan({ ...newPlan("alex", day), focusIds: [t.id] }),
    ).rejects.toMatchObject({ status: 422 });
    expect((await store.entities()).filter((r) => r.kind === "plan")).toEqual(
      [],
    );
  });
  it("rejects home tasks and missing tasks as outing stops", async () => {
    const t = await task({ context: "At home" });
    for (const ids of [[t.id], ["missing"]])
      await expect(
        store.createRecord("outing", outing(ids)),
      ).rejects.toMatchObject({ status: 422 });
    expect((await store.entities()).filter((r) => r.kind === "outing")).toEqual(
      [],
    );
  });
  it("allows one inherited outing while explicit away tasks can belong to several", async () => {
    const inherited = await task({ context: "Inherit" });
    const away = await task({ context: "Away from home" });
    await store.createRecord("outing", outing([inherited.id, away.id]));
    await expect(
      store.createRecord("outing", outing([inherited.id])),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      store.createRecord("outing", outing([away.id])),
    ).resolves.toMatchObject({ kind: "outing" });
    expect(
      (await store.entities()).filter((r) => r.kind === "outing"),
    ).toHaveLength(2);
  });
  it("rolls back all plan edits if one selected task is stale", async () => {
    const a = await task();
    const b = await task();
    const updated = await store.updateRecord(b.id, b.version, {
      ...b.data,
      title: "Changed elsewhere",
    });
    await expect(
      store.savePlan(
        { ...newPlan("alex", day), taskIds: [a.id, b.id] },
        undefined,
        [
          { id: a.id, version: a.version, data: { estimate: 90 } },
          { id: b.id, version: b.version, data: { estimate: 30 } },
        ],
      ),
    ).rejects.toMatchObject({ status: 409 });
    const rows = await store.entities();
    expect(rows.find((r) => r.id === a.id)).toEqual(a);
    expect(rows.find((r) => r.id === b.id)).toEqual(updated);
    expect(rows.some((r) => r.kind === "plan")).toBe(false);
  });
  it("rolls back all plan edits if a selected task was deleted", async () => {
    const t = await task();
    await expect(
      store.savePlan({ ...newPlan("alex", day), taskIds: [t.id] }, undefined, [
        { id: t.id, version: t.version, data: { title: "Do not save" } },
        { id: "deleted", version: 1, data: {} },
      ]),
    ).rejects.toMatchObject({ status: 404 });
    expect((await store.entities()).find((r) => r.id === t.id)).toEqual(t);
  });
  it("saves task edits and plan together while removing prior plan and focus membership", async () => {
    const t = await task();
    const first = await store.savePlan({
      ...newPlan("alex", day),
      taskIds: [t.id],
      focusIds: [t.id],
    });
    const nextDay = "2026-10-25";
    const plan = await store.savePlan(
      { ...newPlan("alex", nextDay), taskIds: [t.id] },
      undefined,
      [
        {
          id: t.id,
          version: t.version,
          data: { estimate: 45, scheduledStart: `${nextDay}T09:30` },
        },
      ],
    );
    const rows = await store.entities();
    expect(plan.data.taskIds).toEqual([t.id]);
    expect(rows.find((r) => r.id === first.id)?.data).toMatchObject({
      taskIds: [],
      focusIds: [],
    });
    expect(rows.find((r) => r.id === t.id)?.data).toMatchObject({
      estimate: 45,
      plannedDay: nextDay,
      scheduledStart: "2026-10-25T16:30:00Z",
    });
  });
  it.each(["move", "archive"] as const)(
    "reviews a task with %s without changing its identity",
    async (action) => {
      const t = await task({
        scheduledStart: `${day}T09:00`,
        scheduledEnd: `${day}T09:30`,
      });
      const plan = await store.savePlan({
        ...newPlan("alex", day),
        taskIds: [t.id],
        focusIds: [t.id],
      });
      await store.saveReview({
        data: {
          ...(plan.data as unknown as Plan),
          reflection: "Ready for tomorrow",
        },
        version: plan.version,
        decisions: [
          { id: t.id, version: t.version, action, day: "2026-10-25" },
        ],
      });
      const rows = await store.entities();
      expect(rows.find((r) => r.id === t.id)?.data).toMatchObject({
        archived: action === "archive",
        plannedDay: action === "move" ? "2026-10-25" : day,
        scheduledStart: "",
        scheduledEnd: "",
      });
      expect(rows.find((r) => r.id === plan.id)?.data).toMatchObject({
        reviewed: true,
        taskIds: [],
        focusIds: [],
        reflection: "Ready for tomorrow",
      });
    },
  );
  it("keeps the entire review unchanged when a task has a concurrent edit", async () => {
    const a = await task();
    const b = await task();
    const p = await store.savePlan({
      ...newPlan("alex", day),
      taskIds: [a.id, b.id],
    });
    const updated = await store.updateRecord(b.id, b.version, {
      ...b.data,
      title: "New title",
    });
    await expect(
      store.saveReview({
        data: p.data as unknown as Plan,
        version: p.version,
        decisions: [a, b].map((t) => ({
          id: t.id,
          version: t.version,
          action: "archive",
          day: "",
        })),
      }),
    ).rejects.toMatchObject({ status: 409 });
    const rows = await store.entities();
    expect(rows.find((r) => r.id === a.id)).toEqual(a);
    expect(rows.find((r) => r.id === b.id)).toEqual(updated);
    expect(rows.find((r) => r.id === p.id)).toEqual(p);
  });
  it.each<Partial<Task>>([
    { ownerId: null },
    { plannedDay: "2026-10-25" },
    { status: "Done" },
    { seriesId: "series", occurrenceDay: day },
  ])("rejects review decisions for ineligible work: %j", async (fields) => {
    const t = await task(fields);
    await expect(
      store.saveReview({
        data: newPlan("alex", day),
        decisions: [
          { id: t.id, version: t.version, action: "archive", day: "" },
        ],
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect((await store.entities()).find((r) => r.id === t.id)).toEqual(t);
  });
  it("rolls back routine application when a later template index is invalid", async () => {
    const routine = await store.createRecord("routine", {
      title: "Morning",
      notes: "",
      templates: [{ title: "First" }],
    });
    const operationId = randomUUID();
    await expect(
      store.applyRoutine({
        routineId: routine.id,
        personId: "alex",
        day,
        indices: [0, 99],
        operationId,
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect((await store.entities()).filter((r) => r.kind === "task")).toEqual(
      [],
    );
    expect(
      await database.db().operation.findUnique({ where: { id: operationId } }),
    ).toBeNull();
  });
  it("keeps prerequisites and linked references from being permanently deleted", async () => {
    const prerequisite = await task({ deletedAt: "2026-10-24T12:00:00Z" });
    const ref = await store.createRecord("reference", {
      title: "Guide",
      type: "Note",
      notes: "",
      url: "",
      checklist: [],
      attachmentIds: [],
      tags: [],
    });
    await task({ dependencies: [prerequisite.id], referenceIds: [ref.id] });
    await expect(
      store.removeRecord(prerequisite.id, prerequisite.version),
    ).rejects.toMatchObject({ status: 422 });
    await expect(store.removeRecord(ref.id, ref.version)).rejects.toMatchObject(
      { status: 422 },
    );
    const rows = await store.entities();
    expect(rows.find((r) => r.id === prerequisite.id)).toEqual(prerequisite);
    expect(rows.find((r) => r.id === ref.id)).toEqual(ref);
  });
});
