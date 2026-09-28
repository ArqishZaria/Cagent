#!/usr/bin/env bash
# ==============================================================================
# install-backup-cron.sh (Azure version)
# Copies backup-db.sh into place and schedules it via cron at 0 2 * * *.
#
# DB host / name / user are READ FROM backup-db.sh, so the ~/.pgpass entry
# written here can never drift out of sync with the credentials that script
# actually connects with (a mismatch makes pg_dump prompt for / fail on a
# password, so the nightly backup would silently never run).
#
# Usage: sudo bash install-backup-cron.sh   (run from the deploy/ directory)
# ==============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/backup-db.sh"
[ -f "$SRC" ] || { echo "ERROR: $SRC not found." >&2; exit 1; }

read_var() { grep -E "^$1=" "$SRC" | head -1 | cut -d'"' -f2; }
DB_NAME="$(read_var DB_NAME)"
DB_USER="$(read_var DB_USER)"
PG_HOST="$(read_var DB_HOST)"
if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$PG_HOST" ]; then
    echo "ERROR: couldn't read DB_NAME / DB_USER / DB_HOST from backup-db.sh." >&2
    exit 1
fi

APP_USER="cagentapp"
SCRIPT_DEST="/opt/cagent/scripts/backup-db.sh"
mkdir -p "$(dirname "$SCRIPT_DEST")"
cp "$SRC" "$SCRIPT_DEST"
chmod +x "$SCRIPT_DEST"
chown "$APP_USER:$APP_USER" "$SCRIPT_DEST"

mkdir -p /opt/cagent/backups /var/log/voip-saas
chown -R "$APP_USER:$APP_USER" /opt/cagent/backups /var/log/voip-saas

echo "==> Setting up ~/.pgpass for $APP_USER so pg_dump can authenticate"
echo "    as ${DB_USER} on ${PG_HOST} (db: ${DB_NAME}) without a password prompt."
PGPASS_FILE="/home/${APP_USER}/.pgpass"
if [ ! -f "$PGPASS_FILE" ]; then
    read -rsp "Enter the Postgres password for ${DB_USER}: " DB_PASSWORD
    echo
    # .pgpass requires ':' and '\' inside a field to be backslash-escaped.
    ESCAPED_PASSWORD="$(printf '%s' "$DB_PASSWORD" | sed -e 's/\\/\\\\/g' -e 's/:/\\:/g')"
    # format: hostname:port:database:username:password
    echo "${PG_HOST}:5432:${DB_NAME}:${DB_USER}:${ESCAPED_PASSWORD}" > "$PGPASS_FILE"
    chown "$APP_USER:$APP_USER" "$PGPASS_FILE"
    chmod 600 "$PGPASS_FILE"
else
    echo "    $PGPASS_FILE already exists — leaving it as-is."
    echo "    (If backups fail to authenticate, delete it and re-run this script.)"
fi

CRON_FILE="/etc/cron.d/cagent-db-backup"
echo "0 2 * * * ${APP_USER} $SCRIPT_DEST" > "$CRON_FILE"
chmod 644 "$CRON_FILE"

echo "==> Running one backup now to prove authentication works..."
if sudo -u "$APP_USER" "$SCRIPT_DEST"; then
    echo "==> Test backup succeeded:"
    ls -lh /opt/cagent/backups | tail -n 3
else
    echo "!! Test backup FAILED — see /var/log/voip-saas/db-backup.log." >&2
    echo "!! Common causes: wrong password in ~/.pgpass, or this VM's IP not in the" >&2
    echo "!! Postgres firewall. The nightly cron will fail the same way until fixed." >&2
    exit 1
fi

echo "==> Installed daily backup cron job: $CRON_FILE (runs 02:00 server time)"
echo "==> Backups land in /opt/cagent/backups/, kept for 7 days"
echo "==> Logs: /var/log/voip-saas/db-backup.log"
echo
echo "==> RESTORE DRILL — test this now, don't wait for an emergency:"
echo "    (create a throwaway DB first)"
echo "    az postgres flexible-server db create --resource-group voip-saas-rg \\"
echo "      --server-name ${PG_HOST%%.*} --database-name ${DB_NAME}_restore_test"
echo "    then, on this VM:"
echo "    gunzip -c /opt/cagent/backups/${DB_NAME}_<timestamp>.sql.gz | \\"
echo "      psql \"sslmode=require host=${PG_HOST} dbname=${DB_NAME}_restore_test user=${DB_USER}\""