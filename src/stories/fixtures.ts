import { delay, http, HttpResponse } from "msw";
import { defaultFilters, settingsDefaults, taskDefaults } from "../lib/types";
import { newPlan } from "../lib/domain";
import type { Entity, Task, Workspace } from "../lib/types";
export const demoDay = "2026-10-24";
const at = "2026-10-24T12:00:00.000Z";
export function record(
  kind: Entity["kind"],
  id: string,
  data: unknown,
): Entity {
  return { id, kind, version: 1, createdAt: at, updatedAt: at, data } as Entity;
}
export function exampleWorkspace(): Workspace {
  return {
    generation: "storybook",
    maintenance: false,
    provider: { configured: false, mapConfigured: false, used: 0, limit: 1000 },
    activities: [
      {
        id: "activity",
        recordId: "presentation",
        action: "create",
        detail: "Added a task",
        createdAt: at,
      },
    ],
    records: [
      record("settings", "settings", settingsDefaults),
      record("person", "alex", {
        name: "Alex",
        color: "#e8ba72",
        retired: false,
      }),
      record("person", "sam", {
        name: "Sam",
        color: "#a6b3d2",
        retired: false,
      }),
      record("area", "work", {
        title: "Work",
        notes: "Useful things, thoughtfully made.",
      }),
      record("project", "team", {
        title: "Team presentation",
        notes: "<p>Start with the customer.</p>",
        areaId: "work",
        targetDay: "2026-10-30",
        referenceIds: ["outline"],
        archived: false,
      }),
      record("task", "presentation", {
        ...taskDefaults("Prepare team presentation"),
        ownerId: "alex",
        projectId: "team",
        plannedDay: demoDay,
        estimate: 60,
        priority: "High",
        notes: "<p>Lead with the customer problem.</p>",
        checklist: [{ id: "one", text: "Choose examples", done: false }],
        referenceIds: ["outline"],
      }),
      record("task", "walk", {
        ...taskDefaults("Walk through the park"),
        ownerId: "alex",
        plannedDay: demoDay,
        estimate: 30,
        outdoor: true,
        context: "Away from home",
        destination: "Golden Gate Park",
        latitude: 37.7694,
        longitude: -122.4862,
        travelMinutes: 15,
        status: "In progress",
      }),
      record("task", "waiting", {
        ...taskDefaults("Confirm contractor date"),
        ownerId: null,
        status: "Waiting/blocked",
        blockingNote: "Waiting for a reply",
        estimate: 10,
      }),
      record("task", "done", {
        ...taskDefaults("Clear the desk"),
        ownerId: "alex",
        plannedDay: demoDay,
        status: "Done",
        estimate: 10,
        completedAt: at,
      }),
      record("task", "someday", {
        ...taskDefaults("Research a bicycle"),
        ownerId: "alex",
        someday: true,
        estimate: 25,
      }),
      record("plan", `plan-alex-${demoDay}`, {
        ...newPlan("alex", demoDay),
        taskIds: ["presentation", "walk", "done"],
        focusIds: ["presentation", "walk"],
        notes: "Leave room between things.",
        essentials: [{ id: "bottle", text: "Water bottle", done: false }],
      }),
      record("availability", "hours", {
        personId: "alex",
        date: demoDay,
        weekdays: [6],
        start: "09:00",
        end: "17:00",
        breaks: [{ start: "12:00", end: "13:00" }],
      }),
      record("reference", "outline", {
        title: "Presentation outline",
        type: "Note",
        notes: "<p>One problem, three examples, one useful question.</p>",
        url: "",
        checklist: [],
        attachmentIds: [],
        tags: ["work"],
      }),
      record("routine", "reset", {
        title: "Sunday reset",
        notes: "<p>A gentler start.</p>",
        templates: [
          {
            title: "Clear surfaces",
            estimate: 10,
            context: "At home",
            effort: "Low",
            notes: "",
            checklist: [],
          },
        ],
      }),
      record("place", "home", {
        name: "Home",
        address: "San Francisco, CA",
        placeId: "",
        latitude: 37.7749,
        longitude: -122.4194,
      }),
      record("outing", "outing", {
        title: "Afternoon outdoors",
        notes: "<p>Bring water.</p>",
        context: "Away from home",
        taskIds: ["walk"],
        origin: "Home",
        travelMode: "WALK",
        departure: "",
        arrival: "",
        returnTrip: false,
        returnAddress: "Home",
        bring: [{ id: "water", text: "Water", done: false }],
      }),
      record("view", "short", {
        title: "Short tasks",
        filters: { ...defaultFilters, maxMinutes: "30" },
      }),
    ],
  };
}
let workspace = exampleWorkspace();
let failWrites = false;
let writeDelay = 0;
export function resetWorkspace(
  options: { failWrites?: boolean; writeDelay?: number; empty?: boolean } = {},
) {
  workspace = exampleWorkspace();
  failWrites = !!options.failWrites;
  writeDelay = options.writeDelay || 0;
  if (options.empty)
    workspace.records = workspace.records.filter(
      (r) => r.kind === "settings" || r.kind === "person",
    );
}
export function getMockWorkspace() {
  return structuredClone(workspace);
}
const backup = {
  id: "example",
  type: "manual",
  at,
  status: "succeeded",
  bytes: 2048,
};
export const handlers = [
  http.get("/api/workspace", () => HttpResponse.json(workspace)),
  http.post("/api/records", async ({ request }) => {
    if (writeDelay) await delay(writeDelay);
    if (failWrites)
      return HttpResponse.json(
        { error: "The server is unavailable. Your draft is preserved." },
        { status: 503 },
      );
    const body = (await request.json()) as {
      kind: Entity["kind"];
      data: Entity["data"];
    };
    const result = record(body.kind, crypto.randomUUID(), body.data);
    workspace.records.push(result);
    return HttpResponse.json(result, { status: 201 });
  }),
  http.patch("/api/records/:id", async ({ request, params }) => {
    if (writeDelay) await delay(writeDelay);
    if (failWrites)
      return HttpResponse.json(
        { error: "The server is unavailable. Your draft is preserved." },
        { status: 503 },
      );
    const body = (await request.json()) as {
      data: Entity["data"];
      version: number;
    };
    const index = workspace.records.findIndex((r) => r.id === params.id);
    const previous = workspace.records[index];
    if (!previous)
      return HttpResponse.json(
        { error: "Record unavailable" },
        { status: 404 },
      );
    if (previous.version !== body.version)
      return HttpResponse.json(
        { error: "Changed in another browser", current: previous },
        { status: 409 },
      );
    const result = {
      ...previous,
      data: body.data,
      version: previous.version + 1,
    };
    workspace.records[index] = result;
    return HttpResponse.json(result);
  }),
  http.get("/api/backups", () =>
    HttpResponse.json({
      history: [backup],
      next: "2026-10-25T10:00:00Z",
      maintenance: false,
    }),
  ),
  http.post("/api/backups", async () => HttpResponse.json(backup)),
  http.post("/api/provider", () =>
    HttpResponse.json(
      {
        error:
          "Google is not configured. Use a saved place or manual travel estimate.",
      },
      { status: 503 },
    ),
  ),
  http.post("/api/plan", async ({ request }) => {
    const body = (await request.json()) as { data: Entity["data"] };
    const plan = record("plan", `plan-alex-${demoDay}`, body.data);
    workspace.records = workspace.records
      .filter((r) => r.id !== plan.id)
      .concat(plan);
    return HttpResponse.json(plan);
  }),
];
export function exampleTask(id = "presentation") {
  return workspace.records.find((r) => r.id === id) as unknown as Entity<Task>;
}
export function patchMockTask(id: string, fields: Partial<Task>) {
  const item = workspace.records.find((r) => r.id === id)!;
  item.data = { ...item.data, ...fields };
}

/** Configure a scenario before rendering; each story starts from a fresh workspace. */
export function editMockWorkspace(edit: (value: Workspace) => void) {
  edit(workspace);
}
