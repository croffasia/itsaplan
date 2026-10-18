#!/usr/bin/env bash
# Nightly backup of the database and the stored files to OneDrive with rclone.
# Needs an rclone remote named "onedrive" (rclone config, type "onedrive",
# "OneDrive for Business"). Keeps 14 daily database dumps on OneDrive.
#
#   crontab -e
#   0 2 * * * /opt/itsaplan/deploy/vps/backup-to-onedrive.sh >> /var/log/itsaplan-backup.log 2>&1
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE="${BACKUP_REMOTE:-onedrive:itsaplan-backup}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$REPO_DIR"
set -a; . ./.env; set +a

compose() { docker compose -f docker-compose.yml -f deploy/vps/docker-compose.vps.yml "$@"; }
stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"

echo "[$stamp] dumping database"
compose exec -T postgres pg_dump -U "${POSTGRES_USER:-itsaplan}" -d "${POSTGRES_DB:-itsaplan}" -Fc > "$WORK/db-$stamp.dump"
rclone copy "$WORK/db-$stamp.dump" "$REMOTE/db"
rclone delete "$REMOTE/db" --min-age 14d

echo "[$stamp] syncing files"
volume="$(docker volume ls -q | grep -E '(^|_)minio-data$' | head -1)"
docker run --rm -v "$volume":/data:ro -v "$WORK":/out alpine tar -C /data -cf /out/files.tar .
mkdir -p "$WORK/files" && tar -C "$WORK/files" -xf "$WORK/files.tar"
rclone sync "$WORK/files" "$REMOTE/files"

echo "[$stamp] done"
