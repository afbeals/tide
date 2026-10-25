# Design handoff: personal daily planner POC

## 1. Purpose and design direction

Design a functioning personal task planner that helps someone capture ideas, plan realistic days, manage ongoing work, and remember future intentions.

The application combines task management, daily planning, recurring routines, rich notes, focus timers, and location-aware travel planning.

The central experience is:

Capture → Organize → Plan My Day → Work → Review

This is a greenfield project outside Pineapple. Use an independent visual identity and component system. There are no Airbnb design or process requirements.

### Audience and platform

- One person managing work, home, errands, routines, and longer-running projects.
- Browser application, designed for desktop first and adapted thoughtfully for mobile.
- Data and attachments live on the computer running the application.
- No accounts, collaboration, or cross-device synchronization in this version.
- Export, backup, and restore are included.

### Experience goals

The interface should feel calm, useful, and pleasant even when the user has many tasks.

- Make capturing a task effortless.
- Keep advanced capabilities available without displaying every field immediately.
- Help the user distinguish intentions from commitments.
- Make unfinished work recoverable without guilt.
- Keep task information consistent across every view.
- Explain recommendations and system feedback in plain language.
- Use realistic content throughout the Figma file.

The visual treatment is open to exploration. Favor readable typography, clear hierarchy, restrained color, comfortable spacing, and subtle motion.

## 2. Core concepts and behavior

These distinctions must remain clear throughout the design.

| Concept | Meaning |
|---|---|
| Task | An item to do, with optional notes, scheduling, attachments, and other details. |
| Status | Open, In progress, Waiting/blocked, or Done. |
| Planned date | The day the user intends to work on the task. |
| Start date | The earliest date the task should become actionable. |
| Deadline | When the task must be finished. Independent of its planned date. |
| Scheduled time | An optional time slot on a particular day. Tasks may remain untimed. |
| Someday | An intentionally deferred idea without a current commitment. |
| Project | A collection of related tasks with shared context and reference material. |
| Area | A broader responsibility, such as Home, Work, or Health, containing projects and tasks. |
| Routine | A reusable group of tasks that can be added to a day. |
| Recurring task | A task with individually tracked scheduled occurrences. |
| Trip / outing | A group of away-from-home tasks with destinations and travel between stops. |
| Reference item | Reusable notes, documents, links, images, or checklists that tasks can reference. |

### Shared task behavior

List, board, timeline, and map presentations use the same task records.

- Changing a task in one view updates it everywhere.
- Moving a card between board columns changes its status.
- Changing status does not change its planned date.
- Moving a task to another day preserves its identity, notes, and history.
- Copying creates a separate unchecked task.
- Archiving, deleting, and skipping a recurring occurrence are distinct actions, separate from the four task statuses.

### Location context

Tasks and task groups support:

- At home
- Away from home
- Anywhere

A group can provide shared context; individual tasks can override it.

Travel features apply to away-from-home tasks and groups. Outdoor weather can also apply to tasks performed at home.

## 3. Information architecture

Use a persistent desktop sidebar and a simplified mobile navigation pattern.

### Primary navigation

| Destination | Purpose |
|---|---|
| Today | Daily working view, essentials, focus tasks, scheduled work, and recent unfinished tasks. |
| Upcoming | Browse future dates and plan across a week. |
| Inbox | Capture tasks before organizing them. |
| All Tasks | Search and filter the entire task collection, including older unfinished tasks. |
| Someday | Store and periodically reconsider future ideas. |
| Projects & Areas | Browse responsibilities and related projects. |

### Supporting navigation

- Saved views
- Routines
- Reference library
- History and daily notes
- Trash
- Settings

“Plan My Day” should be a prominent action from Today. End-of-day review should also be easily discoverable there.

Avoid giving every capability equal visual weight. Keep the daily workflow prominent.

## 4. Shared application shell and view system

### Desktop shell

Include:

- Main navigation sidebar
- Page title and contextual information
- Search
- Primary “Add task” action
- View switcher where applicable
- Filters and sorting
- Main content area
- Task detail side panel
- Persistent active-timer indicator

### View system

