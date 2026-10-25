import http from "node:http";
import fs from "node:fs";
import path from "node:path";

// Local static Storybook only; no API or access to the application's data.
const root = path.resolve("storybook-static");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
if (!fs.existsSync(path.join(root, "iframe.html"))) {
  throw new Error("Build Storybook first with npm run storybook:build");
}
const server = http.createServer((req, res) => {
  let file;
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    file = path.resolve(
      root,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile())
      throw new Error("Unavailable");
  } catch {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": types[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
});
server.listen(6007, "127.0.0.1", () =>
  console.log("Static Storybook: http://127.0.0.1:6007"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
