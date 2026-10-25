# Implementation checklist

Checkboxes track implementation, not exhaustive acceptance. All 430 stable requirements are retained. The [machine-readable register](feature-register.json) records implementation files, evidence and verification status for every item. Automated evidence is grouped by feature family; a checked box does not claim a separate test or pixel comparison for that item.

Unresolved operational checks remain open below. See the [verification record](verification.md) for commands, results and limits.

## 01. Requirements and coverage

Implementation: [feature-register.json](feature-register.json), [figma-inventory.json](figma-inventory.json), [screen-build-map.md](screen-build-map.md).

- [x] **01.01** Preserve accepted features and exclusions
- [x] **01.02** Maintain feature register
- [x] **01.03** Maintain comprehensive checklist
- [x] **01.04** Index all 836 source entries
- [x] **01.05** Index all 834 prototype frames
- [x] **01.06** Account for 48 foundations
- [x] **01.07** Use node IDs as identifiers
- [x] **01.08** Distinguish duplicate water-filter names
- [x] **01.09** Record responsive counterparts
- [x] **01.10** Record superseded designs
- [x] **01.11** Record verification evidence
- [x] **01.12** Reconcile coverage before completion

## 02. Project foundation

Implementation: [package.json](../package.json), [schema.prisma](../prisma/schema.prisma), [db.ts](../src/server/db.ts).

- [x] **02.01** Initialize independent Tide repository
- [x] **02.02** Pin Node 24 and stable dependencies
- [x] **02.03** Configure Next 16 React 19 TypeScript
- [x] **02.04** Use one npm lockfile
- [x] **02.05** Configure Prisma 7 and SQLite WAL
- [x] **02.06** Apply migrations
- [x] **02.07** Persist database and attachments
- [x] **02.08** Configure typed domain services
- [x] **02.09** Provide development build lint typecheck and test scripts
- [x] **02.10** Expose health endpoint
- [x] **02.11** Verify process restart persistence

## 03. Shared data and APIs

Implementation: [types.ts](../src/lib/types.ts), [domain.ts](../src/lib/domain.ts), [store.ts](../src/server/store.ts), [workspace.tsx](../src/components/workspace.tsx).

- [x] **03.01** Use one shared workspace
- [x] **03.02** Give people stable IDs
- [x] **03.03** Support optional ownership and Unassigned
- [x] **03.04** Keep four shared statuses
- [x] **03.05** Separate planned date start deadline and schedule
- [x] **03.06** Model projects areas tags estimates and effort
- [x] **03.07** Model rich notes checklists files and references
- [x] **03.08** Model dependencies and blocking notes
- [x] **03.09** Model series and occurrence outcomes
- [x] **03.10** Model reusable routines
- [x] **03.11** Model outings and ordered stops
- [x] **03.12** Model per-person plans notes essentials availability and timers
- [x] **03.13** Validate all writes
- [x] **03.14** Detect version conflicts
- [x] **03.15** Make bulk writes idempotent
- [x] **03.16** Refresh visible tabs
- [x] **03.17** Distinguish local drafts from server data

## 04. Visual system

Implementation: [globals.css](../src/app/globals.css), [calendar.css](../src/app/calendar.css), [ui.tsx](../src/components/ui.tsx), [TaskViews.tsx](../src/components/TaskViews.tsx).

- [x] **04.01** Apply Tide Desk Ink and amber identity
- [x] **04.02** Use IBM Plex Sans
- [x] **04.03** Implement tokens spacing borders and corners
- [x] **04.04** Support Light Dark System themes
- [x] **04.05** Keep density independent of theme
- [x] **04.06** Support reduced motion
- [x] **04.07** Build task rows and board cards
- [x] **04.08** Build owner status priority date tag effort indicators
- [x] **04.09** Build filters search and view switchers
- [x] **04.10** Build bulk toolbar
- [x] **04.11** Build detail sections
- [x] **04.12** Build timeline and travel blocks
- [x] **04.13** Build timer and capacity components
- [x] **04.14** Build reference attachment and provider summaries
- [x] **04.15** Build form fields dialogs notices and recovery states