| View | Main purpose |
|---|---|
| List | Scan tasks and their status, priority, dates, and other relevant metadata. |
| Board | Organize cards into Open, In progress, Waiting/blocked, and Done columns. |
| Timeline | Place tasks into time slots alongside personal availability and travel. |
| Map | Understand the destinations and route for away-from-home tasks. |

Today, Upcoming, All Tasks, and project pages should support relevant views. Map is contextual to destination-bearing tasks.

Preserve filters when switching views. If a view cannot display some filtered tasks, show a clear explanation and an appropriate tray or list rather than making them disappear silently.

### Board behavior

- Four shared status columns throughout the app.
- No custom project workflows.
- Drag cards between columns.
- Provide a status selector as an accessible alternative.
- Cards show enough information to distinguish tasks without opening them.
- Make overdue deadlines and blocking reasons understandable without relying on color.

### Timeline behavior

- Distinguish fixed task times, flexible scheduled tasks, travel, and unavailable periods.
- Include an unscheduled task tray beside the desktop timeline.
- Allow tasks to remain untimed.
- Show overlap and capacity feedback without preventing the user from keeping the plan.
- Provide alternatives to dragging for assigning dates and times.

## 5. Today: the primary working screen

Today should answer:

1. What matters most?
2. What is scheduled?
3. What can I work on next?
4. What needs reviewing?

### Content

- Date navigation and “Plan My Day”
- A restrained daily summary
- Today’s focus: up to three highlighted tasks
- Pinned daily essentials: a short note or checklist
- Today’s tasks in list, board, or timeline
- Estimated workload compared with available time
- Active focus timer
- Relevant weather and departure information
- Collapsible completed tasks
- End-of-day review entry point

### Recent unfinished section

Show unfinished one-off tasks planned for the previous three days, separate from today’s intentional commitments.

Each item should make its original planned date visible.

Actions include:

- Add to today
- Choose another date
- Move to Someday
- Open task details

Do not automatically move these tasks.

Older unfinished tasks remain accessible through All Tasks and Plan My Day. They should not accumulate indefinitely in Today’s recent section.

### Presentation

A day should become visually lighter as tasks are completed. Use neutral language for unfinished work and missed routines.

## 6. Plan My Day flow

Design a focused, resumable planning flow.

### Step 1: Review available work

Present distinct sources:

- Tasks already planned for the selected day
- Recent unfinished tasks
- Older unfinished tasks
- Available project tasks
- Someday suggestions
- Recurring occurrences for the day
- Routines the user can add

Allow selecting several tasks together.

### Step 2: Shape the day

Let the user:

- Order tasks
- Choose up to three focus tasks
- Optionally group untimed tasks into morning, afternoon, and evening
- Assign time slots
- Add or adjust estimates
- Review available time
- See dependencies and blocked tasks
- Include preparation and travel time

### Step 3: Check the plan

Show:

- Planned workload versus capacity
- Scheduling overlaps
- Relevant deadlines
- Weather for outdoor tasks
- Travel feasibility for destination tasks

Feedback is advisory. The user controls changes.

### Step 4: Finish planning

Return to Today with the selected view and the resulting plan.

Preserve planning progress if interrupted.

## 7. Task creation and task details

### Task creation

Only the title is required.

Use progressive disclosure for optional details. Support task creation from Inbox, a selected day, a project, or a routine, with the current context visible.

Preserve interrupted drafts.

### Task detail panel

Use a desktop side panel and a mobile full-screen detail view.

Organize information into understandable groups:

| Group | Contents |
|---|---|
| Identity | Title, status, project/area, tags, priority |
| Planning | Planned day, start date, deadline, optional time slot, estimate |
| Work | Checklist/subtasks, effort/energy level, focus timer, actual time |
| Context | Notes, links, images, attachments, linked reference items |
| Dependencies | Prerequisite tasks, waiting/blocked state, blocking note |
| Recurrence | Schedule, pause, occurrence history, edit scope |
| Location | Home/away/anywhere, outdoor context, destinations, travel details |
| History | Creation, edits, rescheduling, progress notes, completion |

Keep rarely used groups collapsed or secondary.

### Notes and attachments

