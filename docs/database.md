# Database

SQLite uses WAL, a busy timeout, and Prisma 7's better-sqlite3 adapter. Production storage is outside the image.

| Table | Fields / purpose |
|---|---|
| `Record` | Stable `id`, `kind`, integer `version`, validated JSON `data`, creation/update timestamps |
| `Activity` | Record ID, action, description, timestamp; task history |
| `Operation` | Idempotency key and operation result for safe bulk/routine retries |

Record kinds are task, person, area, project, routine, reference, place, view, plan, availability, outing, settings, attachment, timeLog and reminder. Exact payload types are in `src/lib/types.ts`; server validation is in `src/lib/domain.ts`.

Task references include owner/project/area, prerequisite task IDs, file/reference IDs, recurrence series and occurrence date. Plans reference a person/day and ordered tasks/focus. Timer logs reference person/task. File metadata references an opaque storage key, never a user-supplied disk path.

Migration commands: `npm run db:generate`, `npm run db:deploy`. Commit migrations; never commit the live database, generated client or attachments. Use full backups rather than copying a live WAL database alone.
