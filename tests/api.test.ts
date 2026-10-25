import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { taskDefaults } from "../src/lib/types";
import { newPlan, workspaceDay } from "../src/lib/domain";
import { temporaryDatabase } from "./helpers/database";
const fixture = temporaryDatabase("api");
let api: typeof import("../src/app/api/[...path]/route");
let store: typeof import("../src/server/store");
let database: typeof import("../src/server/db");
beforeAll(async () => {
  database = await import("../src/server/db");
  store = await import("../src/server/store");
  api = await import("../src/app/api/[...path]/route");
  await store.initialize();
});
beforeEach(async () => {
  database.runtime.maintenance = false;
  await database
    .db()
    .record.deleteMany({ where: { kind: { not: "settings" } } });
  await store.createRecord(
    "person",
    { name: "Owner", color: "#e8ba72", retired: false },
    "owner",
  );
});
afterAll(async () => {
  await fixture.close(database);
});
async function call(
  resource: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const multipart = body instanceof FormData;
  const request = new NextRequest(`http://localhost:8776/api/${resource}`, {
    method,
    headers: {
      host: "localhost:8776",
      "X-Tide-Generation": database.generation(),
      ...(multipart ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body:
      body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  const handler = api[method as "GET" | "POST" | "PATCH" | "DELETE"];
  return handler(request, {
    params: Promise.resolve({ path: resource.split("?")[0].split("/") }),
  });
}
async function task(title = "API task") {
  const response = await call("records", "POST", {
    kind: "task",
    data: { ...taskDefaults(title), ownerId: "owner" },
  });
  expect(response.status).toBe(201);
  return response.json();
}
describe("HTTP contract with real SQLite persistence", () => {
  it("reports health, workspace generation and uncached data", async () => {
    const health = await call("health");
    expect(await health.json()).toEqual({ ok: true, maintenance: false });
    const response = await call("workspace");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      generation: "initial",
      records: expect.arrayContaining([
        expect.objectContaining({ id: "owner" }),
      ]),
    });
  });
  it("returns field validation issues without inserting bad data", async () => {
    const bad = await call("records", "POST", {
      kind: "task",
      data: taskDefaults(""),
    });
    expect(bad.status).toBe(422);
    expect(await bad.json()).toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ path: ["title"] }),
      ]),
    });
    expect(
      (await call("records", "POST", { kind: "unknown", data: {} })).status,
    ).toBe(422);
    expect(
      (await store.entities()).filter((r) => r.kind === "task"),
    ).toHaveLength(0);
  });
  it("rejects cross-origin and stale-generation writes while allowing the matching origin", async () => {
    const body = { kind: "task", data: taskDefaults("Origin test") };
    expect(
      (
        await call("records", "POST", body, {
          origin: "https://elsewhere.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (await call("records", "POST", body, { "X-Tide-Generation": "old" }))
        .status,
    ).toBe(409);
    expect(
      (await call("records", "POST", body, { "X-Tide-Generation": "" })).status,
    ).toBe(409);
    expect(
      (await call("records", "POST", body, { origin: "http://localhost:8776" }))
        .status,
    ).toBe(201);
  });
  it("persists edits and returns the server record for stale updates", async () => {
    const t = await task();
    const changed = await call(`records/${t.id}`, "PATCH", {
      version: t.version,
      data: { ...t.data, title: "Accepted" },
    });
    expect(changed.status).toBe(200);
    const stale = await call(`records/${t.id}`, "PATCH", {
      version: t.version,
      data: { ...t.data, title: "Rejected" },
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      current: { data: { title: "Accepted" } },
    });
    expect(
      (await call("records/missing", "PATCH", { version: 1, data: t.data }))
        .status,
    ).toBe(404);
  });
  it("requires Trash and a current version before permanent deletion", async () => {
    const t = await task();
    expect(
      (await call(`records/${t.id}`, "DELETE", { version: t.version })).status,
    ).toBe(422);
    const trashed = await (
      await call(`records/${t.id}`, "PATCH", {
        version: t.version,
        data: { ...t.data, deletedAt: new Date().toISOString() },
      })
    ).json();
    expect(
      (await call(`records/${t.id}`, "DELETE", { version: t.version })).status,
    ).toBe(409);
    expect(
      (await call(`records/${t.id}`, "DELETE", { version: trashed.version }))
        .status,
    ).toBe(200);
    expect(
      (await call(`records/${t.id}`, "DELETE", { version: trashed.version }))
        .status,
    ).toBe(404);
    expect((await call("records/owner", "DELETE", { version: 1 })).status).toBe(
      422,
    );
  });
  it("exports inspectable JSON and escapes spreadsheet formulas and quotes in CSV", async () => {
    const t = await task('=SUM(1,2) "quoted"');
    const exported = await (await call("export")).json();
    expect(exported.records).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: t.id })]),
    );
    const csv = await call("export?format=csv");
    expect(csv.headers.get("content-type")).toBe("text/csv");
    expect(await csv.text()).toContain('"\t=SUM(1,2) ""quoted"""');
  });
  it("uploads and serves actual image bytes with safe response headers", async () => {
    const form = new FormData();
    const bytes = fs.readFileSync("public/demo-insurance.png");
    form.set(
      "file",
      new File([bytes], "card image.png", { type: "image/png" }),
    );
    const uploaded = await call("attachment", "POST", form);
    expect(uploaded.status).toBe(201);
    const a = await uploaded.json();
    const download = await call(`attachment/${a.id}`);
    expect(download.headers.get("content-type")).toBe("image/png");
    expect(download.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(download.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes);
    expect(
      fs.existsSync(path.join(database.activeDir(), "attachments", a.id)),
    ).toBe(true);
  });
  it("removes uploaded bytes and returns sanitized JSON when persistence fails", async () => {
    const directory = path.join(database.activeDir(), "attachments");
    const before = fs.existsSync(directory)
      ? fs.readdirSync(directory).sort()
      : [];
    const fail = vi
      .spyOn(database.db().record, "create")
      .mockRejectedValueOnce(new Error("private database failure details"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const form = new FormData();
      form.set(
        "file",
        new File(["Keep this draft"], "draft.txt", { type: "text/plain" }),
      );
      const response = await call("attachment", "POST", form);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error:
          "The server could not finish this request. Your draft is preserved.",
      });
      expect(fs.readdirSync(directory).sort()).toEqual(before);
      expect(
        (await store.entities()).filter((r) => r.kind === "attachment"),
      ).toHaveLength(0);
    } finally {
      fail.mockRestore();
      log.mockRestore();
    }
  });
  it("downloads unsupported file types instead of rendering them and handles lost files", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File(["<script>example</script>"], "notes.html", {
        type: "text/html",
      }),
    );
    const a = await (await call("attachment", "POST", form)).json();
    const download = await call(`attachment/${a.id}`);
    expect(download.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(download.headers.get("content-security-policy")).toContain(
      "sandbox",
    );
    fs.unlinkSync(path.join(database.activeDir(), "attachments", a.id));
    expect((await call(`attachment/${a.id}`)).status).toBe(404);
    expect((await call("attachment/missing")).status).toBe(404);
  });
  it("rejects missing/oversized uploads and invalid storage paths", async () => {
    expect((await call("attachment", "POST", new FormData())).status).toBe(422);
    const form = new FormData();
    form.set(
      "file",
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.bin"),
    );
    expect((await call("attachment", "POST", form)).status).toBe(413);
    await database.db().record.create({
      data: {
        id: "unsafe",
        kind: "attachment",
        data: {
          title: "unsafe",
          filename: "unsafe",
          mime: "text/plain",
          bytes: 0,
          storageKey: "../outside",
        },
      },
    });
    expect((await call("attachment/unsafe")).status).toBe(400);
  });
  it("suspends editing during maintenance while keeping health and backup status available", async () => {
    database.runtime.maintenance = true;
    expect((await call("health")).status).toBe(503);
    expect((await call("workspace")).status).toBe(503);
    const backups = await call("backups");
    expect(backups.status).toBe(200);
    expect(await backups.json()).toMatchObject({
      maintenance: true,
      next: null,
    });
    database.runtime.maintenance = false;
  });
  it("preserves timer versions through start, pause, resume and stop", async () => {
    const t = await task();
    const start = await (
      await call("timer", "POST", {
        action: "start",
        personId: "owner",
        taskId: t.id,
        durationSeconds: 60,
      })
    ).json();
    expect(
      (
        await call("timer", "POST", {
          action: "pause",
          personId: "owner",
          version: 0,
        })
      ).status,
    ).toBe(409);
    const pause = await (
      await call("timer", "POST", {
        action: "pause",
        personId: "owner",
        version: start.version,
      })
    ).json();
    expect(pause.data.running).toBe(false);
    const resume = await (
      await call("timer", "POST", {
        action: "resume",
        personId: "owner",
        version: pause.version,
      })
    ).json();
    expect(resume.data.running).toBe(true);
    const stop = await (
      await call("timer", "POST", {
        action: "stop",
        personId: "owner",
        version: resume.version,
      })
    ).json();
    expect(stop.data.stoppedAt).toBeTruthy();
    expect(
      (
        await call("timer", "POST", {
          action: "stop",
          personId: "owner",
          version: stop.version,
        })
      ).status,
    ).toBe(404);
  });
  it("copies idempotently through the HTTP API and undoes only that operation", async () => {
    const t = await task();
    const input = {
      operationId: randomUUID(),
      action: "copy",
      day: workspaceDay(),
      items: [{ id: t.id, version: t.version }],
    };
    const first = await (await call("bulk", "POST", input)).json();
    expect(await (await call("bulk", "POST", input)).json()).toEqual(first);
    expect(
      (await store.entities()).filter((r) => r.kind === "task"),
    ).toHaveLength(2);
    expect(
      (await call("bulk-undo", "POST", { operationId: input.operationId }))
        .status,
    ).toBe(200);
    expect(
      (await store.entities()).filter((r) => r.kind === "task"),
    ).toHaveLength(1);
    expect(
      (
        await call("bulk", "POST", {
          ...input,
          operationId: randomUUID(),
          day: "bad",
        })
      ).status,
    ).toBe(422);
  });
  it("applies selected routine templates once and atomically saves their daily plan", async () => {
    const routine = await store.createRecord("routine", {
      title: "Start",
      notes: "",
      templates: [
        { title: "First", estimate: 10 },
        { title: "Second", estimate: 20 },
      ],
    });
    const input = {
      routineId: routine.id,
      personId: "owner",
      day: workspaceDay(),
      indices: [1],
      operationId: randomUUID(),
    };
    const applied = await (await call("routine-apply", "POST", input)).json();
    expect(applied).toHaveLength(1);
    expect(applied[0].data.title).toBe("Second");
    expect(await (await call("routine-apply", "POST", input)).json()).toEqual(
      applied,
    );
    const plan = {
      ...newPlan("owner", workspaceDay()),
      taskIds: [applied[0].id],
      focusIds: [applied[0].id],
    };
    const saved = await (await call("plan", "POST", { data: plan })).json();
    expect(saved.data.focusIds).toEqual(plan.focusIds);
    const review = await call("review", "POST", {
      data: { ...plan, reflection: "Good progress" },
      version: saved.version,
      decisions: [
        {
          id: applied[0].id,
          version: applied[0].version,
          action: "someday",
          day: "",
        },
      ],
    });
    expect(review.status).toBe(200);
    expect(
      (await store.entities()).find((r) => r.id === applied[0].id)?.data
        .someday,
    ).toBe(true);
  });
  it("routes provider actions and rejects invalid provider input", async () => {
    expect(
      (await call("provider", "POST", { action: "places", query: "a" })).status,
    ).toBe(422);
    expect(
      (
        await call("provider", "POST", {
          action: "place-details",
          id: "../bad",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call("provider", "POST", {
          action: "route",
          origin: "",
          destination: "",
          travelMode: "DRIVE",
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await call("provider", "POST", {
          action: "weather",
          latitude: 99,
          longitude: 0,
          day: workspaceDay(),
        })
      ).status,
    ).toBe(422);
  });
  it("validates a full uploaded backup before replacement and rejects stale tabs afterwards", async () => {
    const t = await task("Backed up");
    const created = await (await call("backups", "POST", {})).json();
    expect(created.status).toBe("succeeded");
    const downloaded = await call(`backup/${created.id}`);
    expect(downloaded.headers.get("content-type")).toBe("application/zip");
    const form = new FormData();
    form.set(
      "file",
      new File([await downloaded.arrayBuffer()], "backup.zip", {
        type: "application/zip",
      }),
    );
    const preview = await (await call("restore-upload", "POST", form)).json();
    expect(preview.manifest.counts.task).toBe(1);
    expect(
      (
        await call("backups", "POST", {
          action: "restore",
          token: preview.token,
        })
      ).status,
    ).toBe(422);
    const oldGeneration = database.generation();
    expect(
      (
        await call("backups", "POST", {
          action: "restore",
          token: preview.token,
          confirm: true,
        })
      ).status,
    ).toBe(200);
    expect(database.generation()).not.toBe(oldGeneration);
    expect(
      (
        await call(
          `records/${t.id}`,
          "PATCH",
          { version: t.version, data: t.data },
          { "X-Tide-Generation": oldGeneration },
        )
      ).status,
    ).toBe(409);
    expect(
      (await store.entities()).find((r) => r.id === t.id)?.data.title,
    ).toBe("Backed up");
  });
  it("rejects missing or invalid archives and unknown endpoints", async () => {
    expect((await call("restore-upload", "POST", new FormData())).status).toBe(
      422,
    );
    const form = new FormData();
    form.set("file", new File(["not a zip"], "bad.zip"));
    expect((await call("restore-upload", "POST", form)).status).toBe(422);
    expect((await call("backup/missing")).status).toBe(404);
    expect((await call("backup/invalid.id")).status).toBe(400);
    expect((await call("unknown")).status).toBe(404);
    expect((await call("unknown", "POST", {})).status).toBe(404);
  });
  it("rejects malformed JSON as a client error", async () => {
    const request = new NextRequest("http://localhost:8776/api/records", {
      method: "POST",
      headers: { "X-Tide-Generation": database.generation() },
      body: "{",
    });
    const response = await api.POST(request, {
      params: Promise.resolve({ path: ["records"] }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Request body must be valid JSON",
    });
  });
  it("contains unexpected failures without leaking internal details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new NextRequest("http://localhost:8776/api/records", {
      method: "POST",
      headers: { "X-Tide-Generation": database.generation() },
      body: "{",
    });
    vi.spyOn(request, "json").mockRejectedValueOnce(
      new Error("internal read details"),
    );
    const response = await api.POST(request, {
      params: Promise.resolve({ path: ["records"] }),
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error:
        "The server could not finish this request. Your draft is preserved.",
    });
    log.mockRestore();
  });
});
