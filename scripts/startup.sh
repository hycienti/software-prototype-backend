#!/bin/sh
set -eu

RUN_MIGRATIONS_ON_START="${RUN_MIGRATIONS_ON_START:-true}"
RUN_SEED_THERAPISTS_ON_START="${RUN_SEED_THERAPISTS_ON_START:-false}"
MIGRATION_RETRIES="${MIGRATION_RETRIES:-10}"
MIGRATION_RETRY_DELAY_SECONDS="${MIGRATION_RETRY_DELAY_SECONDS:-3}"

if [ "$RUN_MIGRATIONS_ON_START" = "true" ]; then
  echo "[startup] Running database migrations..."

  attempt=1
  while [ "$attempt" -le "$MIGRATION_RETRIES" ]; do
    if node ace.js migration:run; then
      echo "[startup] Migrations completed."
      break
    fi

    if [ "$attempt" -eq "$MIGRATION_RETRIES" ]; then
      echo "[startup] Migration failed after $MIGRATION_RETRIES attempts. Exiting."
      exit 1
    fi

    echo "[startup] Migration attempt $attempt failed. Retrying in $MIGRATION_RETRY_DELAY_SECONDS seconds..."
    sleep "$MIGRATION_RETRY_DELAY_SECONDS"
    attempt=$(expr "$attempt" + 1)
  done
fi

if [ "$RUN_SEED_THERAPISTS_ON_START" = "true" ]; then
  echo "[startup] Running therapist seed command..."
  node ace.js seed:therapists
fi

echo "[startup] Starting API server..."
exec node bin/server.js
