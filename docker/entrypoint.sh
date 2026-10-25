#!/bin/sh
set -eu
mkdir -p "${TIDE_DATA_DIR:-/app/data}"
# A restore can select a generation other than the original database.
DATABASE_URL=$(node scripts/active-database.mjs)
export DATABASE_URL
if [ -s "${DATABASE_URL#file:}" ]; then npm run db:backup -- --safety; fi
npm run db:deploy
if [ "${TIDE_SEED_DEMO:-false}" = "true" ]; then npm run db:seed; fi
exec "$@"
