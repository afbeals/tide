# Verification record

Verified locally on **2026-10-24**. Tide is a functioning independent POC with persisted data. Automated tests cover the primary feature families and the nine original demo journeys. They do not individually certify all 430 requirements or establish pixel equivalence with all 836 Figma sources.

## Environment

macOS arm64, Node 24.13.0, npm 11, Chromium via Playwright. Browser tests run against the production Next server using a freshly migrated, seeded temporary workspace on port 8777. They do not reset the normal workspace on port 8776. Firefox, Safari/WebKit, Linux containers and the actual Unraid host have not been exercised. Docker is unavailable on this machine; Google API keys were not supplied.

## Results

| Check | Observed result |
|---|---|
| `npm run check` | TypeScript and ESLint passed; **130 core tests passed** across domain, provider, real SQLite/store/API and backup integration suites; coverage gates passed |
| `npm run test:coverage` | **96.15% lines**, 95.05% statements, 94.08% functions, **90.13% branches** across all domain/server/API source |
| `npm run test:stories:coverage` | **149 stories passed** in Chromium with interaction and axe checks; separate component coverage **79.71% lines**, 79.20% statements, 72.84% functions, 73.11% branches |
| `npm run storybook:build` | Standalone Storybook 10 catalog compiled successfully with actual app CSS/fonts and isolated fixtures |
| `npm run test:visual` | **20 screenshot comparisons passed**, using checked-in macOS baselines for themes and desktop/tablet/mobile states |
| `npm run build` | Production compilation, TypeScript and route generation passed |
| `npm run format:check` | All selected source, script, configuration and test files passed Prettier |
| `npm run docs:check` | Local Markdown links, **430 stable requirements**, **836 source mappings**, **834 prototype frames**, and **48 foundation entries** reconciled |
| `npm run test:e2e` | **27 Chromium browser tests passed** against an isolated production server |
| `npm audit --audit-level=low` | **0 vulnerabilities** reported by the installed dependency audit |
| Local production smoke | `npm run db:deploy`, non-destructive `npm run db:seed`, and `npm start` succeeded; `/api/health` and `/api/workspace` returned HTTP 200 |
| Production restart | All **78 existing workspace records** matched exactly before and after stopping/restarting the process |
| Clean-instance restore | A full backup restored into a separately migrated empty workspace; all **78 records** matched, the attachment existed, and subsequent migration deployment resolved the restored generation |
| Scheduler after restart | The restored production server created a successful automatic backup after its first 30-second tick, with **no browser or API requests** |
| Live weather | The real Open-Meteo endpoint returned HTTP 200 with the requested San Francisco forecast through Tide's provider endpoint |

