"use client";

import { createId } from "@/lib/id";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sun,
  CalendarDays,
  Inbox,
  Layers,
  Leaf,
  Folder,
  Bookmark,
  Repeat,
  Library,
  History,
  Trash2,
  Settings as SettingsIcon,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Columns3,
  Clock,
  SlidersHorizontal,
  MapPin,
  Check,
  Users,
  ArrowUpRight,
  Menu,
  X,
  CloudSun,
} from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "./workspace";
import { EntityEditor, FilterFields } from "./EntityEditor";
import { TaskPanel } from "./TaskPanel";
import { TaskList, TaskBoard, TaskTimeline, TaskRow } from "./TaskViews";
import { PlanningWizard, DailyContent, RoutineApply } from "./Planning";
import { Backups } from "./Backups";
import { OutingView } from "./Travel";
import { RichText } from "./RichText";
import { Modal, Field, Empty, Minutes, ErrorMessage, Checklist } from "./ui";
import {
  addDays,
  capacity,
  filterTasks,
  workload,
  workspaceDay,
} from "@/lib/domain";
import { recordsOf, defaultFilters, settingsDefaults } from "@/lib/types";
import type {
  Entity,
  Kind,
  Task,
  Person,
  Plan,
  Settings,
  Availability,
  Project,
  Routine,
  Reference,
  SavedView,
  Outing,
  TimeLog,
  Attachment,
} from "@/lib/types";
const navigation = [
  { id: "today", label: "Today", icon: Sun },
  { id: "upcoming", label: "Upcoming", icon: CalendarDays },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "all", label: "All Tasks", icon: Layers },
  { id: "someday", label: "Someday", icon: Leaf },
  { id: "projects", label: "Projects & Areas", icon: Folder },
  { id: "saved", label: "Saved views", icon: Bookmark },
  { id: "routines", label: "Routines", icon: Repeat },
  { id: "library", label: "Reference library", icon: Library },
  { id: "outings", label: "Outings", icon: MapPin },
  { id: "history", label: "History & notes", icon: History },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];
