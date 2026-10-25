# Development

The independent project uses npm, Next.js App Router, React and TypeScript. No Pineapple/Airbnb tooling is required.

| Command | Purpose |
|---|---|
| `npm run dev` | Development server on 8776 |
| `npm run build` | Generate Prisma client and production build |
| `npm start` | Production server on 8776 |
| `npm run check` | Type check, lint, core tests and coverage gates |
| `npm run test:e2e` | Build production, then run browser journeys against an isolated temporary database |
| `npm run storybook` | Real component catalog on 6006; themes/density and mocked APIs |
| `npm run test:stories:coverage` | Chromium interaction/accessibility checks and component coverage |
| `npm run storybook:build` | Static Storybook build |
| `npm run test:visual` | Compare built stories against reviewed baselines |
| `npm run docs:check` | Document links and Figma inventory reconciliation |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Deliberate, non-destructive demo seed |
| `npm run db:backup` | Full database-and-attachment archive |

Environment variables: `TIDE_DATA_DIR` (default `./data`), `DATABASE_URL` (default `file:./data/workspace.db`), `GOOGLE_SERVER_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (build-time browser map key). `TIDE_GOOGLE_DAILY_LIMIT` initializes the request allowance for a new workspace; the settings editor controls it thereafter. The settings record holds request limits, backup settings and shared date preferences. Do not commit credentials or data.

Edit domain validation before extending an entity's data shape. Add an appropriate migration when changing SQLite tables. Update API/database/workflow docs in the same change. Use the Figma reference register instead of choosing unrelated prototype frames.

Use `npm run format` / `npm run format:check` for consistent formatting. The runtime data path is deliberately outside the build output; Turbopack tracing ignores its configurable volume path.

See [testing and Storybook](testing.md) for all gates, isolated data, baseline updates and the GitHub Actions workflow.
