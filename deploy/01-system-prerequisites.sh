#!/usr/bin/env bash
# ==============================================================================
# 01-system-prerequisites.sh (Azure version)
# Run once on the fresh Azure Ubuntu 24.04 VM, AFTER your code has been cloned
# to /opt/cagent (see deploy/README.md step 2). Installs everything the
# Django/Celery/crawl4ai stack needs.
#
# Differences from the Oracle version:
#   - No Postgres SERVER install — the database is Azure Database for
#     PostgreSQL (see 00b-provision-postgres.sh). The psql/pg_dump CLIENT is
#     installed though: backup-db.sh needs pg_dump, and you need psql to
#     create the app role.
#   - No `stress` package and no idle-prevention cron — Azure does not
#     reclaim idle VMs, unlike Oracle's Always Free tier.
#   - No ARM/Ampere shape assumption.
#
# Usage: sudo bash 01-system-prerequisites.sh
# ==============================================================================
set -euo pipefail

echo "==> Updating apt and installing system packages"
apt-get update -y
apt-get install -y \
    python3 python3-venv python3-pip \
    libpq-dev postgresql-client \
    redis-server \
    nginx \
    certbot python3-certbot-nginx \
    git curl unzip \
    build-essential \
    ufw

# --- Application user + directories -----------------------------------------
# These names are referenced by every systemd unit in deploy/systemd/ and by
# 02-nginx-ssl.sh / backup-db.sh — change them everywhere or nowhere.
APP_USER="cagentapp"
APP_DIR="/opt/cagent"
LOG_DIR="/var/log/voip-saas"

if ! id -u "$APP_USER" >/dev/null 2>&1; then
    echo "==> Creating application user: $APP_USER"
    useradd --system --create-home --shell /bin/bash "$APP_USER"
fi

# The log directory MUST exist and be writable by the app user before
# gunicorn/celery first start — their unit files write logs here and fail
# to start if it's missing.
mkdir -p "$APP_DIR" "$LOG_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$LOG_DIR"

# --- Python virtualenv + project dependencies -------------------------------
if [ -d "$APP_DIR/backend" ]; then
    echo "==> Creating virtualenv and installing Python requirements"
    sudo -u "$APP_USER" python3 -m venv "$APP_DIR/venv"
    sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --upgrade pip
    sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

    echo "==> Installing Playwright's Chromium (required by crawl4ai)"
    "$APP_DIR/venv/bin/python" -m playwright install-deps chromium
    sudo -u "$APP_USER" "$APP_DIR/venv/bin/python" -m playwright install chromium
else
    echo "ERROR: $APP_DIR/backend not found — clone your repo to $APP_DIR first" >&2
    echo "       (deploy/README.md step 2), then re-run this script." >&2
    exit 1
fi

# --- Redis: local on this VM (default). Skip if you use Azure Cache for Redis.
echo "==> Enabling and starting local Redis"
systemctl enable --now redis-server

echo "==> Done. Postgres is NOT installed here — it's Azure Database for"
echo "    PostgreSQL (run 00b-provision-postgres.sh from your local machine"
echo "    if you haven't already). Next: create the app DB role (see the end of"
echo "    00b's output), 02-nginx-ssl.sh, then .env, migrate, systemd services."