import { randomUUID } from "node:crypto";
import { db, serialize, assertWritable, HttpError, generation } from "./db";
import {
  addDays,
  copyTask,
  dependencyCycle,
  occurrenceMatches,
  parseData,
  workspaceDay,
  normalizeTimes,
  occurrenceData,
} from "../lib/domain";
import { recordsOf, settingsDefaults, taskDefaults } from "../lib/types";
import type {
  Kind,
  Task,
  Settings,
  Entity,
  Plan,
  Person,
  TimeLog,
  Routine,
} from "../lib/types";
import type { Prisma } from "../generated/prisma/client";

export function asEntity(row: {
  id: string;
  kind: string;
  version: number;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    kind: row.kind as Kind,
    data: row.data as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export async function entities() {
  return (await db().record.findMany({ orderBy: { createdAt: "asc" } })).map(
    asEntity,
  );
}
export async function settings(): Promise<Settings> {
  const r = await db().record.findUnique({ where: { id: "settings" } });
  return r ? (r.data as unknown as Settings) : settingsDefaults;
}
export async function initialize() {
  const initialLimit = Number(process.env.TIDE_GOOGLE_DAILY_LIMIT ?? 1000);
  await db().record.upsert({
    where: { id: "settings" },
    create: {
      id: "settings",
      kind: "settings",
      data: {
        ...settingsDefaults,
        googleDailyLimit: Number.isFinite(initialLimit)
          ? Math.max(0, Math.min(100000, Math.trunc(initialLimit)))
          : 1000,
      } as unknown as Prisma.InputJsonObject,
    },
    update: {},
  });
}
function validateRelations(
  kind: Kind,
  id: string,
  data: Record<string, unknown>,
  rows: Entity[],
) {
  const has = (value: unknown, k?: Kind) =>
    typeof value === "string" &&
    rows.some((r) => r.id === value && (!k || r.kind === k));
  if (kind === "task") {
    const t = data as unknown as Task;
    const tasks = recordsOf<Task>(rows, "task");
    if (dependencyCycle(id, t.dependencies, tasks))
      throw new HttpError(422, "Dependencies cannot contain a cycle.");
    for (const dep of t.dependencies)
      if (!has(dep, "task"))
        throw new HttpError(422, "A prerequisite no longer exists.");
    if (t.ownerId && !has(t.ownerId, "person"))
      throw new HttpError(422, "The selected person no longer exists.");
    if (t.projectId && !has(t.projectId, "project"))
      throw new HttpError(422, "The selected project no longer exists.");
  }
  for (const [key, relatedKind] of [
    ["areaId", "area"],
    ["projectId", "project"],
    ["placeId", "place"],
    ["personId", "person"],
  ] as const)
    if (data[key] && !has(data[key], relatedKind))
      throw new HttpError(422, `The selected ${relatedKind} no longer exists.`);
  for (const [key, relatedKind] of [
    ["referenceIds", "reference"],
    ["attachmentIds", "attachment"],
    ["taskIds", "task"],
  ] as const)
    if (Array.isArray(data[key]))
      for (const related of data[key] as string[])
        if (!has(related, relatedKind))
          throw new HttpError(422, `A linked ${relatedKind} no longer exists.`);
  if (kind === "outing")
    for (const taskId of data.taskIds as string[]) {
      const task = tasksById(rows, taskId)!;
      if (!["Away from home", "Inherit"].includes(task.data.context))
        throw new HttpError(
          422,
          "Outing stops must have Away from home or inherited context.",
        );
      if (
        task.data.context === "Inherit" &&
        rows.some(
          (r) =>
            r.kind === "outing" &&
            r.id !== id &&
            (r.data.taskIds as string[]).includes(taskId),
        )
      )
        throw new HttpError(
          422,
          "An inherited task can belong to one outing. Use an explicit task context for other groups.",
        );
    }
  if (kind === "plan") {
    const p = data as unknown as Plan;
    if (!has(p.personId, "person"))
      throw new HttpError(422, "Choose a planning person.");
    for (const taskId of [...p.taskIds, ...p.focusIds]) {
      const t = tasksById(rows, taskId);
      if (!t || t.data.ownerId !== p.personId)
        throw new HttpError(
          422,
          "Assign each task to this person before adding it to their plan.",
        );
    }
    if (p.focusIds.some((id) => !p.taskIds.includes(id)))
      throw new HttpError(422, "Focus tasks must be included in this plan.");
  }
}
function tasksById(rows: Entity[], id: string) {
  return recordsOf<Task>(rows, "task").find((t) => t.id === id);
}
export async function createRecord(
  kind: Kind,
  input: unknown,
  id: string = randomUUID(),
): Promise<Entity> {
  return serialize(async () => {
    assertWritable();
    const data = parseData(
      kind,
      normalizeTimes(kind, input, (await settings()).timezone),
    );
    const rows = await entities();
    validateRelations(kind, id, data, rows);
    if (kind === "task" && data.status === "Done" && !data.completedAt)
      data.completedAt = new Date().toISOString();
    if (["attachment", "timeLog"].includes(kind))
      throw new HttpError(400, "Use the dedicated upload or timer operation.");
    return asEntity(
      await db().record.create({
        data: { id, kind, data: data as Prisma.InputJsonObject },
      }),
    );
  });
}
export async function updateRecord(
  id: string,
  version: number,
  input: unknown,
  scopeFrom?: string,
): Promise<Entity> {
  return serialize(async () => {
    assertWritable();
    const row = await db().record.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, "This record no longer exists.");
    if (row.version !== version)
      throw new HttpError(
        409,
        "Another browser changed this record.",
        asEntity(row),
      );
    if (["attachment", "timeLog"].includes(row.kind))
      throw new HttpError(400, "Use the dedicated operation.");
    const cfg = await settings();
    const today = workspaceDay(cfg);
    const data = parseData(
      row.kind as Kind,
      normalizeTimes(row.kind as Kind, input, cfg.timezone),
    );
    const rows = await entities();
    validateRelations(row.kind as Kind, id, data, rows);
    const previous = row.data as unknown as Task;
    if (row.kind === "task" && previous.ownerId !== data.ownerId) {
      const owner = recordsOf<Person>(rows, "person").find(
        (p) => p.id === data.ownerId,
      );
      if (owner?.data.retired)
        throw new HttpError(422, "Choose an active person.");
    }
    if (row.kind === "task") {
      const t = data as unknown as Task;
      if (t.seriesId)
        t.occurrenceOverrides = [
          ...new Set([
            ...(previous.occurrenceOverrides || []),
            ...Object.keys(data).filter(
              (k) =>
                JSON.stringify(data[k]) !==
                JSON.stringify(
                  (previous as unknown as Record<string, unknown>)[k],
                ),
            ),
          ]),
        ];
      if (t.recurrence) {
        t.recurrence.excludedPeriods =
          previous.recurrence?.excludedPeriods || [];
        if (t.recurrence.paused && !previous.recurrence?.paused)
          t.recurrence.pausedSince = today;
        if (!t.recurrence.paused && previous.recurrence?.paused) {
          t.recurrence.excludedPeriods = [
            ...t.recurrence.excludedPeriods,
            { start: previous.recurrence.pausedSince || today, end: today },
          ];
          t.recurrence.pausedSince = "";
        }
      }
    }
    return db().$transaction(async (tx) => {
      if (row.kind === "task") {
        const t = data as unknown as Task;
        if (previous.ownerId !== t.ownerId)
          for (const plan of recordsOf<Plan>(rows, "plan").filter(
            (p) => p.data.taskIds.includes(id) || p.data.focusIds.includes(id),
          )) {
            await tx.record.update({
              where: { id: plan.id },
              data: {
                version: { increment: 1 },
                data: {
                  ...plan.data,
                  taskIds: plan.data.taskIds.filter((t) => t !== id),
                  focusIds: plan.data.focusIds.filter((t) => t !== id),
                } as unknown as Prisma.InputJsonObject,
              },
            });
          }
        if (t.status === "Done" && previous.status !== "Done") {
          t.completedAt = new Date().toISOString();
          if (t.seriesId) t.outcome = "done";
        }
        if (t.status !== "Done" && previous.status === "Done") {
          t.completedAt = "";
          if (t.seriesId) t.outcome = null;
        }
        if (t.deletedAt || t.archived)
          for (const p of recordsOf<Plan>(rows, "plan").filter(
            (p) => p.data.taskIds.includes(id) || p.data.focusIds.includes(id),
          ))
            await tx.record.update({
              where: { id: p.id },
              data: {
                version: { increment: 1 },
                data: {
                  ...p.data,
                  taskIds: p.data.taskIds.filter((x) => x !== id),
                  focusIds: p.data.focusIds.filter((x) => x !== id),
                } as unknown as Prisma.InputJsonObject,
              },
            });
      }
      const changed = await tx.record.updateMany({
        where: { id, version },
        data: {
          data: data as Prisma.InputJsonObject,
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new HttpError(409, "Another browser changed this record.");
      await tx.activity.create({
        data: {
          id: randomUUID(),
          recordId: id,
          action: "updated",
          detail:
            row.kind === "task"
              ? `${previous.status} → ${data.status}`
              : "Saved changes",
        },
      });
      if (row.kind === "task" && previous.recurrence && !previous.seriesId) {
        const master = data as unknown as Task;
        const from =
          scopeFrom && /^\d{4}-\d{2}-\d{2}$/.test(scopeFrom)
            ? scopeFrom
            : today;
        const changedKeys = Object.keys(master).filter(
          (k) =>
            JSON.stringify(data[k]) !==
              JSON.stringify(
                (previous as unknown as Record<string, unknown>)[k],
              ) &&
            ![
              "recurrence",
              "status",
              "completedAt",
              "occurrenceOverrides",
            ].includes(k),
        );
        for (const child of recordsOf<Task>(rows, "task").filter(
          (t) =>
            t.data.seriesId === id &&
            !t.data.outcome &&
            t.data.status !== "Done" &&
            t.data.occurrenceDay >= from,
        )) {
          const matches =
            master.recurrence &&
            !master.recurrence.paused &&
            (master.recurrence.mode === "relative" ||
              occurrenceMatches(master, child.data.occurrenceDay)) &&
            !master.archived &&
            !master.deletedAt;
          const next = { ...child.data, suspended: !matches };
          const template = occurrenceData(
            master,
            child.data.occurrenceDay,
            cfg.timezone,
          ) as unknown as Record<string, unknown>;
          for (const key of changedKeys)
            if (!child.data.occurrenceOverrides?.includes(key))
              (next as unknown as Record<string, unknown>)[key] = template[key];
          if (child.data.ownerId !== next.ownerId || next.suspended)
            await removeFromPlans(tx, rows, [child.id]);
          await tx.record.update({
            where: { id: child.id },
            data: {
              version: { increment: 1 },
              data: next as unknown as Prisma.InputJsonObject,
            },
          });
        }
      }
      return asEntity((await tx.record.findUnique({ where: { id } }))!);
    });
  });
}
export async function removeRecord(id: string, version: number) {
  return serialize(async () => {
    assertWritable();
    const row = await db().record.findUnique({ where: { id } });
    if (!row) throw new HttpError(404, "Record not found");
    if (row.version !== version)
      throw new HttpError(
        409,
        "Another browser changed this record.",
        asEntity(row),
      );
    if (row.kind === "settings" || row.kind === "person")
      throw new HttpError(422, "Retire people instead of deleting history.");
    if (row.kind === "task" && !(row.data as unknown as Task).deletedAt)
      throw new HttpError(
        422,
        "Move the task to Trash before deleting permanently.",
      );
    const rows = await entities();
    if (
      rows.some(
        (r) =>
          r.id !== id &&
          r.kind === "task" &&
          ((r.data.dependencies as string[]) || []).includes(id),
      )
    )
      throw new HttpError(
        422,
        "Remove this task from prerequisites before deleting it.",
      );
    if (
      row.kind !== "task" &&
      rows.some(
        (r) =>
          (r.id !== id &&
            ["areaId", "projectId", "placeId"].some((k) => r.data[k] === id)) ||
          (r.id !== id &&
            ["referenceIds", "attachmentIds"].some(
              (k) =>
                Array.isArray(r.data[k]) &&
                (r.data[k] as string[]).includes(id),
            )),
      )
    )
      throw new HttpError(
        422,
        "Unlink this item from its tasks or projects before deleting it.",
      );
    await db().$transaction(async (tx) => {
      for (const plan of recordsOf<Plan>(rows, "plan").filter((p) =>
        p.data.taskIds.includes(id),
      ))
        await tx.record.update({
          where: { id: plan.id },
          data: {
            version: { increment: 1 },
            data: {
              ...plan.data,
              taskIds: plan.data.taskIds.filter((t) => t !== id),
              focusIds: plan.data.focusIds.filter((t) => t !== id),
            } as unknown as Prisma.InputJsonObject,
          },
        });
      await tx.record.delete({ where: { id } });
      await tx.activity.create({
        data: {
          id: randomUUID(),
          recordId: id,
          action: "deleted",
          detail: `Permanently deleted ${row.kind}`,
        },
      });
    });
    return { ok: true };
  });
}
async function removeFromPlans(
  tx: Prisma.TransactionClient,
  rows: Entity[],
  ids: string[],
  keepDay?: string,
) {
  const changed: Entity<Plan>[] = [];
  for (const plan of recordsOf<Plan>(rows, "plan")) {
    if (
      plan.data.day === keepDay ||
      !plan.data.taskIds.some((id) => ids.includes(id))
    )
      continue;
    const next = {
      ...plan.data,
      taskIds: plan.data.taskIds.filter((id) => !ids.includes(id)),
      focusIds: plan.data.focusIds.filter((id) => !ids.includes(id)),
    };
    const row = asEntity(
      await tx.record.update({
        where: { id: plan.id },
        data: {
          version: { increment: 1 },
          data: next as unknown as Prisma.InputJsonObject,
        },
      }),
    ) as unknown as Entity<Plan>;
    changed.push(row);
    // Keep the transaction's working snapshot current for subsequent removals.
    rows[rows.findIndex((r) => r.id === plan.id)] = row as unknown as Entity;
  }
  return changed;
}
export async function materialize() {
  return serialize(async () => {
    if ((await import("./db")).runtime.maintenance) return;
    const rows = await entities();
    const cfg = await settings();
    const today = workspaceDay(cfg);
    const tasks = recordsOf<Task>(rows, "task");
    for (const series of tasks.filter(
      (t) =>
        t.data.recurrence &&
        !t.data.seriesId &&
        !t.data.deletedAt &&
        !t.data.archived,
    )) {
      const r = series.data.recurrence!;
      if (r.paused) continue;
      const occurrences = tasks.filter((t) => t.data.seriesId === series.id);
      if (r.mode === "relative") {
        if (
          occurrences.some(
            (t) =>
              !t.data.outcome &&
              !t.data.suspended &&
              !t.data.deletedAt &&
              !t.data.archived,
          )
        )
          continue;
        const resolved = occurrences
          .filter(
            (t) => t.data.outcome === "done" || t.data.outcome === "skipped",
          )
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (r.count && resolved.length >= r.count) continue;
        const last = resolved[0];
        const candidate = last
          ? addDays(
              workspaceDay(
                cfg,
                (await import("@js-temporal/polyfill")).Temporal.Instant.from(
                  last.data.completedAt || last.updatedAt,
                ),
              ),
              r.interval,
            )
          : r.start && r.start > today
            ? r.start
            : today;
        const target = r.excludedPeriods?.some(
          (p) => candidate >= p.start && candidate < p.end,
        )
          ? today
          : candidate;
        if (r.end && target > r.end) continue;
        const id = `${series.id}@${target}-relative-${resolved.length}`;
        await db().record.upsert({
          where: { id },
          create: {
            id,
            kind: "task",
            data: {
              ...occurrenceData(series.data, target, cfg.timezone),
              seriesId: series.id,
            } as unknown as Prisma.InputJsonObject,
          },
          update: {},
        });
        continue;
      }
      const end =
        r.end && r.end < addDays(today, 14) ? r.end : addDays(today, 14);
      let cursor = r.start || today;
      let guard = 0;
      while (cursor <= end && guard++ < 10000) {
        if (occurrenceMatches(series.data, cursor)) {
          const id = `${series.id}@${cursor}`;
          await db().record.upsert({
            where: { id },
            create: {
              id,
              kind: "task",
              data: {
                ...occurrenceData(series.data, cursor, cfg.timezone),
                seriesId: series.id,
                outcome: cursor < today ? "missed" : null,
              } as unknown as Prisma.InputJsonObject,
            },
            update: {},
          });
        }
        cursor = addDays(cursor, 1);
      }
    }
    for (const t of tasks.filter(
      (t) =>
        t.data.seriesId &&
        !t.data.suspended &&
        t.data.occurrenceDay < today &&
        !t.data.outcome &&
        t.data.status !== "Done" &&
        tasks.find((s) => s.id === t.data.seriesId)?.data.recurrence?.mode !==
          "relative",
    ))
      await db().record.update({
        where: { id: t.id },
        data: {
          version: { increment: 1 },
          data: {
            ...t.data,
            outcome: "missed",
          } as unknown as Prisma.InputJsonObject,
        },
      });
  });
}
export async function timerAction(input: {
  action: string;
  personId: string;
  taskId?: string;
  durationSeconds?: number;
  confirm?: boolean;
  version?: number;
}) {
  return serialize(async () => {
    assertWritable();
    const rows = await entities();
    const person = recordsOf<Person>(rows, "person").find(
      (p) => p.id === input.personId && !p.data.retired,
    );
    if (!person) throw new HttpError(422, "Choose an active planning person.");
    const active = recordsOf<TimeLog>(rows, "timeLog").find(
      (t) => t.data.personId === input.personId && !t.data.stoppedAt,
    );
    const now = new Date().toISOString();
    return db().$transaction(async (tx) => {
      if (input.action === "start") {
        if (!input.taskId || !tasksById(rows, input.taskId))
          throw new HttpError(422, "Choose a task.");
        if (active && !input.confirm)
          throw new HttpError(
            409,
            "This person already has an active timer.",
            active,
          );
        if (active)
          await tx.record.update({
            where: { id: active.id },
            data: {
              version: { increment: 1 },
              data: {
                ...active.data,
                running: false,
                stoppedAt: now,
                elapsedSeconds: elapsed(active.data),
              } as unknown as Prisma.InputJsonObject,
            },
          });
        return asEntity(
          await tx.record.create({
            data: {
              id: randomUUID(),
              kind: "timeLog",
              data: {
                personId: input.personId,
                taskId: input.taskId,
                startedAt: now,
                pausedAt: "",
                elapsedSeconds: 0,
                durationSeconds: Math.max(
                  60,
                  Math.round(Math.min(86400, input.durationSeconds || 1500)),
                ),
                running: true,
                stoppedAt: "",
              },
            },
          }),
        );
      }
      if (!active) throw new HttpError(404, "There is no active timer.");
      if (input.version !== active.version)
        throw new HttpError(
          409,
          "This timer changed in another browser.",
          active,
        );
      const data = { ...active.data };
      if (input.action === "pause") {
        data.elapsedSeconds = elapsed(data);
        data.running = false;
        data.pausedAt = now;
      } else if (input.action === "resume") {
        data.running = true;
        data.startedAt = now;
        data.pausedAt = "";
      } else if (input.action === "stop") {
        data.elapsedSeconds = elapsed(data);
        data.running = false;
        data.stoppedAt = now;
      } else throw new HttpError(400, "Unknown timer action");
      return asEntity(
        await tx.record.update({
          where: { id: active.id },
          data: {
            version: { increment: 1 },
            data: data as unknown as Prisma.InputJsonObject,
          },
        }),
      );
    });
  });
}
export function elapsed(t: TimeLog) {
  return (
    t.elapsedSeconds +
    (t.running ? Math.max(0, (Date.now() - Date.parse(t.startedAt)) / 1000) : 0)
  );
}
export async function bulk(input: {
  operationId: string;
  action: "move" | "copy" | "someday" | "archive";
  items: { id: string; version: number }[];
  day: string;
}) {
  return serialize(async () => {
    assertWritable();
    const previous = await db().operation.findUnique({
      where: { id: input.operationId },
    });
    if (previous) return previous.result;
    if (new Set(input.items.map((t) => t.id)).size !== input.items.length)
      throw new HttpError(422, "Choose each task once.");
    const rows = await entities();
    return db().$transaction(async (tx) => {
      const results = [];
      const before = [];
      for (const item of input.items) {
        const task = tasksById(rows, item.id);
        if (!task) throw new HttpError(404, "A selected task no longer exists");
        if (task.version !== item.version)
          throw new HttpError(
            409,
            "A selected task changed. Refresh and review the selection.",
            task,
          );
        before.push(task);
        const data =
          input.action === "copy"
            ? copyTask(task.data, input.day)
            : {
                ...task.data,
                plannedDay:
                  input.action === "move"
                    ? input.day
                    : input.action === "someday"
                      ? ""
                      : task.data.plannedDay,
                scheduledStart: "",
                scheduledEnd: "",
                someday: input.action === "someday",
                archived: input.action === "archive" || task.data.archived,
              };
        const validated = parseData("task", data);
        const id = input.action === "copy" ? randomUUID() : task.id;
        const result =
          input.action === "copy"
            ? await tx.record.create({
                data: {
                  id,
                  kind: "task",
                  data: validated as Prisma.InputJsonObject,
                },
              })
            : await tx.record.update({
                where: { id },
                data: {
                  data: validated as Prisma.InputJsonObject,
                  version: { increment: 1 },
                },
              });
        results.push(asEntity(result));
        await tx.activity.create({
          data: {
            id: randomUUID(),
            recordId: id,
            action: input.action,
            detail: `${input.action} ${task.data.title}${input.day ? ` → ${input.day}` : ""}`,
          },
        });
      }
      const beforePlans =
        input.action === "copy"
          ? []
          : recordsOf<Plan>(rows, "plan")
              .filter(
                (p) =>
                  p.data.taskIds.some((id) =>
                    input.items.some((i) => i.id === id),
                  ) &&
                  (input.action !== "move" || p.data.day !== input.day),
              )
              .map((p) => structuredClone(p));
      const changedPlans =
        input.action === "copy"
          ? []
          : await removeFromPlans(
              tx,
              rows,
              input.items.map((i) => i.id),
              input.action === "move" ? input.day : undefined,
            );
      await tx.operation.create({
        data: {
          id: `${input.operationId}:undo`,
          result: {
            before,
            after: results,
            beforePlans,
            afterPlans: changedPlans,
            copy: input.action === "copy",
          } as unknown as Prisma.InputJsonObject,
        },
      });
      await tx.operation.create({
        data: {
          id: input.operationId,
          result: results as unknown as Prisma.InputJsonArray,
        },
      });
      return results;
    });
  });
}
export async function undoBulk(operationId: string) {
  return serialize(async () => {
    assertWritable();
    const stored = await db().operation.findUnique({
      where: { id: `${operationId}:undo` },
    });
    if (!stored) throw new HttpError(404, "This operation cannot be undone.");
    const meta = stored.result as unknown as {
      before: Entity<Task>[];
      after: Entity<Task>[];
      beforePlans: Entity<Plan>[];
      afterPlans: Entity<Plan>[];
      copy: boolean;
      undone?: boolean;
    };
    if (meta.undone) return { ok: true };
    const rows = await entities();
    for (const after of [...meta.after, ...meta.afterPlans]) {
      const current = rows.find((r) => r.id === after.id);
      if (!current || current.version !== after.version)
        throw new HttpError(
          409,
          "A task or plan changed after this operation. Review the current records before making further changes.",
        );
    }
    if (
      meta.copy &&
      rows.some(
        (r) =>
          r.kind === "task" &&
          (r.data.dependencies as string[]).some((id) =>
            meta.after.some((t) => t.id === id),
          ),
      )
    )
      throw new HttpError(
        409,
        "A copied task is now used as a prerequisite. Remove that link before undoing.",
      );
    await db().$transaction(async (tx) => {
      if (meta.copy) {
        await removeFromPlans(
          tx,
          rows,
          meta.after.map((t) => t.id),
        );
        await tx.record.deleteMany({
          where: { id: { in: meta.after.map((t) => t.id) } },
        });
      } else
        for (const before of meta.before)
          await tx.record.update({
            where: { id: before.id },
            data: {
              data: before.data as unknown as Prisma.InputJsonObject,
              version: { increment: 1 },
            },
          });
      for (const before of meta.beforePlans)
        await tx.record.update({
          where: { id: before.id },
          data: {
            data: before.data as unknown as Prisma.InputJsonObject,
            version: { increment: 1 },
          },
        });
      await tx.operation.update({
        where: { id: stored.id },
        data: {
          result: {
            ...meta,
            undone: true,
          } as unknown as Prisma.InputJsonObject,
        },
      });
      await tx.activity.create({
        data: {
          id: randomUUID(),
          recordId: operationId,
          action: "undo",
          detail: "Undid bulk task operation",
        },
      });
    });
    return { ok: true };
  });
}
export async function applyRoutine(input: {
  routineId: string;
  personId: string;
  day: string;
  indices: number[];
  operationId: string;
}) {
  return serialize(async () => {
    assertWritable();
    const old = await db().operation.findUnique({
      where: { id: input.operationId },
    });
    if (old) return old.result;
    const rows = await entities();
    const routine = recordsOf<Routine>(rows, "routine").find(
      (r) => r.id === input.routineId,
    );
    if (!routine) throw new HttpError(404, "Routine not found");
    if (
      !recordsOf<Person>(rows, "person").some(
        (p) => p.id === input.personId && !p.data.retired,
      )
    )
      throw new HttpError(422, "Choose an active person");
    return db().$transaction(async (tx) => {
      const added = [];
      for (const index of new Set(input.indices)) {
        const template = routine.data.templates[index];
        if (!template) throw new HttpError(422, "Choose valid templates");
        const task = parseData("task", {
          ...taskDefaults(template.title),
          ...template,
          ownerId: input.personId,
          plannedDay: input.day,
        });
        added.push(
          asEntity(
            await tx.record.create({
              data: {
                id: randomUUID(),
                kind: "task",
                data: task as Prisma.InputJsonObject,
              },
            }),
          ),
        );
      }
      await tx.operation.create({
        data: {
          id: input.operationId,
          result: added as unknown as Prisma.InputJsonArray,
        },
      });
      return added;
    });
  });
}
export async function savePlan(
  input: Plan,
  version?: number,
  taskEdits?: { id: string; version: number; data: Partial<Task> }[],
) {
  return serialize(async () => {
    assertWritable();
    const data = parseData("plan", input) as unknown as Plan;
    const id = `plan-${data.personId}-${data.day}`;
    const rows = await entities();
    const previous = rows.find((r) => r.id === id);
    if (previous && previous.version !== version)
      throw new HttpError(
        409,
        "This daily plan changed in another browser.",
        previous,
      );
    const cfg = await settings();
    const prospective = [...rows];
    for (const edit of taskEdits || []) {
      const index = prospective.findIndex(
        (r) => r.id === edit.id && r.kind === "task",
      );
      if (index < 0)
        throw new HttpError(404, "A planned task no longer exists");
      const row = prospective[index];
      if (row.version !== edit.version)
        throw new HttpError(
          409,
          "A selected task changed. Review the plan again.",
          row,
        );
      prospective[index] = {
        ...row,
        data: parseData(
          "task",
          normalizeTimes(
            "task",
            {
              ...row.data,
              ...edit.data,
              ownerId: data.personId,
              plannedDay: data.day,
            },
            cfg.timezone,
          ),
        ),
      };
    }
    for (const edit of taskEdits || []) {
      const row = prospective.find((r) => r.id === edit.id)!;
      validateRelations("task", row.id, row.data, prospective);
    }
    validateRelations(
      "plan",
      id,
      data as unknown as Record<string, unknown>,
      prospective,
    );
    return db().$transaction(async (tx) => {
      for (const edit of taskEdits || []) {
        const row = prospective.find((r) => r.id === edit.id)!;
        await tx.record.update({
          where: { id: edit.id },
          data: {
            data: row.data as Prisma.InputJsonObject,
            version: { increment: 1 },
          },
        });
      }
      await removeFromPlans(
        tx,
        rows.filter((r) => r.id !== id),
        (taskEdits || []).map((t) => t.id),
      );
      const saved = await tx.record.upsert({
        where: { id },
        create: {
          id,
          kind: "plan",
          data: data as unknown as Prisma.InputJsonObject,
        },
        update: {
          version: { increment: 1 },
          data: data as unknown as Prisma.InputJsonObject,
        },
      });
      return asEntity(saved);
    });
  });
}
export async function snapshot() {
  return {
    records: await entities(),
    activities: (
      await db().activity.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      })
    ).map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    generation: generation(),
  };
}

export async function saveReview(input: {
  data: Plan;
  version?: number;
  decisions: {
    id: string;
    version: number;
    action: "move" | "someday" | "archive";
    day: string;
  }[];
}) {
  return serialize(async () => {
    assertWritable();
    const plan = parseData("plan", input.data) as unknown as Plan;
    const id = `plan-${plan.personId}-${plan.day}`;
    const rows = await entities();
    const existing = rows.find((r) => r.id === id);
    if (existing?.version !== input.version)
      throw new HttpError(
        409,
        "This daily plan changed. Reopen the review to see the current plan.",
        existing,
      );
    const changes = input.decisions.map((decision) => {
      const task = tasksById(rows, decision.id);
      if (!task || task.version !== decision.version)
        throw new HttpError(
          409,
          "A reviewed task changed. Reopen the review before saving.",
          task,
        );
      if (
        task.data.ownerId !== plan.personId ||
        task.data.plannedDay !== plan.day ||
        task.data.seriesId ||
        task.data.status === "Done"
      )
        throw new HttpError(
          422,
          "Choose unfinished one-off work from this person and day.",
        );
      const next = parseData("task", {
        ...task.data,
        plannedDay:
          decision.action === "move"
            ? decision.day
            : decision.action === "someday"
              ? ""
              : task.data.plannedDay,
        scheduledStart: "",
        scheduledEnd: "",
        someday: decision.action === "someday",
        archived: decision.action === "archive",
      });
      return { task, next };
    });
    const moved = changes.map((c) => c.task.id);
    const nextPlan = {
      ...plan,
      reviewed: true,
      taskIds: plan.taskIds.filter((t) => !moved.includes(t)),
      focusIds: plan.focusIds.filter((t) => !moved.includes(t)),
    };
    validateRelations(
      "plan",
      id,
      nextPlan as unknown as Record<string, unknown>,
      rows,
    );
    return db().$transaction(async (tx) => {
      for (const { task, next } of changes) {
        await tx.record.update({
          where: { id: task.id },
          data: {
            version: { increment: 1 },
            data: next as Prisma.InputJsonObject,
          },
        });
        await tx.activity.create({
          data: {
            id: randomUUID(),
            recordId: task.id,
            action: "daily review",
            detail: "Explicitly rescheduled during daily review",
          },
        });
      }
      await removeFromPlans(
        tx,
        rows.filter((r) => r.id !== id),
        moved,
      );
      return asEntity(
        await tx.record.upsert({
          where: { id },
          create: {
            id,
            kind: "plan",
            data: nextPlan as unknown as Prisma.InputJsonObject,
          },
          update: {
            version: { increment: 1 },
            data: nextPlan as unknown as Prisma.InputJsonObject,
          },
        }),
      );
    });
  });
}
