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

function runDocker(
  command: string,
  options: { failAt?: number; signalAt?: number; unavailable?: boolean } = {},
) {
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
const capture = process.env.DOCKER_CAPTURE_PATH;
const calls = fs.existsSync(capture) ? JSON.parse(fs.readFileSync(capture, "utf8")) : [];
calls.push({
  command, args,
  server: process.env.GOOGLE_SERVER_API_KEY,
  browser: process.env.GOOGLE_MAPS_BROWSER_KEY,
  mode: process.env.TIDE_GOOGLE_MODE,
  localOnly: process.env.TIDE_DOCKER_LOCAL_ONLY,
});
fs.writeFileSync(capture, JSON.stringify(calls));
if (process.env.DOCKER_UNAVAILABLE === "true") return { error: new Error("ENOENT"), status: null };
if (calls.length === Number(process.env.DOCKER_SIGNAL_AT)) return { status: null, signal: "SIGTERM" };
return { status: calls.length === Number(process.env.DOCKER_FAIL_AT) ? 7 : 0 };
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
        DOCKER_FAIL_AT: String(options.failAt ?? 0),
        DOCKER_SIGNAL_AT: String(options.signalAt ?? 0),
        DOCKER_UNAVAILABLE: String(options.unavailable ?? false),
      },
      encoding: "utf8",
    },
  );
  const calls = JSON.parse(fs.readFileSync(capture, "utf8")) as {
    command: string;
    args: string[];
    server?: string;
    browser?: string;
    mode?: string;
    localOnly?: string;
  }[];
  return { ...result, calls };
}

describe("Docker Google configuration", () => {
  it("builds without loading local credentials or passing key build arguments", () => {
    const execution = runDocker("build");
    expect(execution.status, execution.stderr).toBe(0);
    const [result] = execution.calls;
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
    const execution = runDocker("test");
    expect(execution.status, execution.stderr).toBe(0);
    const [result] = execution.calls;
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

describe("Docker release", () => {
  it("builds the versioned amd64 image, tags latest, and publishes both in order", () => {
    const result = runDocker("release");
    expect(result.status, result.stderr).toBe(0);
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const version = `afbeals/tide:${pkg.version}`;
    expect(
      result.calls.map(({ command, args }) => ({ command, args })),
    ).toEqual([
      {
        command: "docker",
        args: [
          "buildx",
          "build",
          "--platform",
          "linux/amd64",
          "--load",
          "-t",
          version,
          ".",
        ],
      },
      { command: "docker", args: ["tag", version, "afbeals/tide:latest"] },
      { command: "docker", args: ["push", version] },
      { command: "docker", args: ["push", "afbeals/tide:latest"] },
    ]);
    for (const call of result.calls) {
      expect(call.localOnly).toBeUndefined();
      expect(call.args.join(" ")).not.toMatch(
        /local-test-|inherited-test-|--build-arg|env-file/,
      );
    }
    expect(result.stdout).toContain(
      `Released ${version} and afbeals/tide:latest`,
    );
  });

  it.each([1, 2, 3, 4])(
    "stops immediately when release step %i fails",
    (failAt) => {
      const result = runDocker("release", { failAt });
      expect(result.status).toBe(7);
      expect(result.calls).toHaveLength(failAt);
      expect(result.stdout).not.toContain("Released");
    },
  );

  it("does not tag or push after Docker is terminated by a signal", () => {
    const result = runDocker("release", { signalAt: 1 });
    expect(result.status).toBe(1);
    expect(result.calls).toHaveLength(1);
    expect(result.stdout).not.toContain("Released");
  });

  it("reports missing Docker and stops before publishing", () => {
    const result = runDocker("release", { unavailable: true });
    expect(result.status).toBe(1);
    expect(result.calls).toHaveLength(1);
    expect(result.stderr).toContain("Docker is not available");
    expect(result.stdout).not.toContain("Released");
  });
});
