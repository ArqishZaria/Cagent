#!/usr/bin/env bash
# ==============================================================================
# 01-system-prerequisites.sh
# Run once on a fresh Oracle Cloud "Always Free" ARM (Ampere A1) instance,
# Ubuntu 22.04/24.04. Installs everything the Django/Celery/crawl4ai stack
# needs, then installs Playwright's Chromium for the scraper.
#
# Usage: sudo bash 01-system-prerequisites.sh
# ==============================================================================
set -euo pipefail

echo "==> Updating apt and installing system packages"
apt-get update -y
apt-get install -y \
    python3 python3-venv python3-pip \
    postgresql postgresql-contrib libpq-dev \
    redis-server \
    nginx \
    certbot python3-certbot-nginx \
    git curl unzip \
    build-essential \
    stress \
    ufw

# --- Application user + directories -----------------------------------------
APP_USER="voipapp"
APP_DIR="/opt/voip-saas"

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

# --- PostgreSQL: create DB + user (idempotent) -------------------------------
echo "==> Configuring PostgreSQL (edit the password below before running!)"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='voip_saas_user'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER voip_saas_user WITH PASSWORD 'CHANGE_ME_BEFORE_RUNNING';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='voip_saas'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE voip_saas OWNER voip_saas_user;"

echo "==> Enabling and starting Redis + PostgreSQL"
systemctl enable --now redis-server
systemctl enable --now postgresql

echo "==> Done. Next: run 02-idle-fix.sh, 03-firewall.sh, 04-nginx-ssl.sh, then set up the systemd services."
