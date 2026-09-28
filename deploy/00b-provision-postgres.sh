#!/usr/bin/env bash
# ==============================================================================
# 00b-provision-postgres.sh
# Run on YOUR LOCAL MACHINE, AFTER 00-provision-vm.sh (it needs the VM's
# public IP). Creates an Azure Database for PostgreSQL Flexible Server that
# is reachable ONLY from that VM — it is never opened to the whole internet.
#
# The admin password is NOT stored in this file. Pass it in the environment:
#
#   export PG_ADMIN_PASSWORD='a-long-random-password'
#   bash 00b-provision-postgres.sh
#
# Names below must stay in sync with 00-provision-vm.sh (VM_NAME,
# RESOURCE_GROUP), backup-db.sh and install-backup-cron.sh (DB_NAME,
# DB_USER, DB_HOST). Override any of them by exporting the variable first.
# ==============================================================================
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-voip-saas-rg}"
LOCATION="${LOCATION:-polandcentral}"
PG_SERVER_NAME="${PG_SERVER_NAME:-cagent}"        # must be globally unique across Azure
PG_ADMIN_USER="${PG_ADMIN_USER:-cagent_admin}"
DB_NAME="${DB_NAME:-cagent}"
VM_NAME="${VM_NAME:-voip-saas-prod}"              # same default as 00-provision-vm.sh

: "${PG_ADMIN_PASSWORD:?Set PG_ADMIN_PASSWORD in your environment first (do not hardcode it in this file).}"
if [ "${#PG_ADMIN_PASSWORD}" -lt 12 ]; then
  echo "ERROR: PG_ADMIN_PASSWORD must be at least 12 characters." >&2
  exit 1
fi
case "$PG_ADMIN_PASSWORD" in
  *CHANGE_ME*|*password*|*Password*) echo "ERROR: PG_ADMIN_PASSWORD looks like a placeholder." >&2; exit 1 ;;
esac

echo "==> Looking up the VM's public IP ($VM_NAME in $RESOURCE_GROUP)"
VM_IP=$(az vm show -d --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --query publicIps -o tsv)
if [ -z "$VM_IP" ]; then
  echo "ERROR: couldn't find a public IP for VM '$VM_NAME' in '$RESOURCE_GROUP'." >&2
  echo "       Run 00-provision-vm.sh first, or export VM_NAME/RESOURCE_GROUP to match your VM." >&2
  exit 1
fi
echo "    VM public IP: $VM_IP"

echo "==> Creating Azure Database for PostgreSQL Flexible Server (Burstable B1ms)"
echo "    Firewall: ONLY $VM_IP is allowed to connect."
az postgres flexible-server create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PG_SERVER_NAME" \
  --location "$LOCATION" \
  --admin-user "$PG_ADMIN_USER" \
  --admin-password "$PG_ADMIN_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --public-access "$VM_IP" \
  --yes

echo "==> Creating the application database"
az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$PG_SERVER_NAME" \
  --database-name "$DB_NAME"

FQDN=$(az postgres flexible-server show --resource-group "$RESOURCE_GROUP" --name "$PG_SERVER_NAME" --query fullyQualifiedDomainName -o tsv)

echo "==> Firewall rules now on the server (should list only your VM's IP):"
az postgres flexible-server firewall-rule list \
  --resource-group "$RESOURCE_GROUP" --name "$PG_SERVER_NAME" -o table

echo
echo "==> Done."
echo "    Host:       $FQDN"
echo "    Admin user: $PG_ADMIN_USER"
echo "    Database:   $DB_NAME"
echo
echo "    NEXT: create a least-privilege app role. Run this ON THE VM (after"
echo "    01-system-prerequisites.sh has installed the psql client) — the VM is"
echo "    the only machine allowed through the firewall, so it won't work from"
echo "    your laptop:"
echo
echo "      psql \"host=$FQDN port=5432 dbname=$DB_NAME user=$PG_ADMIN_USER sslmode=require\""
echo "      CREATE USER cagent_app WITH PASSWORD 'pick-a-real-password';"
echo "      ALTER DATABASE $DB_NAME OWNER TO cagent_app;"
echo "      GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO cagent_app;"
echo "      \\c $DB_NAME"
echo "      GRANT ALL ON SCHEMA public TO cagent_app;"
echo
echo "    Your production DATABASE_URL is then:"
echo "      postgres://cagent_app:pick-a-real-password@$FQDN:5432/$DB_NAME"
echo "    (if the password has special characters, URL-encode them)"