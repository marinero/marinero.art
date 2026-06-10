#!/usr/bin/env bash
# Apply SQL migrations on the production Postgres container.
# Safe to re-run: migrations use IF NOT EXISTS.
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
MIGRATIONS_DIR="docker/postgres/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "No migrations directory: $MIGRATIONS_DIR"
  exit 0
fi

echo "==> Waiting for Postgres..."
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  sh -c 'until pg_isready -U marinero -d marinero; do sleep 1; done'

for file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  name=$(basename "$file")
  echo "==> Applying $name"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U marinero -d marinero <"$file"
done

echo "==> Migrations done."
