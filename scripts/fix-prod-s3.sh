#!/usr/bin/env bash
# Пересоздаёт nextjs с актуальным .env.production (после restart ключи S3 «пропадают»).
# Usage on EC2:  cd /home/ubuntu/marinero && ./scripts/fix-prod-s3.sh
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE_FILE="docker-compose.prod.yml"

if [ ! -f .env.production ]; then
  echo "Missing .env.production"
  exit 1
fi

# shellcheck disable=SC1091
set -a && source .env.production && set +a

if [ -z "${S3_ACCESS_KEY_ID:-}" ] || [ -z "${S3_SECRET_ACCESS_KEY:-}" ]; then
  echo "ERROR: S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set in .env.production"
  exit 1
fi

if grep -qE '^S3_ENDPOINT=' .env.production && ! grep -qE '^#.*S3_ENDPOINT=' .env.production; then
  echo "ERROR: Remove S3_ENDPOINT from .env.production on prod (MinIO is local only)"
  exit 1
fi

echo "==> Recreate nextjs (reload .env.production)"
docker compose --env-file .env.production -f "$COMPOSE_FILE" up -d --force-recreate nextjs

echo "==> Verify S3 keys inside container"
if ! docker exec marinero_nextjs sh -c 'test -n "$S3_ACCESS_KEY_ID" && test -n "$S3_SECRET_ACCESS_KEY"'; then
  echo "ERROR: S3 credentials still missing in container"
  exit 1
fi
echo "    S3 credentials: OK"

echo "==> Test audio stream"
if curl -sfI -m 15 "http://localhost/api/audio/stream?key=marinero%2Faudio%2F1778946982781-z593f.mp3" | head -1 | grep -q 200; then
  echo "    Audio stream: OK"
else
  echo "WARNING: audio stream check failed — see: docker compose -f $COMPOSE_FILE logs nextjs --tail 30"
  exit 1
fi

echo "==> Done"
