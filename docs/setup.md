# Setup — a new machine

Use Node 24 (tested locally with 24.13.0) and npm 11.

```sh
npm ci
cp .env.example .env
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Open http://localhost:8776. Seeding is optional and refuses to overwrite an existing non-empty workspace. Without a seed, create people from Settings → People, then configure availability and saved places. There is no login.

Development defaults to `./data/workspace.db`; uploaded files live in the active generation's `attachments/`. The database scripts load `.env` using Node’s native environment-file support; existing shell variables take precedence. Next also loads `.env` for its own process. `DATABASE_URL` must identify the same database as the application.

After dependency/schema changes run generate and deploy again. If port 8776 is occupied, stop the existing Tide process. Do not delete data to solve migration problems; take a full backup and inspect the error.

Google integrations are optional and live access is reserved for the production Unraid container. Keep local development key-free; it uses manual alternatives, with mocked integrations in tests and Storybook. Follow the [Google account and API key setup](integrations.md) to create the Cloud project, enable services and set both runtime keys in Unraid. Weather needs no Google key.