## 05. Shell and responsiveness

Implementation: [Tide.tsx](../src/components/Tide.tsx), [TaskPanel.tsx](../src/components/TaskPanel.tsx), [ui.tsx](../src/components/ui.tsx), [globals.css](../src/app/globals.css).

- [x] **05.01** Build all primary and supporting navigation
- [x] **05.02** Provide Add task and search
- [x] **05.03** Show person context
- [x] **05.04** Show active timers
- [x] **05.05** Preserve date person project filters view selection and scroll
- [x] **05.06** Support browser back and forward
- [x] **05.07** Handle unavailable selected records
- [x] **05.08** Use 200px sidebar above 1280
- [x] **05.09** Use 72px rail at tablet widths
- [x] **05.10** Dock inspector above 1024
- [x] **05.11** Overlay 352px inspector at 768–1023
- [x] **05.12** Use full-screen mobile details and editors
- [x] **05.13** Keep inspector scrolling independent
- [x] **05.14** Keep Close visible
- [x] **05.15** Contain overlay focus and restore it
- [x] **05.16** Support Escape dismissal
- [x] **05.17** Keep mobile editor actions visible
- [x] **05.18** Wrap long content
- [x] **05.19** Navigate mobile board columns
- [x] **05.20** Switch timeline and tray
- [x] **05.21** Switch map and itinerary
- [x] **05.22** Provide mobile bulk entry and exit

## 06. People and ownership

Implementation: [Tide.tsx](../src/components/Tide.tsx), [TaskPanel.tsx](../src/components/TaskPanel.tsx), [EntityEditor.tsx](../src/components/EntityEditor.tsx), [store.ts](../src/server/store.ts).

- [x] **06.01** Select planning person
- [x] **06.02** Show All people overview
- [x] **06.03** Create people
- [x] **06.04** Rename people
- [x] **06.05** Retire people with retained history
- [x] **06.06** Keep person selection separate from authentication
- [x] **06.07** Allow all users to inspect and edit
- [x] **06.08** Keep Unassigned available
- [x] **06.09** Filter owners across views
- [x] **06.10** Select reassign and remove owners
- [x] **06.11** Explain plan and focus removal
- [x] **06.12** Preserve task content dates and status during reassignment
- [x] **06.13** Offer explicit new-owner planning
- [x] **06.14** Do not transfer timers
- [x] **06.15** Require explicit ownership for per-person planning
- [x] **06.16** Show each person capacity focus notes essentials and timer

## 07. Capture and task detail

Implementation: [EntityEditor.tsx](../src/components/EntityEditor.tsx), [TaskPanel.tsx](../src/components/TaskPanel.tsx), [RichText.tsx](../src/components/RichText.tsx), [route.ts](../src/app/api/[...path]/route.ts).

- [x] **07.01** Require only title
- [x] **07.02** Create from Inbox day project and routine
- [x] **07.03** Expose creation context
- [x] **07.04** Preserve interrupted drafts
- [x] **07.05** Organize captured work
- [x] **07.06** Edit all identity fields
- [x] **07.07** Edit all separate date fields
- [x] **07.08** Distinguish fixed and flexible tasks
- [x] **07.09** Allow untimed work
- [x] **07.10** Edit rich notes and links
- [x] **07.11** Add reorder complete and remove checklist items
- [x] **07.12** Show checklist progress
- [x] **07.13** Upload files and images
- [x] **07.14** Show upload progress failure and retry
- [x] **07.15** Preview images and supported files
- [x] **07.16** Handle missing attachments
- [x] **07.17** Link reference material
- [x] **07.18** Show activity
- [x] **07.19** Copy move archive and delete
- [x] **07.20** Autosave notes
- [x] **07.21** Show accurate save feedback
- [x] **07.22** Preserve failed drafts

## 08. Dependencies

Implementation: [TaskPanel.tsx](../src/components/TaskPanel.tsx), [domain.ts](../src/lib/domain.ts), [store.ts](../src/server/store.ts).

