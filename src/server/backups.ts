import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import Database from "better-sqlite3";
import archiver from "archiver";
import unzipper from "unzipper";
import {
  activeDir,
  dataRoot,
  databasePath,
  db,
  runtime,
  serialize,
  HttpError,
  generation,
} from "./db";
import { settings } from "./store";
import { parseData, workspaceDay, weekday } from "../lib/domain";
import type { Kind } from "../lib/types";

const backupDir = path.join(dataRoot, "backups");
const imports = path.join(dataRoot, "imports");
interface BackupEntry {
  id: string;
  type: string;
  at: string;
  status: string;
  bytes: number;
  error?: string;
}
interface Manifest {
  format: "tide";
  version: 1;
  at: string;
  counts: Record<string, number>;
  files: Record<string, string>;
}
function hash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
function historyPath() {
  fs.mkdirSync(backupDir, { recursive: true });
  return path.join(backupDir, "history.json");
}
export function backupHistory(): BackupEntry[] {
  try {
    return JSON.parse(fs.readFileSync(historyPath(), "utf8"));
  } catch {
    return [];
  }
}
function saveHistory(entries: BackupEntry[]) {
  const dest = historyPath();
  fs.writeFileSync(`${dest}.tmp`, JSON.stringify(entries));
  fs.renameSync(`${dest}.tmp`, dest);
}
export async function createBackup(type = "manual") {
  return serialize(async () => {
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
    const record: BackupEntry = {
      id,
      type,
      at: new Date().toISOString(),
      status: "running",
      bytes: 0,
    };
    saveHistory([record, ...backupHistory()]);
    const temp = path.join(backupDir, `${id}.tmp`);
    const staging = path.join(backupDir, `${id}.stage`);
    try {
      fs.mkdirSync(staging);
      const sqlite = new Database(databasePath());
      try {
        await sqlite.backup(path.join(staging, "workspace.db"));
      } finally {
        sqlite.close();
      }
      const files: Record<string, string> = {};
      files["workspace.db"] = hash(
        fs.readFileSync(path.join(staging, "workspace.db")),
      );
      const attachmentDir = path.join(activeDir(), "attachments");
      if (fs.existsSync(attachmentDir)) {
        fs.cpSync(attachmentDir, path.join(staging, "attachments"), {
          recursive: true,
        });
        for (const file of fs.readdirSync(path.join(staging, "attachments")))
          if (fs.statSync(path.join(staging, "attachments", file)).isFile())
            files[`attachments/${file}`] = hash(
              fs.readFileSync(path.join(staging, "attachments", file)),
            );
      }
      const counts: Record<string, number> = {};
      for (const row of await db().record.groupBy({
        by: ["kind"],
        _count: true,
      }))
        counts[row.kind] = row._count;
      const manifest: Manifest = {
        format: "tide",
        version: 1,
        at: record.at,
        counts,
        files,
      };
      fs.writeFileSync(
        path.join(staging, "manifest.json"),
        JSON.stringify(manifest, null, 2),
      );
      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(temp);
        const zip = archiver("zip", { zlib: { level: 6 } });
        output.on("close", resolve);
        output.on("error", reject);
        zip.on("error", reject);
        zip.pipe(output);
        zip.directory(staging, false);
        void zip.finalize();
      });
      fs.renameSync(temp, path.join(backupDir, `${id}.zip`));
      record.status = "succeeded";
      record.bytes = fs.statSync(path.join(backupDir, `${id}.zip`)).size;
      saveHistory(backupHistory().map((b) => (b.id === id ? record : b)));
      await retain();
      return record;
    } catch (error) {
      record.status = "failed";
      record.error = error instanceof Error ? error.message : "Backup failed";
      saveHistory(backupHistory().map((b) => (b.id === id ? record : b)));
      throw error;
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
      fs.rmSync(temp, { force: true });
    }
  });
}
async function retain() {
  const cfg = await settings();
  const history = backupHistory();
  const auto = history.filter(
    (b) => b.type === "automatic" && b.status === "succeeded",
  );
  const keep = new Set(auto.slice(0, cfg.retentionDaily).map((b) => b.id));
  const weeks = new Set<string>();
  for (const b of auto) {
    const date = new Date(b.at);
    const week = new Date(
      date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    if (!weeks.has(week) && weeks.size < cfg.retentionWeekly) {
      weeks.add(week);
      keep.add(b.id);
    }
  }
  const safety = history.filter(
    (b) => b.type === "safety" && b.status === "succeeded",
  );
  for (const b of safety.slice(0, cfg.retentionSafety)) keep.add(b.id);
  const remove = history.filter(
    (b) =>
      b.status === "succeeded" &&
      ["automatic", "safety"].includes(b.type) &&
      !keep.has(b.id),
  );
  for (const b of remove)
    fs.rmSync(path.join(backupDir, `${b.id}.zip`), { force: true });
  saveHistory(history.filter((b) => !remove.includes(b)));
}
export function backupFile(id: string) {
  if (!/^[\w-]+$/.test(id)) throw new HttpError(400, "Invalid backup ID");
  const p = path.join(backupDir, `${id}.zip`);
  if (!fs.existsSync(p)) throw new HttpError(404, "Backup not found");
  return p;
}
export async function validateArchive(buffer: Buffer) {
  if (buffer.length > 200 * 1024 * 1024)
    throw new HttpError(413, "Backup upload exceeds 200 MB");
  fs.mkdirSync(imports, { recursive: true });
  const token = randomUUID();
  const staging = path.join(imports, token);
  fs.mkdirSync(staging);
  try {
    const zip = await unzipper.Open.buffer(buffer);
    let total = 0;
    const names = new Set<string>();
    for (const file of zip.files) {
      if (file.type === "Directory") continue;
      const name = file.path;
      if (
        names.has(name) ||
        !(
          name === "manifest.json" ||
          name === "workspace.db" ||
          /^attachments\/[a-zA-Z0-9_-]+$/.test(name)
        )
      )
        throw new HttpError(
          422,
          "The backup contains an invalid or duplicate path",
        );
      names.add(name);
      total += file.uncompressedSize;
      if (total > 500 * 1024 * 1024)
        throw new HttpError(413, "Expanded backup exceeds 500 MB");
      const bytes = await file.buffer();
      const dest = path.join(staging, name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, bytes);
    }
    const manifest = JSON.parse(
      fs.readFileSync(path.join(staging, "manifest.json"), "utf8"),
    ) as Manifest;
    if (manifest.format !== "tide")
      throw new HttpError(422, "This is not a Tide backup");
    if (manifest.version !== 1)
      throw new HttpError(
        422,
        "This backup format is incompatible with this version of Tide",
      );
    if (!manifest.files || !manifest.files["workspace.db"])
      throw new HttpError(422, "Backup database is missing");
    for (const [name, checksum] of Object.entries(manifest.files)) {
      if (
        !(
          name === "workspace.db" || /^attachments\/[a-zA-Z0-9_-]+$/.test(name)
        ) ||
        !fs.existsSync(path.join(staging, name)) ||
        hash(fs.readFileSync(path.join(staging, name))) !== checksum
      )
        throw new HttpError(422, "Backup integrity verification failed");
    }
    for (const name of names)
      if (name !== "manifest.json" && !manifest.files[name])
        throw new HttpError(422, "Backup contains unchecked files");
    const sqlite = new Database(path.join(staging, "workspace.db"), {
      readonly: true,
    });
    try {
      if (sqlite.pragma("integrity_check", { simple: true }) !== "ok")
        throw new HttpError(422, "Database integrity check failed");
      const rows = sqlite
        .prepare("SELECT id, kind, version, data FROM Record")
        .all() as { id: string; kind: Kind; version: number; data: string }[];
      for (const row of rows) {
        if (!row.id || row.version < 1)
          throw new HttpError(422, "Invalid database record");
        const data = parseData(row.kind, JSON.parse(row.data));
        if (
          row.kind === "attachment" &&
          !manifest.files[`attachments/${data.storageKey}`]
        )
          throw new HttpError(422, "An attachment is missing");
      }
      sqlite.prepare("SELECT id FROM Activity LIMIT 1").all();
      sqlite.prepare("SELECT id FROM Operation LIMIT 1").all();
    } finally {
      sqlite.close();
    }
    return { token, manifest };
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error instanceof HttpError
      ? error
      : new HttpError(
          422,
          "Could not validate this backup. Choose a complete Tide ZIP archive.",
        );
  }
}
export async function restoreArchive(token: string) {
  if (!/^[a-f0-9-]{36}$/.test(token))
    throw new HttpError(400, "Invalid restore token");
  const staging = path.join(imports, token);
  if (!fs.existsSync(path.join(staging, "manifest.json")))
    throw new HttpError(404, "The validated upload is no longer available");
  if (runtime.maintenance)
    throw new HttpError(503, "A restore is already in progress");
  runtime.maintenance = true;
  try {
    await createBackup("safety");
    return await serialize(async () => {
      const g = `restore-${randomUUID()}`;
      const dest = path.join(dataRoot, "generations", g);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(staging, dest);
      if (runtime.client) await runtime.client.$disconnect();
      runtime.client = undefined;
      runtime.database = undefined;
      const sqlite = new Database(path.join(dest, "workspace.db"));
      try {
        sqlite.pragma("journal_mode = WAL");
      } finally {
        sqlite.close();
      }
      const manifestPath = path.join(dataRoot, "active.json");
      fs.writeFileSync(
        `${manifestPath}.tmp`,
        JSON.stringify({ generation: g, restoredAt: new Date().toISOString() }),
      );
      fs.renameSync(`${manifestPath}.tmp`, manifestPath);
      runtime.requestCache.clear();
      return { generation: g, ok: true };
    });
  } finally {
    runtime.maintenance = false;
  }
}
export function startScheduler() {
  if (runtime.scheduler) return;
  const interrupted = backupHistory();
  if (interrupted.some((b) => b.status === "running"))
    saveHistory(
      interrupted.map((b) =>
        b.status === "running"
          ? {
              ...b,
              status: "failed",
              error:
                "The previous process stopped during this backup. Run a new backup.",
            }
          : b,
      ),
    );
  runtime.scheduler = setInterval(async () => {
    try {
      if (runtime.maintenance) return;
      const cfg = await settings();
      if (!cfg.backupEnabled) return;
      const now = (
        await import("@js-temporal/polyfill")
      ).Temporal.Now.zonedDateTimeISO(cfg.timezone);
      const date = now.toPlainDate().toString();
      const key = `${date}-${cfg.backupTime}`;
      if (
        now.toPlainTime().toString().slice(0, 5) < cfg.backupTime ||
        !cfg.backupWeekdays.includes(weekday(date))
      )
        return;
      if (
        runtime.lastBackupAttempt === key ||
        backupHistory().some(
          (b) =>
            b.type === "automatic" &&
            workspaceDay(
              { ...cfg, dayBoundary: "00:00" },
              TemporalInstant(b.at),
            ) === date,
        )
      )
        return;
      runtime.lastBackupAttempt = key;
      await createBackup("automatic");
    } catch (error) {
      console.error(
        "Scheduled backup failed:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }, 30000);
  runtime.scheduler.unref();
}
function TemporalInstant(at: string) {
  return requireTemporal().Instant.from(at);
}
import { Temporal } from "@js-temporal/polyfill";

function requireTemporal() {
  return Temporal;
}
export async function cleanImports() {
  if (!fs.existsSync(imports)) return;
  for (const name of await fsp.readdir(imports)) {
    const p = path.join(imports, name);
    if (Date.now() - (await fsp.stat(p)).mtimeMs > 86400000)
      await fsp.rm(p, { recursive: true, force: true });
  }
}
export { generation };
