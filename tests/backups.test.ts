import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import archiver from "archiver";
import unzipper from "unzipper";
import Database from "better-sqlite3";
import { temporaryDatabase } from "./helpers/database";
import { taskDefaults } from "../src/lib/types";

const fixture = temporaryDatabase("archive");
let database: typeof import("../src/server/db");
let store: typeof import("../src/server/store");
let backups: typeof import("../src/server/backups");
let original: Map<string, Buffer>;
const historyFile = path.join(fixture.root, "backups", "history.json");
beforeAll(async () => {
  database = await import("../src/server/db");
  store = await import("../src/server/store");
  backups = await import("../src/server/backups");
  await store.initialize();
  await store.createRecord("task", taskDefaults("Keep this work"), "important");
  const item = await backups.createBackup();
  const archive = await unzipper.Open.file(backups.backupFile(item.id));
  original = new Map(
    await Promise.all(
      archive.files
        .filter((f) => f.type !== "Directory")
        .map(async (f) => [f.path, await f.buffer()] as const),
    ),
  );
});
beforeEach(() => {
  fs.writeFileSync(historyFile, "[]");
  database.runtime.lastBackupAttempt = undefined;
});
afterEach(() => {
  if (database.runtime.scheduler) clearInterval(database.runtime.scheduler);
  database.runtime.scheduler = undefined;
  database.runtime.maintenance = false;
  vi.restoreAllMocks();
  vi.useRealTimers();
});
afterAll(async () => fixture.close(database));
async function zip(entries: Map<string, Buffer>) {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip");
    const chunks: Buffer[] = [];
    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    for (const [name, bytes] of entries) archive.append(bytes, { name });
    void archive.finalize();
  });
}
function manifest(
  entries: Map<string, Buffer>,
  edit: (value: {
    format: string;
    version: number;
    files: Record<string, string>;
  }) => void,
) {
  const value = JSON.parse(entries.get("manifest.json")!.toString());
  edit(value);
  entries.set("manifest.json", Buffer.from(JSON.stringify(value)));
}
describe("backup integrity and recovery", () => {
  it.each([
    [
      "another application's archive",
      (entries: Map<string, Buffer>) =>
        manifest(entries, (m) => {
          m.format = "other";
        }),
      "not a Tide backup",
    ],
    [
      "future format",
      (entries: Map<string, Buffer>) =>
        manifest(entries, (m) => {
          m.version = 99;
        }),
      "incompatible",
    ],
    [
      "missing database",
      (entries: Map<string, Buffer>) =>
        manifest(entries, (m) => {
          delete m.files["workspace.db"];
        }),
      "database is missing",
    ],
    [
      "changed database bytes",
      (entries: Map<string, Buffer>) =>
        entries.set("workspace.db", Buffer.from("changed")),
      "integrity verification",
    ],
    [
      "missing attachment",
      (entries: Map<string, Buffer>) =>
        manifest(entries, (m) => {
          m.files["attachments/missing"] = "bad";
        }),
      "integrity verification",
    ],
    [
      "unchecked file",
      (entries: Map<string, Buffer>) =>
        entries.set("attachments/extra", Buffer.from("unchecked")),
      "unchecked files",
    ],
    [
      "unexpected path",
      (entries: Map<string, Buffer>) =>
        entries.set("unexpected.txt", Buffer.from("untrusted")),
      "invalid or duplicate path",
    ],
    [
      "unsafe manifest path",
      (entries: Map<string, Buffer>) =>
        manifest(entries, (m) => {
          m.files["../outside"] = "bad";
        }),
      "integrity verification",
    ],
  ] as const)(
    "rejects %s before changing active data",
    async (_, edit, message) => {
      const before = await store.snapshot();
      const entries = new Map(original);
      edit(entries);
      await expect(
        backups.validateArchive(await zip(entries)),
      ).rejects.toMatchObject({
        status: 422,
        message: expect.stringContaining(message),
      });
      expect(await store.snapshot()).toEqual(before);
      expect(fs.readdirSync(path.join(fixture.root, "imports"))).toEqual([]);
    },
  );
  it("rejects schema-invalid records even when ZIP checksums match", async () => {
    const entries = new Map(original);
    const file = path.join(fixture.root, "invalid.db");
    fs.writeFileSync(file, entries.get("workspace.db")!);
    const sqlite = new Database(file);
    sqlite
      .prepare("UPDATE Record SET version = 0 WHERE id = ?")
      .run("important");
    sqlite.close();
    const bytes = fs.readFileSync(file);
    entries.set("workspace.db", bytes);
    manifest(entries, (m) => {
      m.files["workspace.db"] = createHash("sha256")
        .update(bytes)
        .digest("hex");
    });
    await expect(
      backups.validateArchive(await zip(entries)),
    ).rejects.toMatchObject({
      status: 422,
      message: "Invalid database record",
    });
  });
  it("rejects invalid, expired and concurrently restoring tokens", async () => {
    await expect(backups.restoreArchive("../unsafe")).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      backups.restoreArchive("00000000-0000-0000-0000-000000000000"),
    ).rejects.toMatchObject({ status: 404 });
    const preview = await backups.validateArchive(await zip(original));
    database.runtime.maintenance = true;
    await expect(backups.restoreArchive(preview.token)).rejects.toMatchObject({
      status: 503,
    });
    database.runtime.maintenance = false;
    fs.rmSync(path.join(fixture.root, "imports", preview.token), {
      recursive: true,
    });
  });
  it("records failed backups and removes partial archive files", async () => {
    vi.spyOn(database.db().record, "groupBy").mockRejectedValueOnce(
      new Error("Snapshot unavailable"),
    );
    await expect(backups.createBackup()).rejects.toThrow(
      "Snapshot unavailable",
    );
    expect(backups.backupHistory()).toEqual([
      expect.objectContaining({
        status: "failed",
        error: "Snapshot unavailable",
      }),
    ]);
    expect(
      fs
        .readdirSync(path.dirname(historyFile))
        .filter((n) => n.endsWith(".tmp") || n.endsWith(".stage")),
    ).toEqual([]);
    expect((await store.entities()).some((r) => r.id === "important")).toBe(
      true,
    );
  });
  it("keeps manual archives while expiring old automatic and safety archives", async () => {
    const cfg = (await store.entities()).find((r) => r.id === "settings")!;
    await store.updateRecord(cfg.id, cfg.version, {
      ...cfg.data,
      retentionDaily: 1,
      retentionWeekly: 1,
      retentionSafety: 1,
    });
    const entries = [
      { id: "auto-new", type: "automatic", at: "2026-10-24T12:00:00Z" },
      { id: "auto-old", type: "automatic", at: "2026-09-01T12:00:00Z" },
      { id: "safe-new", type: "safety", at: "2026-10-24T12:00:00Z" },
      { id: "safe-old", type: "safety", at: "2026-09-01T12:00:00Z" },
      { id: "manual-old", type: "manual", at: "2025-01-01T12:00:00Z" },
    ].map((e) => ({ ...e, status: "succeeded", bytes: 1 }));
    fs.writeFileSync(historyFile, JSON.stringify(entries));
    for (const e of entries)
      fs.writeFileSync(
        path.join(path.dirname(historyFile), `${e.id}.zip`),
        "placeholder",
      );
    await backups.createBackup("manual");
    expect(backups.backupHistory().map((e) => e.id)).toEqual(
      expect.arrayContaining(["auto-new", "safe-new", "manual-old"]),
    );
    for (const id of ["auto-old", "safe-old"]) {
      expect(backups.backupHistory().some((e) => e.id === id)).toBe(false);
      expect(
        fs.existsSync(path.join(path.dirname(historyFile), `${id}.zip`)),
      ).toBe(false);
    }
  });
  it("recovers an interrupted backup and schedules once without browser requests", async () => {
    fs.writeFileSync(
      historyFile,
      JSON.stringify([
        {
          id: "interrupted",
          type: "automatic",
          at: "2026-01-01T00:00:00Z",
          status: "running",
          bytes: 0,
        },
      ]),
    );
    const cfg = (await store.entities()).find((r) => r.id === "settings")!;
    await store.updateRecord(cfg.id, cfg.version, {
      ...cfg.data,
      backupEnabled: true,
      backupTime: "00:00",
      backupWeekdays: [0, 1, 2, 3, 4, 5, 6],
    });
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    backups.startScheduler();
    const timer = database.runtime.scheduler;
    backups.startScheduler();
    expect(database.runtime.scheduler).toBe(timer);
    expect(backups.backupHistory()[0]).toMatchObject({
      status: "failed",
      error: expect.stringContaining("previous process stopped"),
    });
    database.runtime.maintenance = true;
    await vi.advanceTimersByTimeAsync(30000);
    expect(backups.backupHistory()).toHaveLength(1);
    database.runtime.maintenance = false;
    await vi.advanceTimersByTimeAsync(30000);
    await expect
      .poll(
        () =>
          backups
            .backupHistory()
            .filter((e) => e.type === "automatic" && e.status === "succeeded")
            .length,
      )
      .toBe(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(
      backups.backupHistory().filter((e) => e.status === "succeeded"),
    ).toHaveLength(1);
  });
  it("cleans expired import previews while keeping recent previews", async () => {
    const dir = path.join(fixture.root, "imports");
    fs.mkdirSync(path.join(dir, "expired"), { recursive: true });
    fs.mkdirSync(path.join(dir, "recent"), { recursive: true });
    const old = new Date(Date.now() - 2 * 86400000);
    fs.utimesSync(path.join(dir, "expired"), old, old);
    await backups.cleanImports();
    expect(fs.readdirSync(dir)).toEqual(["recent"]);
  });
});