- [x] **08.01** Search prerequisites
- [x] **08.02** Add and remove prerequisites
- [x] **08.03** Prevent self-dependencies
- [x] **08.04** Prevent dependency cycles
- [x] **08.05** Edit blocking notes
- [x] **08.06** Show dependency status
- [x] **08.07** Filter blocked work
- [x] **08.08** Reflect prerequisite changes
- [x] **08.09** Handle missing prerequisites

## 09. Views and filtering

Implementation: [TaskViews.tsx](../src/components/TaskViews.tsx), [EntityEditor.tsx](../src/components/EntityEditor.tsx), [domain.ts](../src/lib/domain.ts).

- [x] **09.01** Implement scoped List Board Timeline
- [x] **09.02** Share task records across views
- [x] **09.03** Preserve scope and selection
- [x] **09.04** Keep board counts consistent
- [x] **09.05** Drag between four statuses
- [x] **09.06** Provide status selector alternative
- [x] **09.07** Do not change dates when changing status
- [x] **09.08** Provide non-drag scheduling
- [x] **09.09** Distinguish fixed flexible travel and unavailable time
- [x] **09.10** Keep untimed tray
- [x] **09.11** Show advisory overlaps
- [x] **09.12** Search tasks
- [x] **09.13** Filter owner status priority dates project area tags effort context and minutes
- [x] **09.14** Sort and show active filters
- [x] **09.15** Handle no results

## 10. Today and planning

Implementation: [Tide.tsx](../src/components/Tide.tsx), [Planning.tsx](../src/components/Planning.tsx), [store.ts](../src/server/store.ts), [domain.ts](../src/lib/domain.ts).

- [x] **10.01** Navigate dates
- [x] **10.02** Show daily summary
- [x] **10.03** Choose at most three focus tasks
- [x] **10.04** Show per-person essentials and notes
- [x] **10.05** Compare workload and capacity
- [x] **10.06** Show relevant travel and weather
- [x] **10.07** Collapse completed work
- [x] **10.08** Show empty day
- [x] **10.09** Show prior three days unfinished separately
- [x] **10.10** Show original planned dates
- [x] **10.11** Add recent work to today
- [x] **10.12** Choose another day or Someday
- [x] **10.13** Keep older unfinished work discoverable
- [x] **10.14** Never auto-roll unfinished work
- [x] **10.15** Review already planned recent older project Someday recurrence and routine sources
- [x] **10.16** Select multiple tasks
- [x] **10.17** Order tasks
- [x] **10.18** Choose focus
- [x] **10.19** Optionally group untimed work
- [x] **10.20** Assign optional time slots and estimates
- [x] **10.21** Review dependencies capacity overlaps deadlines weather and travel
- [x] **10.22** Keep warnings advisory
- [x] **10.23** Preserve interrupted planning
- [x] **10.24** Save atomically and return to context
- [x] **10.25** Avoid estimate and scheduled-duration double counting

## 11. Availability notes and essentials

Implementation: [EntityEditor.tsx](../src/components/EntityEditor.tsx), [Planning.tsx](../src/components/Planning.tsx), [Tide.tsx](../src/components/Tide.tsx), [domain.ts](../src/lib/domain.ts).

- [x] **11.01** Edit recurring availability per person
- [x] **11.02** Choose weekdays hours and breaks
- [x] **11.03** Validate periods and overlap
- [x] **11.04** Calculate capacity
- [x] **11.05** Override individual dates without changing recurring hours
- [x] **11.06** Show availability on timeline
- [x] **11.07** Edit daily notes
- [x] **11.08** Browse previous notes
- [x] **11.09** Record reflection and accomplishments
- [x] **11.10** Edit checklists for essentials
- [x] **11.11** Collapse and unpin essentials
- [x] **11.12** Keep per-person content separate

## 12. Upcoming Someday and bulk

Implementation: [Tide.tsx](../src/components/Tide.tsx), [domain.ts](../src/lib/domain.ts), [store.ts](../src/server/store.ts).

