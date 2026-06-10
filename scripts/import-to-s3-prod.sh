#!/usr/bin/env bash
# Import blob archive → AWS S3 + update prod PostgreSQL URLs.
# Run on EC2 (IAM role marinero-ec2-s3) after copying archive to ./data/blob-archive
#
# Usage:
#   ./scripts/import-to-s3-prod.sh                    # full import
#   ./scripts/import-to-s3-prod.sh --dry-run          # plan only
#   ./scripts/import-to-s3-prod.sh --skip-db          # S3 upload only
set -euo pipefail

cd "$(dirname "$0")/.."

SOURCE="${SOURCE:-./data/blob-archive}"
IMPORT_ARGS="$*"

if [ ! -d "$SOURCE" ] && [ ! -f "$SOURCE" ]; then
  echo "Archive not found: $SOURCE"
  echo ""
  echo "Copy archive to server first, e.g. from Mac:"
  echo "  scp -r ./data/blob-archive ubuntu@13.49.72.22:~/marinero/data/"
  exit 1
fi

if [ ! -f .env.production ]; then
  echo "Missing .env.production"
  exit 1
fi

set -a && source .env.production && set +a

# Inside docker network postgres hostname is 'postgres'
export ENV_FILE=.env.production
export DATABASE_URL="${DATABASE_URL/@localhost:/@postgres:}"

echo "==> Import to S3 (${S3_REGION:-eu-north-1})"
echo "    Source: $SOURCE"
echo "    DB:     ${DATABASE_URL%%@*}@***"

docker run --rm \
  --network marinero_default \
  -v "$(pwd):/app" \
  -w /app \
  -e ENV_FILE \
  -e DATABASE_URL \
  -e S3_REGION \
  -e S3_BUCKET_PUBLIC \
  -e S3_BUCKET_PRIVATE \
  -e NEXT_PUBLIC_STORAGE_URL \
  -e AWS_REGION="${S3_REGION:-eu-north-1}" \
  -e AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-}" \
  -e AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-}" \
  -e AWS_SESSION_TOKEN="${AWS_SESSION_TOKEN:-}" \
  node:20-alpine sh -c '
    npm install --no-save pg tsx @aws-sdk/client-s3 >/dev/null
    npx tsx scripts/import-blob-archive-to-minio.ts -- --source '"$SOURCE"' $IMPORT_ARGS
  '

echo "==> Restart Next.js"
docker compose -f docker-compose.prod.yml restart nextjs
