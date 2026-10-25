import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Resolve the same database for migrations, container startup and restored data. */
export function activeDatabaseURL() {
  const root = path.resolve(process.env.TIDE_DATA_DIR || "./data");
  const manifest = path.join(root, "active.json");
  if (fs.existsSync(manifest)) {
    const { generation } = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (typeof generation !== "string" || !/^[a-zA-Z0-9_-]+$/.test(generation))
      throw new Error(
        "The active data manifest is invalid. Restore a known-good manifest before starting.",
      );
    if (generation !== "initial")
      return (
        "file:" + path.join(root, "generations", generation, "workspace.db")
      );
  }
  const configured = process.env.DATABASE_URL;
  if (configured && !configured.startsWith("file:"))
    throw new Error("Tide requires a SQLite file: database URL.");
  return (
    "file:" +
    path.resolve(configured?.slice(5) || path.join(root, "workspace.db"))
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(activeDatabaseURL());