- [x] **12.01** Navigate upcoming week
- [x] **12.02** Distinguish appointments recurrence deadlines and planned work
- [x] **12.03** Move between days
- [x] **12.04** Search and filter Someday
- [x] **12.05** Show age or last review
- [x] **12.06** Schedule retain and archive Someday
- [x] **12.07** Surface older Someday during planning
- [x] **12.08** Select multiple tasks
- [x] **12.09** Choose explicit Copy or Move
- [x] **12.10** Choose destination day
- [x] **12.11** Preview retained and reset fields
- [x] **12.12** Clear scheduled times consistently
- [x] **12.13** Preserve identity and history on move
- [x] **12.14** Create independent copies
- [x] **12.15** Reset checklist completion reminders and progress
- [x] **12.16** Do not copy timer logs
- [x] **12.17** Confirm result
- [x] **12.18** Offer appropriate undo
- [x] **12.19** Prevent duplicate retries

## 13. Recurrence

Implementation: [EntityEditor.tsx](../src/components/EntityEditor.tsx), [TaskPanel.tsx](../src/components/TaskPanel.tsx), [store.ts](../src/server/store.ts), [domain.ts](../src/lib/domain.ts).

- [x] **13.01** Support daily recurrence
- [x] **13.02** Support selected weekdays
- [x] **13.03** Support weekly and custom RRULE
- [x] **13.04** Support completion-relative recurrence
- [x] **13.05** Support start date
- [x] **13.06** Support never date and count ends
- [x] **13.07** Distinguish series from occurrence
- [x] **13.08** Track outcomes individually
- [x] **13.09** Complete an occurrence only
- [x] **13.10** Skip occurrence
- [x] **13.11** Preserve done missed and skipped history
- [x] **13.12** Do not accumulate overdue copies
- [x] **13.13** Edit one occurrence
- [x] **13.14** Edit this and future scope
- [x] **13.15** Keep previous outcomes
- [x] **13.16** Pause future generation
- [x] **13.17** Resume without paused backlog
- [x] **13.18** Schedule relative next date from completion
- [x] **13.19** Prevent duplicate generation
- [x] **13.20** Respect timezone day boundary and DST

## 14. Routines projects and saved views

Implementation: [EntityEditor.tsx](../src/components/EntityEditor.tsx), [Tide.tsx](../src/components/Tide.tsx), [Planning.tsx](../src/components/Planning.tsx), [store.ts](../src/server/store.ts).

- [x] **14.01** Browse and preview routines
- [x] **14.02** Create and edit routines
- [x] **14.03** Add edit remove templates
- [x] **14.04** Edit template estimate effort context notes and checklist
- [x] **14.05** Order templates with buttons
- [x] **14.06** Select templates
- [x] **14.07** Choose person and day
- [x] **14.08** Preview and confirm application
- [x] **14.09** Keep applied tasks independent
- [x] **14.10** Browse areas and projects
- [x] **14.11** Create edit area
- [x] **14.12** Create edit project
- [x] **14.13** Set purpose target date notes and references
- [x] **14.14** Separate project target and task deadline
- [x] **14.15** Show counts blocked and completed work
- [x] **14.16** Preserve project scope
- [x] **14.17** Access archived content
- [x] **14.18** Create saved filters
- [x] **14.19** Open edit rename and delete saved views
- [x] **14.20** Include time effort context and ownership filters
- [x] **14.21** Handle empty saved views

## 15. Reference library

Implementation: [Tide.tsx](../src/components/Tide.tsx), [EntityEditor.tsx](../src/components/EntityEditor.tsx), [TaskPanel.tsx](../src/components/TaskPanel.tsx), [seed.ts](../scripts/seed.ts).

- [x] **15.01** Browse organize and search references
- [x] **15.02** Create note link file image and checklist types
- [x] **15.03** Provide type-specific editing
- [x] **15.04** Preview attachments
- [x] **15.05** Replace uploaded material
- [x] **15.06** Preserve failed drafts
- [x] **15.07** Search and explicitly select target task
- [x] **15.08** Link to task and project
- [x] **15.09** Copy independent content
- [x] **15.10** Explain copy versus shared link
- [x] **15.11** Preserve selected reference
- [x] **15.12** Open item-specific details
- [x] **15.13** Implement outline bicycle insurance reset and water-filter examples
- [x] **15.14** Reflect shared edits without changing copied material
- [x] **15.15** Handle missing links