The verification machine uses an existing Chromium executable selected through `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. New machines can install Playwright's browser with `npx playwright install chromium`. See [testing](testing.md).

## Browser and domain coverage

The browser suite exercises real capture and persistence; project-scoped views; separate appearance preferences; mobile navigation and full-screen editors; backup validation and replacement; rich notes and real upload/download; timer reopening and completion; older/Someday/routine planning; references and image previews; Trash restoration; single-occurrence editing and series pause/resume; outing creation, manual estimates and provider fallback; copy previews and undo; concurrent browsers; failed-write draft recovery; independent people's timers; creation and editing of all management types with persisted relationships and signed decimal coordinates; explicit Unassigned ownership; and missed reminders with persistent browser preferences/dismissal.

The nine original flows in the [design brief](original-design-brief.md) map to tests in [planner.spec.ts](../tests/e2e/planner.spec.ts):

| Original flow | Browser evidence |
|---|---|
| Capture → organize → plan | `captures in Inbox and organizes the task into a day and project` |
| Build a day from multiple sources | `plans older and Someday work with selected independent routine templates` |
| Shared List/Board/Timeline and status | `capture, real persistence, shared views, and task details`; responsive timeline cases |
| Notes, attachment, timer and completion | `edits notes, uploads a real file, persists a timer and completes the task` |
| Recurrence scopes | `edits one occurrence, pauses and resumes a series without losing its editor`; store tests for future changes/history |
| Away group and directions | `creates an away group with explicit stops`; `uses an outing, preserves manual planning during provider failure and opens directions` |
| Review and bulk decisions | `reviews a day and applies an explicit bulk decision without restoring old plan members`; bulk copy/undo case |
| References, deletion and recovery | `links a reference, previews an image, and restores a deleted task` |
| Unavailable weather/routing | `shows unavailable weather while keeping task details editable`; outing fallback case |

The coverage expansion adds 23 real SQLite tests for missing relationships, retired-person reassignment, valid outing membership, plan focus invariants, atomic plan/review saves, routine rollback, and deletion safeguards. Seventy-eight additional stories exercise editor conflicts/deleted records, attachments, management saves, timer lifecycle/switch consent, notes autosave/recovery/conflicts, travel/weather/opening hours, outing estimates/reordering, board pointer dragging, filters, bulk operations, references and connection retry. External provider responses are mocked.

Domain/store tests independently check workspace time-zone boundaries and DST, local datetime normalization, capacity overrides, no estimate/schedule double counting, context inheritance, cycle prevention, stale versions, idempotent bulk operations, safe undo, serialized failures, atomic review, independent timers, recurrence scope/pause/relative scheduling, full backup restoration, invalid archives and stale generations.

Responsive checks cover **390, 900, 1024, 1180 and 1440px**. The light and dark theme cases perform six axe audits covering Today, an inspector and Settings, with no detected WCAG A/AA/2.1AA violations in those states. This is automated accessibility evidence, not a complete manual assistive-technology audit.

Selected test captures are preserved in [screenshots](screenshots/): [mobile](screenshots/layout-390.png), [tablet](screenshots/layout-900.png), [desktop](screenshots/layout-1440.png), [light](screenshots/theme-light.png) and [dark](screenshots/theme-dark.png). Captures show the isolated verification workspace after test interactions, not the user's normal workspace.

## Coverage and automation limits

Core gates require 95% lines, 94% statements, 90% functions and 88% branches. Storybook independently requires 75% lines/statements and 70% functions/branches. Component coverage does not include the additional UI behavior exercised by production E2E. Neither report is a whole-application percentage. Coverage includes all files within each declared scope.

The checks found and fixed tablet navigation accessible names, stale notes-formatting button state, malformed JSON incorrectly returning a server error, and an upload failure escaping the JSON error handler. Expanded stories also found and fixed keyboard-inaccessible conflict comparison scrolling and low-contrast timeline availability/event labels. Backup tests also verify damaged archives cannot change active data, retention, scheduler recovery and partial-file cleanup.

GitHub Actions is configured for Linux quality/E2E and macOS visual comparisons, with coverage/Storybook/report artifacts. The results above are local; check the pull request for hosted CI results. Visual baselines were inspected locally; the hosted macOS runner may require review for OS rendering differences. See [testing and Storybook](testing.md) for contributor commands and limits.

## Outstanding acceptance and operational checks

| Requirement | Remaining work |
|---|---|
| **18.15** Google browser key restrictions | Supply real keys; inspect allowed browser origins, API restrictions, billing and Cloud quotas. Live Maps, Places, opening hours, Routes and traffic/arrival behavior remain unverified. Real adapters and manual fallback are implemented. |
| **24.01** Linux amd64 image | Build/run the supplied Docker image on a host with Docker; check the native SQLite module, health check, safe migrations and volume persistence. No image was published. |
| **24.08** Unraid LAN HTTP | Verify actual port/volume mapping, permissions, LAN access and container restart on Unraid. Geolocation generally needs HTTPS; saved/manual locations remain available on LAN HTTP. |

The checklist tracks implementation separately from acceptance. The feature register gives each requirement code/document destinations and evidence scope. Most evidence is at feature-family level; full manual acceptance of every requirement, Figma state and preference combination remains a further review. All source/prototype nodes are inventoried and mapped; each source is explicitly marked as awaiting per-node visual acceptance.

The local production application is available at **http://localhost:8776** while its process is running. Deployment to the target host remains a separate operational check. Use the [demo walkthrough](demo.md) and [Unraid guide](deploy-unraid.md) for the next environment.
