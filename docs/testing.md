# Testing and Storybook

Tide uses Vitest for core logic and real SQLite/API integration tests, Storybook with browser interaction/accessibility tests for components, and Playwright for production journeys and screenshot comparisons. No Pineapple or Airbnb tooling is required.

## Setup and commands

Use Node 24 and the committed npm lockfile. Run `npm ci`, `npm run db:generate`, then `npx playwright install chromium`. Linux may need `npx playwright install --with-deps chromium`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` only when using an existing compatible Chromium installation.

| Command | Purpose |
|---|---|
| `npm run check` | Generate Next types, check TypeScript, lint, run core tests and enforce core coverage gates |
| `npm run test:coverage` | Core tests and terminal/HTML/JSON/LCOV reports in `coverage/core/` |
| `npm run storybook` | Interactive component catalog at http://localhost:6006 |
| `npm run test:stories` | Render every story in Chromium; run interactions and axe checks |
| `npm run test:stories:coverage` | Same checks with component coverage/gates in `coverage/components/` |
| `npm run storybook:build` | Build the standalone catalog into `storybook-static/` |
| `npm run test:visual` | Compare built stories against checked-in screenshot baselines |
| `npm run test:visual:update` | Explicitly generate/update baselines for review |
| `npm run test:e2e` | Build production once, then run persisted browser journeys |
| `npm run format:check` | Check source, tests, Storybook and tooling formatting |
| `npm run docs:check` | Check documentation links, requirements and Figma inventories |

Story tests start their own Vite browser environment. They need no app/Storybook server, Google keys or user database. Screenshot tests start a loopback-only static server on 6007; build Storybook first. E2E owns port 8777. Keep those test ports free.

The production browser suite also visits `http://tide.test:8777`, which Chromium resolves to loopback through a test-only host rule. Its browser origin remains insecure, matching Unraid LAN HTTP. The test verifies that `crypto.randomUUID` is absent, then checks startup, task/checklist creation, copying with a valid operation UUID, and persistence after reload. No machine or router DNS changes are needed.

## Coverage scope and gates

| Suite | Instrumented source | Lines | Statements | Functions | Branches |
|---|---|---:|---:|---:|---:|
| Core | All `src/lib/**/*.ts`, `src/server/**/*.ts`, API route handlers | 95% | 94% | 90% | 88% |
| Storybook | All `src/components/**/*.tsx`, including unvisited components | 75% | 75% | 70% | 70% |

These are separate reports, not a whole-application percentage. Component coverage measures isolated story runs; production E2E exercises additional UI paths but is not included in either percentage. The gates were raised after adding recovery, successful saves and failure interactions; they protect the expanded suite. Passing coverage does not individually certify every feature or Figma state.

The current 133 core tests measure 96.17% lines and 90.13% branches; 149 Storybook stories measure 79.70% component lines and 73.11% branches. These replace the earlier 107-test/71-story baseline (92.51% core lines and 50.63% component lines).

Open `coverage/core/index.html` or `coverage/components/index.html` after the corresponding command. Adding untested files within the declared scopes lowers coverage. Do not exclude new business logic, weaken gates or add assertions that merely repeat implementation to pass.

## What the tests protect

- Domain: time zones, day boundaries, DST, overnight recurrence, exclusions, filters, ordering, inherited context and capacity.
- Store/HTTP: real migrations/persistence, dependency cycles, owner/plan invariants, stale versions/generations, origin checks, validation, idempotent bulk/routine operations, undo, atomic review, independent timers, actual attachment bytes and safe exports.
- Providers: server-only credentials, field masks, disabled/missing configuration, serialized quotas and day rollover, travel modes, arrival estimates, forecast caching and recoverable failures. External HTTP is mocked.
- Backups: real ZIP/SQLite snapshots and restore, checksum/path/schema rejection, preserved active data on failure, partial-file cleanup, retention, interrupted-process recovery and scheduling without browser traffic.
- Components: validation, pending/failed saves, editor conflict comparison/review, deleted-record recovery, management-form payloads, file upload/removal, checklist/routine ordering, completion, board pointer dragging/status failures, keyboard-accessible comparison panels, notes formatting/safe links/autosave/recovery, timer lifecycle/switch confirmation, owner/plan confirmation, review decisions, bulk consent/failure retention, reference linking/copying, filters/preferences, connection retry, route/weather/opening-hours responses and manual directions fallback.
- Production journeys: actual navigation and persistence across List/Board/Timeline, management editors, planning, routines/references, notes/files/timers, recurrence, outings, bulk decisions, independent browsers, reminders, draft recovery and backup replacement. Responsive checks cover 390, 900, 1024, 1180 and 1440px.

Node integration tests migrate SQLite inside disposable temporary directories and remove only their own data. The production browser server likewise creates/deletes its own database and uploaded files. Neither resets the normal `data/` workspace.

## Storybook catalog