## 16. Timers and reminders

Implementation: [TaskPanel.tsx](../src/components/TaskPanel.tsx), [Tide.tsx](../src/components/Tide.tsx), [store.ts](../src/server/store.ts).

- [x] **16.01** Configure focus duration
- [x] **16.02** Start pause resume stop
- [x] **16.03** Persist timestamps
- [x] **16.04** Record actual time
- [x] **16.05** Separate focus deadline and elapsed time
- [x] **16.06** Allow one active timer per person
- [x] **16.07** Confirm timer switch
- [x] **16.08** Allow independent people timers
- [x] **16.09** Keep timers on context change
- [x] **16.10** Synchronize browsers
- [x] **16.11** Prevent concurrent duplicate active timers
- [x] **16.12** Edit reminder time
- [x] **16.13** Store browser preferences
- [x] **16.14** Alert while open
- [x] **16.15** Surface missed alerts
- [x] **16.16** Dismiss and open reminders
- [x] **16.17** Explain closed-app limitation

## 17. Places travel and outings

Implementation: [Travel.tsx](../src/components/Travel.tsx), [EntityEditor.tsx](../src/components/EntityEditor.tsx), [TaskViews.tsx](../src/components/TaskViews.tsx), [providers.ts](../src/server/providers.ts).

- [x] **17.01** Support Home Away Anywhere and inherited context
- [x] **17.02** Allow task overrides
- [x] **17.03** Restrict travel to away context
- [x] **17.04** Manage saved Home Work and other places
- [x] **17.05** Search and manually enter addresses
- [x] **17.06** Choose start location
- [x] **17.07** Request device location explicitly
- [x] **17.08** Handle denied and insecure-context location
- [x] **17.09** Choose driving walking cycling transit where supported
- [x] **17.10** Choose departure or arrival
- [x] **17.11** Include preparation arrival buffers and return travel
- [x] **17.12** Show estimates and checked time
- [x] **17.13** Calculate approximate driving leave-by
- [x] **17.14** Open Google directions
- [x] **17.15** Create outings
- [x] **17.16** Associate tasks and stops
- [x] **17.17** Order stops manually
- [x] **17.18** Show between-stop travel and total duration
- [x] **17.19** Add destination notes and bring checklist
- [x] **17.20** Show opening hours when available
- [x] **17.21** Link markers and selected tasks
- [x] **17.22** Preserve map selection
- [x] **17.23** Show travel blocks
- [x] **17.24** Flag travel conflicts
- [x] **17.25** Offer itinerary and manual estimates
- [x] **17.26** Do not optimize route automatically

## 18. Weather and providers

Implementation: [providers.ts](../src/server/providers.ts), [Travel.tsx](../src/components/Travel.tsx), [EntityEditor.tsx](../src/components/EntityEditor.tsx), [integrations.md](integrations.md).

- [x] **18.01** Configure Google services
- [x] **18.02** Use Open-Meteo weather
- [x] **18.03** Support outdoor context at Home and Away
- [x] **18.04** Use destination or Home coordinates
- [x] **18.05** Request relevant forecast
- [x] **18.06** Show checked time
- [x] **18.07** Suggest improved day with explicit reschedule
- [x] **18.08** Handle missing location
- [x] **18.09** Handle outside forecast range
- [x] **18.10** Handle loading unavailable stale and quota states
- [x] **18.11** Show Google not configured
- [x] **18.12** Show unsupported travel mode
- [x] **18.13** Apply request controls
- [x] **18.14** Protect credentials
- [ ] **18.15** Restrict browser map key — Configure and inspect Google Cloud browser-key API and HTTP-referrer restrictions after supplying a real key.
- [x] **18.16** Respect provider storage limits
- [x] **18.17** Keep tasks usable during failure

