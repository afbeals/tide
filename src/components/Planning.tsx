"use client";

import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, Check, Plus } from "lucide-react";
import { useWorkspace } from "./workspace";
import { Modal, Field, Minutes, ErrorMessage, Checklist } from "./ui";
import {
  capacity,
  newPlan,
  workload,
  addDays,
  localDateTime,
  instantInZone,
  effectiveTask,
} from "@/lib/domain";
import { recordsOf } from "@/lib/types";
import type {
  Entity,
  Task,
  Person,
  Plan,
  Availability,
  Routine,
  Settings,
  TimeLog,
} from "@/lib/types";
export function PlanningWizard({
  personId,
  day,
  onClose,
  onOpen,
}: {
  personId: string;
  day: string;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const { workspace, mutate, notify } = useWorkspace();
  const existing = recordsOf<Plan>(workspace.records, "plan").find(
    (p) => p.data.personId === personId && p.data.day === day,
  );
  const cfg = recordsOf<Settings>(workspace.records, "settings")[0].data;
  const draftKey = `tide:planning:${personId}:${day}`;
  const [draft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) || "null");
    } catch {
      return null;
    }
  });
  const tasks = recordsOf<Task>(workspace.records, "task").filter(
    (t) =>
      !t.data.deletedAt &&
      !t.data.archived &&
      !t.data.recurrence &&
      !t.data.suspended &&
      t.data.status !== "Done" &&
      !t.data.outcome &&
      (t.data.ownerId === personId || !t.data.ownerId),
  );
  const [baseVersion, setBaseVersion] = useState(
    draft ? draft.version : existing?.version,
  );
  const [baseGeneration, setBaseGeneration] = useState(
    draft?.generation || workspace.generation,
  );
  const [step, setStep] = useState(draft?.step || 1);
  const [ids, setIds] = useState<string[]>(
    draft?.ids ||
      existing?.data.taskIds ||
      tasks.filter((t) => t.data.plannedDay === day).map((t) => t.id),
  );
  const [focus, setFocus] = useState<string[]>(
    draft?.focus || existing?.data.focusIds || [],
  );
  const [edits, setEdits] = useState<Record<string, Partial<Task>>>(
    draft?.edits || {},
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [routine, setRoutine] = useState<Entity<Routine> | null>(null);
  const person = recordsOf<Person>(workspace.records, "person").find(
    (p) => p.id === personId,
  );
  const selected = ids
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Entity<Task> => !!t)
    .map((t) => ({ ...t, data: { ...t.data, ...edits[t.id] } }));
  const available = capacity(
    personId,
    day,
    recordsOf<Availability>(workspace.records, "availability"),
  );
  const used = workload(selected, workspace.records);
  useEffect(() => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        step,
        ids,
        focus,
        edits,
        version: baseVersion,
        generation: baseGeneration,
      }),
    );
  }, [step, ids, focus, edits, draftKey, baseVersion, baseGeneration]);
  function toggle(t: Entity<Task>) {
    if (
      !ids.includes(t.id) &&
      !t.data.ownerId &&
      !window.confirm(
        `Assign “${t.data.title}” to ${person?.data.name} and add it to this plan?`,
      )
    )
      return;
    setIds(ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id]);
    if (ids.includes(t.id)) setFocus(focus.filter((x) => x !== t.id));
  }
  async function finish() {
    setBusy(true);
    setError("");
    try {
      if (baseGeneration !== workspace.generation)
        throw new Error(
          "The workspace was restored. Review the current plan before saving.",
        );
      await mutate("plan", {
        data: {
          ...(existing?.data || newPlan(personId, day)),
          taskIds: selected.map((t) => t.id),
          focusIds: focus.filter((id) => ids.includes(id)),
          planningStep: 4,
        },
        version: baseVersion,
        taskEdits: selected.map((t) => ({
          id: t.id,
          version: t.version,
          data: {
            ...edits[t.id],
            ownerId: personId,
            plannedDay: day,
            someday: false,
          },
        })),
      });
      localStorage.removeItem(draftKey);
      notify("Your day has a little more shape");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save plan");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Plan ${person?.data.name || "your"}’s day`}
      description={`${day} · ${step} of 4`}
      wide
      onClose={onClose}
      footer={
        <>
          <small>
            {ids.length} tasks · <Minutes value={used} /> /{" "}
            <Minutes value={available} />
          </small>
          {step > 1 && <button onClick={() => setStep(step - 1)}>Back</button>}
          {step < 4 ? (
            <button className="primary" onClick={() => setStep(step + 1)}>
              Continue
            </button>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() => void finish()}
            >
              {busy ? "Saving…" : "Save plan"}
            </button>
          )}
        </>
      }
    >
      <div className="step-indicator">
        {["Review", "Shape", "Check", "Finish"].map((label, i) => (
          <span
            key={label}
            className={
              step === i + 1 ? "active" : step > i + 1 ? "complete" : ""
            }
          >
            {step > i + 1 ? "✓" : i + 1} {label}
          </span>
        ))}
      </div>
      <ErrorMessage error={error} />
      {error && (
        <button
          onClick={() => {
            setBaseVersion(existing?.version);
            setBaseGeneration(workspace.generation);
            setError("");
          }}
        >
          I have reviewed the current plan; retry my selections
        </button>
      )}
      {draft && (
        <p className="info-message">
          Your interrupted planning draft was recovered.
        </p>
      )}
      {step === 1 && (
        <>
          <h2>Choose what belongs in this day</h2>
          <p className="muted">
            Everything is an invitation. Select the work you want to bring
            forward.
          </p>
          {[
            ["Already planned", tasks.filter((t) => t.data.plannedDay === day)],
            [
              "Recent unfinished",
              tasks.filter(
                (t) =>
                  t.data.plannedDay < day &&
                  t.data.plannedDay >= addDays(day, -3) &&
                  !t.data.seriesId,
              ),
            ],
            [
              "Older unfinished",
              tasks.filter(
                (t) =>
                  t.data.plannedDay &&
                  t.data.plannedDay < addDays(day, -3) &&
                  !t.data.seriesId,
              ),
            ],
            [
              "Someday",
              tasks
                .filter((t) => t.data.someday)
                .sort((a, b) =>
                  String(a.data.reviewedAt || a.createdAt).localeCompare(
                    String(b.data.reviewedAt || b.createdAt),
                  ),
                )
                .slice(0, 5),
            ],
            [
              "Projects & available work",
              tasks.filter(
                (t) =>
                  !t.data.someday &&
                  (!t.data.plannedDay || t.data.plannedDay > day) &&
                  (!t.data.startDay || t.data.startDay <= day),
              ),
            ],
          ].map(([label, items]) => (
            <section key={label as string} className="planning-source">
              <h3>{label as string}</h3>
              {(items as Entity<Task>[]).map((t) => (
                <label className="planning-choice" key={t.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(t.id)}
                    onChange={() => toggle(t)}
                  />
                  <span>
                    <strong>{t.data.title}</strong>
                    <small>
                      {t.data.ownerId
                        ? person?.data.name
                        : "Unassigned · will be assigned explicitly"}{" "}
                      · {t.data.plannedDay || "Unplanned"} · {t.data.estimate}{" "}
                      min
                    </small>
                  </span>
                </label>
              ))}
            </section>
          ))}
          <h3>Add a routine</h3>
          <div className="button-row">
            {recordsOf<Routine>(workspace.records, "routine").map((r) => (
              <button key={r.id} onClick={() => setRoutine(r)}>
                <Plus size={14} />
                {r.data.title}
              </button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h2>Give your day some shape</h2>
          <p className="muted">
            Choose up to three focus tasks. Time slots are optional.
          </p>
          {selected.map((t, index) => (
            <div className="planning-task" key={t.id}>
              <div className="section-heading">
                <strong>{t.data.title}</strong>
                <div className="button-row">
                  <button
                    className="icon-button"
                    aria-label="Move task up"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...ids];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      setIds(next);
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Move task down"
                    disabled={index === selected.length - 1}
                    onClick={() => {
                      const next = [...ids];
                      [next[index + 1], next[index]] = [
                        next[index],
                        next[index + 1],
                      ];
                      setIds(next);
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={focus.includes(t.id)}
                  disabled={!focus.includes(t.id) && focus.length >= 3}
                  onChange={(e) =>
                    setFocus(
                      e.target.checked
                        ? [...focus, t.id]
                        : focus.filter((id) => id !== t.id),
                    )
                  }
                />
                Today’s focus
              </label>
              <div className="form-grid">
                <Field label="Estimate (minutes)">
                  <input
                    type="number"
                    min="0"
                    value={t.data.estimate}
                    onChange={(e) =>
                      setEdits({
                        ...edits,
                        [t.id]: {
                          ...edits[t.id],
                          estimate: Number(e.target.value),
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Untimed grouping">
                  <select
                    value={t.data.dayPart}
                    onChange={(e) =>
                      setEdits({
                        ...edits,
                        [t.id]: { ...edits[t.id], dayPart: e.target.value },
                      })
                    }
                  >
                    {["", "Morning", "Afternoon", "Evening"].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Start">
                  <input
                    type="datetime-local"
                    value={localDateTime(t.data.scheduledStart, cfg.timezone)}
                    onChange={(e) =>
                      setEdits({
                        ...edits,
                        [t.id]: {
                          ...edits[t.id],
                          scheduledStart: instantInZone(
                            e.target.value,
                            cfg.timezone,
                          ),
                        },
                      })
                    }
                  />
                </Field>
                <Field label="End">
                  <input
                    type="datetime-local"
                    value={localDateTime(t.data.scheduledEnd, cfg.timezone)}
                    onChange={(e) =>
                      setEdits({
                        ...edits,
                        [t.id]: {
                          ...edits[t.id],
                          scheduledEnd: instantInZone(
                            e.target.value,
                            cfg.timezone,
                          ),
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </>
      )}
      {step === 3 && (
        <>
          <h2>A quick look at the whole day</h2>
          <div
            className={`capacity-summary ${used > available ? "over-capacity" : ""}`}
          >
            <strong>
              <Minutes value={used} /> planned / <Minutes value={available} />{" "}
              available
            </strong>
            <p>
              {used > available
                ? `${Math.round(used - available)} minutes over capacity. You can still keep this plan.`
                : "There’s room for transitions and the unexpected."}
            </p>
          </div>
          {selected
            .filter(
              (t) =>
                t.data.status === "Waiting/blocked" ||
                t.data.dependencies.some(
                  (id) =>
                    workspace.records.find((r) => r.id === id)?.data.status !==
                    "Done",
                ),
            )
            .map((t) => (
              <p className="info-message" key={t.id}>
                Waiting / prerequisite: {t.data.title}. {t.data.blockingNote}
              </p>
            ))}
          {selected
            .filter((t) => t.data.deadline && t.data.deadline < day)
            .map((t) => (
              <p className="info-message" key={t.id}>
                Deadline is before this day: {t.data.title}
              </p>
            ))}
          {selected
            .filter(
              (t) =>
                t.data.outdoor ||
                effectiveTask(t.data, workspace.records, t.id).context ===
                  "Away from home",
            )
            .map((t) => (
              <button
                className="linked-item"
                key={t.id}
                onClick={() => onOpen(t.id)}
              >
                Review weather / travel: {t.data.title}
              </button>
            ))}
          {selected.some(
            (a, i) =>
              a.data.scheduledStart &&
              selected.some(
                (b, j) =>
                  j > i &&
                  b.data.scheduledStart &&
                  Date.parse(a.data.scheduledStart) <
                    Date.parse(b.data.scheduledEnd || b.data.scheduledStart) &&
                  Date.parse(b.data.scheduledStart) <
                    Date.parse(a.data.scheduledEnd || a.data.scheduledStart),
              ),
          ) && (
            <p className="info-message">
              Some scheduled tasks overlap. Open their details to adjust them,
              or keep the plan as it is.
            </p>
          )}
        </>
      )}
      {step === 4 && (
        <>
          <h2>Make room for what matters</h2>
          <p>
            {selected.length} tasks, {focus.length} focus selections. Your
            choices stay yours to change.
          </p>
          {selected.map((t) => (
            <div className="planning-choice" key={t.id}>
              <Check size={16} />
              <strong>{t.data.title}</strong>
              <span className="muted">
                {focus.includes(t.id) ? "Focus · " : ""}
                {t.data.estimate} min
              </span>
            </div>
          ))}
        </>
      )}
      {routine && (
        <RoutineApply
          routine={routine}
          personId={personId}
          day={day}
          onClose={() => setRoutine(null)}
          onApplied={(added) => {
            setIds([...ids, ...added.map((t) => t.id)]);
            setRoutine(null);
          }}
        />
      )}
    </Modal>
  );
}
export function RoutineApply({
  routine,
  personId,
  day,
  onClose,
  onApplied,
}: {
  routine: Entity<Routine>;
  personId: string;
  day: string;
  onClose: () => void;
  onApplied?: (tasks: Entity<Task>[]) => void;
}) {
  const { workspace, mutate } = useWorkspace();
  const [person, setPerson] = useState(personId === "all" ? "" : personId);
  const [date, setDate] = useState(day);
  const [indices, setIndices] = useState(
    routine.data.templates.map((_, i) => i),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [operationId] = useState(() => crypto.randomUUID());
  return (
    <Modal
      title={`Add ${routine.data.title}`}
      description="Choose templates and review before creating independent tasks."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            disabled={busy || !person || !indices.length}
            onClick={async () => {
              setBusy(true);
              try {
                const tasks = await mutate<Entity<Task>[]>("routine-apply", {
                  routineId: routine.id,
                  personId: person,
                  day: date,
                  indices,
                  operationId,
                });
                onApplied?.(tasks);
                onClose();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not add routine",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Add {indices.length} tasks
          </button>
        </>
      }
    >
      <ErrorMessage error={error} />
      <div className="form-grid">
        <Field label="Person">
          <select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Choose a person</option>
            {recordsOf<Person>(workspace.records, "person")
              .filter((p) => !p.data.retired)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.data.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Day">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      {routine.data.templates.map((t, i) => (
        <label className="planning-choice" key={i}>
          <input
            type="checkbox"
            checked={indices.includes(i)}
            onChange={(e) =>
              setIndices(
                e.target.checked
                  ? [...indices, i]
                  : indices.filter((x) => x !== i),
              )
            }
          />
          <span>
            <strong>{t.title}</strong>
            <small>
              {t.estimate || 0} min · {t.context}
            </small>
          </span>
        </label>
      ))}
    </Modal>
  );
}
export function DailyContent({
  personId,
  day,
  mode,
  onClose,
}: {
  personId: string;
  day: string;
  mode: "notes" | "essentials" | "review";
  onClose: () => void;
}) {
  const { workspace, mutate } = useWorkspace();
  const existing = recordsOf<Plan>(workspace.records, "plan").find(
    (p) => p.data.personId === personId && p.data.day === day,
  );
  const [plan, setPlan] = useState(existing?.data || newPlan(personId, day));
  const [baseVersion] = useState(existing?.version);
  const [baseGeneration] = useState(workspace.generation);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const tasks = recordsOf<Task>(workspace.records, "task").filter(
    (t) =>
      t.data.ownerId === personId &&
      t.data.plannedDay === day &&
      !t.data.deletedAt &&
      !t.data.recurrence,
  );
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [destination, setDestination] = useState(addDays(day, 1));
  return (
    <Modal
      title={
        mode === "review"
          ? "Review your day"
          : mode === "essentials"
            ? "Pinned daily essentials"
            : "Daily note"
      }
      description={day}
      wide={mode === "review"}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (baseGeneration !== workspace.generation)
                  throw new Error(
                    "The workspace was restored. Reopen this review before saving.",
                  );
                if (mode === "review")
                  await mutate("review", {
                    data: { ...plan, reviewed: true },
                    version: baseVersion,
                    decisions: tasks
                      .filter(
                        (t) =>
                          decisions[t.id] && decisions[t.id] !== "unchanged",
                      )
                      .map((task) => ({
                        id: task.id,
                        version: task.version,
                        action:
                          decisions[task.id] === "someday"
                            ? "someday"
                            : decisions[task.id] === "archive"
                              ? "archive"
                              : "move",
                        day:
                          decisions[task.id] === "tomorrow"
                            ? addDays(day, 1)
                            : destination,
                      })),
                  });
                else await mutate("plan", { data: plan, version: baseVersion });
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not save");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <ErrorMessage error={error} />
      {mode === "review" && (
        <>
          <h3>
            Completed · {tasks.filter((t) => t.data.status === "Done").length}
          </h3>
          {tasks
            .filter((t) => t.data.status === "Done")
            .map((t) => (
              <p key={t.id}>✓ {t.data.title}</p>
            ))}
          <h3>Estimate and actual time</h3>
          {tasks.map((t) => {
            const actual =
              recordsOf<TimeLog>(workspace.records, "timeLog")
                .filter(
                  (log) =>
                    log.data.taskId === t.id && log.data.personId === personId,
                )
                .reduce(
                  (n, log) =>
                    n +
                    log.data.elapsedSeconds +
                    (log.data.running
                      ? Math.max(
                          0,
                          (Date.now() - Date.parse(log.data.startedAt)) / 1000,
                        )
                      : 0),
                  0,
                ) / 60;
            return (
              <p key={t.id}>
                {t.data.title} · <Minutes value={t.data.estimate} /> estimated /{" "}
                <Minutes value={actual} /> actual
              </p>
            );
          })}
          <h3>Unfinished one-off work</h3>
          <Field label="Apply to all unfinished one-off tasks">
            <select
              defaultValue=""
              onChange={(e) =>
                setDecisions(
                  Object.fromEntries(
                    tasks
                      .filter(
                        (t) => t.data.status !== "Done" && !t.data.seriesId,
                      )
                      .map((t) => [t.id, e.target.value]),
                  ),
                )
              }
            >
              <option value="">Choose a decision</option>
              <option value="unchanged">Leave unchanged</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="date">Another date</option>
              <option value="someday">Someday</option>
              <option value="archive">Archive</option>
            </select>
          </Field>
          <Field label="Another destination date">
            <input
              type="date"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </Field>
          {tasks
            .filter((t) => t.data.status !== "Done" && !t.data.seriesId)
            .map((t) => (
              <div className="review-item" key={t.id}>
                <strong>{t.data.title}</strong>
                <select
                  aria-label={`Review ${t.data.title}`}
                  value={decisions[t.id] || "unchanged"}
                  onChange={(e) =>
                    setDecisions({ ...decisions, [t.id]: e.target.value })
                  }
                >
                  <option value="unchanged">Leave unchanged</option>
                  <option value="tomorrow">Tomorrow</option>
                  <option value="date">Another date</option>
                  <option value="someday">Someday</option>
                  <option value="archive">Archive</option>
                </select>
              </div>
            ))}
          <h3>Recurring outcomes</h3>
          {tasks
            .filter((t) => t.data.seriesId)
            .map((t) => (
              <p key={t.id}>
                {t.data.title} · {t.data.outcome || t.data.status}
              </p>
            ))}
          <p className="muted">
            Nothing moves unless you choose it. Recurring outcomes are kept in
            history.
          </p>
        </>
      )}
      {mode === "essentials" ? (
        <>
          <Checklist
            items={plan.essentials}
            onChange={(v) => setPlan({ ...plan, essentials: v })}
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={plan.essentialsPinned}
              onChange={(e) =>
                setPlan({ ...plan, essentialsPinned: e.target.checked })
              }
            />
            Pin on Today
          </label>
        </>
      ) : (
        <>
          <Field
            label={
              mode === "review"
                ? "Reflection and accomplishments"
                : "Daily note"
            }
          >
            <textarea
              rows={8}
              value={mode === "review" ? plan.reflection : plan.notes}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  [mode === "review" ? "reflection" : "notes"]: e.target.value,
                })
              }
            />
          </Field>
        </>
      )}
    </Modal>
  );
}
