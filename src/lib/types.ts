export const kinds = [
  "task",
  "person",
  "area",
  "project",
  "routine",
  "reference",
  "place",
  "view",
  "plan",
  "availability",
  "outing",
  "settings",
  "attachment",
  "timeLog",
  "reminder",
] as const;
export type Kind = (typeof kinds)[number];
export const statuses = [
  "Open",
  "In progress",
  "Waiting/blocked",
  "Done",
] as const;
export type Status = (typeof statuses)[number];
export interface Entity<T = Record<string, unknown>> {
  id: string;
  kind: Kind;
  version: number;
  data: T;
  createdAt: string;
  updatedAt: string;
}
export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}
export interface Recurrence {
  mode: "daily" | "weekdays" | "custom" | "relative";
  interval: number;
  weekdays: number[];
  rule: string;
  start: string;
  end: string;
  count: number | null;
  paused: boolean;
  pausedSince?: string;
  excludedPeriods?: { start: string; end: string }[];
}
export interface Task {
  suspended?: boolean;
  occurrenceOverrides?: string[];
  title: string;
  status: Status;
  ownerId: string | null;
  projectId: string | null;
  areaId: string | null;
  plannedDay: string;
  startDay: string;
  deadline: string;
  scheduledStart: string;
  scheduledEnd: string;
  fixed: boolean;
  dayPart: string;
  priority: "Low" | "Normal" | "High" | "Urgent";
  tags: string[];
  estimate: number;
  effort: "Low" | "Medium" | "High";
  notes: string;
  checklist: CheckItem[];
  dependencies: string[];
  blockingNote: string;
  referenceIds: string[];
  attachmentIds: string[];
  context: "At home" | "Away from home" | "Anywhere" | "Inherit";
  outdoor: boolean;
  placeId: string | null;
  destination: string;
  latitude: number | null;
  longitude: number | null;
  origin: string;
  travelMode: string;
  departure: string;
  arrival: string;
  prepMinutes: number;
  arrivalMinutes: number;
  travelMinutes: number;
  returnMinutes: number;
  reminderAt: string;
  recurrence: Recurrence | null;
  seriesId: string | null;
  occurrenceDay: string;
  outcome: "done" | "skipped" | "missed" | null;
  completedAt: string;
  archived: boolean;
  deletedAt: string;
  someday: boolean;
  reviewedAt: string;
}
export interface Person {
  name: string;
  color: string;
  retired: boolean;
}
export interface Plan {
  personId: string;
  day: string;
  taskIds: string[];
  focusIds: string[];
  notes: string;
  reflection: string;
  essentials: CheckItem[];
  essentialsPinned: boolean;
  reviewed: boolean;
  planningStep: number;
}
export interface Availability {
  personId: string;
  date: string;
  weekdays: number[];
  start: string;
  end: string;
  breaks: { start: string; end: string }[];
}
export interface Place {
  name: string;
  address: string;
  placeId: string;
  latitude: number | null;
  longitude: number | null;
}
export interface Settings {
  title: string;
  timezone: string;
  weekStart: number;
  dayBoundary: string;
  backupEnabled: boolean;
  backupTime: string;
  backupWeekdays: number[];
  retentionDaily: number;
  retentionWeekly: number;
  retentionSafety: number;
  googleEnabled: boolean;
  googleDailyLimit: number;
}
export interface Routine {
  title: string;
  notes: string;
  templates: Partial<Task>[];
}
export interface Reference {
  title: string;
  type: "Note" | "Link" | "File" | "Image" | "Checklist";
  notes: string;
  url: string;
  checklist: CheckItem[];
  attachmentIds: string[];
  tags: string[];
}
export interface Project {
  title: string;
  areaId: string | null;
  notes: string;
  targetDay: string;
  referenceIds: string[];
  archived: boolean;
}
export interface Area {
  title: string;
  notes: string;
}
export interface SavedView {
  title: string;
  filters: Filters;
}
export interface Filters {
  query: string;
  owner: string;
  status: string;
  priority: string;
  effort: string;
  context: string;
  tag: string;
  projectId: string;
  areaId: string;
  maxMinutes: string;
  plannedDay: string;
  sort: string;
}
export interface Outing {
  title: string;
  notes: string;
  context: "Away from home";
  taskIds: string[];
  origin: string;
  travelMode: string;
  departure: string;
  arrival: string;
  returnTrip: boolean;
  returnAddress: string;
  bring: CheckItem[];
}
export interface TimeLog {
  personId: string;
  taskId: string;
  startedAt: string;
  pausedAt: string;
  elapsedSeconds: number;
  durationSeconds: number;
  running: boolean;
  stoppedAt: string;
}
export interface Attachment {
  title: string;
  filename: string;
  mime: string;
  bytes: number;
  storageKey: string;
}
export interface Workspace {
  records: Entity[];
  activities: {
    id: string;
    recordId: string;
    action: string;
    detail: string;
    createdAt: string;
  }[];
  generation: string;
  provider: {
    configured: boolean;
    mapConfigured: boolean;
    mapsBrowserKey: string;
    used: number;
    limit: number;
  };
  maintenance: boolean;
}
export const defaultFilters: Filters = {
  query: "",
  owner: "all",
  status: "",
  priority: "",
  effort: "",
  context: "",
  tag: "",
  projectId: "",
  areaId: "",
  maxMinutes: "",
  plannedDay: "",
  sort: "priority",
};
export function recordsOf<T>(records: Entity[], kind: Kind): Entity<T>[] {
  return records.filter((r) => r.kind === kind) as unknown as Entity<T>[];
}
export function taskDefaults(title = ""): Task {
  return {
    title,
    status: "Open",
    ownerId: null,
    projectId: null,
    areaId: null,
    plannedDay: "",
    startDay: "",
    deadline: "",
    scheduledStart: "",
    scheduledEnd: "",
    fixed: false,
    dayPart: "",
    priority: "Normal",
    tags: [],
    estimate: 0,
    effort: "Medium",
    notes: "",
    checklist: [],
    dependencies: [],
    blockingNote: "",
    referenceIds: [],
    attachmentIds: [],
    context: "Anywhere",
    outdoor: false,
    placeId: null,
    destination: "",
    latitude: null,
    longitude: null,
    origin: "Home",
    travelMode: "DRIVE",
    departure: "",
    arrival: "",
    prepMinutes: 0,
    arrivalMinutes: 0,
    travelMinutes: 0,
    returnMinutes: 0,
    reminderAt: "",
    recurrence: null,
    seriesId: null,
    occurrenceDay: "",
    outcome: null,
    completedAt: "",
    archived: false,
    deletedAt: "",
    someday: false,
    reviewedAt: "",
  };
}
export const settingsDefaults: Settings = {
  title: "Tide",
  timezone: "America/Los_Angeles",
  weekStart: 1,
  dayBoundary: "00:00",
  backupEnabled: true,
  backupTime: "03:00",
  backupWeekdays: [0, 1, 2, 3, 4, 5, 6],
  retentionDaily: 7,
  retentionWeekly: 4,
  retentionSafety: 3,
  googleEnabled: true,
  googleDailyLimit: 1000,
};