## 19. Review history and Trash

Implementation: [Planning.tsx](../src/components/Planning.tsx), [Tide.tsx](../src/components/Tide.tsx), [TaskPanel.tsx](../src/components/TaskPanel.tsx), [store.ts](../src/server/store.ts).

- [x] **19.01** Review desktop and mobile
- [x] **19.02** Show completed unfinished recurring and estimate-versus-actual outcomes
- [x] **19.03** Record reflection
- [x] **19.04** Explicitly choose tomorrow another day Someday archive or unchanged
- [x] **19.05** Support individual and bulk decisions
- [x] **19.06** Do not move other work
- [x] **19.07** Browse by day
- [x] **19.08** Open activity
- [x] **19.09** Reopen completed tasks
- [x] **19.10** Keep archive delete and skip distinct
- [x] **19.11** Restore Trash records
- [x] **19.12** Confirm permanent delete
- [x] **19.13** Handle reference relationships
- [x] **19.14** Offer reversible undo
- [x] **19.15** Make undo conflict-aware
- [x] **19.16** Use neutral language

## 20. Settings and connection recovery

Implementation: [workspace.tsx](../src/components/workspace.tsx), [EntityEditor.tsx](../src/components/EntityEditor.tsx), [TaskPanel.tsx](../src/components/TaskPanel.tsx), [Planning.tsx](../src/components/Planning.tsx).

- [x] **20.01** Configure appearance density motion and workspace dates
- [x] **20.02** Distinguish shared and browser settings
- [x] **20.03** Persist preferences
- [x] **20.04** Show field validation
- [x] **20.05** Show saving before success
- [x] **20.06** Only label server acceptance Saved
- [x] **20.07** Label local drafts accurately
- [x] **20.08** Preserve interrupted editors notes and planning
- [x] **20.09** Detect disconnect
- [x] **20.10** Do not promise full offline editing
- [x] **20.11** Reconnect and retry
- [x] **20.12** Preserve failed input
- [x] **20.13** Compare concurrent server and draft versions
- [x] **20.14** Choose server or reviewed draft
- [x] **20.15** Require explicit replacement
- [x] **20.16** Recheck current version
- [x] **20.17** Never silently merge
- [x] **20.18** Recover changed deleted or restored-record drafts

## 21. Backups and restore

Implementation: [backups.ts](../src/server/backups.ts), [instrumentation.ts](../src/instrumentation.ts), [Backups.tsx](../src/components/Backups.tsx), [db.ts](../src/server/db.ts), [route.ts](../src/app/api/[...path]/route.ts).

- [x] **21.01** Export JSON and CSV
- [x] **21.02** Explain export limits
- [x] **21.03** Create full manual backup
- [x] **21.04** Include all records and attachments
- [x] **21.05** Configure automatic schedule
- [x] **21.06** Support daily and selected weekdays
- [x] **21.07** Use workspace timezone
- [x] **21.08** Default 03:00
- [x] **21.09** Retain seven daily four weekly three safety backups
- [x] **21.10** Show last next history running success failure and download
- [x] **21.11** Retry failures
- [x] **21.12** Keep tasks usable during backup
- [x] **21.13** Create consistent snapshot
- [x] **21.14** Handle storage failure
- [x] **21.15** Resume scheduler after restart
- [x] **21.16** Upload backup
- [x] **21.17** Validate paths checksums database and files
- [x] **21.18** Reject invalid incompatible archives
- [x] **21.19** Preview contents
- [x] **21.20** Confirm all-people replacement
- [x] **21.21** Create safety backup
- [x] **21.22** Suspend editing
- [x] **21.23** Preserve local drafts
- [x] **21.24** Stage full generation
- [x] **21.25** Switch active manifest atomically
- [x] **21.26** Show maintenance progress reconnection success failure
- [x] **21.27** Recover usable workspace
- [x] **21.28** Invalidate stale caches
- [x] **21.29** Review post-restore drafts
- [x] **21.30** Restore into clean instance

## 22. Accessibility and shared states

