#!/usr/bin/env bash
# One-time setup on a fresh Ubuntu EC2 instance.
# Run as ubuntu user with sudo:
#   curl -fsSL ... | bash   OR   bash scripts/ec2-bootstrap.sh
set -euo pipefail

echo "==> Installing Docker..."
sudo apt-get update -qq
sudo apt-get install -y -qq ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${VERSION_CODENAME:-$VERSION_ID}") stable" |
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"

APP_DIR="${APP_DIR:-/opt/marinero}"
echo "==> App directory: $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"

echo ""
echo "Bootstrap complete. Next steps:"
echo "  1. Log out and back in (docker group), or run: newgrp docker"
echo "  2. Clone repo into $APP_DIR"
echo "  3. Copy .env.production.example → .env.production and fill secrets"
echo "  4. Run: ./scripts/deploy.sh --first-run"
