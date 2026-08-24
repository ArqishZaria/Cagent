#!/usr/bin/env bash
# ==============================================================================
# install-backup-cron.sh (Azure version)
# Copies backup-db.sh into place and schedules it via cron at 0 2 * * *.
#
# Usage: sudo bash install-backup-cron.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DEST="/opt/cagent/scripts/backup-db.sh"
mkdir -p "$(dirname "$SCRIPT_DEST")"
cp "$(dirname "$0")/backup-db.sh" "$SCRIPT_DEST"
chmod +x "$SCRIPT_DEST"
chown cagentapp:cagentapp "$SCRIPT_DEST"

mkdir -p /opt/cagent/backups /var/log/voip-saas
chown -R cagentapp:cagentapp /opt/cagent/backups /var/log/voip-saas

echo "==> Setting up ~/.pgpass for the cagent user so pg_dump can authenticate"
echo "    against Azure Database for PostgreSQL without a password prompt."
PGPASS_FILE="/home/cagentapp/.pgpass"
PG_HOST="cagent.postgres.database.azure.com"   # match backup-db.sh
if [ ! -f "$PGPASS_FILE" ]; then
    read -rsp "Enter the voip_saas_user Postgres password to store in .pgpass: " DB_PASSWORD
    echo
    # format: hostname:port:database:username:password
    echo "${PG_HOST}:5432:cagentapp:cagentapp_admin:${DB_PASSWORD}" > "$PGPASS_FILE"
    chown cagentapp:cagentapp "$PGPASS_FILE"
    chmod 600 "$PGPASS_FILE"
else
    echo "    ~/.pgpass already exists — leaving it as-is."
fi

CRON_FILE="/etc/cron.d/cagent-db-backup"
echo "0 2 * * * cagentapp $SCRIPT_DEST" > "$CRON_FILE"
chmod 644 "$CRON_FILE"

echo "==> Installed daily backup cron job: $CRON_FILE (runs 02:00 server time)"
echo "==> Backups land in /opt/cagent/backups/, kept for 7 days"
echo "==> Logs: /var/log/voip-saas/db-backup.log"
echo
echo "==> RESTORE DRILL — test this now, don't wait for an emergency:"
echo "    gunzip -c /opt/cagent/backups/cagent_<timestamp>.sql.gz | \\"
echo "      psql \"sslmode=require host=${PG_HOST} dbname=cagent_restore_test user=cagent_admin\""
echo "    (create cagent_restore_test as a throwaway DB first via:"
echo "     az postgres flexible-server db create --resource-group voip-saas-rg \\"
echo "       --server-name cagent-pg --database-name cagent_restore_test)"