- Support readable formatted notes and checklists.
- Preview images inline and in an expanded viewer.
- Give links recognizable titles and destinations.
- Show attachment loading, failure, and missing-file states.
- Allow linking reusable reference material without copying it.
- Show subtle saving/saved/error feedback.

### Task actions

Provide discoverable controls for copying, moving, archiving, and deleting.

There is no dedicated command menu or keyboard-shortcut feature.

Ordinary keyboard navigation remains an accessibility requirement.

## 8. Recurring tasks and reusable routines

### Recurring task configuration

Support:

- Daily
- Selected weekdays
- Weekly and other custom schedules
- Completion-relative repetition, such as “three days after completion”
- Pausing a recurring task
- Skipping an occurrence
- Editing one occurrence or this and future occurrences

### Recurring task behavior

- Each occurrence has its own completion record.
- Missed occurrences do not accumulate as overdue copies.
- History preserves completed, missed, and skipped occurrences.
- Completing today’s occurrence does not complete the entire recurring series.

Clearly distinguish the series from the selected occurrence in the detail panel.

### Routines page

Allow users to:

- Create and edit reusable groups
- Preview their tasks
- Add a routine to a chosen day
- Select which included tasks to add
- Review the result before confirming

Distinguish adding a routine on demand from configuring recurring tasks.

## 9. Upcoming, Someday, and bulk planning

### Upcoming

Provide a week-oriented overview with date navigation.

Show scheduled tasks, recurring occurrences, and deadlines with clear visual distinctions.

Support moving tasks between days, including bulk selection.

### Bulk copy and move

Design a flow with:

1. Selected tasks
2. Explicit Copy or Move choice
3. Destination day
4. Preview
5. Confirmation and undo

For copies, show which details will be retained. Default to retaining useful task content while resetting completion and progress state.

### Someday

Provide:

- Search and filters
- Task details and project context
- Date added or last reviewed
- Actions to schedule, retain, or archive

Periodically surface a small set of older Someday items during planning, particularly when planning the coming week.

Do not create a separate weekly-review feature.

## 10. Projects, areas, and saved views

### Projects & Areas overview

Show areas such as Home, Work, and Health, with their projects and related tasks.

Project summaries should communicate:

- Purpose or description
- Open and completed task counts
- Relevant dates
- Blocking or waiting work

### Project detail

Include:

- Project notes and reference links
- List, board, and timeline views
- Task filters
- Progress overview
- Completed and archived content access

Dependencies should be understandable from task details without requiring a complex graph.

### Saved views

Allow saving useful filter combinations, for example:

- Outdoor tasks this week
- Tasks estimated under 15 minutes
- Waiting/blocked work
- High-priority work tasks

Effort/energy and available time should be usable as explicit filters.

## 11. Destination tasks, trips, and maps

### Location setup

For away-from-home tasks, support:

- Destination search or address entry
- Starting location
- Saved places such as Home and Work
- Current location, requested only with permission
- Travel mode
- Planned departure or desired arrival time
- Preparation and arrival buffers
- Optional return or onward travel

Travel modes include driving, walking, cycling, and public transit where available.

### Travel information

Show:

- Estimated travel duration
- Departure and arrival estimates
- Suggested leave-by time
- Time the estimate was checked
- Relevant uncertainty or unavailable-route feedback
- “Open in Google Maps”

Keep labels explicit that travel durations are estimates.

### Trips / errand groups

Allow grouping multiple away-from-home tasks into an outing.

The group view includes:

- Stops and associated tasks
- Editable stop order
- Route preview
- Travel between stops
- Total outing estimate
- Optional return journey
- Destination notes and “bring this” checklists
- Opening-hours feedback where available

Do not imply automatic route optimization unless it is separately specified later.

### Map view

Show destination markers linked to task cards and an ordered itinerary.

Selecting a marker highlights its task; selecting a task highlights its destination.

Provide a useful list alternative when maps or routing are unavailable.

### Travel-aware scheduling

Flag situations such as appointments that are too far apart to reach on time.

Explain the issue and let the user adjust the plan.

### Example

Dentist at 2:00 PM:

- Estimated drive: 25 minutes
- Arrival buffer: 10 minutes
- Suggested departure: approximately 1:25 PM

