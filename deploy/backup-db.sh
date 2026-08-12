#!/usr/bin/env bash
# ==============================================================================
# backup-db.sh
# Scheduled via cron at 0 2 * * * (2am daily). Dumps the voip_saas database,
# compresses it, and deletes local backups older than 7 days.
#
# Install: sudo bash install-backup-cron.sh   (see that script — it copies
# this file into place and writes the crontab entry)
# ==============================================================================
set -euo pipefail

DB_NAME="voip_saas"
DB_USER="voip_saas_user"
BACKUP_DIR="/opt/voip-saas/backups"
RETENTION_DAYS=7
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
LOG_FILE="/var/log/voip-saas/db-backup.log"

mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

echo "$(date -Iseconds) — starting backup of ${DB_NAME}" >> "$LOG_FILE"

# PGPASSWORD should be set via the environment (e.g. sourced from .env) or a
# ~/.pgpass file for the user running this script — never hardcode it here.
if pg_dump -U "$DB_USER" -h localhost "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "$(date -Iseconds) — backup succeeded: ${BACKUP_FILE} (${SIZE})" >> "$LOG_FILE"
else
    echo "$(date -Iseconds) — BACKUP FAILED for ${DB_NAME}" >> "$LOG_FILE"
    rm -f "$BACKUP_FILE"  # don't leave a partial/corrupt dump around
    exit 1
fi

echo "$(date -Iseconds) — purging backups older than ${RETENTION_DAYS} days" >> "$LOG_FILE"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -print -delete >> "$LOG_FILE"

echo "$(date -Iseconds) — backup cycle complete" >> "$LOG_FILE"