export function Tide() {
  return (
    <WorkspaceProvider>
      <Application />
    </WorkspaceProvider>
  );
}
interface Editor {
  kind: Kind;
  entity?: Entity;
  initial?: Record<string, unknown>;
  scopeFrom?: string;
}
function Application() {
  const {
    workspace,
    save,
    mutate,
    remove,
    notify,
    notice,
    pending,
    online,
    saveStatus,
  } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const cfg =
    recordsOf<Settings>(workspace.records, "settings")[0]?.data ||
    settingsDefaults;
  const settingsEntity = workspace.records.find((r) => r.id === "settings");
  const people = recordsOf<Person>(workspace.records, "person");
  const today = workspaceDay(cfg);
  const section = params.get("section") || "today";
  const day = params.get("day") || today;
  const person =
    params.get("person") || people.find((p) => !p.data.retired)?.id || "all";
  const view = params.get("view") || "list";
  const projectId = params.get("project") || "";
  const selectedId = params.get("task") || "";
  const selected = workspace.records.find((r) => r.id === selectedId);
  const tasks = recordsOf<Task>(workspace.records, "task");
  const projects = recordsOf<Project>(workspace.records, "project");
  const plans = recordsOf<Plan>(workspace.records, "plan");
  const availability = recordsOf<Availability>(
    workspace.records,
    "availability",
  );
  const currentPlan = plans.find(
    (p) => p.data.personId === person && p.data.day === day,
  );
  const personName =
    people.find((p) => p.id === person)?.data.name || "All people";
  const [editor, setEditor] = useState<Editor | null>(null);
  const [planning, setPlanning] = useState(false);
  const [dailyMode, setDailyMode] = useState<
    "notes" | "essentials" | "review" | null
  >(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(() => {
    try {
      return {
        ...defaultFilters,
        ...JSON.parse(params.get("filters") || "{}"),
      };
    } catch {
      return { ...defaultFilters };
    }
  });
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"move" | "copy" | null>(null);
  const [bulkDay, setBulkDay] = useState(addDays(day, 1));
  const [bulkUndo, setBulkUndo] = useState<string | null>(null);
  const [essentialsCollapsed, setEssentialsCollapsed] = useState(false);
  const [bulkOperation, setBulkOperation] = useState(() => createId());
  const [bulkError, setBulkError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [routine, setRoutine] = useState<Entity<Routine> | null>(null);
  const [theme, setTheme] = useState(() =>
    typeof window === "undefined"
      ? "dark"
      : localStorage.getItem("tide:theme") || "dark",
  );
  const [density, setDensity] = useState(() =>
    typeof window === "undefined"
      ? "comfortable"
      : localStorage.getItem("tide:density") || "comfortable",
  );
  const [motion, setMotion] = useState(() =>
    typeof window === "undefined"
      ? "system"
      : localStorage.getItem("tide:motion") || "system",
  );
  const [remindersEnabled, setRemindersEnabled] = useState(
    () =>
      typeof window === "undefined" ||
      localStorage.getItem("tide:reminders") !== "off",
  );
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("tide:dismissed") || "[]");
    } catch {
      return [];
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const [showArchived, setShowArchived] = useState(false);
  const [referenceTarget, setReferenceTarget] = useState<{
    reference: Entity<Reference>;
    copy: boolean;
  } | null>(null);
  const [targetSearch, setTargetSearch] = useState("");
  const [targetTask, setTargetTask] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [recentOpen, setRecentOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.push(`?${next.toString()}`, { scroll: false });
    },
    [params, router],
  );
  const open = useCallback((id: string) => navigate({ task: id }), [navigate]);
  const go = (id: string) => {
    navigate({ section: id, project: null, task: null });
    setMobileMenu(false);
    setSelection(new Set());
  };
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.density = density;
      document.documentElement.dataset.motion = motion;
    };
    apply();
    media.addEventListener("change", apply);
    localStorage.setItem("tide:theme", theme);
    localStorage.setItem("tide:density", density);
    localStorage.setItem("tide:motion", motion);
    return () => media.removeEventListener("change", apply);
  }, [theme, density, motion]);
  useEffect(() => {
    const key = `tide:scroll:${section}:${person}:${day}:${view}:${projectId}`;
    const node = scrollRef.current;
    if (node) node.scrollTop = Number(sessionStorage.getItem(key) || 0);
    return () => {
      if (node) sessionStorage.setItem(key, String(node.scrollTop));
    };
  }, [section, person, day, view, projectId]);
  useEffect(() => {
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]'))
        navigate({ task: null });
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [navigate]);
  const taskRecords = tasks.filter(
    (t) =>
      !t.data.recurrence &&
      !t.data.suspended &&
      !t.data.deletedAt &&
      (showArchived ? t.data.archived : !t.data.archived),
  );
  const filtered = filterTasks(taskRecords, filters, workspace.records);
  let displayed = filtered;
  if (section === "today")
    displayed = filtered.filter(
      (t) =>
        t.data.plannedDay === day &&
        (person === "all" || t.data.ownerId === person) &&
        t.data.outcome !== "missed" &&
        t.data.outcome !== "skipped",
    );
  if (section === "upcoming")
    displayed = filtered.filter(
      (t) => t.data.plannedDay >= day && t.data.plannedDay <= addDays(day, 6),
    );
  if (section === "inbox")
    displayed = filtered.filter(
      (t) => !t.data.plannedDay && !t.data.someday && !t.data.seriesId,
    );
  if (section === "someday") displayed = filtered.filter((t) => t.data.someday);
  if (section === "projects" && projectId)
    displayed = filtered.filter((t) => t.data.projectId === projectId);
  if (section === "trash")
    displayed = filterTasks(
      tasks.filter((t) => !!t.data.deletedAt),
      filters,
    );
  if (section === "history")
    displayed = filterTasks(
      tasks.filter(
        (t) =>
          !t.data.recurrence &&
          !t.data.suspended &&
          !t.data.deletedAt &&
          t.data.plannedDay === day &&
          (person === "all" || t.data.ownerId === person),
      ),
      filters,
    );
  if (section === "today" && currentPlan) {
    const order = currentPlan.data.taskIds;
    displayed = [...displayed].sort(
      (a, b) =>
        (order.includes(a.id) ? order.indexOf(a.id) : 999) -
        (order.includes(b.id) ? order.indexOf(b.id) : 999),
    );
  }
  const recent = tasks.filter(
    (t) =>
      !t.data.deletedAt &&
      !t.data.archived &&
      !t.data.seriesId &&
      !t.data.recurrence &&
      !t.data.suspended &&
      t.data.status !== "Done" &&
      t.data.plannedDay < day &&
      t.data.plannedDay >= addDays(day, -3) &&
      (person === "all" || t.data.ownerId === person),
  );
  const used = workload(displayed, workspace.records);
  const available =
    person === "all"
      ? people
          .filter((p) => !p.data.retired)
          .reduce((n, p) => n + capacity(p.id, day, availability), 0)
      : capacity(person, day, availability);
  const focusTasks =
    currentPlan?.data.focusIds
      .map((id) => tasks.find((t) => t.id === id))
      .filter((t): t is Entity<Task> => !!t && !t.data.deletedAt) || [];
  const activeTimers = recordsOf<TimeLog>(workspace.records, "timeLog").filter(
    (t) => !t.data.stoppedAt,
  );
  const alerts = remindersEnabled
    ? tasks.filter(
        (t) =>
          !t.data.deletedAt &&
          t.data.reminderAt &&
          Date.parse(t.data.reminderAt) <= now &&
          !dismissed.includes(`${t.id}@${t.data.reminderAt}`) &&
          t.data.status !== "Done",
      )
    : [];
  const activeProject = projects.find((p) => p.id === projectId);
  const titles: Record<string, string> = {
    today: "Today",
    upcoming: "Upcoming",
    inbox: "Inbox",
    all: "All Tasks",
    someday: "Someday",
    projects: activeProject?.data.title || "Projects & Areas",
    saved: "Saved views",
    routines: "Routines",
    library: "Reference library",
    history: "History & daily notes",
    trash: "Trash",
    settings: "Settings",
    people: "People",
    places: "Saved places",
    areas: "Manage areas",
    outings: "Outings",
    backups: "Automatic backups",
  };
  const taskPage =
    [
      "today",
      "upcoming",
      "inbox",
      "all",
      "someday",
      "trash",
      "history",
    ].includes(section) ||
    (section === "projects" && !!projectId);
  function addTask() {
    setEditor({
      kind: "task",
      initial: {
        plannedDay: ["today", "upcoming"].includes(section) ? day : "",
        projectId: projectId || null,
        ownerId: person === "all" ? null : person,
        someday: section === "someday",
      },
    });
  }
  async function act(work: () => Promise<unknown>, success?: string) {
    try {
      await work();
      if (success) notify(success);
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "This action could not be completed",
      );
    }
  }
  function toggleSelection(id: string) {
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  async function runBulk(input: {
    operationId: string;
    action: "move" | "copy" | "someday" | "archive";
    day: string;
    items: { id: string; version: number }[];
  }) {
    const result = await mutate("bulk", input);
    setBulkUndo(input.operationId);
    return result;
  }
  function beginBulk(action: "move" | "copy") {
    setBulkAction(action);
    setBulkDay(addDays(day, 1));
    setBulkError("");
    setBulkOperation(createId());
  }
  function collection(kind: Kind, label: string) {
    const items = workspace.records
      .filter(
        (r) =>
          r.kind === kind &&
          (kind !== "project" || !!r.data.archived === showArchived),
      )
      .sort((a, b) =>
        kind === "project"
          ? String(a.data.areaId || "").localeCompare(
              String(b.data.areaId || ""),
            )
          : 0,
      );
    return (
      <>
        <div className="section-heading">
          <p className="muted">
            {kind === "person"
              ? "One shared workspace. People help organize plans; everyone can edit."
              : kind === "routine"
                ? "Useful rhythms, ready when you need them."
                : kind === "reference"
                  ? "Keep useful context close, and reuse it when it helps."
                  : "A little structure for the things you care about."}
          </p>
          <button className="primary" onClick={() => setEditor({ kind })}>
            <Plus size={15} />
            {label}
          </button>
        </div>
        {!items.length ? (
          <Empty
            title={`Your ${titles[section]?.toLowerCase()} start here`}
            action={
              <button onClick={() => setEditor({ kind })}>{label}</button>
            }
          />
        ) : (
          <div className="collection-grid">
            {items
              .filter(
                (r) =>
                  !filters.query ||
                  JSON.stringify(r.data)
                    .toLowerCase()
                    .includes(filters.query.toLowerCase()),
              )
              .map((r) => (
                <article className="collection-card" key={r.id}>
                  <span className="eyebrow">
                    {kind === "project"
                      ? String(
                          workspace.records.find((a) => a.id === r.data.areaId)
                            ?.data.title || "No area",
                        )
                      : String(r.data.type || kind)}
                  </span>
                  <button
                    className="card-title"
                    onClick={() =>
                      kind === "project"
                        ? navigate({ project: r.id, task: null })
                        : kind === "view"
                          ? (() => {
                              const f = (r as unknown as Entity<SavedView>).data
                                .filters;
                              setFilters(f);
                              navigate({
                                section: "all",
                                filters: JSON.stringify(f),
                                project: null,
                                task: null,
                              });
                            })()
                          : open(r.id)
                    }
                  >
                    {String(r.data.title || r.data.name)}
                  </button>
                  {kind === "project" && (
                    <p className="muted">
                      {
                        tasks.filter(
                          (t) =>
                            t.data.projectId === r.id &&
                            t.data.status !== "Done" &&
                            !t.data.deletedAt,
                        ).length
                      }{" "}
                      open ·{" "}
                      {
                        tasks.filter(
                          (t) =>
                            t.data.projectId === r.id &&
                            t.data.status === "Done",
                        ).length
                      }{" "}
                      completed
                    </p>
                  )}
                  {kind === "person" && (
                    <p className="muted">
                      {r.data.retired
                        ? "Retired · history retained"
                        : "Active planning person"}
                    </p>
                  )}
                  {kind === "place" && (
                    <p className="muted">{String(r.data.address)}</p>
                  )}
                  {kind === "project" && (
                    <p className="muted">
                      {
                        tasks.filter(
                          (t) =>
                            t.data.projectId === r.id &&
                            !t.data.recurrence &&
                            !t.data.deletedAt &&
                            (t.data.status === "Waiting/blocked" ||
                              t.data.dependencies.some(
                                (id) =>
                                  tasks.find((d) => d.id === id)?.data
                                    .status !== "Done",
                              )),
                        ).length
                      }{" "}
                      waiting or blocked
                    </p>
                  )}
                  {kind === "routine" && (
                    <p className="muted">
                      {(r as unknown as Entity<Routine>).data.templates.length}{" "}
                      task templates
                    </p>
                  )}
                  {kind === "view" && (
                    <p className="muted">
                      {
                        filterTasks(
                          taskRecords,
                          (r as unknown as Entity<SavedView>).data.filters,
                        ).length
                      }{" "}
                      matching tasks
                    </p>
                  )}
                  <div className="button-row">
                    <button onClick={() => setEditor({ kind, entity: r })}>
                      Edit
                    </button>
                    {kind === "routine" && (
                      <button
                        className="primary"
                        onClick={() =>
                          setRoutine(r as unknown as Entity<Routine>)
                        }
                      >
                        Add to a day
                      </button>
                    )}
                    {kind === "person" && (
                      <button
                        onClick={() =>
                          navigate({ section: "today", person: r.id })
                        }
                      >
                        Open plan
                      </button>
                    )}
                    {kind === "view" && (
                      <button
                        className="danger-text"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this saved view? Tasks are kept.",
                            )
                          )
                            void act(() => remove(r));
                        }}
                      >
                        Delete view
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
        )}
      </>
    );
  }
  return (
    <div
      className={`app-shell ${selected?.kind === "task" ? "has-inspector" : ""}`}
    >
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <Link className="brand" href="/?section=today" aria-label="Tide home">
          <Sun className="brand-sun" size={25} />
          <span>Tide</span>
          <span className="brand-dot" />
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        >
          <X size={18} />
        </button>
        <div className="planning-context">
          <label htmlFor="planning-person">Planning for</label>
          <select
            id="planning-person"
            value={person}
            onChange={(e) => navigate({ person: e.target.value, task: null })}
          >
            <option value="all">All people</option>
            {people
              .filter((p) => !p.data.retired || p.id === person)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.data.name}
                  {p.data.retired ? " · Retired" : ""}
                </option>
              ))}
          </select>
          <small>Shared workspace</small>
        </div>
        <nav aria-label="Main navigation">
          <span className="nav-label">Your workspace</span>
          {navigation.map((n, i) => (
            <div key={n.id}>
              {i === 6 && (
                <span className="nav-label collection-label">Collections</span>
              )}
              <button
                className={`nav-item ${section === n.id ? "active" : ""}`}
                aria-label={n.label}
                title={n.label}
                onClick={() => go(n.id)}
              >
                <n.icon size={17} />
                <span>{n.label}</span>
                {n.id === "inbox" && (
                  <span className="nav-count">
                    {taskRecords.filter(
                      (t) => !t.data.plannedDay && !t.data.someday,
                    ).length || ""}
                  </span>
                )}
              </button>
            </div>
          ))}
        </nav>
        <footer className="sidebar-footer">
          {activeTimers.length > 0 && (
            <button
              className="active-timer"
              onClick={() =>
                open(
                  activeTimers.find((t) => t.data.personId === person)?.data
                    .taskId || activeTimers[0].data.taskId,
                )
              }
            >
              <Clock size={14} />
              <span>
                {activeTimers.length > 1
                  ? `${activeTimers.length} active timers`
                  : `${people.find((p) => p.id === activeTimers[0].data.personId)?.data.name} · Focus`}
              </span>
            </button>
          )}
          <span className="sync-status">
            <i className={online ? "synced" : ""} />
            {pending ? "Saving…" : online ? saveStatus : "Disconnected"}
          </span>
          <small className="workspace-caption">A little more daylight.</small>
        </footer>
      </aside>
      <div className="workspace-column">
        <header className="topbar">
          <button
            className="mobile-nav-toggle icon-button"
            aria-label="Open navigation"
            onClick={() => setMobileMenu(true)}
          >
            <Menu size={18} />
          </button>
          <div className="breadcrumbs">
            <span>Shared workspace</span>
            <ChevronRight size={12} />
            <strong>{titles[section] || "Today"}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={15} />
              <input
                aria-label="Search tasks"
                placeholder="Search your workspace"
                value={filters.query}
                onChange={(e) =>
                  setFilters({ ...filters, query: e.target.value })
                }
              />
            </label>
            <button
              className="primary add-task"
              aria-label="Add task"
              onClick={addTask}
            >
              <Plus size={16} />
              <span>Add task</span>
            </button>
          </div>
        </header>
        <main className="workspace-scroll" ref={scrollRef}>
          <div className="page-content">
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {section === "today"
                    ? person === "all"
                      ? "A shared view of the day"
                      : `A little clarity for ${personName}`
                    : "Your workspace, thoughtfully organized"}
                </span>
                <h1>
                  {section === "today" && person === "all"
                    ? "All people"
                    : titles[section] || "Today"}
                </h1>
                <p className="page-subtitle">
                  {["today", "upcoming", "history"].includes(section)
                    ? new Intl.DateTimeFormat("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }).format(new Date(`${day}T12:00:00`))
                    : section === "someday"
                      ? "Good ideas can wait. Keep them somewhere they won’t get lost."
                      : section === "inbox"
                        ? "A place to put things down, before you figure them out."
                        : section === "all"
                          ? "Everything you’re keeping track of, in one place."
                          : "Make room for what matters."}
                  {section === "today" && person !== "all"
                    ? ` · ${displayed.length} tasks planned`
                    : ""}
                </p>
              </div>
              {["today", "upcoming", "history"].includes(section) && (
                <div className="date-nav">
                  <button
                    className="icon-button"
                    aria-label="Previous day"
                    onClick={() => navigate({ day: addDays(day, -1) })}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => navigate({ day: today })}>
                    Today
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Next day"
                    onClick={() => navigate({ day: addDays(day, 1) })}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <input
                    type="date"
                    aria-label="Selected day"
                    value={day}
                    onChange={(e) =>
                      e.target.value && navigate({ day: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
            {selectedId && !selected && (
              <div className="info-message" role="status">
                This record is no longer available.{" "}
                <button onClick={() => navigate({ task: null })}>
                  Dismiss
                </button>
              </div>
            )}
            {bulkUndo && (
              <div className="info-message" role="status">
                Task operation completed.{" "}
                <button
                  onClick={() =>
                    void act(async () => {
                      await mutate("bulk-undo", { operationId: bulkUndo });
                      setBulkUndo(null);
                    }, "Operation undone")
                  }
                >
                  Undo
                </button>
                <button
                  className="text-button"
                  onClick={() => setBulkUndo(null)}
                >
                  Dismiss
                </button>
              </div>
            )}
            {!!alerts.length && (
              <section className="reminder-banner" role="status">
                <Clock size={18} />
                <div>
                  <strong>
                    {alerts.length} reminder{alerts.length > 1 ? "s" : ""} to
                    catch up on
                  </strong>
                  {alerts.slice(0, 3).map((t) => (
                    <div key={t.id}>
                      <button
                        className="text-button"
                        onClick={() => open(t.id)}
                      >
                        {t.data.title}
                      </button>
                      <button
                        className="text-button muted"
                        onClick={() => {
                          const next = [
                            ...dismissed,
                            `${t.id}@${t.data.reminderAt}`,
                          ];
                          setDismissed(next);
                          localStorage.setItem(
                            "tide:dismissed",
                            JSON.stringify(next),
                          );
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {section === "today" && person === "all" ? (
              <div className="people-grid">
                {people
                  .filter((p) => !p.data.retired)
                  .map((p) => {
                    const own = taskRecords.filter(
                      (t) =>
                        t.data.ownerId === p.id && t.data.plannedDay === day,
                    );
                    const plan = plans.find(
                      (plan) =>
                        plan.data.personId === p.id && plan.data.day === day,
                    );
                    const timer = activeTimers.find(
                      (t) => t.data.personId === p.id,
                    );
                    return (
                      <article className="person-day" key={p.id}>
                        <div className="person-heading">
                          <i style={{ background: p.data.color }} />
                          <h2>{p.data.name}</h2>
                        </div>
                        <div className="context-card">
                          <strong>
                            <Minutes value={workload(own, workspace.records)} />{" "}
                            /{" "}
                            <Minutes
                              value={capacity(p.id, day, availability)}
                            />
                          </strong>
                          <small>Workload belongs to {p.data.name}</small>
                        </div>
                        <h3>Today’s focus</h3>
                        <p className="muted">
                          {plan?.data.focusIds
                            .map(
                              (id) =>
                                tasks.find((t) => t.id === id)?.data.title,
                            )
                            .filter(Boolean)
                            .join(" · ") || "Choose a few things that matter."}
                        </p>
                        {timer && (
                          <div className="context-card amber">
                            {timer.data.running ? "Running" : "Paused"} ·{" "}
                            {
                              tasks.find((t) => t.id === timer.data.taskId)
                                ?.data.title
                            }
                          </div>
                        )}
                        <h3>Daily note</h3>
                        <p>
                          {plan?.data.notes || "A little space for context."}
                        </p>
                        <h3>Pinned essentials</h3>
                        <p className="muted">
                          {plan?.data.essentials
                            .map((c) => c.text)
                            .join(" · ") || "Keep the small things close."}
                        </p>
                        <button
                          className="primary"
                          onClick={() => navigate({ person: p.id })}
                        >
                          Open {p.data.name}’s plan <ArrowUpRight size={14} />
                        </button>
                      </article>
                    );
                  })}
                <article className="person-day">
                  <h2>Shared, unassigned work</h2>
                  {taskRecords
                    .filter((t) => !t.data.ownerId)
                    .slice(0, 5)
                    .map((t) => (
                      <TaskRow key={t.id} task={t} onOpen={open} />
                    ))}
                  <button
                    onClick={() => {
                      setFilters({ ...defaultFilters, owner: "unassigned" });
                      go("all");
                    }}
                  >
                    View all unassigned work
                  </button>
                  <button className="text-button" onClick={() => go("people")}>
                    Manage people
                  </button>
                </article>
              </div>
            ) : (
              <>
                {section === "today" && (
                  <>
                    <div className="today-action-row">
                      <button
                        className="primary plan-button"
                        disabled={person === "all"}
                        onClick={() => setPlanning(true)}
                      >
                        <Sun size={16} />
                        Plan My Day
                      </button>
                      <div className="day-context">
                        <CloudSun size={17} />
                        <span>Room for a thoughtful day</span>
                      </div>
                    </div>
                    <section className="day-overview">
                      <div className="capacity-card">
                        <div className="section-heading">
                          <span className="eyebrow">Your day, at a glance</span>
                          <span
                            className={used > available ? "overdue" : "muted"}
                          >
                            {used > available
                              ? "Over capacity"
                              : "Make room for the unexpected"}
                          </span>
                        </div>
                        <strong>
                          <Minutes value={used} />
                          <span>
                            {" "}
                            / <Minutes value={available} /> available
                          </span>
                        </strong>
                        <div className="capacity-track">
                          <i
                            style={{
                              width: `${Math.min(100, available ? (used / available) * 100 : 0)}%`,
                            }}
                          />
                        </div>
                        <small>
                          {Math.max(0, Math.round(available - used))} minutes of
                          breathing room ·{" "}
                          {
                            displayed.filter((t) => t.data.status === "Done")
                              .length
                          }{" "}
                          completed
                        </small>
                      </div>
                      <button
                        className="daily-note-card"
                        onClick={() => setDailyMode("notes")}
                      >
                        <span className="eyebrow">
                          A note for today <ArrowUpRight size={13} />
                        </span>
                        <p>
                          {currentPlan?.data.notes ||
                            "What would make today feel good?"}
                        </p>
                        <small>Your space for a little context.</small>
                      </button>
                    </section>
                    <section className="focus-section">
                      <div className="section-heading">
                        <h2>
                          Today’s focus{" "}
                          <span className="muted">/ keep it simple</span>
                        </h2>
                        <button
                          className="text-button"
                          onClick={() => setPlanning(true)}
                        >
                          Choose focus
                        </button>
                      </div>
                      <div className="focus-grid">
                        {focusTasks.length ? (
                          focusTasks.map((t, i) => (
                            <button
                              className={`focus-card ${t.data.status === "Done" ? "focus-done" : ""}`}
                              key={t.id}
                              onClick={() => open(t.id)}
                            >
                              <span className="focus-number">0{i + 1}</span>
                              <strong>{t.data.title}</strong>
                              <span>
                                <Minutes value={t.data.estimate} /> ·{" "}
                                {t.data.status}
                              </span>
                            </button>
                          ))
                        ) : (
                          <button
                            className="focus-placeholder"
                            onClick={() => setPlanning(true)}
                          >
                            <Plus size={18} />
                            <span>
                              Pick up to three things worth making room for.
                            </span>
                          </button>
                        )}
                      </div>
                    </section>
                    {currentPlan?.data.essentialsPinned === false && (
                      <button
                        className="text-button"
                        onClick={() => setDailyMode("essentials")}
                      >
                        Show / edit daily essentials
                      </button>
                    )}
                    {currentPlan?.data.essentialsPinned !== false && (
                      <div className="essentials-strip">
                        <button
                          className="text-button"
                          aria-expanded={!essentialsCollapsed}
                          onClick={() =>
                            setEssentialsCollapsed(!essentialsCollapsed)
                          }
                        >
                          Daily essentials {essentialsCollapsed ? "▸" : "▾"}
                        </button>
                        <span>
                          {essentialsCollapsed
                            ? ""
                            : currentPlan?.data.essentials
                                .filter((c) => !c.done)
                                .map((c) => c.text)
                                .join(" · ") ||
                              "A checklist for the things you like to keep close."}
                        </span>
                        <button
                          className="text-button"
                          onClick={() => setDailyMode("essentials")}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </>
                )}
                {taskPage && (
                  <>
                    <div className="task-toolbar">
                      <div className="segmented view-switcher">
                        <button
                          aria-label="List view"
                          className={view === "list" ? "active" : ""}
                          onClick={() => navigate({ view: "list" })}
                        >
                          <LayoutList size={15} />
                          <span>List</span>
                        </button>
                        <button
                          aria-label="Board view"
                          className={view === "board" ? "active" : ""}
                          onClick={() => navigate({ view: "board" })}
                        >
                          <Columns3 size={15} />
                          <span>Board</span>
                        </button>
                        <button
                          aria-label="Timeline view"
                          className={view === "timeline" ? "active" : ""}
                          onClick={() => navigate({ view: "timeline" })}
                        >
                          <Clock size={15} />
                          <span>Timeline</span>
                        </button>
                      </div>
                      <div className="button-row">
                        <button onClick={() => setFiltersOpen(true)}>
                          <SlidersHorizontal size={14} />
                          Filters
                          {Object.entries(filters).some(
                            ([k, v]) => v && k !== "sort" && k !== "owner",
                          )
                            ? " · Active"
                            : ""}
                        </button>
                        {["all", "projects"].includes(section) && (
                          <label className="check-label small">
                            <input
                              type="checkbox"
                              checked={showArchived}
                              onChange={(e) =>
                                setShowArchived(e.target.checked)
                              }
                            />
                            Archived
                          </label>
                        )}
                        {section === "projects" && activeProject && (
                          <button
                            onClick={() =>
                              setEditor({
                                kind: "project",
                                entity: activeProject as unknown as Entity,
                              })
                            }
                          >
                            Edit project
                          </button>
                        )}
                      </div>
                    </div>
                    {selection.size > 0 && (
                      <div className="bulk-toolbar">
                        <strong>{selection.size} selected</strong>
                        <button onClick={() => beginBulk("move")}>Move</button>
                        <button onClick={() => beginBulk("copy")}>Copy</button>
                        <button
                          onClick={() =>
                            void act(
                              () =>
                                runBulk({
                                  operationId: createId(),
                                  action: "someday",
                                  day: "",
                                  items: tasks
                                    .filter((t) => selection.has(t.id))
                                    .map((t) => ({
                                      id: t.id,
                                      version: t.version,
                                    })),
                                }),
                              "Moved to Someday",
                            )
                          }
                        >
                          Someday
                        </button>
                        <button onClick={() => setSelection(new Set())}>
                          Clear
                        </button>
                      </div>
                    )}
                    {section === "projects" && activeProject && (
                      <div className="context-card">
                        <RichText value={activeProject.data.notes} readOnly />
                        {activeProject.data.referenceIds.map((id) => (
                          <button
                            className="text-button"
                            key={id}
                            onClick={() => open(id)}
                          >
                            {String(
                              workspace.records.find((r) => r.id === id)?.data
                                .title || "Reference unavailable",
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {section === "trash" ? (
                      <div className="task-list">
                        {displayed.map((t) => (
                          <div key={t.id} className="trash-row">
                            <TaskRow task={t} onOpen={open} />
                            <button
                              onClick={() =>
                                void act(
                                  () =>
                                    save(
                                      "task",
                                      { ...t.data, deletedAt: "" },
                                      t,
                                    ),
                                  "Restored from Trash",
                                )
                              }
                            >
                              Restore
                            </button>
                            <button
                              className="danger-text"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Permanently delete “${t.data.title}”? This cannot be undone.`,
                                  )
                                )
                                  void act(() =>
                                    remove(t as unknown as Entity),
                                  );
                              }}
                            >
                              Delete permanently
                            </button>
                          </div>
                        ))}
                        {!displayed.length && (
                          <Empty
                            title="Nothing in Trash"
                            description="Deleted tasks will wait here until you restore or permanently remove them."
                          />
                        )}
                      </div>
                    ) : view === "board" ? (
                      <TaskBoard tasks={displayed} onOpen={open} />
                    ) : view === "timeline" ? (
                      <TaskTimeline
                        tasks={displayed}
                        day={day}
                        onOpen={open}
                        personId={person}
                      />
                    ) : (
                      <TaskList
                        tasks={displayed}
                        onOpen={open}
                        selection={selection}
                        onSelect={toggleSelection}
                      />
                    )}
                    {section === "today" && (
                      <>
                        <button className="add-inline" onClick={addTask}>
                          <Plus size={15} />
                          Add a task to this day
                        </button>
                        {recent.length > 0 && (
                          <section className="recent-section">
                            <div className="section-heading">
                              <button
                                className="section-toggle"
                                onClick={() => setRecentOpen(!recentOpen)}
                              >
                                {recentOpen ? "▾" : "▸"} Recent unfinished{" "}
                                <span className="count">{recent.length}</span>
                              </button>
                              <span className="muted">
                                An invitation, not an obligation.
                              </span>
                            </div>
                            {recentOpen &&
                              recent.map((t) => (
                                <div className="recent-row" key={t.id}>
                                  <TaskRow task={t} onOpen={open} />
                                  <span className="muted">
                                    Originally {t.data.plannedDay}
                                  </span>
                                  <button
                                    onClick={() =>
                                      void act(
                                        () =>
                                          runBulk({
                                            operationId: createId(),
                                            action: "move",
                                            items: [
                                              { id: t.id, version: t.version },
                                            ],
                                            day,
                                          }),
                                        "Added to this day",
                                      )
                                    }
                                  >
                                    Add to today
                                  </button>
                                </div>
                              ))}
                          </section>
                        )}
                        <div className="review-callout">
                          <div>
                            <span className="eyebrow">
                              When you’re ready to call it a day
                            </span>
                            <h3>Take a moment to look back.</h3>
                            <p className="muted">
                              Keep what helped. Make a little room for tomorrow.
                            </p>
                          </div>
                          <button onClick={() => setDailyMode("review")}>
                            Review your day <ArrowUpRight size={14} />
                          </button>
                        </div>
                      </>
                    )}
                    {section === "history" && (
                      <section className="context-card">
                        <h3>Daily notes & reflection</h3>
                        {plans
                          .filter(
                            (p) =>
                              p.data.day === day &&
                              (person === "all" || p.data.personId === person),
                          )
                          .map((p) => (
                            <div key={p.id}>
                              <strong>
                                {
                                  people.find((x) => x.id === p.data.personId)
                                    ?.data.name
                                }
                              </strong>
                              <p>{p.data.notes || "No daily note."}</p>
                              <p>{p.data.reflection}</p>
                            </div>
                          ))}
                      </section>
                    )}
                  </>
                )}
                {section === "projects" && !projectId && (
                  <>
                    <div className="button-row">
                      <button onClick={() => go("areas")}>Manage areas</button>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={showArchived}
                          onChange={(e) => setShowArchived(e.target.checked)}
                        />
                        Archived projects
                      </label>
                    </div>
                    {collection("project", "Create project")}
                  </>
                )}
                {section === "areas" && collection("area", "Create area")}
                {section === "people" && collection("person", "Create person")}
                {section === "places" && collection("place", "Add saved place")}
                {section === "routines" && (
                  <>
                    {collection("routine", "Create routine")}
                    <section className="inspector-section">
                      <div className="section-heading">
                        <h2>Recurring tasks</h2>
                        <button
                          onClick={() =>
                            setEditor({
                              kind: "task",
                              initial: {
                                recurrence: {
                                  mode: "daily",
                                  interval: 1,
                                  weekdays: [],
                                  rule: "",
                                  start: today,
                                  end: "",
                                  count: null,
                                  paused: false,
                                },
                              },
                            })
                          }
                        >
                          Create recurring task
                        </button>
                      </div>
                      <div className="collection-grid">
                        {tasks
                          .filter(
                            (t) =>
                              t.data.recurrence &&
                              !t.data.seriesId &&
                              !t.data.deletedAt,
                          )
                          .map((t) => (
                            <article className="collection-card" key={t.id}>
                              <button
                                className="card-title"
                                onClick={() => open(t.id)}
                              >
                                {t.data.title}
                              </button>
                              <p className="muted">
                                {t.data.recurrence?.paused
                                  ? "Paused"
                                  : t.data.archived
                                    ? "Archived"
                                    : "Active"}{" "}
                                · {t.data.recurrence?.mode}
                              </p>
                              <div className="button-row">
                                <button
                                  onClick={() =>
                                    setEditor({
                                      kind: "task",
                                      entity: t as unknown as Entity,
                                    })
                                  }
                                >
                                  Edit series
                                </button>
                                <button
                                  onClick={() =>
                                    void act(
                                      () =>
                                        save(
                                          "task",
                                          {
                                            ...t.data,
                                            recurrence: {
                                              ...t.data.recurrence!,
                                              paused:
                                                !t.data.recurrence?.paused,
                                            },
                                          },
                                          t,
                                        ),
                                      t.data.recurrence?.paused
                                        ? "Recurrence resumed"
                                        : "Recurrence paused",
                                    )
                                  }
                                >
                                  {t.data.recurrence?.paused
                                    ? "Resume"
                                    : "Pause"}
                                </button>
                              </div>
                            </article>
                          ))}
                      </div>
                    </section>
                  </>
                )}
                {section === "library" &&
                  collection("reference", "Create reference")}
                {section === "saved" && collection("view", "Create saved view")}
                {section === "outings" && collection("outing", "Create outing")}
                {section === "settings" && (
                  <div className="settings-grid">
                    <section className="settings-card">
                      <h2>Make it feel like yours</h2>
                      <Field label="Theme">
                        <select
                          value={theme}
                          onChange={(e) => setTheme(e.target.value)}
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="system">System</option>
                        </select>
                      </Field>
                      <Field label="Density">
                        <select
                          value={density}
                          onChange={(e) => setDensity(e.target.value)}
                        >
                          <option value="comfortable">Comfortable</option>
                          <option value="compact">Compact</option>
                        </select>
                      </Field>
                      <Field label="Motion">
                        <select
                          value={motion}
                          onChange={(e) => setMotion(e.target.value)}
                        >
                          <option value="system">Follow system</option>
                          <option value="reduced">Reduced</option>
                        </select>
                      </Field>
                    </section>
                    <section className="settings-card">
                      <h2>Shared workspace</h2>
                      <p className="muted">
                        Everyone can inspect and edit. Choosing a person changes
                        planning context.
                      </p>
                      <div className="stack">
                        <button onClick={() => go("people")}>
                          <Users size={15} />
                          People
                        </button>
                        <button onClick={() => go("places")}>
                          <MapPin size={15} />
                          Saved places
                        </button>
                        <button
                          onClick={() =>
                            setEditor({
                              kind: "settings",
                              entity: settingsEntity,
                            })
                          }
                        >
                          Dates, backups & integrations
                        </button>
                        <button onClick={() => go("backups")}>
                          Export, backup & restore
                        </button>
                      </div>
                    </section>
                    <section className="settings-card">
                      <h2>Availability</h2>
                      <p className="muted">
                        Recurring hours and individual date exceptions.
                      </p>
                      {recordsOf<Availability>(
                        workspace.records,
                        "availability",
                      )
                        .filter(
                          (a) => person === "all" || a.data.personId === person,
                        )
                        .map((a) => (
                          <button
                            className="linked-item"
                            key={a.id}
                            onClick={() =>
                              setEditor({
                                kind: "availability",
                                entity: a as unknown as Entity,
                              })
                            }
                          >
                            {
                              people.find((p) => p.id === a.data.personId)?.data
                                .name
                            }{" "}
                            · {a.data.date || "Recurring"}
                            <span>
                              {a.data.start}–{a.data.end}
                            </span>
                          </button>
                        ))}
                      <button
                        onClick={() =>
                          setEditor({
                            kind: "availability",
                            initial: {
                              personId:
                                person === "all" ? people[0]?.id || "" : person,
                            },
                          })
                        }
                      >
                        Add availability / exception
                      </button>
                    </section>
                    <section className="settings-card">
                      <h2>Reminders</h2>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={remindersEnabled}
                          onChange={(e) => {
                            setRemindersEnabled(e.target.checked);
                            localStorage.setItem(
                              "tide:reminders",
                              e.target.checked ? "on" : "off",
                            );
                          }}
                        />
                        Show reminders in this browser
                      </label>
                      <p className="muted">
                        Alerts run while Tide is open. Missed alerts appear when
                        you return.
                      </p>
                      <h3>Google integration</h3>
                      <p>
                        {workspace.provider.configured
                          ? "Configured"
                          : "Not configured"}{" "}
                        · {workspace.provider.used} / {workspace.provider.limit}{" "}
                        requests today
                      </p>
                      <p className="muted">
                        Direct LAN HTTP supports planning and saved/manual
                        addresses. Current device location requires a secure
                        connection.
                      </p>
                    </section>
                  </div>
                )}
                {section === "backups" && (
                  <Backups
                    onSettings={() =>
                      setEditor({ kind: "settings", entity: settingsEntity })
                    }
                  />
                )}
              </>
            )}
            <footer className="page-footer">
              <Sun size={13} />
              <span>A day at a time.</span>
              <span>Tide</span>
            </footer>
          </div>
        </main>
      </div>
      {selected?.kind === "task" && (
        <TaskPanel
          key={selected.id}
          task={selected as unknown as Entity<Task>}
          onClose={() => navigate({ task: null })}
          onOpen={open}
          onEdit={(entity, scopeFrom) =>
            setEditor({ kind: entity.kind, entity, scopeFrom })
          }
          personId={person}
          day={day}
        />
      )}
      {selected && selected.kind !== "task" && (
        <Modal
          title={String(selected.data.title || selected.data.name)}
          onClose={() => navigate({ task: null })}
          wide={selected.kind === "outing"}
          footer={
            <>
              <button
                onClick={() =>
                  setEditor({ kind: selected.kind, entity: selected })
                }
              >
                Edit
              </button>
              <button onClick={() => navigate({ task: null })}>Close</button>
            </>
          }
        >
          {selected.kind === "outing" ? (
            <OutingView
              outing={selected as unknown as Entity<Outing>}
              onOpen={open}
              onEdit={() => setEditor({ kind: "outing", entity: selected })}
            />
          ) : (
            <>
              <RichText value={String(selected.data.notes || "")} readOnly />
              {selected.kind === "routine" && (
                <>
                  <div className="stack">
                    {(
                      selected as unknown as Entity<Routine>
                    ).data.templates.map((t, i) => (
                      <div className="context-card" key={i}>
                        {i + 1}. {t.title} · {t.estimate} min
                      </div>
                    ))}
                  </div>
                  <button
                    className="primary"
                    onClick={() =>
                      setRoutine(selected as unknown as Entity<Routine>)
                    }
                  >
                    Add to a day
                  </button>
                </>
              )}
              {selected.kind === "reference" && (
                <>
                  <span className="badge">{String(selected.data.type)}</span>
                  {selected.data.url && (
                    <a
                      className="linked-item"
                      href={String(selected.data.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {String(selected.data.url)}
                      <ArrowUpRight size={14} />
                    </a>
                  )}
                  {(selected as unknown as Entity<Reference>).data.checklist
                    .length > 0 && (
                    <Checklist
                      items={
                        (selected as unknown as Entity<Reference>).data
                          .checklist
                      }
                      onChange={(items) =>
                        void act(() =>
                          save(
                            "reference",
                            { ...selected.data, checklist: items },
                            selected,
                          ),
                        )
                      }
                    />
                  )}
                  <div className="attachment-list">
                    {(
                      selected as unknown as Entity<Reference>
                    ).data.attachmentIds.map((id) => {
                      const file = recordsOf<Attachment>(
                        workspace.records,
                        "attachment",
                      ).find((a) => a.id === id);
                      return (
                        <a
                          className="linked-item"
                          href={`/api/attachment/${id}`}
                          target="_blank"
                          rel="noreferrer"
                          key={id}
                        >
                          {file?.data.mime.startsWith("image/") && (
                            <Image
                              unoptimized
                              src={`/api/attachment/${id}`}
                              width={640}
                              height={400}
                              style={{ width: "100%", height: "auto" }}
                              alt={file.data.title}
                            />
                          )}
                          {file?.data.title || "Attachment unavailable"}
                        </a>
                      );
                    })}
                  </div>
                  <div className="button-row">
                    <button
                      onClick={() => {
                        setReferenceTarget({
                          reference: selected as unknown as Entity<Reference>,
                          copy: false,
                        });
                        setTargetTask("");
                        setReferenceError("");
                      }}
                    >
                      Link to task
                    </button>
                    <button
                      onClick={() => {
                        setReferenceTarget({
                          reference: selected as unknown as Entity<Reference>,
                          copy: true,
                        });
                        setTargetTask("");
                        setReferenceError("");
                      }}
                    >
                      Copy content to task
                    </button>
                  </div>
                  <p className="muted">
                    Linking keeps a shared reference. Copying adds independent
                    content.
                  </p>
                </>
              )}
            </>
          )}
        </Modal>
      )}
      {editor && (
        <EntityEditor
          key={editor.entity?.id || editor.kind}
          kind={editor.kind}
          entity={editor.entity}
          initial={editor.initial}
          scopeFrom={editor.scopeFrom}
          personId={person === "all" ? "" : person}
          day={day}
          onClose={() => setEditor(null)}
          onSaved={(entity) => {
            if (entity.kind === "task") open(entity.id);
          }}
        />
      )}
      {planning && (
        <PlanningWizard
          personId={person}
          day={day}
          onClose={() => setPlanning(false)}
          onOpen={(id) => {
            setPlanning(false);
            open(id);
          }}
        />
      )}
      {dailyMode && (
        <DailyContent
          personId={person}
          day={day}
          mode={dailyMode}
          onClose={() => setDailyMode(null)}
        />
      )}
      {routine && (
        <RoutineApply
          routine={routine}
          personId={person}
          day={day}
          onClose={() => setRoutine(null)}
        />
      )}
      {filtersOpen && (
        <Modal
          title="Filter your tasks"
          onClose={() => setFiltersOpen(false)}
          footer={
            <>
              <button onClick={() => setFilters({ ...defaultFilters })}>
                Clear filters
              </button>
              <button
                onClick={() => {
                  setFiltersOpen(false);
                  setEditor({
                    kind: "view",
                    initial: { filters: { ...filters } },
                  });
                }}
              >
                Save as view
              </button>
              <button
                className="primary"
                onClick={() => {
                  navigate({ filters: JSON.stringify(filters) });
                  setFiltersOpen(false);
                }}
              >
                Apply filters
              </button>
            </>
          }
        >
          <FilterFields value={filters} onChange={setFilters} />
        </Modal>
      )}
      {bulkAction && (
        <Modal
          title={`${bulkAction === "copy" ? "Copy" : "Move"} ${selection.size} tasks`}
          onClose={() => setBulkAction(null)}
          footer={
            <>
              <button onClick={() => setBulkAction(null)}>Cancel</button>
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await runBulk({
                      operationId: bulkOperation,
                      action: bulkAction,
                      items: tasks
                        .filter((t) => selection.has(t.id))
                        .map((t) => ({ id: t.id, version: t.version })),
                      day: bulkDay,
                    });
                    setSelection(new Set());
                    setBulkAction(null);
                    notify(
                      bulkAction === "copy"
                        ? "Independent copies created"
                        : "Tasks moved",
                    );
                  } catch (e) {
                    setBulkError(
                      e instanceof Error
                        ? e.message
                        : "Could not complete operation",
                    );
                  }
                }}
              >
                Confirm {bulkAction}
              </button>
            </>
          }
        >
          <ErrorMessage error={bulkError} />
          <Field label="Destination day">
            <input
              type="date"
              value={bulkDay}
              onChange={(e) => setBulkDay(e.target.value)}
            />
          </Field>
          {tasks
            .filter((t) => selection.has(t.id))
            .map((t) => (
              <p key={t.id}>{t.data.title}</p>
            ))}
          <div className="info-message">
            Scheduled start and end times will be cleared.
            {bulkAction === "copy"
              ? " Copies keep useful content but reset completion, checklist progress, reminders, and recurrence."
              : " Moving preserves task identity and history."}
          </div>
        </Modal>
      )}
      {referenceTarget && (
        <Modal
          title={
            referenceTarget.copy
              ? "Copy reference content"
              : "Link reference to a task"
          }
          onClose={() => setReferenceTarget(null)}
          footer={
            <>
              <button onClick={() => setReferenceTarget(null)}>Cancel</button>
              <button
                className="primary"
                onClick={async () => {
                  const target = tasks.find((t) => t.id === targetTask);
                  if (!target) {
                    setReferenceError("Choose a target task.");
                    return;
                  }
                  const ref = referenceTarget.reference;
                  try {
                    await save(
                      "task",
                      referenceTarget.copy
                        ? {
                            ...target.data,
                            notes: target.data.notes + ref.data.notes,
                            checklist: [
                              ...target.data.checklist,
                              ...ref.data.checklist.map((c) => ({
                                ...c,
                                id: createId(),
                                done: false,
                              })),
                            ],
                            attachmentIds: [
                              ...new Set([
                                ...target.data.attachmentIds,
                                ...ref.data.attachmentIds,
                              ]),
                            ],
                          }
                        : {
                            ...target.data,
                            referenceIds: [
                              ...new Set([...target.data.referenceIds, ref.id]),
                            ],
                          },
                      target,
                    );
                    setReferenceTarget(null);
                    open(target.id);
                  } catch (e) {
                    setReferenceError(
                      e instanceof Error
                        ? e.message
                        : "Could not apply reference",
                    );
                  }
                }}
              >
                Confirm {referenceTarget.copy ? "copy" : "link"}
              </button>
            </>
          }
        >
          <p>{referenceTarget.reference.data.title}</p>
          <ErrorMessage error={referenceError} />
          <Field label="Find target task">
            <input
              type="search"
              value={targetSearch}
              onChange={(e) => setTargetSearch(e.target.value)}
            />
          </Field>
          <Field label="Choose target task">
            <select
              value={targetTask}
              onChange={(e) => setTargetTask(e.target.value)}
            >
              <option value="">Select a task</option>
              {taskRecords
                .filter((t) =>
                  t.data.title
                    .toLowerCase()
                    .includes(targetSearch.toLowerCase()),
                )
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.data.title}
                  </option>
                ))}
            </select>
          </Field>
        </Modal>
      )}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navigation
          .filter((n) => ["today", "upcoming", "inbox"].includes(n.id))
          .map((n) => (
            <button
              className={section === n.id ? "active" : ""}
              key={n.id}
              onClick={() => go(n.id)}
            >
              <n.icon size={18} />
              {n.label}
            </button>
          ))}
        <button onClick={() => setMobileMenu(true)}>
          <Menu size={18} />
          More
        </button>
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => notify("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
