import { describe, it, expect } from "vitest";
import { boardTasks, sortBoardTasks } from "../src/lib/board";
import { taskDefaults } from "../src/lib/types";
import type { Entity, Task } from "../src/lib/types";
const task = (id: string, data: Partial<Task> = {}): Entity<Task> => ({
  id,
  kind: "task",
  version: 1,
  createdAt: "2026-11-07",
  updatedAt: "2026-11-07",
  data: { ...taskDefaults(id), ...data },
});
describe("board ordering", () => {
  it("keeps saved order and gives legacy cards a stable order regardless of filter input", () => {
    const rows = [
      task("z"),
      task("b", { boardOrder: 1 }),
      task("a", { boardOrder: 0 }),
      task("y"),
    ];
    expect(sortBoardTasks(rows).map((t) => t.id)).toEqual(["a", "b", "y", "z"]);
    expect(sortBoardTasks(rows.reverse()).map((t) => t.id)).toEqual([
      "a",
      "b",
      "y",
      "z",
    ]);
  });
  it("excludes removed, suspended and resolved skipped/missed cards", () => {
    const rows = [
      task("open"),
      task("done", { status: "Done", outcome: "done" }),
      task("skip", { outcome: "skipped" }),
      task("miss", { outcome: "missed" }),
      task("gone", { deletedAt: "now" }),
      task("archive", { archived: true }),
      task("paused", { suspended: true }),
    ];
    expect(boardTasks(rows).map((t) => t.id)).toEqual(["open", "done"]);
  });
});
