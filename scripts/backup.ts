import { createBackup } from "../src/server/backups";
import { db } from "../src/server/db";

console.log(
  await createBackup(process.argv.includes("--safety") ? "safety" : "manual"),
);
await db().$disconnect();
