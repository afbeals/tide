import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db, activeDir } from "../src/server/db";
import { initialize, materialize } from "../src/server/store";
import {
  taskDefaults,
  settingsDefaults,
  defaultFilters,
} from "../src/lib/types";
import type { Task } from "../src/lib/types";
import { workspaceDay, addDays, newPlan, dayTime } from "../src/lib/domain";
import type { Prisma } from "../src/generated/prisma/client";

await initialize();
if (await db().record.count({ where: { kind: { not: "settings" } } })) {
  console.log(
    "Workspace already contains data. Demo seeding leaves it untouched.",
  );
  await db().$disconnect();
  process.exit(0);
}
const day = workspaceDay(settingsDefaults);
const previous = addDays(day, -1);
const tomorrow = addDays(day, 1);
async function record(id: string, kind: string, data: unknown) {
  return db().record.create({
    data: { id, kind, data: data as Prisma.InputJsonObject },
  });
}
await record("alex", "person", {
  name: "Alex",
  color: "#e8ba72",
  retired: false,
});
await record("sam", "person", {
  name: "Sam",
  color: "#a6b3d2",
  retired: false,
});
for (const [id, title, notes] of [
  ["work", "Work", "Make useful things with thoughtful people."],
  ["home", "Home", "A place that works for the people in it."],
  ["health", "Health", "Small things that help us feel well."],
])
  await record(id, "area", { title, notes });
await record("presentation", "project", {
  title: "Team presentation",
  areaId: "work",
  notes:
    "<p>A clear story about the customer problem, and what we want to learn next.</p>",
  targetDay: tomorrow,
  referenceIds: ["outline"],
  archived: false,
});
await record("kitchen", "project", {
  title: "Kitchen refresh",
  areaId: "home",
  notes: "<p>Keep the plan practical. Repair before replacing.</p>",
  targetDay: addDays(day, 21),
  referenceIds: [],
  archived: false,
});
await record("home-place", "place", {
  name: "Home",
  address: "San Francisco, CA",
  placeId: "",
  latitude: 37.7749,
  longitude: -122.4194,
});
await record("work-place", "place", {
  name: "Work",
  address: "San Francisco Ferry Building, CA",
  placeId: "",
  latitude: 37.7955,
  longitude: -122.3937,
});
const checklist = (labels: string[]) =>
  labels.map((text) => ({ id: randomUUID(), text, done: false }));
await record("outline", "reference", {
  title: "Presentation outline",
  type: "Note",
  notes:
    "<h3>Start with the customer.</h3><p>One useful example, one clear problem, and a question the team can help answer.</p>",
  url: "",
  checklist: [],
  attachmentIds: [],
  tags: ["work"],
});
await record("bike-research", "reference", {
  title: "Bicycle research",
  type: "Link",
  notes:
    "<p>Look for something comfortable, easy to maintain, and useful for errands.</p>",
  url: "https://www.bikeleague.org/",
  checklist: [],
  attachmentIds: [],
  tags: ["outdoors"],
});
const insuranceAttachmentId = randomUUID();
const insuranceDir = path.join(activeDir(), "attachments");
fs.mkdirSync(insuranceDir, { recursive: true });
const insuranceBytes = fs.readFileSync(
  path.join(process.cwd(), "public", "demo-insurance.png"),
);
fs.writeFileSync(
  path.join(insuranceDir, insuranceAttachmentId),
  insuranceBytes,
);
await record(insuranceAttachmentId, "attachment", {
  title: "Demo insurance card",
  filename: "demo-insurance.png",
  mime: "image/png",
  bytes: insuranceBytes.length,
  storageKey: insuranceAttachmentId,
});
await record("insurance", "reference", {
  title: "Insurance card reminder",
  type: "Image",
  notes:
    "<p>Demo reference only. Bring the current insurance card and arrive ten minutes early.</p>",
  url: "",
  checklist: [],
  attachmentIds: [insuranceAttachmentId],
  tags: ["health"],
});
await record("reset-checklist", "reference", {
  title: "Sunday reset checklist",
  type: "Checklist",
  notes: "<p>A gentler start to the week.</p>",
  url: "",
  checklist: checklist(["Clear surfaces", "Start laundry", "Prepare lunches"]),
  attachmentIds: [],
  tags: ["home"],
});
await record("filter-instructions", "reference", {
  title: "Water filter instructions",
  type: "Note",
  notes:
    "<p>Turn off the supply, remove the old cartridge, fit the replacement, and flush according to the manufacturer’s directions.</p>",
  url: "",
  checklist: [],
  attachmentIds: [],
  tags: ["home"],
});
const attachmentId = randomUUID();
const attachmentDir = path.join(activeDir(), "attachments");
fs.mkdirSync(attachmentDir, { recursive: true });
const file =
  "Team presentation outline\n\n1. The customer problem\n2. Three useful examples\n3. What we want to learn\n";
