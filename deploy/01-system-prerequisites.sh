#!/usr/bin/env bash
# ==============================================================================
# 01-system-prerequisites.sh (Azure version)
# Run once on the fresh Azure Ubuntu 24.04 VM. Installs everything the
# Django/Celery/crawl4ai stack needs.
#
# Differences from the Oracle version:
#   - No `postgresql`/`postgresql-contrib`/`libpq-dev` server install, and no
#     CREATE USER/CREATE DATABASE step — Postgres is Azure Database for
#     PostgreSQL (see 00b-provision-postgres.sh), reached over the network.
#     libpq-dev is still needed (psycopg2-binary needs it at build time on
#     some platforms) so it's kept.
#   - No `stress` package and no idle-prevention cron — Azure does not
#     reclaim idle VMs, unlike Oracle's Always Free tier.
#   - No ARM/Ampere shape assumption — this targets a standard x86_64 Azure
#     VM size (e.g. Standard_B2s). If you deployed an Azure ARM VM (Dpsv5/
#     Epsv5) instead, everything here still works unmodified.
#
# Usage: sudo bash 01-system-prerequisites.sh
# ==============================================================================
set -euo pipefail

echo "==> Updating apt and installing system packages"
apt-get update -y
apt-get install -y \
    python3 python3-venv python3-pip \
    libpq-dev \
    redis-server \
    nginx \
    certbot python3-certbot-nginx \
    git curl unzip \
    build-essential \
    ufw

# --- Application user + directories -----------------------------------------
APP_USER="cagentapp"
APP_DIR="/opt/cagent"

if ! id -u "$APP_USER" >/dev/null 2>&1; then
    echo "==> Creating application user: $APP_USER"
    useradd --system --create-home --shell /bin/bash "$APP_USER"
fi

mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# --- Python virtualenv + project dependencies -------------------------------
echo "==> NOTE: this script assumes your backend/ and frontend/ code has
already been deployed to $APP_DIR (git clone or scp it there first)."

if [ -d "$APP_DIR/backend" ]; then
    echo "==> Creating virtualenv and installing Python requirements"
    sudo -u "$APP_USER" python3 -m venv "$APP_DIR/venv"
    sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install --upgrade pip
    sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

    echo "==> Installing Playwright's Chromium (required by crawl4ai)"
    sudo -u "$APP_USER" "$APP_DIR/venv/bin/python" -m playwright install --with-deps chromium
else
    echo "==> $APP_DIR/backend not found yet — skipping venv setup."
    echo "    Deploy your code, then re-run this script, or run the venv"
    echo "    + playwright install commands above manually."
fi

# --- Redis: local on this VM (default). Skip entirely if you provisioned ---
# --- Azure Cache for Redis instead — see deploy-azure/README.md.          ---
echo "==> Enabling and starting local Redis"
systemctl enable --now redis-server

echo "==> Done. Postgres is NOT installed here — it's Azure Database for"
echo "    PostgreSQL (run 00b-provision-postgres.sh from your local machine"
echo "    if you haven't already). Next: run 02-nginx-ssl.sh, then set up"
echo "    the systemd services."
