#!/usr/bin/env bash
# ==============================================================================
# 00b-provision-postgres.sh
# Run on YOUR LOCAL MACHINE. Creates an Azure Database for PostgreSQL Flexible
# Server, replacing the self-hosted Postgres that 01-system-prerequisites.sh
# used to install on the instance itself (guide.pdf Phase 4 / 15.1).
#
# Because the DB is now managed by Azure, you do NOT install postgresql on
# the VM at all, and you do NOT run the "CREATE USER / CREATE DATABASE" psql
# commands from guide.pdf Phase 4 — this script does both for you.
# ==============================================================================
set -euo pipefail

RESOURCE_GROUP="voip-saas-rg"
LOCATION="polandcentral"
PG_SERVER_NAME="cagent"        # must be globally unique across Azure
PG_ADMIN_USER="cagent_admin"
PG_ADMIN_PASSWORD="786Cagent!"   # edit before running
DB_NAME="cagent"
VM_NAME="cagent"

echo "==> Creating Azure Database for PostgreSQL Flexible Server (Burstable B1ms)"
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
  --public-access 0.0.0.0-255.255.255.255   # tighten to your VM's IP after go-live, see note below

echo "==> Creating the application database"
az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$PG_SERVER_NAME" \
  --database-name "$DB_NAME"

echo "==> Allowing your VM's outbound IP to reach Postgres"
VM_IP=$(az vm show -d --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --query publicIps -o tsv)
az postgres flexible-server firewall-rule create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$PG_SERVER_NAME" \
  --rule-name "allow-app-vm" \
  --start-ip-address "$VM_IP" \
  --end-ip-address "$VM_IP"

FQDN=$(az postgres flexible-server show --resource-group "$RESOURCE_GROUP" --name "$PG_SERVER_NAME" --query fullyQualifiedDomainName -o tsv)

echo "==> Done."
echo "    Host: $FQDN"
echo "    Admin user: $PG_ADMIN_USER"
echo
echo "    NOTE: Azure Flexible Server's admin user CAN create additional roles"
echo "    (unlike old Single Server). To create a least-privilege app role"
echo "    instead of using the admin user directly, connect and run:"
echo
echo "      psql \"host=$FQDN port=5432 dbname=$DB_NAME user=$PG_ADMIN_USER sslmode=require\""
echo "      CREATE USER voip_saas_user WITH PASSWORD 'pick-a-real-password';"
echo "      GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO voip_saas_user;"
echo "      \\c $DB_NAME"
echo "      GRANT ALL ON SCHEMA public TO voip_saas_user;"
echo
echo "    Your production DATABASE_URL (see .env.example changes) is then:"
echo "      postgres://voip_saas_user:pick-a-real-password@$FQDN:5432/$DB_NAME"
echo
echo "    SECURITY NOTE: --public-access above is wide-open for first setup."
echo "    After you confirm connectivity, tighten it:"
echo "      az postgres flexible-server firewall-rule delete --resource-group $RESOURCE_GROUP --name $PG_SERVER_NAME --rule-name AllowAll_2025-1-1_0-0-0"
echo "    (list rules with: az postgres flexible-server firewall-rule list ...)"