Stories render real app components, workspace/query providers and application CSS/fonts. The toolbar switches themes and density. Next navigation uses App Router mocks; full navigation is tested in E2E.

| Story file | Examples |
|---|---|
| [Primitives](../src/stories/Primitives.stories.tsx) | Statuses, empty/validation states, checklist, notes and confirmation modal |
| [Tasks](../src/stories/Tasks.stories.tsx) | Row states, long titles, selection, completion, list, board and timeline |
| [Editors](../src/stories/Editors.stories.tsx) | Tasks and all management record types; save/recovery/error states |
| [Planning](../src/stories/Planning.stories.tsx) | Selection, shaping payloads, capacity, restored drafts, atomic saves/failures, routines and day review |
| [Workspace](../src/stories/Workspace.stories.tsx) | Today, Upcoming, Inbox, All Tasks, Board, Timeline, Someday, projects, saved views, routines, library, outings, history, Trash, settings, backups, inspectors and empty workspace |
| [Workflows](../src/stories/Workflows.stories.tsx) | Inspector, ownership, daily content/review, routine selection, backups and travel/weather fallback |
| [Editor save/recovery](../src/stories/EditorFlows.stories.tsx) | Conflicts, keyboard comparison, deleted records, restored drafts, all management save payloads, uploads, Google place selection, recurrence and dependencies |
| [Inspector recovery](../src/stories/Inspector.stories.tsx) | Timers, switch consent/failure, recovered notes, autosave/conflict recovery, recurrence scope and reassignment with a plan |
| [Travel](../src/stories/Travel.stories.tsx) | Route/forecast/opening-hours responses, reschedule consent, location denial, outing legs/return/conflict, map fallback and stop/checklist edits |
| [Backup recovery](../src/stories/Backups.stories.tsx) | Empty/failed history, retry, invalid archive, restore preview/consent/cancel/interruption, missing downloads |
| [Workspace interactions](../src/stories/WorkspaceFlows.stories.tsx) | Filters/saved views, appearance/reminders, bulk preview/confirmation/failure, references, Trash, loading/connection retry and deletion consent |

[Fixtures](../src/stories/fixtures.ts) use a fixed date and fake people/tasks. MSW intercepts `/api/` requests and resets state between stories; unhandled API calls fail instead of reaching a workspace. The Google browser key is forced empty. Stories never call paid Google services. The generated worker lives in `.storybook/public/`, separate from application public assets.

Add stories for meaningful new component states. Use `play` to interact through accessible roles/labels and assert visible behavior, accepted payloads or callbacks. Use real components/providers and mock network boundaries. Axe checks fail stories on detected WCAG A/AA/2.1AA violations; they do not replace keyboard or assistive-technology review.

## Screenshot comparisons

Twenty checked-in baselines cover themes, desktop/tablet/mobile Today, Board, desktop/mobile inspectors, settings, empty workspace, task editor, planning capacity, long mobile titles, timeline travel buffers in both themes, backup restore consent, editor conflicts, recovered task notes, rainy forecasts, outing travel conflicts and bulk-copy previews. They use a fixed clock/time zone, bundled fonts, reduced motion and pinned Chromium. Tests wait for rendering/data/fonts and reject page errors. Comparisons allow at most 300 differing pixels to tolerate minor native form-control text rendering differences; meaningful layout changes still fail.

Build Storybook, run `npm run test:visual`, and inspect actual/expected/difference images and traces in `test-results/` on failure. For intentional changes, run `npm run test:visual:update`, visually inspect changed PNGs, rerun the normal comparison and commit the reviewed baselines. Normal runs and CI never silently generate missing baselines.

Baselines live in `tests/visual/__screenshots__/<platform>/chromium/`. Initial images were generated/inspected on macOS; visual CI uses `macos-14`. Linux needs its own generated and reviewed platform baselines. OS/browser rendering differences may require review; never silently refresh in CI. Selected regression screenshots do not establish equivalence with the entire Figma file.

## Remaining component coverage gaps

Calendar pointer rescheduling/resizing and its failure rollback, some narrow-screen focus/navigation paths, and additional recurrence/editor variants still have uncovered branches. The live Google Maps SDK is intentionally absent from isolated stories; map loading/marker behavior needs the external integration checks. Story coverage does not certify every Figma frame.

## Continuous integration

[Quality workflow](../.github/workflows/quality.yml) runs on PRs, main/master pushes and manual dispatch with read-only repository permissions. Linux runs formatting, types, lint, core coverage, documentation, Storybook interaction/accessibility coverage, static catalog build and production E2E. macOS compares visual baselines. Focused tests are rejected in CI. Artifacts retain coverage, the built catalog and browser failure reports for 14 days.

The workflow is configured locally; execution on GitHub requires pushing the project and enabling Actions. No credentials or real workspace data are needed. See [verification](verification.md) for observed results and checks requiring Google credentials, Docker or Unraid.
