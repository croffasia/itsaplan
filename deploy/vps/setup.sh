#!/usr/bin/env bash
# First-time setup on a fresh Ubuntu/Debian VPS, run as root from the repository root:
#   bash deploy/vps/setup.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
command -v rclone >/dev/null || curl -fsSL https://rclone.org/install.sh | bash

if [ ! -f .env ]; then
  cp deploy/vps/env.vps.example .env
  for key in POSTGRES_PASSWORD BETTER_AUTH_SECRET APP_ENCRYPTION_KEY S3_SECRET_ACCESS_KEY; do
    secret="$(openssl rand -base64 32 | tr -d '\n/+=' | cut -c1-40)"
    sed -i "s|^$key=.*|$key=$secret|" .env
  done
  echo "Created .env with generated secrets. Set the domains in it, then run this again."
  exit 0
fi

# Only SSH and the web ports are open.
if command -v ufw >/dev/null; then
  ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443 && ufw --force enable
fi

docker compose -f docker-compose.yml -f deploy/vps/docker-compose.vps.yml up -d --build
echo "Started. Open https://$(grep '^APP_DOMAIN=' .env | cut -d= -f2)"
