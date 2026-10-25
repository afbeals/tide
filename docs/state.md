# State and drafts

TanStack Query caches the authoritative workspace and refreshes visible tabs every 15 seconds and on focus. Mutations invalidate relevant data. URL parameters carry section, date, planning person, view, project, selected record and persisted filters; navigation uses browser history.

Browser storage holds theme/density/motion/reminder preferences, editor drafts, notes drafts, interrupted planning and per-context scroll. These are device-local. They do not establish identity or permissions.

Saved means the server accepted a write. Draft saved on this device means the input exists only in browser storage. Offline task editing is not a synchronization feature: disconnected writes must be reviewed and retried. Conflicting versions require an explicit server-versus-draft choice.

Restoration changes the workspace generation; cached data is refreshed and older device drafts require review. Never silently replay drafts against a restored/deleted record.

Mutations carry the workspace generation and record version. Notes that conflict stop autosaving and offer server/draft comparison. An explicitly reviewed draft can replace the displayed current version; subsequent concurrent changes still return 409. Bulk undo similarly rejects changes made after the operation instead of overwriting them.
