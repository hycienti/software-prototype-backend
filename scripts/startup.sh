#!/bin/sh
set -eu

RUN_MIGRATIONS_ON_START="${RUN_MIGRATIONS_ON_START:-true}"
RUN_SEED_THERAPISTS_ON_START="${RUN_SEED_THERAPISTS_ON_START:-false}"
MIGRATION_RETRIES="${MIGRATION_RETRIES:-10}"
MIGRATION_RETRY_DELAY_SECONDS="${MIGRATION_RETRY_DELAY_SECONDS:-3}"

run_migrations() {
  echo "[startup] Running database migrations..."

  attempt=1
  while [ "$attempt" -le "$MIGRATION_RETRIES" ]; do
    if node ace.js migration:run --force; then
      echo "[startup] Migrations completed."
      return 0
    fi

    if [ "$attempt" -eq "$MIGRATION_RETRIES" ]; then
      echo "[startup] Migration failed after $MIGRATION_RETRIES attempts. Exiting."
      return 1
    fi

    echo "[startup] Migration attempt $attempt failed. Retrying in $MIGRATION_RETRY_DELAY_SECONDS seconds..."
    sleep "$MIGRATION_RETRY_DELAY_SECONDS"
    attempt=$(expr "$attempt" + 1)
  done
}

if [ "$RUN_MIGRATIONS_ON_START" = "true" ]; then
  run_migrations
fi

if [ "$RUN_SEED_THERAPISTS_ON_START" = "true" ]; then
  # Seeding requires schema to exist; enforce migrations first in seed mode.
  if [ "$RUN_MIGRATIONS_ON_START" != "true" ]; then
    echo "[startup] RUN_SEED_THERAPISTS_ON_START=true detected; running migrations first."
    run_migrations
  fi

  echo "[startup] Running therapist seed command..."
  node ace.js seed:therapists
fi

echo "[startup] Starting API server..."
exec node bin/server.js