Display the travel block in the timeline alongside the appointment.

## 12. Weather integration

Weather is optional task context.

- Outdoor tasks can show weather for their location and planned time.
- Away-from-home tasks use destination weather.
- At-home outdoor tasks can use the saved home location.
- Suggest a better day when conditions appear unsuitable.
- Require user action before rescheduling.

Design states for:

- Forecast available
- Date outside the forecast range
- Missing location
- Loading
- Service unavailable
- Previously retrieved information with its update time

Weather and routing failures must not prevent ordinary task use.

## 13. Timers, capacity, reminders, and availability

### Timers

Distinguish:

- Focus countdown
- Deadline countdown
- Time spent on a task

Show the active timer persistently without dominating the interface.

Support starting, pausing, resuming, and stopping.

A timer should survive refresh or reopening.

Design default: one active focus timer at a time. Starting another offers to stop or switch the current timer.

### Capacity

- Set available task time for a day.
- Compare it with task estimates and applicable travel/preparation time.
- Optionally compare estimated and actual time.
- Avoid double-counting a scheduled task and its estimate.

### Personal availability

Provide recurring availability settings and date-specific adjustments.

Show working hours, breaks, and unavailable periods in the timeline.

### Reminders

- Alerts operate while the app is open.
- Reopening surfaces missed alerts.
- No promise of notifications while the application is closed.

Use a restrained alert pattern with clear dismiss and task-opening actions.

## 14. Reference library, pinned essentials, and daily notes

### Reference library

Support reusable:

- Notes
- Links
- Images and documents
- Checklists

Users can organize, search, preview, and link items from tasks and projects.

Make the distinction between linking a shared reference and copying its content understandable.

### Pinned daily essentials

Provide a compact note/checklist module on Today.

Allow editing, collapsing, and unpinning.

These essentials should remain easy to find without competing with the task list.

### Daily notes and reflection

Each day can contain:

- General notes
- Accomplishments
- Context or reflections
- Its task completion history

Allow browsing previous days.

## 15. End-of-day review and history

### End-of-day review

Show:

- Completed tasks
- Unfinished one-off tasks
- Recurring occurrence outcomes
- Optional daily reflection
- Estimated versus actual time, where recorded

For unfinished tasks, allow bulk or individual choices:

- Tomorrow
- Another date
- Someday
- Leave unchanged
- Archive

Do not silently reschedule tasks.

### History

Provide:

- Completed tasks by day
- Recurring occurrence history
- Task-level activity
- Daily notes
- Reopening completed tasks

Use neutral language.

Avoid streak penalties, guilt-based messages, or competitive scoring.

## 16. Settings, recovery, and appearance

### Settings

Include:

- Light, dark, and system theme
- Comfortable and compact density
- Reduced-motion preference
- Timezone, week start, and day boundary
- Availability
- Saved locations
- Reminder preferences
- Export, backup, and restore

Dates and recurrence should follow the configured timezone and day boundary consistently.

### Recovery

- Immediate undo for appropriate changes
- Trash with restore
- Clear permanent-delete confirmation
- Backup including attachments
- Restore flow with a preview and clear explanation of its effect

Design default: full backup restore replaces the current local workspace after explicit confirmation.

Do not imply merging unless specified later.

### Persistence feedback

- Autosave task and note edits.
- Preserve interrupted drafts.
- Restore the selected day, view, filters, scroll position, and open task when practical.
- Surface save failures clearly with a retry path.

## 17. Responsive and accessibility requirements

### Desktop

Design a primary reference frame around 1440 px wide.

Use the available space for sidebar navigation, task content, and a detail panel or timeline tray.

### Tablet

Show behavior around 1024 px wide, including navigation collapse and panel transitions.

### Mobile

Design a reference around 390 px wide.

- Task detail becomes full-screen.
- Planning steps remain usable.
- Timeline and unscheduled tasks have an explicit switching pattern.
- Board columns remain navigable with their labels and counts visible.
- Map and itinerary can switch without losing selection.
- Bulk selection has clear entry and exit states.

### Accessibility

- Visible keyboard focus
- Logical focus order
- Accessible labels
- Adequate contrast in both themes
- Status conveyed through text and icons, not color alone
- Alternatives to dragging
- Reduced-motion behavior
- Comfortable touch targets
- Clear error messages and recovery actions

