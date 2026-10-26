import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});

function runDocker(command: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tide-docker-config-"));
  directories.push(dir);
  const capture = path.join(dir, "capture.json");
  fs.writeFileSync(
    path.join(dir, ".env"),
    [
      "TIDE_GOOGLE_MODE=live",
      "GOOGLE_SERVER_API_KEY=local-test-server-key",
      "GOOGLE_MAPS_BROWSER_KEY=local-test-browser-key",
      "DATABASE_URL=file:/host-only/database.db",
      "TIDE_DOCKER_LOCAL_ONLY=loaded-from-local-env",
    ].join("\n"),
  );
  const stub = path.join(dir, "docker-stub.mjs");
  fs.writeFileSync(
    stub,
    `import childProcess from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
childProcess.spawnSync = (command, args) => {
fs.writeFileSync(process.env.DOCKER_CAPTURE_PATH, JSON.stringify({
  command, args,
  server: process.env.GOOGLE_SERVER_API_KEY,
  browser: process.env.GOOGLE_MAPS_BROWSER_KEY,
  mode: process.env.TIDE_GOOGLE_MODE,
  localOnly: process.env.TIDE_DOCKER_LOCAL_ONLY,
}));
return { status: 0 };
};
syncBuiltinESMExports();
`,
  );
  const env = { ...process.env };
  delete env.TIDE_DOCKER_LOCAL_ONLY;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(stub).href,
      path.resolve("scripts/docker.mjs"),
      command,
    ],
    {
      cwd: dir,
      env: {
        ...env,
        GOOGLE_SERVER_API_KEY: "inherited-test-server-key",
        GOOGLE_MAPS_BROWSER_KEY: "inherited-test-browser-key",
        NEXT_PUBLIC_GOOGLE_MAPS_KEY: "inherited-test-legacy-key",
        TIDE_GOOGLE_MODE: "live",
        DOCKER_CAPTURE_PATH: capture,
      },
      encoding: "utf8",
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(fs.readFileSync(capture, "utf8")) as {
    command: string;
    args: string[];
    server?: string;
    browser?: string;
    mode?: string;
    localOnly?: string;
  };
}

describe("Docker Google configuration", () => {
  it("builds without loading local credentials or passing key build arguments", () => {
    const result = runDocker("build");
    expect(result.command).toBe("docker");
    expect(result.args.slice(0, 6)).toEqual([
      "buildx",
      "build",
      "--platform",
      "linux/amd64",
      "--load",
      "-t",
    ]);
    expect(result.args.at(-1)).toBe(".");
    expect(result.args).not.toContain("--build-arg");
    expect(result.server).toBe("inherited-test-server-key");
    expect(result.browser).toBe("inherited-test-browser-key");
    expect(result.localOnly).toBeUndefined();
  });

  it("disables Google credentials by default for local container tests", () => {
    const result = runDocker("test");
    for (const key of [
      "GOOGLE_SERVER_API_KEY",
      "GOOGLE_MAPS_BROWSER_KEY",
      "NEXT_PUBLIC_GOOGLE_MAPS_KEY",
    ])
      expect(result.args).toContain(`${key}=`);
    expect(result.args).toContain("TIDE_GOOGLE_MODE=disabled");
    expect(result.server).toBe("inherited-test-server-key");
    expect(result.browser).toBe("inherited-test-browser-key");
    expect(result.localOnly).toBeUndefined();
    expect(result.args.join(" ")).not.toMatch(
      /local-test-|DATABASE_URL|env-file|host-only/,
    );
  });
});
