#!/usr/bin/env bash
# Deploy marinero.art on EC2 (pull code, build, migrate, restart).
# Usage:
#   ./scripts/deploy.sh              # update running stack
#   ./scripts/deploy.sh --first-run  # initial deploy (restore DB if dump present)
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
FIRST_RUN=false

for arg in "$@"; do
  case "$arg" in
    --first-run) FIRST_RUN=true ;;
  esac
done

if [ ! -f .env.production ]; then
  echo "Missing .env.production — copy from .env.production.example"
  exit 1
fi

# shellcheck disable=SC1091
set -a && source .env.production && set +a

export GIT_SHA
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo "==> Building Next.js image (git: $GIT_SHA)..."
docker compose -f "$COMPOSE_FILE" build --pull nextjs

echo "==> Starting Postgres..."
docker compose -f "$COMPOSE_FILE" up -d postgres
sleep 3

if $FIRST_RUN && [ -f full_backup.sql ]; then
  echo "==> Restoring database from full_backup.sql (first run)..."
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    sh -c 'until pg_isready -U marinero -d marinero; do sleep 1; done'
  # init.sql may seed rows (e.g. about_content) — clear before data restore
  echo "==> Clearing seed data from init.sql..."
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U marinero -d marinero -c "
      DO \$\$ DECLARE r RECORD; BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
        END LOOP;
      END \$\$;"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U marinero -d marinero <full_backup.sql
elif $FIRST_RUN; then
  echo "==> First run without full_backup.sql — using init.sql schema only."
fi

echo "==> Applying migrations..."
bash scripts/run-migrations.sh

echo "==> Starting application stack..."
docker compose -f "$COMPOSE_FILE" up -d

echo "==> Status:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "Deploy complete. Site: ${NEXT_PUBLIC_SITE_URL:-https://marinero.art}"
