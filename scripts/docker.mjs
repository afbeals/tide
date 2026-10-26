import { spawnSync } from "node:child_process";
import fs from "node:fs";
const pkg = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const image = "afbeals/tide";
const version = image + ":" + pkg.version;
function docker(args) {
  const result = spawnSync("docker", args, { stdio: "inherit" });
  if (result.error) {
    console.error(
      "Docker is not available. Install/start Docker Desktop or use an Unraid build host.",
    );
    process.exit(1);
  }
  if (result.status) process.exit(result.status);
}
switch (process.argv[2]) {
  case "build":
    docker([
      "buildx",
      "build",
      "--platform",
      "linux/amd64",
      "--load",
      "-t",
      version,
      ".",
    ]);
    break;
  case "tag":
    docker(["tag", version, image + ":latest"]);
    break;
  case "test":
    fs.mkdirSync("docker-data", { recursive: true });
    docker([
      "run",
      "--rm",
      "--name",
      "tide-local",
      "--env",
      "TIDE_GOOGLE_MODE=disabled",
      "--env",
      "GOOGLE_SERVER_API_KEY=",
      "--env",
      "GOOGLE_MAPS_BROWSER_KEY=",
      "--env",
      "NEXT_PUBLIC_GOOGLE_MAPS_KEY=",
      "-p",
      "8776:8776",
      "-v",
      process.cwd() + "/docker-data:/app/data",
      version,
    ]);
    break;
  case "push":
    docker(["push", version]);
    docker(["push", image + ":latest"]);
    break;
  default:
    console.error("Usage: node scripts/docker.mjs build|tag|test|push");
    process.exit(1);
}
