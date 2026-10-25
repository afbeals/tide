import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

export const dataRoot = path.resolve(
  /* turbopackIgnore: true */ process.env.TIDE_DATA_DIR || "./data",
);
fs.mkdirSync(dataRoot, { recursive: true });
export function generation() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(dataRoot, "active.json"), "utf8"),
    ).generation as string;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "initial";
    throw new Error(
      "The active data manifest cannot be read. Recover the manifest before starting Tide.",
      { cause: error },
    );
  }
}
export function activeDir() {
  const g = generation();
  if (!/^[a-zA-Z0-9_-]+$/.test(g)) throw new Error("Invalid active generation");
  return g === "initial" ? dataRoot : path.join(dataRoot, "generations", g);
}
export function databasePath() {
  if (
    generation() === "initial" &&
    process.env.DATABASE_URL?.startsWith("file:")
  )
    return path.resolve(process.env.DATABASE_URL.slice(5));
  return path.join(activeDir(), "workspace.db");
}
interface Runtime {
  client?: PrismaClient;
  database?: string;
  maintenance: boolean;
  writeQueue: Promise<unknown>;
  scheduler?: NodeJS.Timeout;
  lastBackupAttempt?: string;
  providerCount?: { day: string; count: number };
  requestCache: Map<string, { expires: number; data: unknown }>;
}
const globalState = globalThis as unknown as { tideRuntime?: Runtime };
export const runtime: Runtime = (globalState.tideRuntime ??= {
  maintenance: false,
  writeQueue: Promise.resolve(),
  requestCache: new Map(),
});
export function db() {
  const p = databasePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (runtime.database !== p) {
    const sqlite = new Database(p);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 10000");
    sqlite.pragma("foreign_keys = ON");
    sqlite.close();
    runtime.client = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: `file:${p}` }),
    });
    runtime.database = p;
  }
  return runtime.client!;
}
export function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = runtime.writeQueue.then(() => {
    assertGeneration();
    return work();
  });
  runtime.writeQueue = next.catch(() => {});
  return next;
}
export const requestGeneration = new AsyncLocalStorage<string | null>();
export function assertGeneration() {
  const expected = requestGeneration.getStore();
  if (expected && expected !== generation())
    throw new HttpError(
      409,
      "The workspace was restored. Refresh and review your device draft before saving.",
    );
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function assertWritable() {
  assertGeneration();
  if (runtime.maintenance)
    throw new HttpError(
      503,
      "Workspace maintenance is in progress. Your device draft is preserved.",
    );
}
