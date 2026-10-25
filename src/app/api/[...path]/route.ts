import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import {
  activeDir,
  db,
  runtime as appRuntime,
  assertWritable,
  HttpError,
  serialize,
  requestGeneration,
  generation,
} from "@/server/db";
import {
  initialize,
  materialize,
  snapshot,
  createRecord,
  updateRecord,
  removeRecord,
  timerAction,
  bulk,
  savePlan,
  applyRoutine,
  undoBulk,
  saveReview,
  asEntity,
  settings,
} from "@/server/store";
import {
  backupHistory,
  backupFile,
  createBackup,
  validateArchive,
  restoreArchive,
  startScheduler,
} from "@/server/backups";
import {
  places,
  route,
  weather,
  providerStatus,
  placeDetails,
} from "@/server/providers";
import { envelopeSchema, parseData, nextBackup } from "@/lib/domain";
import type { Plan } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Context {
  params: Promise<{ path: string[] }>;
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        issues: error.issues,
      },
      422,
    );
  if (error instanceof HttpError)
    return json({ error: error.message, current: error.details }, error.status);
  console.error(
    "Request failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return json(
    {
      error:
        "The server could not finish this request. Your draft is preserved.",
    },
    500,
  );
}
async function processRequest(req: NextRequest, context: Context) {
  try {
    const segments = (await context.params).path;
    const resource = segments[0];
    const method = req.method;
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      if (origin && new URL(origin).host !== req.headers.get("host"))
        throw new HttpError(403, "Cross-origin writes are not allowed");
    }
    if (resource === "health")
      return json(
        { ok: !appRuntime.maintenance, maintenance: appRuntime.maintenance },
        appRuntime.maintenance ? 503 : 200,
      );
    if (appRuntime.maintenance && resource !== "backups")
      throw new HttpError(
        503,
        "Workspace maintenance is in progress. Drafts are preserved.",
      );
    if (!appRuntime.maintenance) await initialize();
    startScheduler();
    if (appRuntime.maintenance && resource !== "backups")
      throw new HttpError(
        503,
        "Workspace maintenance is in progress. Drafts are preserved.",
      );
    if (method === "GET") {
      if (resource === "workspace") {
        await materialize();
        return json({
          ...(await snapshot()),
          provider: await providerStatus(),
          maintenance: appRuntime.maintenance,
        });
      }
      if (resource === "backups")
        return json({
          history: backupHistory(),
          next: appRuntime.maintenance ? null : nextBackup(await settings()),
          maintenance: appRuntime.maintenance,
        });
      if (resource === "backup" && segments[1])
        return new Response(fs.readFileSync(backupFile(segments[1])), {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="tide-${segments[1]}.zip"`,
          },
        });
      if (resource === "attachment" && segments[1]) {
        const row = await db().record.findUnique({
          where: { id: segments[1] },
        });
        if (!row || row.kind !== "attachment")
          throw new HttpError(404, "Attachment not found");
        const data = parseData("attachment", row.data);
        if (!/^[a-zA-Z0-9_-]+$/.test(String(data.storageKey)))
          throw new HttpError(400, "Invalid attachment");
        const file = path.join(
          activeDir(),
          "attachments",
          String(data.storageKey),
        );
        if (!fs.existsSync(file))
          throw new HttpError(404, "Attachment file is unavailable");
        const inline = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ].includes(String(data.mime));
        return new Response(fs.readFileSync(file), {
          headers: {
            "Content-Type": String(data.mime),
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(String(data.filename))}`,
          },
        });
      }
      if (resource === "export") {
        const data = await snapshot();
        const csv = req.nextUrl.searchParams.get("format") === "csv";
        const escaped = (v: unknown) =>
          `"${String(v ?? "")
            .replaceAll('"', '""')
            .replace(/^([=+@-])/, "\t$1")}"`;
        const content = csv
          ? [
              "id,title,status,ownerId,plannedDay,deadline,estimate",
              ...data.records
                .filter((r) => r.kind === "task")
                .map((r) =>
                  [
                    r.id,
                    r.data.title,
                    r.data.status,
                    r.data.ownerId,
                    r.data.plannedDay,
                    r.data.deadline,
                    r.data.estimate,
                  ]
                    .map(escaped)
                    .join(","),
                ),
            ].join("\r\n")
          : JSON.stringify(data, null, 2);
        return new Response(content, {
          headers: {
            "Content-Type": csv ? "text/csv" : "application/json",
            "Content-Disposition": `attachment; filename="tide-export.${csv ? "csv" : "json"}"`,
          },
        });
      }
    }
    if (method === "POST" && resource === "attachment") {
      assertWritable();
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(422, "Choose a file");
      if (file.size > 20 * 1024 * 1024)
        throw new HttpError(413, "Attachments must be smaller than 20 MB");
      return await serialize(async () => {
        assertWritable();
        const id = randomUUID();
        const dest = path.join(activeDir(), "attachments");
        fs.mkdirSync(dest, { recursive: true });
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.join(dest, id), buffer);
        try {
          const row = await db().record.create({
            data: {
              id,
              kind: "attachment",
              data: {
                title: file.name || "Attachment",
                filename: file.name || "attachment",
                mime: file.type || "application/octet-stream",
                bytes: file.size,
                storageKey: id,
              },
            },
          });
          return json(asEntity(row), 201);
        } catch (error) {
          fs.rmSync(path.join(dest, id), { force: true });
          throw error;
        }
      });
    }
    if (method === "POST" && resource === "restore-upload") {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File))
        throw new HttpError(422, "Choose a Tide backup ZIP");
      return json(await validateArchive(Buffer.from(await file.arrayBuffer())));
    }
    let body: Record<string, unknown> = {};
    if (method !== "GET") {
      try {
        body = z.record(z.string(), z.unknown()).parse(await req.json());
      } catch (error) {
        if (error instanceof SyntaxError)
          throw new HttpError(400, "Request body must be valid JSON");
        throw error;
      }
    }
    if (method === "POST") {
      if (resource === "records") {
        const input = envelopeSchema.parse(body);
        return json(await createRecord(input.kind, input.data), 201);
      }
      if (resource === "review")
        return json(
          await saveReview(
            z
              .object({
                data: z.custom<Plan>(),
                version: z.number().int().optional(),
                decisions: z
                  .array(
                    z.object({
                      id: z.string(),
                      version: z.number().int(),
                      action: z.enum(["move", "someday", "archive"]),
                      day: z.string(),
                    }),
                  )
                  .max(500),
              })
              .parse(body),
          ),
        );
      if (resource === "plan") {
        return json(
          await savePlan(
            body.data as Plan,
            z.number().int().optional().parse(body.version),
            z
              .array(
                z.object({
                  id: z.string(),
                  version: z.number().int(),
                  data: z.record(z.string(), z.unknown()),
                }),
              )
              .optional()
              .parse(body.taskEdits),
          ),
        );
      }
      if (resource === "timer") {
        const input = z
          .object({
            action: z.enum(["start", "pause", "resume", "stop"]),
            personId: z.string(),
            taskId: z.string().optional(),
            durationSeconds: z.number().optional(),
            confirm: z.boolean().optional(),
            version: z.number().int().optional(),
          })
          .parse(body);
        return json(await timerAction(input));
      }
      if (resource === "bulk-undo")
        return json(await undoBulk(z.string().uuid().parse(body.operationId)));
      if (resource === "bulk") {
        const input = z
          .object({
            operationId: z.string().uuid(),
            action: z.enum(["copy", "move", "archive", "someday"]),
            day: z.string(),
            items: z
              .array(z.object({ id: z.string(), version: z.number().int() }))
              .min(1)
              .max(500),
          })
          .parse(body);
        if (
          ["copy", "move"].includes(input.action) &&
          !/^\d{4}-\d{2}-\d{2}$/.test(input.day)
        )
          throw new HttpError(422, "Choose a destination day");
        return json(await bulk(input));
      }
      if (resource === "routine-apply")
        return json(
          await applyRoutine(
            z
              .object({
                routineId: z.string(),
                personId: z.string(),
                day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                indices: z.array(z.number().int().min(0)).min(1),
                operationId: z.string().uuid(),
              })
              .parse(body),
          ),
        );
      if (resource === "backups") {
        if (body.action === "restore") {
          if (body.confirm !== true)
            throw new HttpError(
              422,
              "Confirm replacement of everyone’s workspace",
            );
          return json(
            await restoreArchive(z.string().uuid().parse(body.token)),
          );
        }
        return json(await createBackup("manual"));
      }
      if (resource === "provider") {
        if (body.action === "place-details")
          return json(await placeDetails(z.string().parse(body.id)));
        if (body.action === "places")
          return json(await places(z.string().parse(body.query)));
        if (body.action === "route")
          return json(
            await route(
              z
                .object({
                  origin: z.string(),
                  destination: z.string(),
                  travelMode: z.string(),
                  departure: z.string().optional(),
                  arrival: z.string().optional(),
                })
                .parse(body),
            ),
          );
        if (body.action === "weather")
          return json(
            await weather(
              z
                .object({
                  latitude: z.number(),
                  longitude: z.number(),
                  day: z.string(),
                })
                .parse(body),
            ),
          );
      }
    }
    if (method === "PATCH" && resource === "records" && segments[1])
      return json(
        await updateRecord(
          segments[1],
          z.number().int().parse(body.version),
          body.data,
          z.string().optional().parse(body.scopeFrom),
        ),
      );
    if (method === "DELETE" && resource === "records" && segments[1])
      return json(
        await removeRecord(segments[1], z.number().int().parse(body.version)),
      );
    throw new HttpError(404, "Endpoint not found");
  } catch (error) {
    return errorResponse(error);
  }
}
function handle(req: NextRequest, context: Context) {
  if (
    req.method !== "GET" &&
    req.headers.get("x-tide-generation") !== generation()
  )
    return Promise.resolve(
      json(
        {
          error:
            "The workspace changed or was restored. Refresh and review your draft before saving.",
        },
        409,
      ),
    );
  return requestGeneration.run(
    req.method === "GET" ? null : req.headers.get("x-tide-generation"),
    () => processRequest(req, context),
  );
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
