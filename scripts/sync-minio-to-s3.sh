#!/usr/bin/env bash
# Mirror local MinIO buckets → AWS S3 (same object keys).
# Run on Mac while docker compose minio is up.
#
# Requires AWS credentials (marinero-deploy):
#   aws configure --profile marinero-deploy
#   AWS_PROFILE=marinero-deploy ./scripts/sync-minio-to-s3.sh
#
# Usage:
#   ./scripts/sync-minio-to-s3.sh           # upload
#   ./scripts/sync-minio-to-s3.sh --dry-run   # show what would sync
set -euo pipefail

cd "$(dirname "$0")/.."

DRY_RUN=""
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN="--dry-run"
fi

REGION="${S3_REGION:-eu-north-1}"
BUCKET_PUBLIC="${S3_BUCKET_PUBLIC:-marinero-public}"
BUCKET_PRIVATE="${S3_BUCKET_PRIVATE:-marinero-private}"
MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-minioadmin123}"

if ! docker compose ps minio --status running -q 2>/dev/null | grep -q .; then
  echo "MinIO is not running. Start: docker compose up -d minio minio-init"
  exit 1
fi

if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
  if [ -n "${AWS_PROFILE:-}" ]; then
    eval "$(aws configure export-credentials --profile "$AWS_PROFILE" --format env 2>/dev/null || true)"
  fi
fi

if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
  echo "AWS credentials not found."
  echo "Set AWS_PROFILE=marinero-deploy or export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY"
  exit 1
fi

NETWORK="$(docker inspect marinero_minio --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' | head -1)"
if [ -z "$NETWORK" ]; then
  echo "Cannot detect Docker network for marinero_minio"
  exit 1
fi

echo "==> MinIO → S3 mirror (${REGION})"
echo "    Network: ${NETWORK}"
echo "    Public:  ${BUCKET_PUBLIC}"
echo "    Private: ${BUCKET_PRIVATE}"
[ -n "$DRY_RUN" ] && echo "    Mode:    dry-run"

run_mc() {
  docker run --rm --network "$NETWORK" \
    -e MC_HOST_local="http://${MINIO_USER}:${MINIO_PASS}@minio:9000" \
    -e MC_HOST_aws="https://${AWS_ACCESS_KEY_ID}:${AWS_SECRET_ACCESS_KEY}@s3.${REGION}.amazonaws.com" \
    minio/mc "$@"
}

echo ""
echo "==> ${BUCKET_PUBLIC}"
run_mc mirror $DRY_RUN --overwrite local/${BUCKET_PUBLIC} aws/${BUCKET_PUBLIC}

echo ""
echo "==> ${BUCKET_PRIVATE}"
run_mc mirror $DRY_RUN --overwrite local/${BUCKET_PRIVATE} aws/${BUCKET_PRIVATE}

echo ""
echo "==> Done. Next on EC2:"
echo "    ./scripts/update-storage-urls-prod.sh"
