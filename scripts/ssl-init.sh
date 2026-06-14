#!/usr/bin/env bash
# Obtain Let's Encrypt certificate (run once after DNS points to EC2).
# Usage: CERTBOT_EMAIL=you@example.com ./scripts/ssl-init.sh
set -euo pipefail

DOMAIN="${DOMAIN:-marinero.art}"
EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL=your@email.com}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

echo "==> Starting nginx (HTTP only) for ACME challenge..."
docker compose -f "$COMPOSE_FILE" up -d nginx

echo "==> Requesting certificate for $DOMAIN and www.$DOMAIN..."
# certbot service overrides entrypoint with "certbot renew" — force certonly
docker compose -f "$COMPOSE_FILE" run --rm --entrypoint certbot certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo ""
echo "Certificate obtained. Now:"
echo "  1. Uncomment the HTTPS server blocks in docker/nginx/default.conf"
echo "  2. Run: docker compose -f $COMPOSE_FILE restart nginx"
echo "  3. Start certbot renew loop: docker compose -f $COMPOSE_FILE up -d certbot"
