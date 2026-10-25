import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tide-browser-"));
const env = {
  ...process.env,
  TIDE_DATA_DIR: directory,
  DATABASE_URL: "file:" + path.join(directory, "workspace.db"),
};
for (const args of [
  ["run", "db:deploy"],
  ["run", "db:seed"],
]) {
  const r = spawnSync("npm", args, { env, stdio: "inherit" });
  if (r.status) {
    fs.rmSync(directory, { recursive: true, force: true });
    process.exit(r.status);
  }
}
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "8777"],
  { env, stdio: "inherit" },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  fs.rmSync(directory, { recursive: true, force: true });
  process.exit(code || 0);
});
