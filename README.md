# Tide

A calm shared planner for everyday work, future ideas and getting out the door. React/Next.js, SQLite, real local persistence, and a Docker/Unraid deployment on port **8776**.

```sh
npm ci
npm run db:generate
npm run db:deploy
npm run db:seed  # optional; only seeds an empty workspace
npm run dev
```

Open http://localhost:8776. Use Node 24. There is no login: everyone with access shares the workspace; selecting a person changes planning context.

Read the [documentation index](docs/README.md), [setup guide](docs/setup.md), [builder checklist](docs/implementation-checklist.md), [Figma register](docs/figma-reference-register.md), and [verification record](docs/verification.md).

## Checks

```sh
npm run check
npm run build
npm run docs:check
npm run test:e2e
npm run test:stories:coverage
npm run storybook:build
npm run test:visual
```

Run `npm run storybook` for the component catalog at http://localhost:6006. See [testing and Storybook](docs/testing.md) for coverage scopes/gates, fixtures, screenshot baselines and CI.

## Hosting

The production image is `afbeals/tide:<version>`. Mount `/mnt/user/appdata/tide/data` at `/app/data`; map port `8776:8776`. See [Unraid deployment](docs/deploy-unraid.md) and [backup/restore](docs/backup-restore.md). Provider keys are optional and unconfigured services have manual alternatives.
