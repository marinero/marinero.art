#!/usr/bin/env bash
# Update PostgreSQL storage URLs after files are in AWS S3.
# Run on EC2 after sync-minio-to-s3.sh from Mac.
#
# Usage:
#   ./scripts/update-storage-urls-prod.sh
#   ./scripts/update-storage-urls-prod.sh --dry-run
set -euo pipefail

cd "$(dirname "$0")/.."

IMPORT_ARGS="$*"

if [ ! -f .env.production ]; then
  echo "Missing .env.production"
  exit 1
fi

set -a && source .env.production && set +a

export ENV_FILE=.env.production
export DATABASE_URL="${DATABASE_URL/@localhost:/@postgres:}"

echo "==> Update storage URLs in PostgreSQL"
echo "    Public base: ${NEXT_PUBLIC_STORAGE_URL:-?}"
echo "    DB:          ${DATABASE_URL%%@*}@***"

docker run --rm \
  --network marinero_default \
  -v "$(pwd):/app" \
  -w /app \
  -e ENV_FILE \
  -e DATABASE_URL \
  -e NEXT_PUBLIC_STORAGE_URL \
  -e S3_BUCKET_PUBLIC \
  -e S3_BUCKET_PRIVATE \
  node:20-alpine sh -c '
    npm install --no-save pg tsx @aws-sdk/client-s3 >/dev/null
    npx tsx scripts/import-blob-archive-to-minio.ts -- --db-only '"$IMPORT_ARGS"'
  '

echo "==> Restart Next.js"
docker compose -f docker-compose.prod.yml restart nextjs
