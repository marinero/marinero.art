#!/usr/bin/env bash
# Deploy marinero.art on EC2 (pull code, build, migrate, restart).
# Usage:
#   ./scripts/deploy.sh              # update running stack
#   ./scripts/deploy.sh --first-run  # initial deploy (restore DB if dump present)
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
COMPOSE=(docker compose --env-file .env.production -f "$COMPOSE_FILE")
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
"${COMPOSE[@]}" build --pull nextjs

echo "==> Starting Postgres..."
"${COMPOSE[@]}" up -d postgres
sleep 3

if $FIRST_RUN && [ -f full_backup.sql ]; then
  echo "==> Restoring database from full_backup.sql (first run)..."
  "${COMPOSE[@]}" exec -T postgres \
    sh -c 'until pg_isready -U marinero -d marinero; do sleep 1; done'
  # init.sql may seed rows (e.g. about_content) — clear before data restore
  echo "==> Clearing seed data from init.sql..."
  "${COMPOSE[@]}" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U marinero -d marinero -c "
      DO \$\$ DECLARE r RECORD; BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
        END LOOP;
      END \$\$;"
  "${COMPOSE[@]}" exec -T postgres \
    psql -v ON_ERROR_STOP=1 -U marinero -d marinero <full_backup.sql
elif $FIRST_RUN; then
  echo "==> First run without full_backup.sql — using init.sql schema only."
fi

echo "==> Applying migrations..."
bash scripts/run-migrations.sh

echo "==> Starting application stack..."
# --force-recreate: подхватить изменения .env.production (restart их не применяет)
"${COMPOSE[@]}" up -d --force-recreate nextjs
"${COMPOSE[@]}" up -d

echo "==> Checking S3 credentials in container..."
if ! docker exec marinero_nextjs sh -c 'test -n "$S3_ACCESS_KEY_ID" && test -n "$S3_SECRET_ACCESS_KEY"'; then
  echo "WARNING: S3 credentials missing. Run: ./scripts/fix-prod-s3.sh"
else
  echo "    S3 credentials: OK"
fi

echo "==> Status:"
"${COMPOSE[@]}" ps

echo ""
echo "Deploy complete. Site: ${NEXT_PUBLIC_SITE_URL:-https://marinero.art}"