Implementation: [ui.tsx](../src/components/ui.tsx), [TaskPanel.tsx](../src/components/TaskPanel.tsx), [globals.css](../src/app/globals.css), [EntityEditor.tsx](../src/components/EntityEditor.tsx).

- [x] **22.01** Label controls
- [x] **22.02** Show keyboard focus
- [x] **22.03** Use logical focus order
- [x] **22.04** Support ordinary keyboard navigation
- [x] **22.05** Offer drag alternatives
- [x] **22.06** Convey status beyond color
- [x] **22.07** Verify both-theme contrast
- [x] **22.08** Use 44px mobile touch targets
- [x] **22.09** Announce status and errors
- [x] **22.10** Associate validation
- [x] **22.11** Restore useful focus
- [x] **22.12** Cover initial loading empty populated filtered-empty failure
- [x] **22.13** Cover editor empty filled invalid saving saved failed retry
- [x] **22.14** Handle long and missing content
- [x] **22.15** Honor reduced motion

## 23. Verification and demo

Implementation: [domain.test.ts](../tests/domain.test.ts), [store.test.ts](../tests/store.test.ts), [planner.spec.ts](../tests/e2e/planner.spec.ts), [verification.md](verification.md).

- [x] **23.01** Verify all nine original journeys
- [x] **23.02** Verify ownership and Unassigned flow
- [x] **23.03** Verify independent people timers and plans
- [x] **23.04** Verify management forms with real writes
- [x] **23.05** Verify concurrent browsers
- [x] **23.06** Verify draft recovery
- [x] **23.07** Verify backup restore
- [x] **23.08** Verify timezone boundary DST
- [x] **23.09** Verify reopened timers and reminders
- [x] **23.10** Verify idempotent bulk
- [x] **23.11** Compare 390 900 1024 1180 1440 layouts
- [x] **23.12** Verify theme density combinations
- [x] **23.13** Run domain integration and browser tests
- [x] **23.14** Record evidence
- [x] **23.15** Reconcile every source

## 24. Docker Unraid and operations

Implementation: [Dockerfile](../Dockerfile), [docker-compose.yml](../docker-compose.yml), [entrypoint.sh](../docker/entrypoint.sh), [docker.mjs](../scripts/docker.mjs), [active-database.mjs](../scripts/active-database.mjs), [seed.ts](../scripts/seed.ts), [deploy-unraid.md](deploy-unraid.md).

- [ ] **24.01** Build Linux amd64 image — Docker is unavailable on this machine; build and run the supplied Linux amd64 image on a Docker host.
- [x] **24.02** Provide versioned and latest tags
- [x] **24.03** Default port 8776
- [x] **24.04** Mount Unraid appdata at /app/data
- [x] **24.05** Persist database files and backups
- [x] **24.06** Run safe startup migrations
- [x] **24.07** Provide health checks
- [ ] **24.08** Verify LAN HTTP — Verify port mapping, volume permissions, LAN HTTP and restart behavior on the actual Unraid host.
- [x] **24.09** Document geolocation limitation
- [x] **24.10** Document configuration install upgrade rollback and recovery
- [x] **24.11** Seed realistic demo deliberately
- [x] **24.12** Include multiple people unfinished completed and empty future examples
- [x] **24.13** Verify running production app
- [x] **24.14** Record Docker verification limitations honestly

## 25. Documentation and handoff

Implementation: [README.md](../README.md), [README.md](README.md), [verification.md](verification.md), [check-docs.mjs](../scripts/check-docs.mjs).

- [x] **25.01** Write root README
- [x] **25.02** Write documentation index
- [x] **25.03** Document setup development architecture database API state and workspace
- [x] **25.04** Document planning and styling
- [x] **25.05** Document integrations and tests
- [x] **25.06** Document Unraid and backup restoration
- [x] **25.07** Preserve full feature register checklist and Figma mapping
- [x] **25.08** Document demo and known limitations
- [x] **25.09** Validate links commands and examples
- [x] **25.10** Keep implemented and planned behavior distinct
- [x] **25.11** Update docs with changes
