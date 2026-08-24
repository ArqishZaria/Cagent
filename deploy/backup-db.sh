#!/usr/bin/env bash
# ==============================================================================
# backup-db.sh (Azure version)
# Scheduled via cron at 0 2 * * * (2am daily). Dumps the voip_saas database
# from Azure Database for PostgreSQL over the network, compresses it, and
# deletes local backups older than 7 days.
#
# NOTE: Azure Database for PostgreSQL Flexible Server already takes automated
# backups with point-in-time restore (default 7-day retention, configurable
# up to 35 days) — this script is a *supplementary* logical backup, not your
# only line of defense. Still worth keeping for portability / easy restore
# testing without going through the Azure portal.
#
# Install: sudo bash install-backup-cron.sh
# ==============================================================================
set -euo pipefail

DB_NAME="cagent"
DB_USER="cagent_admin"
DB_HOST="cagent.postgres.database.azure.com"   # <- set to your server's FQDN
BACKUP_DIR="/opt/cagent/backups"
RETENTION_DAYS=7
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"
LOG_FILE="/var/log/voip-saas/db-backup.log"

mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

echo "$(date -Iseconds) — starting backup of ${DB_NAME} from ${DB_HOST}" >> "$LOG_FILE"

# Auth comes from ~/.pgpass (see install-backup-cron.sh) — Azure Flexible
# Server requires SSL, which sslmode=require below enforces.
if pg_dump "sslmode=require host=${DB_HOST} dbname=${DB_NAME} user=${DB_USER}" | gzip > "$BACKUP_FILE"; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "$(date -Iseconds) — backup succeeded: ${BACKUP_FILE} (${SIZE})" >> "$LOG_FILE"
else
    echo "$(date -Iseconds) — BACKUP FAILED for ${DB_NAME}" >> "$LOG_FILE"
    rm -f "$BACKUP_FILE"
    exit 1
fi

echo "$(date -Iseconds) — purging backups older than ${RETENTION_DAYS} days" >> "$LOG_FILE"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -print -delete >> "$LOG_FILE"

echo "$(date -Iseconds) — backup cycle complete" >> "$LOG_FILE"
