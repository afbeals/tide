import type { Entity, Task } from "./types";

export function boardTasks(tasks: Entity<Task>[]) {
  return tasks.filter(
    ({ data: t }) =>
      !t.deletedAt &&
      !t.archived &&
      !t.recurrence &&
      !t.suspended &&
      !["skipped", "missed"].includes(t.outcome || ""),
  );
}

/** Saved positions precede legacy tasks; legacy ties never depend on a view's filters. */
export function sortBoardTasks(tasks: Entity<Task>[]) {
  return [...tasks].sort(
    (a, b) =>
      (a.data.boardOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.data.boardOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}
