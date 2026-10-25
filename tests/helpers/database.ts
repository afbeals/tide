import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

/** Real migrations in a disposable directory; never read the normal workspace. */
export function temporaryDatabase(label: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `tide-${label}-`));
  const previous = {
    dir: process.env.TIDE_DATA_DIR,
    url: process.env.DATABASE_URL,
  };
  process.env.TIDE_DATA_DIR = root;
  process.env.DATABASE_URL = `file:${path.join(root, "workspace.db")}`;
  const sqlite = new Database(path.join(root, "workspace.db"));
  sqlite.exec(
    fs.readFileSync(
      "prisma/migrations/20261024000000_initial/migration.sql",
      "utf8",
    ),
  );
  sqlite.close();
  return {
    root,
    async close(database: typeof import("../../src/server/db")) {
      if (database.runtime.scheduler) clearInterval(database.runtime.scheduler);
      await database.runtime.client?.$disconnect();
      fs.rmSync(root, { recursive: true, force: true });
      for (const [key, value] of Object.entries({
        TIDE_DATA_DIR: previous.dir,
        DATABASE_URL: previous.url,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    },
  };
}
