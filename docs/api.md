# API

All responses are uncached. Write requests use JSON except uploads. Browser writes require a same-origin request. There is no authentication. Every write must include `X-Tide-Generation` equal to the `generation` returned by GET `/api/workspace`. A restore changes it; stale requests receive 409, including writes already queued when the restore began.

| Method / path | Purpose |
|---|---|
| GET `/api/health` | Health/maintenance |
| GET `/api/workspace` | Records, recent activity, generation and provider usage; materializes recurrence |
| POST `/api/records` | `{kind,data}` create |
| PATCH `/api/records/:id` | `{version,data,scopeFrom?}` replace validated payload; `scopeFrom` is the inclusive future-series date |
| DELETE `/api/records/:id` | `{version}` permanent deletion where allowed |
| POST `/api/plan` | `{data,version,taskEdits?}` person/day planning transaction |
| POST `/api/review` | `{data,version,decisions:[{id,version,action,day}]}` atomic end-of-day review |
| POST `/api/bulk-undo` | `{operationId}` version-aware reversal of a bulk action |
| POST `/api/timer` | `{action,personId,taskId?,durationSeconds?,confirm?,version?}` |
| POST `/api/bulk` | `{operationId,action,items:[{id,version}],day}` |
| POST `/api/routine-apply` | `{operationId,routineId,personId,day,indices}` |
| POST `/api/attachment` | Multipart `file`; maximum 20 MB |
| GET `/api/attachment/:id` | Stored file; active images may display inline |
| GET `/api/export` | JSON inspection export |
| GET `/api/export?format=csv` | Task table CSV export |
| GET `/api/backups` | Backup history |
| POST `/api/backups` | `{action:"create"}` or `{action:"restore",token,confirm:true}` |
| GET `/api/backup/:id` | Full ZIP download |
| POST `/api/restore-upload` | Multipart full backup ZIP; validates and returns preview/token |
| POST `/api/provider` | Places, place-details/opening hours, route or weather request with explicit `action` |

GET `/api/workspace` includes `provider.mapsBrowserKey`, the public Maps JavaScript key read from the running server's `GOOGLE_MAPS_BROWSER_KEY` environment variable (empty string when absent or disabled). `provider.mapConfigured` reports whether that value is present. The browser uses this field rather than a build-time key. Live access requires `TIDE_GOOGLE_MODE=live` and is always disabled under Next development; otherwise server Google requests return 503 and browser keys are withheld. For existing installations, `NEXT_PUBLIC_GOOGLE_MAPS_KEY` remains a runtime fallback; the new variable takes precedence. Responses remain `Cache-Control: no-store`. The private `GOOGLE_SERVER_API_KEY` is never included in workspace responses or exports.

Entity envelope: `{id,kind,version,data,createdAt,updatedAt}`. Errors: `{error,current?}`. Validation returns 422 with issues; stale writes return 409 and current record where applicable; unavailable records return 404; maintenance returns 503; provider allowance returns 429.

Example creation: `POST /api/records` with `kind:"person"` and `data:{name:"Alex",color:"#e8ba72",retired:false}`. Use returned ID/version in subsequent writes. For task payloads use `taskDefaults()` and the documented type; a title is the only user-required field, while the client supplies structural defaults.

Datetime-local input is normalized in the workspace IANA time zone before storage. Stored schedule timestamps are instants; day-only fields stay local dates. `scopeFrom` preserves older outcomes and independently edited occurrence fields.
