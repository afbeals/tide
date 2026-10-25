# Backup and restore

Full backup ZIPs contain a SQLite online snapshot, active attachment files and a versioned manifest with file SHA-256 checksums and record counts. JSON/CSV exports are inspection/portability outputs, not full restore archives.

Run from Settings → Automatic backups, or `npm run db:backup`. Backups live under the data root's `backups/`, independent of active restored generations. Default automatic execution is 03:00 in workspace timezone, retaining seven recent daily snapshots, four weekly representatives and three safety backups. Manual archives are retained until managed externally. The Node server starts the scheduler through `src/instrumentation.ts`; no browser visit is required after a restart. Due schedules are checked every 30 seconds while the server runs.

Restore: upload or choose a history archive → validate paths/checksums/database/files → review contents → explicitly confirm everyone's replacement → maintenance → reconnect. All records and attachments move together. Unsaved device drafts remain local for later review.

The server creates a safety backup, stages an independent `generations/restore-<id>` directory and atomically switches `active.json`. A failed stage leaves the old generation selected. Existing generations are intentionally retained for recovery and consume disk space. Inspect/reclaim obsolete generations only after verifying a downloaded backup and active data.

Uploads are limited to 200 MB compressed / 500 MB expanded for this POC. Only expected database/manifest/opaque attachment paths are accepted. Invalid, incomplete or incompatible archives are rejected before replacement. If interrupted, check health and logs, reconnect and verify active generation before editing.

An operator can recover by stopping the server, retaining the entire data directory, and selecting a known-good generation via the active manifest or restoring a downloaded archive in a clean instance. Never combine a database from one generation with files from another.