fs.writeFileSync(path.join(attachmentDir, attachmentId), file);
await record(attachmentId, "attachment", {
  title: "team-outline.txt",
  filename: "team-outline.txt",
  mime: "text/plain",
  bytes: Buffer.byteLength(file),
  storageKey: attachmentId,
});
async function task(id: string, title: string, fields: Partial<Task>) {
  await record(id, "task", {
    ...taskDefaults(title),
    ownerId: "alex",
    ...fields,
  });
}
await task("team-task", "Prepare team presentation", {
  projectId: "presentation",
  areaId: "work",
  plannedDay: day,
  status: "In progress",
  estimate: 90,
  priority: "High",
  deadline: tomorrow,
  scheduledStart: dayTime(day, "09:30", settingsDefaults.timezone),
  scheduledEnd: dayTime(day, "11:00", settingsDefaults.timezone),
  notes:
    "<p>Lead with the customer problem. Keep the opening to two minutes.</p>",
  checklist: checklist([
    "Choose three customer examples",
    "Outline the opening",
    "Rehearse the story",
  ]),
  attachmentIds: [attachmentId],
  referenceIds: ["outline"],
  tags: ["work", "focus"],
});
await task("plants-series", "Water balcony plants", {
  areaId: "home",
  outdoor: true,
  context: "At home",
  placeId: "home-place",
  estimate: 10,
  notes: "<p>Check the soil first. The herbs may need less water today.</p>",
  recurrence: {
    mode: "daily",
    interval: 1,
    weekdays: [],
    rule: "",
    start: addDays(day, -5),
    end: "",
    count: null,
    paused: false,
  },
});
await task("reading-series", "Read for 20 minutes", {
  areaId: "health",
  estimate: 20,
  effort: "Low",
  notes: "<p>A few pages count.</p>",
  recurrence: {
    mode: "daily",
    interval: 1,
    weekdays: [],
    rule: "",
    start: day,
    end: "",
    count: null,
    paused: false,
  },
});
await task("dentist", "Dentist appointment", {
  areaId: "health",
  plannedDay: day,
  estimate: 45,
  fixed: true,
  scheduledStart: dayTime(day, "14:00", settingsDefaults.timezone),
  scheduledEnd: dayTime(day, "14:45", settingsDefaults.timezone),
  context: "Away from home",
  destination: "450 Sutter Street, San Francisco, CA",
  latitude: 37.7894,
  longitude: -122.4077,
  origin: "Home",
  travelMinutes: 25,
  arrivalMinutes: 10,
  referenceIds: ["insurance"],
  checklist: checklist(["Bring insurance card", "Bring water bottle"]),
});
await task("contractor", "Waiting for contractor quote", {
  projectId: "kitchen",
  areaId: "home",
  plannedDay: addDays(day, -2),
  status: "Waiting/blocked",
  estimate: 15,
  blockingNote: "Waiting for the revised materials estimate.",
  notes: "<p>Asked for a breakdown of labor and materials.</p>",
});
await task("bike-service", "Book bike service", {
  ownerId: null,
  plannedDay: previous,
  estimate: 15,
  effort: "Low",
  context: "Away from home",
  destination: "Valencia Cyclery, San Francisco, CA",
  latitude: 37.7564,
  longitude: -122.4214,
});
await task("bicycle", "Research a bicycle", {
  areaId: "health",
  someday: true,
  estimate: 30,
  notes: "<p>Something comfortable for weekend rides and errands.</p>",
  referenceIds: ["bike-research"],
  tags: ["outdoors"],
});
await task("filter-series", "Replace water filter", {
  areaId: "home",
  context: "At home",
  estimate: 20,
  referenceIds: ["filter-instructions"],
  recurrence: {
    mode: "relative",
    interval: 90,
    weekdays: [],
    rule: "",
    start: tomorrow,
    end: "",
    count: null,
    paused: false,
  },
});
await task("feedback", "Ask for feedback", {
  projectId: "presentation",
  plannedDay: tomorrow,
  estimate: 15,
  dependencies: ["team-task"],
});
await task("rehearse", "Rehearse the story", {
  projectId: "presentation",
  plannedDay: tomorrow,
  estimate: 30,
  dependencies: ["team-task"],
});
await task("old-task", "Sort the spare cables", {
  areaId: "home",
  plannedDay: addDays(day, -12),
  estimate: 20,
  effort: "Low",
});
await task("done-example", "Send the project update", {
  areaId: "work",
  plannedDay: previous,
  status: "Done",
  completedAt: new Date().toISOString(),
  estimate: 15,
  notes: "<p>Sent a short update and the next decision needed.</p>",
});
await task("sam-dinner", "Prepare dinner", {
  ownerId: "sam",
  areaId: "home",
  plannedDay: day,
  estimate: 45,
  context: "At home",
  checklist: checklist([
    "Check ingredients",
    "Prepare vegetables",
    "Set the table",
  ]),
});
await task("sam-kitchen", "Kitchen repair plan", {
  ownerId: "sam",
  projectId: "kitchen",
  plannedDay: day,
  estimate: 40,
  notes: "<p>Measure the drawer and photograph the hinge.</p>",
});
await task("sam-cake", "Order birthday cake", {
  ownerId: "sam",
  plannedDay: day,
  estimate: 15,
  effort: "Low",
});
await task("groceries", "Pick up groceries", {
  context: "Away from home",
  plannedDay: tomorrow,
  estimate: 25,
  destination: "Whole Foods Market, 2001 Market Street, San Francisco, CA",
  latitude: 37.7688,
  longitude: -122.4263,
  ownerId: "sam",
});
await task("pharmacy", "Collect prescription", {
  context: "Away from home",
  plannedDay: tomorrow,
  estimate: 10,
  destination: "Walgreens, 1189 Potrero Avenue, San Francisco, CA",
  latitude: 37.7534,
  longitude: -122.4068,
  ownerId: "sam",
});
await task("parcel", "Drop off parcel", {
  context: "Away from home",
  plannedDay: tomorrow,
  estimate: 10,
  destination: "USPS, 1600 Bryant Street, San Francisco, CA",
  latitude: 37.7669,
  longitude: -122.411,
  ownerId: "sam",
});
await record("errands", "outing", {
  title: "Saturday errands",
  notes: "<p>Keep the route flexible. Check opening hours before leaving.</p>",
  context: "Away from home",
  taskIds: ["groceries", "pharmacy", "parcel"],
  origin: "Home",
  travelMode: "DRIVE",
  departure: "",
  arrival: "",
  returnTrip: true,
  returnAddress: "Home",
  bring: checklist([
    "Reusable bags",
    "Parcel and label",
    "Prescription information",
  ]),
});
await record("sunday-reset", "routine", {
  title: "Sunday reset",
  notes: "<p>A few small things to make the week easier.</p>",
  templates: [
    {
      title: "Tidy living room",
      estimate: 15,
      effort: "Low",
      context: "At home",
      notes: "<p>Clear surfaces and put things back.</p>",
      checklist: checklist(["Clear surfaces", "Put items away"]),
    },
    {
      title: "Start laundry",
      estimate: 10,
      effort: "Low",
      context: "At home",
      notes: "",
      checklist: [],
    },
    {
      title: "Prepare lunches",
      estimate: 30,
      effort: "Medium",
      context: "At home",
      notes: "",
      checklist: [],
    },
  ],
});
await record("short-view", "view", {
  title: "A little time to spare",
  filters: {
    ...defaultFilters,
    maxMinutes: "15",
    effort: "Low",
    status: "Open",
  },
});
await record("waiting-view", "view", {
  title: "Waiting on something",
  filters: { ...defaultFilters, status: "Waiting/blocked" },
});
for (const personId of ["alex", "sam"])
  await record(`hours-${personId}`, "availability", {
    personId,
    date: "",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    start: personId === "alex" ? "09:00" : "10:00",
    end: personId === "alex" ? "17:00" : "13:00",
    breaks:
      personId === "alex"
        ? [
            { start: "12:00", end: "13:00" },
            { start: "15:00", end: "16:00" },
          ]
        : [],
  });
await materialize();
await record(`plan-alex-${day}`, "plan", {
  ...newPlan("alex", day),
  taskIds: [
    "team-task",
    `plants-series@${day}`,
    "dentist",
    `reading-series@${day}`,
  ],
  focusIds: ["team-task", "dentist", `reading-series@${day}`],
  notes: "Leave transition time before the dentist.",
  essentials: checklist(["Insurance card", "Water bottle"]),
});
await record(`plan-sam-${day}`, "plan", {
  ...newPlan("sam", day),
  taskIds: ["sam-dinner", "sam-kitchen", "sam-cake"],
  focusIds: ["sam-dinner", "sam-kitchen"],
  notes: "Keep the morning plan short.",
  essentials: checklist(["Shopping list", "Reusable bag"]),
});
console.log(
  `Demo workspace ready for ${day}. No real API keys or personal information were seeded.`,
);
await db().$disconnect();