## 18. Example content for the designs

Use a connected set of realistic examples:

| Example | Features demonstrated |
|---|---|
| Water balcony plants | At home, outdoor weather, recurring task |
| Read for 20 minutes | Daily recurrence, focus timer |
| Prepare team presentation | Work project, checklist, attachments, deadline, estimate |
| Waiting for contractor quote | Home project, waiting/blocked status, progress note |
| Dentist appointment | Fixed time, destination, travel estimate, arrival buffer |
| Saturday errands | Grocery store, pharmacy, parcel drop-off, route and opening hours |
| Research a bicycle | Someday item, links, notes, resurfacing |
| Replace water filter | Completion-relative recurrence, reusable instructions |
| Sunday reset | Routine containing several household tasks |

Include previous days with incomplete tasks, an older unfinished task, completed history, and an empty future day.

## 19. Required Figma deliverables

Organize the file into:

1. Brief and feature inventory
2. Information architecture and user flows
3. Foundations and reusable components
4. Desktop screens
5. Mobile and tablet adaptations
6. Interaction and state specifications
7. Clickable prototype

### Components

Create reusable components and variants for:

- Task row and board card
- Status, priority, date, tag, and effort indicators
- View switcher and filter controls
- Bulk-selection toolbar
- Task detail sections
- Timeline task and travel blocks
- Unscheduled task tray
- Timer controls
- Capacity indicator
- Weather and route summaries
- Reference and attachment previews
- Empty, loading, error, and unavailable states
- Dialogs, notifications, confirmations, and undo feedback

### Screen coverage

Provide detailed screens for the main daily workflow and sufficient supporting screens to cover every accepted feature.

Show light and dark theme examples and both density options without duplicating every screen unnecessarily.

### Prototype flows

The prototype should demonstrate:

1. Capture a task in Inbox, organize it, and plan it for today.
2. Build a day using recent unfinished tasks, older work, Someday, and a routine.
3. Switch between list, board, and timeline; move a card to In progress.
4. Open a task, add notes and an attachment, run a timer, and complete it.
5. Configure recurrence and distinguish editing one occurrence from future occurrences.
6. Create an away-from-home errand group, review travel/weather, and open directions.
7. Review a day and bulk move or copy selected tasks.
8. Link reference material, delete a task, and restore it.
9. Show how the interface handles unavailable weather or routing.

Annotate interactions that cannot be represented fully in a Figma prototype.

## 20. Boundaries and design defaults

### Explicitly excluded

- Command menu
- Dedicated quick-action feature
- Keyboard shortcuts beyond ordinary accessible interaction
- Accounts, collaboration, assignment, or cross-device synchronization
- Custom board workflows

### Not selected from earlier brainstorming

Do not add these as committed features:

- Dedicated weekly review
- Goals and milestones
- Multiple scheduled work sessions for one task
- Flexible weekly habit targets
- General task backlinks
- Promoting notes into tasks
- Structured completion measurements
- User-created automation rules
- Separate task revisit dates
- Contingency plans
- Automatic disrupted-day replanning
- “Ready to start” recommendations
- Project review cadences
- Flexible scheduling windows
- A resettable sample-workspace product feature

Realistic sample content is still required for the designs.

### Defaults established for this design handoff

These defaults make the design concrete and may be refined during design review:

- One active focus timer at a time.
- Full backup restore replaces the local workspace after confirmation.
- Copied tasks retain useful content but reset completion and progress.
- Groups provide shared location context, with individual task overrides.
- Workload, weather, and scheduling feedback is advisory.
- No automatic task rescheduling or route optimization.

### Handoff acceptance criteria

The design is ready for implementation when:

- Every accepted feature has a clear home.
- The daily workflow is understandable without explanation.
- Shared task behavior is consistent across views.
- Recurrence, copying, moving, and unfinished work are unambiguous.
- Travel features appear in appropriate location contexts.
- Important empty, loading, error, and recovery states are covered.
- Mobile behavior and accessible alternatives are specified.
- The prototype demonstrates complete flows rather than isolated screens.
