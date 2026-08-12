#!/usr/bin/env bash
# ==============================================================================
# install-backup-cron.sh
# Copies backup-db.sh into place and schedules it via cron at 0 2 * * *.
#
# Usage: sudo bash install-backup-cron.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DEST="/opt/voip-saas/scripts/backup-db.sh"
mkdir -p "$(dirname "$SCRIPT_DEST")"
cp "$(dirname "$0")/backup-db.sh" "$SCRIPT_DEST"
chmod +x "$SCRIPT_DEST"
chown voipapp:voipapp "$SCRIPT_DEST"

mkdir -p /opt/voip-saas/backups /var/log/voip-saas
chown -R voipapp:voipapp /opt/voip-saas/backups /var/log/voip-saas

echo "==> Setting up ~/.pgpass for the voipapp user so pg_dump can authenticate"
echo "    without a password prompt (required for cron — it has no TTY)."
PGPASS_FILE="/home/voipapp/.pgpass"
if [ ! -f "$PGPASS_FILE" ]; then
    read -rsp "Enter the voip_saas_user Postgres password to store in .pgpass: " DB_PASSWORD
    echo
    echo "localhost:5432:voip_saas:voip_saas_user:${DB_PASSWORD}" > "$PGPASS_FILE"
    chown voipapp:voipapp "$PGPASS_FILE"
    chmod 600 "$PGPASS_FILE"
else
    echo "    ~/.pgpass already exists — leaving it as-is."
fi

CRON_FILE="/etc/cron.d/voip-saas-db-backup"
echo "0 2 * * * voipapp $SCRIPT_DEST" > "$CRON_FILE"
chmod 644 "$CRON_FILE"

echo "==> Installed daily backup cron job: $CRON_FILE (runs 02:00 server time)"
echo "==> Backups land in /opt/voip-saas/backups/, kept for 7 days"
echo "==> Logs: /var/log/voip-saas/db-backup.log"
echo
echo "==> RESTORE DRILL — test this now, don't wait for an emergency:"
echo "    gunzip -c /opt/voip-saas/backups/voip_saas_<timestamp>.sql.gz | \\"
echo "      psql -U voip_saas_user -h localhost -d voip_saas_restore_test"
echo "    (create voip_saas_restore_test as a throwaway DB first with createdb)"
